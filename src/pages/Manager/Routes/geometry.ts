// Helper hình học + gọi Google Routes API cho màn Routes
import { isRecord } from "../../../utils/typeGuards";
import {
  decodeGooglePolyline,
  parseGoogleDurationSeconds,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";

const googleRoutesEndpoint =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKmBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(second.latitude - first.latitude);
  const lonDistance = toRadians(second.longitude - first.longitude);
  const firstLat = toRadians(first.latitude);
  const secondLat = toRadians(second.latitude);
  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDistance / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function calculatePathDistance(points: RouteCoordinate[]) {
  return points.slice(1).reduce(
    (total, point, index) => total + distanceKmBetween(points[index], point),
    0,
  );
}

// Phải khớp với RouteGeometryValidator.MaximumWaypointDistanceMeters ở BE.
export const maximumRouteWaypointDistanceKm = 0.5;

export type RouteGeometryWaypoint = RouteCoordinate & {
  id?: string;
  name?: string;
};

export function findRouteGeometryWaypointMismatches(
  path: RouteCoordinate[],
  waypoints: RouteGeometryWaypoint[],
) {
  if (path.length < 2) {
    return [];
  }

  return waypoints
    .map((waypoint) => ({
      waypoint,
      distanceToPathKm: projectPointOntoPolyline(path, waypoint).distanceToPathKm,
    }))
    .filter(({ distanceToPathKm }) => distanceToPathKm > maximumRouteWaypointDistanceKm);
}

// Một phương án đường Google trả về — points đã decode, số liệu đã quy đổi km/phút
export type RoadRouteOption = {
  points: RouteCoordinate[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  // Mô tả localized của Google (vd "qua QL20") — có thể vắng
  description?: string;
};

// Tối đa số phương án hiển thị cho user chọn (Google thường trả 1-3)
const maxRouteOptions = 3;

// Parse một phần tử routes[] của computeRoutes → RoadRouteOption; null nếu thiếu field
function parseRouteOption(route: unknown): RoadRouteOption | null {
  if (
    !isRecord(route) ||
    typeof route.distanceMeters !== "number" ||
    typeof route.duration !== "string"
  ) {
    return null;
  }

  const polyline = route.polyline;
  if (!isRecord(polyline) || typeof polyline.encodedPolyline !== "string") {
    return null;
  }

  const durationSeconds = parseGoogleDurationSeconds(route.duration);
  if (durationSeconds <= 0) {
    return null;
  }

  return {
    points: decodeGooglePolyline(polyline.encodedPolyline),
    totalDistanceKm: Number((route.distanceMeters / 1000).toFixed(1)),
    estimatedDurationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    description:
      typeof route.description === "string" && route.description.trim()
        ? route.description.trim()
        : undefined,
  };
}

// Loại phương tiện để Google tính đường: TRUCK (xe khách lớn — mặc định, tránh
// đường cấm/hạn chế xe lớn) hoặc DRIVE (xe nhỏ <16 chỗ). Đã probe thật: Routes API
// chấp nhận travelMode "TRUCK" nhưng KHÔNG nhận truckOptions/dimensions — đừng thêm.
export type RouteTravelMode = "DRIVE" | "TRUCK";

// Tùy chọn bổ sung khi tính đường
export type RoadGeometryOptions = {
  // Điểm nắn lộ trình do user kéo/click trên bản đồ — gửi dạng waypoint `via: true`
  // (đi ngang qua, không tính là điểm dừng) như hành vi kéo đường của Google Maps
  intermediates?: RouteCoordinate[];
  // Mặc định TRUCK — app nhà xe khách, xe lớn là chuẩn
  travelMode?: RouteTravelMode;
};

// Ngưỡng coi lộ trình TRUCK "đi vòng đáng kể" so với DRIVE cùng cặp điểm —
// vượt một trong hai là hiện cảnh báo đường hạn chế xe lớn
const truckDetourKmRatio = 1.1;
const truckDetourExtraMinutes = 10;

// Phương án tốt nhất của một mode = thời lượng ngắn nhất (đề xuất chính của Google
// thường đứng đầu nhưng không đảm bảo — tự chọn min cho chắc)
export function bestRouteOption(options: RoadRouteOption[]): RoadRouteOption {
  return options.reduce((best, option) =>
    option.estimatedDurationMinutes < best.estimatedDurationMinutes
      ? option
      : best,
  );
}

// TRUCK dài hơn đáng kể DRIVE (>10% km hoặc >10 phút, so phương án tốt nhất mỗi
// mode) → đường ngắn nhất có đoạn hạn chế xe lớn, lộ trình đã phải đi vòng
export function isTruckDetour(
  truckOptions: RoadRouteOption[],
  driveOptions: RoadRouteOption[],
): boolean {
  if (truckOptions.length === 0 || driveOptions.length === 0) {
    return false;
  }

  const truck = bestRouteOption(truckOptions);
  const drive = bestRouteOption(driveOptions);

  return (
    truck.totalDistanceKm > drive.totalDistanceKm * truckDetourKmRatio ||
    truck.estimatedDurationMinutes >
      drive.estimatedDurationMinutes + truckDetourExtraMinutes
  );
}

// Ngưỡng coi 2 phương án là "gần trùng" (Google đôi khi trả 2 đường lệch không
// đáng kể): lệch km dưới 1% và cùng số phút → bỏ bản đứng sau, đỡ chồng bubble
const duplicateOptionKmRatio = 0.01;

// Lọc phương án gần trùng — giữ bản đứng trước (đề xuất chính của Google)
export function dedupeRouteOptions(
  options: RoadRouteOption[],
): RoadRouteOption[] {
  return options.filter(
    (option, index) =>
      !options
        .slice(0, index)
        .some(
          (previous) =>
            Math.abs(option.totalDistanceKm - previous.totalDistanceKm) <
              previous.totalDistanceKm * duplicateOptionKmRatio &&
            option.estimatedDurationMinutes ===
              previous.estimatedDurationMinutes,
        ),
  );
}

// Ngưỡng coi một phương án "trùng ~" một đường có sẵn (vd polyline đã lưu):
// tổng km lệch dưới 1.5% VÀ trung điểm 2 đường cách nhau dưới 2km
const matchingPathKmRatio = 0.015;
const matchingPathMidpointKm = 2;

// Tìm index phương án trùng ~ đường path (polyline đã lưu / đang áp) — -1 nếu không có
export function findMatchingRouteOption(
  options: RoadRouteOption[],
  path: RouteCoordinate[],
): number {
  if (path.length < 2) {
    return -1;
  }

  const pathKm = calculatePathDistance(path);
  const pathMidpoint = path[Math.floor(path.length / 2)];

  return options.findIndex((option) => {
    if (option.points.length < 2) {
      return false;
    }

    const optionKm = calculatePathDistance(option.points);
    const optionMidpoint = option.points[Math.floor(option.points.length / 2)];

    return (
      Math.abs(optionKm - pathKm) / Math.max(pathKm, 0.1) <
        matchingPathKmRatio &&
      distanceKmBetween(pathMidpoint, optionMidpoint) < matchingPathMidpointKm
    );
  });
}

// Lọc BỎ các phương án trùng ~ đường `path` — dùng khi soạn tuyến thay thế:
// phương án Google trùng tuyến chính đang hiện hành thì không phải "thay thế".
// Cùng ngưỡng với findMatchingRouteOption; path chưa đủ 2 điểm → giữ nguyên.
export function excludeMatchingRouteOptions(
  options: RoadRouteOption[],
  path: RouteCoordinate[],
): RoadRouteOption[] {
  if (path.length < 2) {
    return options;
  }

  return options.filter(
    (option) => findMatchingRouteOption([option], path) === -1,
  );
}

// ── Neo nhãn thời lượng của phương án chưa chọn ───────────────────────────
// Các phương án Google trả về thường TRÙNG tuyến đang chọn gần hết chiều dài,
// chỉ tách ra một đoạn. Đặt bubble theo tỉ lệ chiều dài (40%/55%/70%) thì rơi
// đúng đoạn trùng → nhìn như đang gắn nhãn cho tuyến chính. Thay vào đó lấy
// điểm TÁCH XA tuyến đang chọn nhất của chính phương án đó làm neo.

// Số điểm lấy mẫu khi quét phương án (polyline HIGH_QUALITY vài nghìn điểm)
const labelAnchorSampleCount = 80;
// Số điểm lấy mẫu của đường tham chiếu khi đo khoảng cách
const labelAnchorReferenceSampleCount = 400;
// Bỏ 12% đầu/cuối: hai đầu luôn trùng bến đi/bến đến của mọi phương án
const labelAnchorEdgeSkipRatio = 0.12;
// Dưới ngưỡng này coi như phương án không tách khỏi tuyến đang chọn → không có
// chỗ nào "của riêng nó" để gắn nhãn, nơi gọi tự lùi về vị trí theo tỉ lệ
const labelAnchorMinDivergenceKm = 0.25;
// Hai bubble gần nhau dưới ngưỡng này coi như chồng chỗ — thử điểm tách khác
const labelAnchorSeparationKm = 12;

// Lấy mẫu đều tối đa maxCount điểm (giữ nguyên điểm đầu/cuối)
function samplePath(points: RouteCoordinate[], maxCount: number) {
  if (points.length <= maxCount || maxCount < 2) {
    return points;
  }

  const step = (points.length - 1) / (maxCount - 1);

  return Array.from(
    { length: maxCount },
    (_unused, index) => points[Math.round(index * step)],
  );
}

// Điểm trên `optionPoints` tách xa `referencePoints` nhất — null khi hai đường
// gần như trùng nhau hoặc thiếu dữ liệu. `takenAnchors` là các neo đã cấp cho
// phương án trước: ưu tiên điểm tách đủ xa chúng để 2 bubble không đè nhau.
export function findRouteLabelAnchor(
  optionPoints: RouteCoordinate[],
  referencePoints: RouteCoordinate[],
  takenAnchors: RouteCoordinate[] = [],
): RouteCoordinate | null {
  if (optionPoints.length === 0 || referencePoints.length < 2) {
    return null;
  }

  const reference = samplePath(
    referencePoints,
    labelAnchorReferenceSampleCount,
  );
  const skip = Math.floor(optionPoints.length * labelAnchorEdgeSkipRatio);
  const inner = optionPoints.slice(skip, optionPoints.length - skip);
  const candidates = samplePath(
    inner.length > 0 ? inner : optionPoints,
    labelAnchorSampleCount,
  )
    .map((point) => ({
      point,
      distanceKm: projectPointOntoPolyline(reference, point).distanceToPathKm,
    }))
    .filter(({ distanceKm }) => Number.isFinite(distanceKm))
    .sort((first, second) => second.distanceKm - first.distanceKm);

  if (
    candidates.length === 0 ||
    candidates[0].distanceKm < labelAnchorMinDivergenceKm
  ) {
    return null;
  }

  // Điểm tách xa nhất mà không đụng bubble đã đặt; không có thì đành lấy xa nhất
  const free = candidates.find(({ point }) =>
    takenAnchors.every(
      (anchor) =>
        distanceKmBetween(anchor, point) >= labelAnchorSeparationKm,
    ),
  );

  return (free ?? candidates[0]).point;
}

// Gọi Google Routes computeRoutes với computeAlternativeRoutes → trả MẢNG phương án
// (tối đa 3, phần tử đầu là đề xuất chính của Google). Luôn có ít nhất 1 phần tử,
// ngược lại throw errorMessage. Có opts.intermediates thì Google chỉ trả 1 phương án.
export async function requestRoadGeometry(
  points: RouteCoordinate[],
  errorMessage: string,
  opts?: RoadGeometryOptions,
): Promise<RoadRouteOption[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(errorMessage);
  }

  const toWaypoint = (point: RouteCoordinate) => ({
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude,
      },
    },
  });
  const response = await fetch(googleRoutesEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.routeLabels",
    },
    body: JSON.stringify({
      origin: toWaypoint(points[0]),
      destination: toWaypoint(points[points.length - 1]),
      // Điểm dừng của tuyến là waypoint thường; điểm nắn lộ trình gắn via:true
      // (thứ tự: sau các điểm dừng — flow nắn đường thực tế chỉ dùng khi tuyến
      // chưa có điểm dừng, vì có điểm dừng thì Google không trả alternative)
      intermediates: [
        ...points.slice(1, -1).map(toWaypoint),
        ...(opts?.intermediates ?? []).map((point) => ({
          ...toWaypoint(point),
          via: true,
        })),
      ],
      travelMode: opts?.travelMode ?? "TRUCK",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      // Google chỉ trả alternative khi KHÔNG có intermediates — có điểm dừng
      // trung gian thì vẫn nhận về đúng 1 phương án, UI tự ẩn dãy chip
      computeAlternativeRoutes: true,
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      languageCode: "vi",
      units: "METRIC",
    }),
  });
  const body: unknown = await response.json();

  if (!response.ok || !isRecord(body) || !Array.isArray(body.routes)) {
    throw new Error(errorMessage);
  }

  const options = body.routes
    .map(parseRouteOption)
    .filter((option): option is RoadRouteOption => option !== null)
    .slice(0, maxRouteOptions);

  if (options.length === 0) {
    throw new Error(errorMessage);
  }

  return options;
}
