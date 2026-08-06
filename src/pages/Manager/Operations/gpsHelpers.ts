import type {
  FleetLatestItem,
  OperatorTripListItem,
  TripRouteGeometry,
} from "../../../api/vietride";
import type { FleetVehicleMapPoint } from "./FleetMap";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import { isRecord } from "../../../utils/typeGuards";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error";

// Nhận cả TrackingLatestLocation (speedKmh?: number) lẫn FleetLatestItem —
// chỉ cần trường speedKmh để phân loại.
export function getFleetStatus(location: {
  speedKmh?: number | null;
}): FleetVehicleMapPoint["status"] {
  if (location.speedKmh == null) return "offline";
  return location.speedKmh > 2 ? "moving" : "idle";
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
      status: location ? getFleetStatus(location) : "lost",
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
          status: getFleetStatus(event),
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

export function statusLabel(
  s: FleetVehicleMapPoint["status"],
  t: (key: string) => string,
) {
  if (s === "moving") return t("gps.moving");
  if (s === "idle") return t("gps.stopped");
  // "lost" = không còn trong fleet-latest (GPS hết TTL); "offline" = có GPS nhưng thiếu speed
  if (s === "lost") return t("gps.gpsSignalLost");
  return t("gps.signalLostStatus");
}

export function statusDotClass(s: FleetVehicleMapPoint["status"]) {
  if (s === "moving") return "bg-emerald-500";
  if (s === "idle") return "bg-amber-500";
  if (s === "lost") return "bg-gray-300";
  return "bg-gray-400";
}

export function statusRowBadge(s: FleetVehicleMapPoint["status"]) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (s === "moving")
    return `${base} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100`;
  if (s === "idle")
    return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-100`;
  if (s === "lost")
    return `${base} bg-gray-50 text-gray-500 ring-1 ring-gray-200`;
  return `${base} bg-gray-100 text-gray-600 ring-1 ring-gray-200`;
}
