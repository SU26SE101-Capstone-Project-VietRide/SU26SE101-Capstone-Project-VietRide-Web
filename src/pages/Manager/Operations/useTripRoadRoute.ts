// Tính lại đường đi theo đường bộ cho chuyến đang mở khi tuyến CHƯA lưu polyline.
//
// Contract route-geometry trả `geometry: null` trong trường hợp đó và cấm client
// nối các marker bến/điểm dừng thành tuyến giả (đường chim bay). Thay vì bỏ trống
// bản đồ, màn hỏi Google Routes đúng dãy bến/điểm dừng đó để có đường bám đường
// bộ thật — panel bên phải nói rõ đây là đường ước lượng, không phải lộ trình đã duyệt.
import { useEffect, useMemo, useState } from "react";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import { requestRoadPath } from "../../../lib/googleRoutes";

export type RoadRouteStatus = "idle" | "loading" | "ready" | "unavailable";

// Cache theo phiên (không persist): xem qua lại các chuyến cùng tuyến không gọi
// lại Google — Routes API tính tiền theo request. null = lượt tính đã hỏng, cache
// luôn để không retry vô hạn.
const roadPathCache = new Map<string, GoogleMapCoordinate[] | null>();

function waypointsKey(waypoints: GoogleMapCoordinate[]) {
  return waypoints
    .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
    .join(";");
}

export function useTripRoadRoute(
  waypoints: GoogleMapCoordinate[],
  enabled: boolean,
) {
  const key = useMemo(() => waypointsKey(waypoints), [waypoints]);
  // Kết quả sống trong cache module (chia sẻ giữa các lần mở chuyến); state chỉ
  // là mốc "đã có thêm lượt tính xong" để hook đọc lại cache khi render tiếp.
  const [settledCount, setSettledCount] = useState(0);
  const canCompute = enabled && waypoints.length > 1;

  useEffect(() => {
    if (!canCompute || roadPathCache.has(key)) return;

    let ignore = false;
    void requestRoadPath(waypoints)
      .then((path) => {
        roadPathCache.set(key, path);
        if (!ignore) setSettledCount((current) => current + 1);
      })
      .catch(() => {
        // Thiếu API key / Google lỗi: bản đồ vẫn có marker bến + vệt GPS, panel
        // bên phải báo không có lộ trình — không bắn lỗi toàn màn
        roadPathCache.set(key, null);
        if (!ignore) setSettledCount((current) => current + 1);
      });

    return () => {
      ignore = true;
    };
  }, [canCompute, key, waypoints]);

  return useMemo(() => {
    if (!canCompute) {
      return { path: [] as GoogleMapCoordinate[], status: "idle" as const };
    }

    // settledCount chỉ để buộc đọc lại cache sau khi một lượt tính xong
    void settledCount;
    const cached = roadPathCache.get(key);
    if (cached === undefined) {
      return { path: [] as GoogleMapCoordinate[], status: "loading" as const };
    }

    return cached
      ? { path: cached, status: "ready" as const }
      : { path: [] as GoogleMapCoordinate[], status: "unavailable" as const };
  }, [canCompute, key, settledCount]);
}
