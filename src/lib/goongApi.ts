// Wrapper REST Goong (Place / Geocode / Direction) — thay các API Google
// tương ứng. Goong trả JSON gần format Google (`status` + `results`/
// `predictions`/`routes`, `geometry.location.lat|lng`, `overview_polyline`),
// nên phần map sang type nội bộ giữ nguyên cách đọc field như hồi còn Google.
//
// Khác biệt phải tự bù ở đây:
//  1. Goong mô tả địa giới bằng `compound {province, district, commune}` chứ
//     không phải `address_components[]` kiểu Google → tự dựng lại mảng đó để
//     `extractGoogleAddressParts` (lọc ra tỉnh/phường) chạy y như cũ.
//  2. Place AutoComplete KHÔNG kèm toạ độ → muốn chấm lên bản đồ phải gọi
//     thêm Place Detail cho từng gợi ý (xem `googlePlacesSearch.ts`).
import { isRecord } from "../utils/typeGuards";
import { buildGoongUrl } from "./goongConfig";

export type GoongAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

export type GoongLatLng = {
  lat: number;
  lng: number;
};

export type GoongPlaceResult = {
  addressComponents: GoongAddressComponent[];
  formattedAddress: string;
  location: GoongLatLng;
  name: string;
  placeId: string;
  types: string[];
};

export type GoongPrediction = {
  description: string;
  // Goong KHÔNG hứa kèm toạ độ trong autocomplete. Có thì dùng luôn (đỡ một
  // vòng Place Detail), không có thì caller tự gọi Detail — xem
  // `searchPlacesAlongRoute`.
  location: GoongLatLng | null;
  mainText: string;
  placeId: string;
  secondaryText: string;
};

// ── Parser dùng chung ──────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * `compound` của Goong → mảng address_components kiểu Google. Gán đúng bộ
 * `types` mà `extractGoogleAddressParts` đang tìm: tỉnh/thành là
 * administrative_area_level_1, phường/xã là administrative_area_level_3.
 */
function compoundToAddressComponents(value: unknown): GoongAddressComponent[] {
  if (!isRecord(value)) {
    return [];
  }

  const parts: Array<[unknown, string[]]> = [
    [value.commune, ["administrative_area_level_3", "sublocality"]],
    [value.district, ["administrative_area_level_2"]],
    [value.province, ["administrative_area_level_1"]],
  ];

  return parts
    .filter(([name]) => typeof name === "string" && name.trim())
    .map(([name, types]) => ({
      long_name: String(name).trim(),
      short_name: String(name).trim(),
      types,
    }));
}

function toAddressComponents(value: unknown): GoongAddressComponent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((component) => ({
    long_name:
      typeof component.long_name === "string" ? component.long_name : undefined,
    short_name:
      typeof component.short_name === "string"
        ? component.short_name
        : undefined,
    types: toStringArray(component.types),
  }));
}

/**
 * Ưu tiên `compound` — đã probe thật: `address_components` của Goong CHỈ có
 * `long_name`/`short_name`, KHÔNG có `types`, nên `extractGoogleAddressParts`
 * (lọc theo types để lấy tỉnh/phường) đọc vào là ra rỗng. `compound` mới là chỗ
 * duy nhất Goong nói rõ đâu là tỉnh, huyện, phường.
 */
function resolveAddressComponents(value: Record<string, unknown>) {
  const fromCompound = compoundToAddressComponents(value.compound);
  if (fromCompound.length > 0) {
    return fromCompound;
  }

  // Không có compound thì đành lấy mảng thô — mất types nhưng còn hơn rỗng
  return toAddressComponents(value.address_components);
}

// `geometry.location` — Goong trả {lat, lng} dạng số như Google
function toLocation(geometry: unknown): GoongLatLng | null {
  if (!isRecord(geometry) || !isRecord(geometry.location)) {
    return null;
  }

  const { lat, lng } = geometry.location;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return { lat, lng };
}

/** Một phần tử `results[]` → GoongPlaceResult; null nếu thiếu toạ độ. */
function toPlaceResult(value: unknown): GoongPlaceResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const location = toLocation(value.geometry);
  if (!location) {
    return null;
  }

  const formattedAddress = readString(value.formatted_address);
  const name = readString(value.name);

  return {
    addressComponents: resolveAddressComponents(value),
    formattedAddress,
    location,
    // Kết quả geocoding chỉ có địa chỉ — lấy đoạn đầu làm tên
    name: name || formattedAddress.split(",")[0]?.trim() || "",
    placeId: readString(value.place_id),
    types: toStringArray(value.types),
  };
}

/**
 * Số request Goong được phép chạy CÙNG LÚC.
 *
 * Goong chặn bằng `429 OVER_RATE_LIMIT` khi bắn dồn. Gợi ý điểm dừng dọc tuyến
 * là chỗ bắn nhiều nhất: mỗi danh mục quét 12 điểm mẫu rồi gọi Place Detail cho
 * từng gợi ý thiếu toạ độ, hai danh mục ra ~50 request trong một nhịp. Đo thật
 * trên tuyến TP.HCM - Đà Lạt: bắn thẳng thì 14/28 lời gọi Detail bị 429 và bị
 * `.catch()` nuốt im lặng, gợi ý "biến mất" mà không có lỗi nào hiện ra.
 *
 * 4 là mức đo được vừa không dính 429 vừa không kéo dài chờ đợi. Đừng nâng lên
 * mà không đo lại bằng chính tuyến dài.
 */
const maxConcurrentRequests = 4;
/**
 * Số lần thử lại khi dính 429.
 *
 * Trước đây là 3, tức MỖI lời gọi có thể thành 4 request. Gợi ý điểm dừng bắn
 * ~84 lời gọi một nhịp, nên khi đã chạm trần quota thì 84 biến thành 336 —
 * càng 429 càng đổ thêm dầu. Giữ đúng 1 lần thử lại: đủ để vượt qua một nhịp
 * dồn nhất thời, không đủ để nhân quota lên nhiều lần.
 */
const maxRateLimitRetries = 1;
const rateLimitBaseDelayMs = 400;

/**
 * NGẮT MẠCH: 429 liên tiếp tới ngưỡng này thì ngừng bắn hẳn trong
 * `circuitCooldownMs`, thay vì để từng request trong loạt tự thử lại.
 *
 * Khi Goong đã từ chối vì quota, mọi request sau đó gần như chắc chắn cũng bị
 * từ chối — mà request bị 429 VẪN bị tính vào quota ngày. Thà dừng sớm: người
 * dùng thấy gợi ý thiếu (y như hiện tại lúc bị 429), nhưng quota không bị đốt
 * thêm cho những lần từ chối chắc chắn.
 */
const maxConsecutiveRateLimits = 3;
const circuitCooldownMs = 60_000;

let consecutiveRateLimits = 0;
let circuitOpenUntil = 0;

/** Chỉ dùng trong test để reset trạng thái ngắt mạch giữa các case. */
export function __resetGoongCircuitForTest() {
  consecutiveRateLimits = 0;
  circuitOpenUntil = 0;
}

let activeRequests = 0;
const pendingQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < maxConcurrentRequests) {
    activeRequests += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    pendingQueue.push(() => {
      activeRequests += 1;
      resolve();
    });
  });
}

function releaseSlot() {
  activeRequests -= 1;
  pendingQueue.shift()?.();
}

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Goong báo lỗi bằng `{ error: { code, message } }` kèm HTTP 4xx.
 *
 * Mọi lời gọi REST Goong đi qua đây nên hàng đợi + retry đặt ở đúng chỗ này:
 * đặt ở tầng trên thì mỗi tính năng lại phải tự chống 429 một kiểu.
 */
async function fetchGoongJson(url: string): Promise<unknown> {
  // Mạch đang ngắt → hỏng ngay, không tốn thêm một request nào. Caller của mọi
  // luồng Goong đều đã .catch() về rỗng/null nên UI xuống cấp y như lúc 429.
  if (Date.now() < circuitOpenUntil) {
    throw new Error("Goong đang tạm ngừng do vượt giới hạn request.");
  }

  await acquireSlot();
  try {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url);
      if (response.ok) {
        // Có một lời gọi trót lọt = Goong còn phục vụ → đóng mạch lại.
        consecutiveRateLimits = 0;
        return (await response.json()) as unknown;
      }

      if (response.status === 429) {
        consecutiveRateLimits += 1;
        if (consecutiveRateLimits >= maxConsecutiveRateLimits) {
          circuitOpenUntil = Date.now() + circuitCooldownMs;
          throw new Error("Goong đang tạm ngừng do vượt giới hạn request.");
        }
      } else {
        // Lỗi khác (sai key, place_id không tồn tại) không phải chuyện quota
        consecutiveRateLimits = 0;
      }

      // 429 lẻ tẻ là tạm thời — chờ rồi thử lại đúng một lần. Các lỗi khác thử
      // lại chỉ tốn quota nên ném luôn.
      if (response.status !== 429 || attempt >= maxRateLimitRetries) {
        throw new Error(`Goong trả về HTTP ${response.status}.`);
      }

      await delay(rateLimitBaseDelayMs * 2 ** attempt);
    }
  } finally {
    releaseSlot();
  }
}

// ── Place: autocomplete ────────────────────────────────────────────────────

function toPrediction(value: unknown): GoongPrediction | null {
  if (!isRecord(value)) {
    return null;
  }

  const placeId = readString(value.place_id);
  if (!placeId) {
    return null;
  }

  const description = readString(value.description);
  const structured = isRecord(value.structured_formatting)
    ? value.structured_formatting
    : null;
  const mainText =
    (structured && readString(structured.main_text)) ||
    description.split(",")[0]?.trim() ||
    description;
  const secondaryText =
    (structured && readString(structured.secondary_text)) || description;

  return {
    description,
    // Vài bản Goong đính kèm `geometry.location`; đọc cơ hội chứ không bắt buộc
    location: toLocation(value.geometry),
    mainText,
    placeId,
    secondaryText,
  };
}

export type GoongAutocompleteRequest = {
  input: string;
  // Số gợi ý tối đa (Goong mặc định 10)
  limit?: number;
  // Ưu tiên kết quả quanh toạ độ này
  location?: GoongLatLng;
  // Bán kính ưu tiên, đơn vị KILOMÉT (Goong mặc định 50)
  radiusKm?: number;
  // Gom autocomplete + detail vào một phiên tính cước (Goong hỗ trợ thật)
  sessionToken?: string;
};

export async function goongAutocomplete({
  input,
  limit,
  location,
  radiusKm,
  sessionToken,
}: GoongAutocompleteRequest): Promise<GoongPrediction[]> {
  const url = buildGoongUrl("Place/AutoComplete", {
    input,
    limit,
    location: location ? `${location.lat},${location.lng}` : undefined,
    // Kèm tỉnh/huyện/xã để dựng lại address_components khi cần
    more_compound: true,
    radius: radiusKm,
    sessiontoken: sessionToken,
  });
  const payload = await fetchGoongJson(url);

  if (!isRecord(payload) || !Array.isArray(payload.predictions)) {
    return [];
  }

  return payload.predictions
    .map(toPrediction)
    .filter((prediction): prediction is GoongPrediction => prediction !== null);
}

// ── Place: chi tiết địa điểm ───────────────────────────────────────────────

// Goong là dịch vụ thiên về ĐỊA CHỈ, không phải POI thương mại: Place Detail
// không có rating/ảnh/giờ mở cửa/SĐT như Google Places. Vẫn khai các field đó
// (luôn null) để card chi tiết điểm dừng không phải đổi hình dạng dữ liệu —
// nếu Goong bổ sung sau này thì chỉ cần sửa parser ở đây.
export type GoongPlaceDetail = GoongPlaceResult & {
  openNow: boolean | null;
  phone: string | null;
  photoReference: string | null;
  rating: number | null;
  url: string | null;
  userRatingCount: number | null;
  website: string | null;
  weekdayHours: string[];
};

function toPlaceDetail(value: unknown): GoongPlaceDetail | null {
  const base = toPlaceResult(value);
  if (!base || !isRecord(value)) {
    return null;
  }

  const openingHours = isRecord(value.opening_hours)
    ? value.opening_hours
    : null;
  const firstPhoto =
    Array.isArray(value.photos) && isRecord(value.photos[0])
      ? value.photos[0]
      : null;

  return {
    ...base,
    openNow:
      openingHours && typeof openingHours.open_now === "boolean"
        ? openingHours.open_now
        : null,
    phone: readString(value.phone_number) || null,
    photoReference:
      (firstPhoto &&
        (readString(firstPhoto.photo_reference) || readString(firstPhoto.url))) ||
      null,
    rating: typeof value.rating === "number" ? value.rating : null,
    url: readString(value.url) || null,
    userRatingCount:
      typeof value.user_ratings_total === "number"
        ? value.user_ratings_total
        : null,
    website: readString(value.website) || null,
    weekdayHours: openingHours ? toStringArray(openingHours.weekday_text) : [],
  };
}

export async function goongPlaceDetail(
  placeId: string,
  sessionToken?: string,
): Promise<GoongPlaceDetail | null> {
  const url = buildGoongUrl("Place/Detail", {
    place_id: placeId,
    sessiontoken: sessionToken,
  });
  const payload = await fetchGoongJson(url);

  if (!isRecord(payload)) {
    return null;
  }

  // Goong trả `result` (object) — vài endpoint trả `results` (mảng)
  const result = Array.isArray(payload.results)
    ? payload.results[0]
    : payload.result;
  const detail = toPlaceDetail(result);
  // Place Detail không phải lúc nào cũng lặp lại place_id trong `result`
  return detail && !detail.placeId ? { ...detail, placeId } : detail;
}

// ── Geocoding: toạ độ → địa chỉ ────────────────────────────────────────────

export async function goongReverseGeocode(
  location: GoongLatLng,
): Promise<GoongPlaceResult[]> {
  const url = buildGoongUrl("Geocode", {
    latlng: `${location.lat},${location.lng}`,
  });
  const payload = await fetchGoongJson(url);

  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return [];
  }

  return payload.results
    .map(toPlaceResult)
    .filter((place): place is GoongPlaceResult => place !== null);
}

// ── Direction ──────────────────────────────────────────────────────────────

// Loại phương tiện Goong chấp nhận. Xe khách cỡ lớn dùng `truck` (tránh đường
// cấm xe lớn), xe nhỏ dùng `car` — khớp cặp TRUCK/DRIVE hồi Google.
export type GoongVehicle = "car" | "bike" | "taxi" | "truck" | "hd";

export type GoongRoute = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  summary: string;
  /**
   * Số lần lộ trình phải QUAY ĐẦU. Goong gắn `maneuver: "uturn"` cho từng bước
   * kiểu "Quay đầu để vào X" — tín hiệu do chính bộ định tuyến khai báo, chắc
   * hơn mọi cách suy ra từ hình đường. Đo thật: tuyến chính HCM–Đà Lạt có 0,
   * còn phương án tự chế bằng điểm thử lệch thì 3/4 bản có đúng 1.
   */
  uTurnCount?: number;
};

function sumLegMetric(legs: unknown, field: "distance" | "duration") {
  if (!Array.isArray(legs)) {
    return 0;
  }

  return legs.reduce<number>((total, leg) => {
    if (!isRecord(leg) || !isRecord(leg[field])) {
      return total;
    }

    const { value } = leg[field];
    return typeof value === "number" ? total + value : total;
  }, 0);
}

// Đếm bước có maneuver quay đầu trong mọi leg
function countUTurns(legs: unknown) {
  if (!Array.isArray(legs)) {
    return 0;
  }

  return legs.reduce<number>((total, leg) => {
    if (!isRecord(leg) || !Array.isArray(leg.steps)) {
      return total;
    }

    return (
      total +
      leg.steps.filter(
        (step) =>
          isRecord(step) &&
          typeof step.maneuver === "string" &&
          step.maneuver.toLowerCase().includes("uturn"),
      ).length
    );
  }, 0);
}

function toRoute(value: unknown): GoongRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const overview = isRecord(value.overview_polyline)
    ? value.overview_polyline
    : null;
  const encodedPolyline = overview ? readString(overview.points) : "";
  const distanceMeters = sumLegMetric(value.legs, "distance");
  const durationSeconds = sumLegMetric(value.legs, "duration");

  if (!encodedPolyline || distanceMeters <= 0 || durationSeconds <= 0) {
    return null;
  }

  return {
    distanceMeters,
    durationSeconds,
    encodedPolyline,
    summary: readString(value.summary).trim(),
    uTurnCount: countUTurns(value.legs),
  };
}

export type GoongDirectionsRequest = {
  alternatives?: boolean;
  destination: GoongLatLng;
  origin: GoongLatLng;
  vehicle?: GoongVehicle;
  // Điểm trung gian đi theo ĐÚNG THỨ TỰ mảng
  waypoints?: GoongLatLng[];
};

function toCoordinateParam(point: GoongLatLng) {
  return `${point.lat},${point.lng}`;
}

/**
 * Đường đi Goong. Trả mảng phương án đã lọc bản hỏng — mảng rỗng nghĩa là
 * không có lộ trình hợp lệ, caller tự quyết định báo lỗi.
 *
 * Điểm dừng trung gian đi chung tham số `destination`, ngăn bằng dấu `;`
 * (Goong không có tham số `waypoints` riêng): điểm cuối cùng là bến đến, các
 * điểm trước nó là điểm dừng theo thứ tự.
 */
export async function goongDirections({
  alternatives = false,
  destination,
  origin,
  vehicle = "truck",
  waypoints = [],
}: GoongDirectionsRequest): Promise<GoongRoute[]> {
  const url = buildGoongUrl("Direction", {
    alternatives,
    destination: [...waypoints, destination].map(toCoordinateParam).join(";"),
    origin: toCoordinateParam(origin),
    vehicle,
  });
  const payload = await fetchGoongJson(url);

  if (!isRecord(payload) || !Array.isArray(payload.routes)) {
    return [];
  }

  return payload.routes
    .map(toRoute)
    .filter((route): route is GoongRoute => route !== null);
}
