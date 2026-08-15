import type {
  FleetLatestItem,
  OperatorTripListItem,
  TripRouteGeometry,
  TripRouteGeometryPoint,
} from "../../../api/vietride";
import {
  getFleetStatus,
  type FleetStatus,
  type FleetVehicleMapPoint,
  type TripRouteMarker,
  type TripRouteMarkerKind,
} from "../../../components/fleetMapPoint";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import { decodeGooglePolyline } from "../../../lib/googlePolyline";
import { isRecord } from "../../../utils/typeGuards";

export { decodeGooglePolyline, getFleetStatus };
export type { FleetStatus, TripRouteMarker, TripRouteMarkerKind };

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error";

/**
 * Kết quả tải lộ trình tuyến của chuyến đang mở. Trước đây chỉ có geometry hoặc
 * null nên khi BE không trả về lộ trình, bản đồ lặng lẽ không vẽ gì và người
 * dùng không phân biệt được "chưa tải xong" với "tuyến này không có dữ liệu".
 */
// "estimated" = tuyến chưa lưu polyline nên đường trên bản đồ do client tự tính
// lại theo đường bộ qua bến/điểm dừng (Google Routes) — vẫn là đường thật, nhưng
// không phải lộ trình đã duyệt nên phải nói rõ cho điều độ viên.
export type RouteGeometryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "estimated"
  | "empty"
  | "error";

/** Trạng thái chuyến (BE) báo hiệu sự cố đang diễn ra */
export const DISRUPTED_TRIP_STATUS = "DISRUPTED";

// Chuyến sự cố phải đè lên trạng thái suy ra từ tốc độ: một chuyến DISRUPTED
// vẫn đang lăn bánh trước đây hiện y hệt xe bình thường (chấm xanh "Đang chạy"),
// khiến sự cố chìm nghỉm giữa đội xe.
export function resolveFleetStatus(
  tripStatus: string | undefined,
  location: { speedKmh?: number | null } | null,
): FleetStatus {
  if (tripStatus === DISRUPTED_TRIP_STATUS) return "disrupted";
  return location ? getFleetStatus(location) : "lost";
}

// Gộp hai lượt tải theo status (IN_PROGRESS + DISRUPTED) thành một danh sách.
// Giữ bản ghi xuất hiện trước — caller xếp nhánh sự cố lên đầu — và loại trùng
// theo tripId để một chuyến đổi trạng thái giữa hai request không thành hai xe.
export function mergeTripsById<T extends { tripId: string }>(
  ...groups: T[][]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.tripId)) continue;
      seen.add(item.tripId);
      merged.push(item);
    }
  }
  return merged;
}

// Merge trips (metadata/crew) với fleet-latest (vị trí batch) theo tripId.
// Chuyến có trong trips nhưng không có trong items = mất tín hiệu GPS (TTL 300s)
// — vẫn giữ trong danh sách với status "lost", không có toạ độ nên không có marker.
export function buildFleetVehicles(
  trips: OperatorTripListItem[],
  items: FleetLatestItem[],
  unassignedDriverLabel: string,
): FleetVehicleMapPoint[] {
  const byTripId = new Map(items.map((item) => [item.tripId, item]));
  return trips.map((trip) => {
    const location = byTripId.get(trip.tripId) ?? null;
    return {
      id: trip.tripId,
      plate: trip.vehicle.licensePlate,
      driver: trip.driver?.displayName ?? unassignedDriverLabel,
      route:
        trip.route.name ||
        `${trip.route.originName} - ${trip.route.destinationName}`,
      speedKmh: location?.speedKmh ?? null,
      status: resolveFleetStatus(trip.status, location),
      position: location
        ? { lat: location.latitude, lng: location.longitude }
        : null,
      // Lượt tải đầu chưa có điểm trước để suy hướng — chỉ dùng được hướng do
      // thiết bị gửi. Các điểm GPS sau đó sẽ tự suy ra trong applyFleetGpsUpdate.
      headingDeg: location?.headingDeg ?? null,
    } satisfies FleetVehicleMapPoint;
  });
}

// Áp một điểm GPS mới (socket event hoặc item từ poll fallback) vào danh sách xe.
// Chỉ cập nhật chuyến đã có trong list — event của chuyến lạ bỏ qua (chờ refresh).
export function applyFleetGpsUpdate(
  current: FleetVehicleMapPoint[],
  event: FleetLatestItem,
): FleetVehicleMapPoint[] {
  return current.map((vehicle) => {
    if (vehicle.id !== event.tripId) return vehicle;

    const nextPosition = { lat: event.latitude, lng: event.longitude };
    return {
      ...vehicle,
      position: nextPosition,
      speedKmh: event.speedKmh ?? null,
      status: resolveFleetStatus(event.status, event),
      // Thiết bị không gửi hướng thì suy từ đoạn vừa đi. Giữ hướng cũ khi xe
      // gần như đứng yên — nếu không marker sẽ quay loạn theo nhiễu GPS.
      headingDeg:
        resolveVehicleHeading(event.headingDeg, [
          { latitude: event.latitude, longitude: event.longitude },
          ...(vehicle.position
            ? [
                {
                  latitude: vehicle.position.lat,
                  longitude: vehicle.position.lng,
                },
              ]
            : []),
        ]) ?? vehicle.headingDeg ?? null,
    };
  });
}

function orderedPoints(points: TripRouteGeometryPoint[]): GoogleMapCoordinate[] {
  return [...points]
    .sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0))
    .map((point) => ({ lat: point.latitude, lng: point.longitude }));
}

/**
 * Polyline THẬT của tuyến (bám đường bộ) từ response route-geometry.
 *
 * Contract hiện hành trả polyline trong `geometry.points` và `geometry: null`
 * khi tuyến chưa lưu đường; trước đây hàm này chỉ đọc shape phẳng cũ nên bản đồ
 * Trung tâm vận hành không bao giờ vẽ được lộ trình. Các nhánh phía sau giữ lại
 * shape cũ để không vỡ trong lúc BE rolling deploy.
 */
export function routeGeometryPath(
  geometry: TripRouteGeometry | null,
): GoogleMapCoordinate[] {
  if (!geometry) return [];

  // Fallback STOPS_ONLY của BE: `points` lúc đó chỉ là toạ độ các điểm dừng
  // (không có cả bến đi/bến đến), nối lại là đúng tuyến giả chim bay mà contract
  // cấm client tự vẽ. Trả rỗng để màn dựng lại đường bộ qua Google Routes
  // (useTripRoadRoute) và panel nói rõ đó là đường ước lượng.
  if (geometry.geometrySource === "STOPS_ONLY") return [];

  if (geometry.geometry?.points?.length) {
    return orderedPoints(geometry.geometry.points);
  }

  if (geometry.points?.length) {
    return orderedPoints(geometry.points);
  }

  const geoJson = geometry.geoJson;
  const source = isRecord(geoJson) && isRecord(geoJson.geometry) ? geoJson.geometry : geoJson;
  if (isRecord(source) && source.type === "LineString" && Array.isArray(source.coordinates)) {
    return source.coordinates.flatMap((point): GoogleMapCoordinate[] => {
      if (!Array.isArray(point) || point.length < 2) return [];
      const [longitude, latitude] = point;
      if (typeof longitude !== "number" || typeof latitude !== "number") return [];
      return [{ lat: latitude, lng: longitude }];
    });
  }

  return geometry.encodedPolyline ? decodeGooglePolyline(geometry.encodedPolyline) : [];
}

/**
 * Chuỗi điểm của tuyến theo đúng thứ tự chạy: bến đi → các điểm dừng (theo
 * sequence) → bến đến. Vừa là marker trên bản đồ, vừa là waypoint để tính lại
 * đường bộ khi tuyến chưa lưu polyline.
 */
export function routeStopMarkers(
  geometry: TripRouteGeometry | null,
): TripRouteMarker[] {
  if (!geometry) return [];

  const markers: TripRouteMarker[] = [];
  const origin = geometry.originStation;
  if (origin) {
    markers.push({
      id: `origin-${origin.stationId}`,
      kind: "origin",
      name: origin.name,
      position: { lat: origin.latitude, lng: origin.longitude },
    });
  }

  [...(geometry.intermediateStops ?? [])]
    .sort((left, right) => left.sequence - right.sequence)
    .forEach((stop, index) => {
      markers.push({
        id: `stop-${stop.stopId}`,
        kind: "stop",
        name: stop.name,
        // Đánh số lại 1..N theo thứ tự chạy — `sequence` của BE có thể thưa
        orderIndex: index + 1,
        position: { lat: stop.latitude, lng: stop.longitude },
      });
    });

  const destination = geometry.destinationStation;
  if (destination) {
    markers.push({
      id: `destination-${destination.stationId}`,
      kind: "destination",
      name: destination.name,
      position: { lat: destination.latitude, lng: destination.longitude },
    });
  }

  return markers;
}

// Xe lệch quá xa lộ trình thì việc "chiếu" lên tuyến không còn ý nghĩa (đi sai
// đường, GPS nhiễu, hoặc lộ trình đã đổi) — khi đó thà không tô đoạn đã đi còn
// hơn vẽ một điểm cắt bịa ra.
const OFF_ROUTE_THRESHOLD_METERS = 500;
const METERS_PER_LAT_DEGREE = 111_320;

export type RouteProgress = {
  /** Đoạn tuyến xe đã đi qua, kết thúc tại vị trí chiếu của xe. */
  traveled: GoogleMapCoordinate[];
  /** Đoạn tuyến còn lại, bắt đầu từ vị trí chiếu của xe. */
  remaining: GoogleMapCoordinate[];
};

// Chiếu điểm lên đoạn thẳng AB. Ở phạm vi một tuyến xe khách, phép chiếu phẳng
// với kinh độ co theo cos(vĩ độ) là đủ chính xác và rẻ hơn nhiều so với tính
// trắc địa thật.
function projectOnSegment(
  point: GoogleMapCoordinate,
  start: GoogleMapCoordinate,
  end: GoogleMapCoordinate,
) {
  const lngScale = Math.cos((start.lat * Math.PI) / 180) || 1;
  const ax = start.lng * lngScale;
  const ay = start.lat;
  const dx = end.lng * lngScale - ax;
  const dy = end.lat - ay;
  const lengthSq = dx * dx + dy * dy;

  const ratio =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.lng * lngScale - ax) * dx + (point.lat - ay) * dy) /
              lengthSq,
          ),
        );

  const projectedX = ax + ratio * dx;
  const projectedY = ay + ratio * dy;
  const offsetX = point.lng * lngScale - projectedX;
  const offsetY = point.lat - projectedY;

  return {
    distanceMeters:
      Math.sqrt(offsetX * offsetX + offsetY * offsetY) * METERS_PER_LAT_DEGREE,
    ratio,
    point: { lat: projectedY, lng: projectedX / lngScale },
  };
}

/**
 * Chiếu một điểm lên lộ trình: đoạn chứa hình chiếu, toạ độ hình chiếu, khoảng
 * lệch khỏi tuyến và quãng đường dọc tuyến tính từ đầu tuyến. null khi lộ trình
 * chưa đủ 2 điểm.
 */
function projectOntoRoute(
  routePath: GoogleMapCoordinate[],
  point: GoogleMapCoordinate,
): {
  index: number;
  point: GoogleMapCoordinate;
  offRouteMeters: number;
  alongMeters: number;
} | null {
  if (routePath.length < 2) return null;

  let cumulative = 0;
  let best: {
    index: number;
    point: GoogleMapCoordinate;
    offRouteMeters: number;
    alongMeters: number;
  } | null = null;

  for (let index = 0; index < routePath.length - 1; index += 1) {
    const start = routePath[index];
    const end = routePath[index + 1];
    const projection = projectOnSegment(point, start, end);
    if (!best || projection.distanceMeters < best.offRouteMeters) {
      best = {
        index,
        point: projection.point,
        offRouteMeters: projection.distanceMeters,
        alongMeters:
          cumulative + projection.ratio * planarDistanceMeters(start, end),
      };
    }
    cumulative += planarDistanceMeters(start, end);
  }

  return best;
}

/**
 * Cắt lộ trình tại vị trí hiện tại của xe để bản đồ tô được "đã đi" khác
 * "chưa đi". Trước đây bản đồ chỉ vẽ nguyên tuyến một màu nên đoạn đã qua và
 * đoạn còn lại nhìn y hệt nhau.
 */
export function splitRouteAtPosition(
  routePath: GoogleMapCoordinate[],
  position: GoogleMapCoordinate | null,
): RouteProgress {
  if (!position || routePath.length < 2) {
    return { traveled: [], remaining: routePath };
  }

  const best = projectOntoRoute(routePath, position);
  if (!best || best.offRouteMeters > OFF_ROUTE_THRESHOLD_METERS) {
    return { traveled: [], remaining: routePath };
  }

  return {
    traveled: [...routePath.slice(0, best.index + 1), best.point],
    remaining: [best.point, ...routePath.slice(best.index + 1)],
  };
}

/**
 * Hướng đi (độ, thuận chiều kim đồng hồ từ bắc) giữa hai toạ độ. Dùng để xoay
 * marker xe khi thiết bị tài xế không gửi `headingDeg`.
 */
export function bearingBetween(
  from: GoogleMapCoordinate,
  to: GoogleMapCoordinate,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLng = toRad(to.lng - from.lng);
  const fromLat = toRad(from.lat);
  const toLat = toRad(to.lat);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

// Hai điểm GPS quá sát nhau thì hướng tính ra chỉ là nhiễu — xe đứng yên sẽ
// quay mòng mòng. Dưới ngưỡng này giữ nguyên hướng cũ.
const MIN_HEADING_DISTANCE_METERS = 8;

function planarDistanceMeters(
  from: GoogleMapCoordinate,
  to: GoogleMapCoordinate,
) {
  const lngScale = Math.cos((from.lat * Math.PI) / 180) || 1;
  const dx = (to.lng - from.lng) * lngScale;
  const dy = to.lat - from.lat;
  return Math.sqrt(dx * dx + dy * dy) * METERS_PER_LAT_DEGREE;
}

/**
 * Hướng xoay của marker xe. Ưu tiên `headingDeg` do thiết bị gửi; thiếu thì suy
 * từ hai điểm GPS gần nhất. `trail` xếp mới nhất trước.
 *
 * Trả null khi không đủ dữ kiện — caller giữ nguyên hướng đang hiển thị thay vì
 * bẻ marker về hướng bắc.
 */
export function resolveVehicleHeading(
  headingDeg: number | null | undefined,
  trail: Array<{ latitude: number; longitude: number }>,
): number | null {
  if (typeof headingDeg === "number" && Number.isFinite(headingDeg)) {
    return ((headingDeg % 360) + 360) % 360;
  }

  const newest = trail[0];
  if (!newest) return null;

  const current = { lat: newest.latitude, lng: newest.longitude };
  // Lùi dần về quá khứ tới khi đủ xa để hướng có nghĩa
  for (let index = 1; index < trail.length; index += 1) {
    const previous = {
      lat: trail[index].latitude,
      lng: trail[index].longitude,
    };
    if (planarDistanceMeters(previous, current) >= MIN_HEADING_DISTANCE_METERS) {
      return bearingBetween(previous, current);
    }
  }

  return null;
}

/**
 * Quãng đường dọc theo tuyến tính từ đầu tuyến tới điểm chiếu của `point`, kèm
 * khoảng lệch khỏi tuyến. Dùng để so tiến độ của xe với vị trí từng điểm dừng.
 */
function alongRouteMeters(
  routePath: GoogleMapCoordinate[],
  point: GoogleMapCoordinate,
): { alongMeters: number; offRouteMeters: number } | null {
  return projectOntoRoute(routePath, point);
}

// Xe đang đỗ ngay tại bến vẫn tính là đã tới nơi — GPS lệch vài chục mét không
// được làm điểm dừng nhấp nháy giữa "đã qua" và "chưa qua".
const STOP_REACHED_TOLERANCE_METERS = 60;

/**
 * Đánh dấu điểm dừng nào xe đã chạy qua, so theo quãng đường dọc tuyến chứ
 * không theo khoảng cách đường chim bay tới xe — tuyến có đoạn quay đầu thì
 * khoảng cách thẳng cho kết quả sai.
 *
 * Không xác định được tiến độ (chưa có vị trí xe, chưa có tuyến, hoặc xe lệch
 * quá xa tuyến) thì trả nguyên danh sách: thà không mờ điểm nào còn hơn mờ nhầm.
 */
export function markPassedStops(
  stops: TripRouteMarker[],
  routePath: GoogleMapCoordinate[],
  vehiclePosition: GoogleMapCoordinate | null,
): TripRouteMarker[] {
  if (!vehiclePosition || routePath.length < 2) return stops;

  const vehicle = alongRouteMeters(routePath, vehiclePosition);
  if (!vehicle || vehicle.offRouteMeters > OFF_ROUTE_THRESHOLD_METERS) {
    return stops;
  }

  return stops.map((stop) => {
    const projected = alongRouteMeters(routePath, stop.position);
    if (!projected) return stop;
    return {
      ...stop,
      passed:
        projected.alongMeters <=
        vehicle.alongMeters + STOP_REACHED_TOLERANCE_METERS,
    };
  });
}

export function statusLabel(s: FleetStatus, t: (key: string) => string) {
  if (s === "disrupted") return t("gps.disruptedStatus");
  if (s === "moving") return t("gps.moving");
  if (s === "idle") return t("gps.stopped");
  // "lost" = không còn trong fleet-latest (GPS hết TTL); "offline" = có GPS nhưng thiếu speed
  if (s === "lost") return t("gps.gpsSignalLost");
  return t("gps.signalLostStatus");
}

export function statusDotClass(s: FleetStatus) {
  if (s === "disrupted") return "bg-red-500";
  if (s === "moving") return "bg-emerald-500";
  if (s === "idle") return "bg-amber-500";
  if (s === "lost") return "bg-gray-300";
  return "bg-gray-400";
}

export function statusRowBadge(s: FleetStatus) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (s === "disrupted")
    return `${base} bg-red-50 text-red-800 ring-1 ring-red-200`;
  if (s === "moving")
    return `${base} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100`;
  if (s === "idle")
    return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-100`;
  if (s === "lost")
    return `${base} bg-gray-50 text-gray-500 ring-1 ring-gray-200`;
  return `${base} bg-gray-100 text-gray-600 ring-1 ring-gray-200`;
}
