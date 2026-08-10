import type {
  FleetLatestItem,
  OperatorTripListItem,
  TripRouteGeometry,
} from "../../../api/vietride";
import type { FleetVehicleMapPoint } from "./FleetMap";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import { isRecord } from "../../../utils/typeGuards";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error";

/**
 * Kết quả tải lộ trình tuyến của chuyến đang mở. Trước đây chỉ có geometry hoặc
 * null nên khi BE không trả về lộ trình, bản đồ lặng lẽ không vẽ gì và người
 * dùng không phân biệt được "chưa tải xong" với "tuyến này không có dữ liệu".
 */
export type RouteGeometryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error";

export type FleetStatus = FleetVehicleMapPoint["status"];

/** Trạng thái chuyến (BE) báo hiệu sự cố đang diễn ra */
export const DISRUPTED_TRIP_STATUS = "DISRUPTED";

// Nhận cả TrackingLatestLocation (speedKmh?: number) lẫn FleetLatestItem —
// chỉ cần trường speedKmh để phân loại.
export function getFleetStatus(location: {
  speedKmh?: number | null;
}): FleetStatus {
  if (location.speedKmh == null) return "offline";
  return location.speedKmh > 2 ? "moving" : "idle";
}

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
    } satisfies FleetVehicleMapPoint;
  });
}

// Áp một điểm GPS mới (socket event hoặc item từ poll fallback) vào danh sách xe.
// Chỉ cập nhật chuyến đã có trong list — event của chuyến lạ bỏ qua (chờ refresh).
export function applyFleetGpsUpdate(
  current: FleetVehicleMapPoint[],
  event: FleetLatestItem,
): FleetVehicleMapPoint[] {
  return current.map((vehicle) =>
    vehicle.id === event.tripId
      ? {
          ...vehicle,
          position: { lat: event.latitude, lng: event.longitude },
          speedKmh: event.speedKmh ?? null,
          status: resolveFleetStatus(event.status, event),
        }
      : vehicle,
  );
}

// Lưu ý: bản decode polyline này trùng logic với `Manager/Routes/polyline.ts`
// nhưng khác kiểu trả về (GoogleMapCoordinate vs RouteCoordinate) — chủ đích
// giữ 2 bản riêng theo module, chưa hợp nhất trong đợt refactor này.
export function decodeGooglePolyline(encoded: string): GoogleMapCoordinate[] {
  const coordinates: GoogleMapCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }

  return coordinates;
}

export function routeGeometryPath(
  geometry: TripRouteGeometry | null,
): GoogleMapCoordinate[] {
  if (!geometry) return [];

  if (geometry.points?.length) {
    return [...geometry.points]
      .sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0))
      .map((point) => ({ lat: point.latitude, lng: point.longitude }));
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

  let best: { index: number; distanceMeters: number; point: GoogleMapCoordinate } | null =
    null;

  for (let index = 0; index < routePath.length - 1; index += 1) {
    const projection = projectOnSegment(
      position,
      routePath[index],
      routePath[index + 1],
    );
    if (!best || projection.distanceMeters < best.distanceMeters) {
      best = {
        index,
        distanceMeters: projection.distanceMeters,
        point: projection.point,
      };
    }
  }

  if (!best || best.distanceMeters > OFF_ROUTE_THRESHOLD_METERS) {
    return { traveled: [], remaining: routePath };
  }

  return {
    traveled: [...routePath.slice(0, best.index + 1), best.point],
    remaining: [best.point, ...routePath.slice(best.index + 1)],
  };
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
