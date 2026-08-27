// Tìm địa điểm dọc theo tuyến + chi tiết địa điểm, chạy trên Place API của
// Goong. Lỗi/thiếu key → trả rỗng im lặng: gợi ý địa điểm là tính năng phụ,
// không được chặn flow soạn tuyến.
//
// Khác biệt so với Google: Places New có hẳn `searchAlongRouteParameters` nhận
// nguyên polyline, Goong thì không có cả nearby lẫn text search. Bù bằng
// Place AutoComplete — endpoint này CÓ `location` + `radius` nên vẫn là "tìm
// theo chữ, quanh một điểm": lấy mẫu vài điểm dọc tuyến rồi hỏi quanh từng
// điểm, và LỌC LẠI theo khoảng cách ở client.
//
// Chỗ tốn kém: AutoComplete của Goong không kèm toạ độ, mà không có toạ độ thì
// không chấm lên bản đồ được. Nên gợi ý nào thiếu toạ độ phải gọi thêm Place
// Detail — có trần `maxDetailLookups` để một tuyến không thổi bay quota.
import {
  goongAutocomplete,
  goongPlaceDetail,
  type GoongLatLng,
  type GoongPlaceDetail,
} from "./goongApi";
import { getGoongApiKey } from "./goongConfig";
import { decodeGooglePolyline } from "./googlePolyline";

// Số điểm lấy mẫu dọc tuyến. Google có searchAlongRoute nhận nguyên polyline,
// ở đây phải tự rải điểm nên thưa quá là mất hẳn gợi ý ở khúc giữa: tuyến liên
// tỉnh ~300km với 5 điểm là mỗi điểm gánh 60km. 12 điểm cho mật độ dùng được mà
// vẫn nhanh (~1s, chạy song song) và đã cache theo tuyến ở
// `useRouteStopSuggestions` nên chỉ tốn một lần cho mỗi tuyến mỗi phiên.
const routeSampleCount = 12;
// Số gợi ý xin mỗi điểm mẫu (Goong mặc định 10). Nhiều điểm mẫu rồi thì mỗi
// điểm không cần lấy sâu — trùng nhau sẽ bị dedupe theo place_id.
const perAnchorLimit = 4;
// Bán kính ƯU TIÊN gửi cho Goong quanh mỗi điểm mẫu, đơn vị KM. Đã probe thật:
// tham số này có tác dụng (đổi điểm mẫu là đổi hẳn kết quả), nhưng nó chỉ là
// gợi ý xếp hạng — Goong vẫn trả về chỗ nằm xa hơn thế.
const searchRadiusKm = 8;
// Chặn vệ sinh: bỏ gợi ý xa điểm mẫu một cách vô lý (tỉnh khác hẳn). KHÔNG siết
// về đúng `searchRadiusKm`: bộ lọc địa lý THẬT là "cách tuyến <= 1km" ở
// `useRouteStopSuggestions`, siết theo khoảng cách tới ĐIỂM MẪU sẽ cắt nhầm
// hàng loạt chỗ nằm hợp lệ giữa hai điểm mẫu.
const sanityRadiusKm = 50;
// Trần số lần gọi Place Detail để lấy toạ độ cho một từ khoá trên một tuyến
const maxDetailLookups = 30;

/**
 * Từ khoá dùng làm gợi ý điểm dừng. Goong tìm theo CHỮ (không có bộ lọc type
 * như Google Places), nên đây là chuỗi tiếng Việt đưa thẳng vào `input`.
 */
export type StopPlaceCategory = {
  id: string;
  keyword: string;
};

export const stopPlaceCategories: StopPlaceCategory[] = [
  { id: "busStation", keyword: "bến xe" },
  { id: "restStop", keyword: "trạm dừng chân" },
];

export type PlaceAlongRoute = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
};

/**
 * Cache Place Detail THÔ theo `place_id`, dùng chung cho MỌI người gọi.
 *
 * Trước đây `searchPlacesAlongRoute` gọi thẳng `goongPlaceDetail`, bỏ qua cache
 * của `getPlaceDetails` ngay trong file này — nên cùng một "Bến xe Miền Đông"
 * bị hỏi lại từ đầu cho từng tuyến đi ngang qua nó. Các tuyến của một nhà xe
 * trùng bến rất nhiều, đây là phần lãng phí lớn nhất mà người dùng không hề
 * thấy.
 *
 * Cache PROMISE chứ không cache kết quả: hai lời gọi cùng place_id chạy song
 * song (chuyện thường trong một loạt quét) sẽ dùng chung đúng một request thay
 * vì bắn hai. Promise hỏng thì gỡ khỏi cache để lần sau còn thử lại được —
 * giữ lại một promise reject là biến lỗi mạng nhất thời thành lỗi vĩnh viễn.
 */
const rawPlaceDetailCache = new Map<
  string,
  Promise<GoongPlaceDetail | null>
>();

function cachedPlaceDetail(
  placeId: string,
): Promise<GoongPlaceDetail | null> {
  const cached = rawPlaceDetailCache.get(placeId);
  if (cached) {
    return cached;
  }

  const pending = goongPlaceDetail(placeId).catch((error: unknown) => {
    rawPlaceDetailCache.delete(placeId);
    throw error;
  });
  rawPlaceDetailCache.set(placeId, pending);
  return pending;
}

const earthRadiusMeters = 6_371_000;

function distanceMetersBetween(first: GoongLatLng, second: GoongLatLng) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDistance = toRadians(second.lat - first.lat);
  const lngDistance = toRadians(second.lng - first.lng);
  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(lngDistance / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

// Lấy mẫu đều tối đa `count` điểm, luôn giữ điểm đầu và điểm cuối
function samplePoints<T>(points: T[], count: number): T[] {
  if (points.length <= count || count < 2) {
    return points;
  }

  const step = (points.length - 1) / (count - 1);
  return Array.from(
    { length: count },
    (_unused, index) => points[Math.round(index * step)],
  );
}

// Gợi ý đã gom đủ dữ liệu để chấm lên bản đồ
type ResolvedSuggestion = {
  address: string;
  location: GoongLatLng;
  name: string;
  placeId: string;
  types: string[];
};

export async function searchPlacesAlongRoute(
  encodedPolyline: string,
  category: StopPlaceCategory,
): Promise<PlaceAlongRoute[]> {
  if (!getGoongApiKey() || !encodedPolyline) {
    return [];
  }

  const path = decodeGooglePolyline(encodedPolyline);
  if (path.length === 0) {
    return [];
  }

  const anchors = samplePoints(path, routeSampleCount);

  try {
    const predictionsPerAnchor = await Promise.all(
      anchors.map((anchor) =>
        goongAutocomplete({
          input: category.keyword,
          limit: perAnchorLimit,
          location: anchor,
          radiusKm: searchRadiusKm,
        }).catch(() => []),
      ),
    );

    // Gộp + dedupe theo place_id, đồng thời nhớ điểm mẫu gần nhất đã sinh ra nó
    // để còn đối chiếu khoảng cách sau khi có toạ độ thật.
    const seen = new Map<
      string,
      { anchor: GoongLatLng; prediction: (typeof predictionsPerAnchor)[0][0] }
    >();
    predictionsPerAnchor.forEach((predictions, index) => {
      predictions.forEach((prediction) => {
        if (!seen.has(prediction.placeId)) {
          seen.set(prediction.placeId, {
            anchor: anchors[index],
            prediction,
          });
        }
      });
    });

    const entries = [...seen.values()];
    const withLocation: ResolvedSuggestion[] = [];
    const needDetail: typeof entries = [];

    entries.forEach((entry) => {
      const { prediction } = entry;
      if (prediction.location) {
        withLocation.push({
          address: prediction.description,
          location: prediction.location,
          name: prediction.mainText,
          placeId: prediction.placeId,
          types: [],
        });
        return;
      }
      needDetail.push(entry);
    });

    // Chỉ những gợi ý thiếu toạ độ mới phải gọi Place Detail, và có trần
    const details = await Promise.all(
      needDetail.slice(0, maxDetailLookups).map(async (entry) => {
        const detail = await cachedPlaceDetail(entry.prediction.placeId).catch(
          () => null,
        );
        if (!detail) {
          return null;
        }

        return {
          address: detail.formattedAddress || entry.prediction.description,
          location: detail.location,
          name: detail.name || entry.prediction.mainText,
          placeId: entry.prediction.placeId,
          types: detail.types,
        } satisfies ResolvedSuggestion;
      }),
    );

    const resolved = [
      ...withLocation,
      ...details.filter((item): item is ResolvedSuggestion => item !== null),
    ];

    const radiusMeters = sanityRadiusKm * 1_000;
    const anchorOf = new Map(
      entries.map((entry) => [entry.prediction.placeId, entry.anchor]),
    );

    return resolved
      .filter((item) => {
        const anchor = anchorOf.get(item.placeId);
        return (
          !anchor || distanceMetersBetween(anchor, item.location) <= radiusMeters
        );
      })
      .map((item) => ({
        placeId: item.placeId,
        name: item.name,
        address: item.address,
        latitude: item.location.lat,
        longitude: item.location.lng,
        types: item.types,
      }));
  } catch {
    return [];
  }
}

// Chi tiết 1 địa điểm — dùng để dựng card khi bấm chấm gợi ý.
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number | null;
  phone: string | null;
  primaryTypeLabel: string | null;
  openNow: boolean | null;
  weekdayHours: string[];
  photoName: string | null;
  googleMapsUri: string | null;
};

// Cache module-level theo placeId — mỗi placeId chỉ gọi Place Detail MỘT LẦN
// mỗi phiên (giống pattern placesCache trong useRouteStopSuggestions).
const placeDetailsCache = new Map<string, PlaceDetails | null>();

// Chỉ dùng trong test để reset cache giữa các case — không export ra ngoài module hook.
export function __clearPlaceDetailsCacheForTest() {
  placeDetailsCache.clear();
  rawPlaceDetailCache.clear();
}

/**
 * Chi tiết 1 địa điểm. Goong là dịch vụ thiên về ĐỊA CHỈ nên phần lớn field
 * "kiểu Google Places" (rating/ảnh/giờ mở cửa/SĐT) sẽ là null — card tự ẩn các
 * dòng đó. Lỗi/thiếu key → null im lặng, cache theo placeId để không gọi lại
 * API khi mở/đóng popup nhiều lần cùng một địa điểm.
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  if (placeDetailsCache.has(placeId)) {
    return placeDetailsCache.get(placeId) ?? null;
  }

  if (!getGoongApiKey() || !placeId) {
    return null;
  }

  try {
    const detail = await cachedPlaceDetail(placeId);
    if (!detail) {
      placeDetailsCache.set(placeId, null);
      return null;
    }

    const details: PlaceDetails = {
      placeId: detail.placeId || placeId,
      name: detail.name,
      address: detail.formattedAddress,
      rating: detail.rating,
      userRatingCount: detail.userRatingCount,
      phone: detail.phone,
      // Goong trả `types` dạng mã kỹ thuật, không có nhãn đã dịch như
      // `primaryTypeDisplayName` của Google → thà bỏ trống còn hơn hiện chuỗi
      // tiếng Anh gạch dưới giữa card tiếng Việt.
      primaryTypeLabel: null,
      openNow: detail.openNow,
      weekdayHours: detail.weekdayHours,
      photoName: detail.photoReference,
      googleMapsUri: detail.url,
    };
    placeDetailsCache.set(placeId, details);
    return details;
  } catch {
    placeDetailsCache.set(placeId, null);
    return null;
  }
}

/**
 * URL ảnh địa điểm từ `photoName` trả về ở getPlaceDetails. Goong KHÔNG có
 * Place Photo API (Google có `maxWidthPx`, đây thì không), nên chỉ dùng được
 * khi bản thân giá trị đã là URL tuyệt đối — còn lại trả null để card ẩn hẳn
 * khung ảnh thay vì render `img` hỏng.
 */
export function buildPlacePhotoUrl(photoName: string): string | null {
  if (!getGoongApiKey() || !photoName) {
    return null;
  }

  return /^https?:\/\//i.test(photoName) ? photoName : null;
}
