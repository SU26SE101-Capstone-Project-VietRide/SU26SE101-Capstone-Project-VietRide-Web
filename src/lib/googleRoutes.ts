// Wrapper Directions Goong cho các màn CHỈ cần hình dạng đường đi theo
// đường bộ, không cần bộ phương án + số liệu km/phút như màn soạn tuyến
// (xem `pages/Manager/Routes/geometry.ts`).
import type { GoogleMapCoordinate } from "./googleMaps";
import { decodeGooglePolyline } from "./googlePolyline";
import { goongDirections } from "./goongApi";
import { getGoongApiKey } from "./goongConfig";

// Giữ trần 23 điểm trung gian như hồi Google: tuyến nhiều điểm dừng hơn thì lấy
// mẫu đều, đường vẫn bám đúng hành lang tuyến vì các điểm bỏ qua nằm giữa hai
// điểm được giữ — đồng thời tránh query string dài bất thường.
const maxIntermediateWaypoints = 23;

const missingApiKeyMessage =
  "Chưa cấu hình VITE_GOONG_API_KEY nên không tính được đường đi thực tế.";
const routingFailedMessage = "Goong không trả về đường đi hợp lệ.";

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

/**
 * Đường đi theo đường bộ qua lần lượt các waypoint (bến đi → điểm dừng → bến
 * đến). Throw khi thiếu API key hoặc Goong không trả kết quả — caller quyết
 * định hiển thị gì, hàm này không nuốt lỗi im lặng.
 */
export async function requestRoadPath(
  waypoints: GoogleMapCoordinate[],
): Promise<GoogleMapCoordinate[]> {
  if (!getGoongApiKey()) {
    throw new Error(missingApiKeyMessage);
  }

  if (waypoints.length < 2) {
    throw new Error(routingFailedMessage);
  }

  const routes = await goongDirections({
    destination: waypoints[waypoints.length - 1],
    origin: waypoints[0],
    // Xe khách là xe lớn — "truck" tránh đường cấm/hạn chế, khớp với cách màn
    // soạn tuyến tính đường cho cùng một tuyến
    vehicle: "truck",
    waypoints: sampleIntermediates(waypoints.slice(1, -1)),
  });

  const encoded = routes[0]?.encodedPolyline ?? "";
  const points = encoded ? decodeGooglePolyline(encoded) : [];

  if (points.length < 2) {
    throw new Error(routingFailedMessage);
  }

  return points;
}
