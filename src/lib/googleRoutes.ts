// Wrapper Google Routes API (computeRoutes) cho các màn CHỈ cần hình dạng đường
// đi theo đường bộ, không cần bộ phương án + số liệu km/phút như màn soạn tuyến
// (xem `pages/Manager/Routes/geometry.ts`).
import { isRecord } from "../utils/typeGuards";
import type { GoogleMapCoordinate } from "./googleMaps";
import { decodeGooglePolyline } from "./googlePolyline";

const googleRoutesEndpoint =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

// Routes API nhận tối đa 25 waypoint mỗi lần gọi: origin + destination + 23
// điểm trung gian. Tuyến nhiều điểm dừng hơn thì lấy mẫu đều, đường vẫn bám
// đúng hành lang tuyến vì các điểm bỏ qua nằm giữa hai điểm được giữ.
const maxIntermediateWaypoints = 23;

const missingApiKeyMessage =
  "Chưa cấu hình VITE_GOOGLE_ROUTES_API_KEY nên không tính được đường đi thực tế.";
const routingFailedMessage = "Google Routes không trả về đường đi hợp lệ.";

function sampleIntermediates(points: GoogleMapCoordinate[]) {
  if (points.length <= maxIntermediateWaypoints) {
    return points;
  }

  const step = (points.length - 1) / (maxIntermediateWaypoints - 1);
  return Array.from(
    { length: maxIntermediateWaypoints },
    (_, index) => points[Math.round(index * step)],
  );
}

function toWaypoint(point: GoogleMapCoordinate) {
  return {
    location: { latLng: { latitude: point.lat, longitude: point.lng } },
  };
}

/**
 * Đường đi theo đường bộ qua lần lượt các waypoint (bến đi → điểm dừng → bến
 * đến). Throw khi thiếu API key hoặc Google không trả kết quả — caller quyết
 * định hiển thị gì, hàm này không nuốt lỗi im lặng.
 */
export async function requestRoadPath(
  waypoints: GoogleMapCoordinate[],
): Promise<GoogleMapCoordinate[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(missingApiKeyMessage);
  }

  if (waypoints.length < 2) {
    throw new Error(routingFailedMessage);
  }

  const response = await fetch(googleRoutesEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: toWaypoint(waypoints[0]),
      destination: toWaypoint(waypoints[waypoints.length - 1]),
      intermediates: sampleIntermediates(waypoints.slice(1, -1)).map(toWaypoint),
      // Xe khách là xe lớn — TRUCK tránh đường cấm/hạn chế, khớp với cách màn
      // soạn tuyến tính đường cho cùng một tuyến
      travelMode: "TRUCK",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      languageCode: "vi",
      units: "METRIC",
    }),
  });
  const body: unknown = await response.json();

  if (!response.ok || !isRecord(body) || !Array.isArray(body.routes)) {
    throw new Error(routingFailedMessage);
  }

  const route: unknown = body.routes[0];
  const polyline = isRecord(route) ? route.polyline : null;
  const encoded =
    isRecord(polyline) && typeof polyline.encodedPolyline === "string"
      ? polyline.encodedPolyline
      : "";
  const points = encoded ? decodeGooglePolyline(encoded) : [];

  if (points.length < 2) {
    throw new Error(routingFailedMessage);
  }

  return points;
}
