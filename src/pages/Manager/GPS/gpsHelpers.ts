import type { TripRouteGeometry } from "../../../api/vietride";
import type { FleetVehicleMapPoint } from "./FleetMap";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import type { TrackingLatestLocation } from "../../../lib/trackingSocket";
import { isRecord } from "../../../utils/typeGuards";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error";

export function getFleetStatus(
  location: TrackingLatestLocation,
): FleetVehicleMapPoint["status"] {
  if (location.speedKmh == null) return "offline";
  return location.speedKmh > 2 ? "moving" : "idle";
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
  return t("gps.signalLostStatus");
}

export function statusDotClass(s: FleetVehicleMapPoint["status"]) {
  if (s === "moving") return "bg-emerald-500";
  if (s === "idle") return "bg-amber-500";
  return "bg-gray-400";
}

export function statusRowBadge(s: FleetVehicleMapPoint["status"]) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (s === "moving")
    return `${base} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100`;
  if (s === "idle")
    return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-100`;
  return `${base} bg-gray-100 text-gray-600 ring-1 ring-gray-200`;
}
