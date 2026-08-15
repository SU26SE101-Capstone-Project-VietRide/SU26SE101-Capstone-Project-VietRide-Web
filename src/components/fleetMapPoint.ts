import type { GoogleMapCoordinate } from "../lib/googleMaps";

/**
 * Vốn khai trong `pages/Manager/Operations/FleetMap.tsx` khi bản đồ chỉ phục vụ
 * màn Operations. Tách ra đây khi màn Dispatch dùng lại `FleetMap` cho xe trung
 * chuyển: helper thuần (dựng điểm, suy trạng thái) không nên phải import một
 * file .tsx kéo theo cả component bản đồ.
 */
export type FleetVehicleMapPoint = {
  id: string;
  plate: string;
  driver: string;
  route: string;
  speedKmh: number | null;
  /**
   * "disrupted" = chuyến đang ở trạng thái sự cố (DISRUPTED) — ưu tiên cao nhất,
   * đè lên trạng thái suy ra từ tốc độ. "lost" = mất tín hiệu GPS (không còn
   * trong fleet-latest, TTL 300s).
   */
  status: "disrupted" | "moving" | "idle" | "offline" | "lost";
  /** null khi mất tín hiệu và không còn toạ độ cuối — xe vẫn hiện trong list, không có marker */
  position: GoogleMapCoordinate | null;
  /**
   * Hướng mũi xe (độ, thuận chiều kim đồng hồ từ bắc). null = chưa biết hướng
   * (xe đứng yên hoặc thiết bị không gửi) — vẽ mũi xe hướng bắc và bỏ mũi tên
   * chỉ hướng, không bịa ra một hướng sai.
   */
  headingDeg?: number | null;
};

export type FleetStatus = FleetVehicleMapPoint["status"];

// Nhận cả TrackingLatestLocation (speedKmh?: number) lẫn FleetLatestItem —
// chỉ cần trường speedKmh để phân loại.
export function getFleetStatus(location: {
  speedKmh?: number | null;
}): FleetStatus {
  if (location.speedKmh == null) return "offline";
  return location.speedKmh > 2 ? "moving" : "idle";
}

export type TripRouteMarkerKind = "origin" | "stop" | "destination";

export type TripRouteMarker = {
  id: string;
  kind: TripRouteMarkerKind;
  name: string;
  /** Số thứ tự 1..N của điểm dừng giữa tuyến — bến đi/bến đến không có. */
  orderIndex?: number;
  /** true = xe đã chạy qua điểm này. Marker mờ đi nhưng vẫn nổi hơn polyline. */
  passed?: boolean;
  position: GoogleMapCoordinate;
};
