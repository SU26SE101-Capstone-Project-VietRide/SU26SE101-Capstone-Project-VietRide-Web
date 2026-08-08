// Type cục bộ của màn Routes — dùng chung giữa index, hook và các sub-component
import type { RouteStopRequest, Station } from "../../../api/vietride";

export type RouteStopDraft = RouteStopRequest & {
  routeId?: string;
  routeName: string;
  stopName: string;
  latitude: number;
  longitude: number;
  // Chỉ dùng client-side để xếp thứ tự khi chèn/re-index draft theo polyline —
  // không gửi lên BE. Khi build request BE chỉ lấy các field của RouteStopRequest.
  distanceFromStartKm?: number;
  // Google Place ID gốc (nếu draft đến từ chấm gợi ý Google Places) — chỉ dùng
  // client-side để dedupe khi cùng địa điểm được thêm lại qua chấm gợi ý khác.
  googlePlaceId?: string;
};

export type StationOption = Station & {
  address?: string;
  operatorStationId?: string;
};

export type StationRouteRole = "" | "origin" | "destination";

export type FeedbackScope = "station" | "route" | "routeStop";

export type RouteMapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  color: string;
};

// Chữ ký hàm dịch tối thiểu mà các hook cần — nhận từ useTranslation("manager") ở index
export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

// Gợi ý điểm dừng trên tuyến: từ kho nhà xe (thêm 1 click) hoặc Google Places
// (tạo stop mới rồi thêm). distanceFromStartKm dùng để sort + tự tính metrics.
export type StopSuggestion = {
  kind: "operatorStop" | "googlePlace";
  id: string; // operatorStop → stop.id; googlePlace → placeId
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceFromStartKm: number;
  googlePlaceId?: string; // chỉ googlePlace
};

// Điểm dừng nháp của TUYẾN THAY THẾ đang soạn (map-first, xem phụ lục spec
// 2026-08-07) — khác RouteStopDraft: không có allowPickup/allowDropoff/routeId/
// routeName (AlternativeRouteRequest.stops không có 2 cờ này) vì tuyến thay thế
// chỉ dùng khi tuyến chính gặp sự cố, không phân biệt đón/trả riêng theo điểm.
export type AlternativeStopDraft = {
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number;
  distanceFromOriginKm: number;
  stopName: string;
  latitude: number;
  longitude: number;
  // Chỉ dùng client-side để re-index theo km dọc polyline đang soạn — không gửi lên BE.
  distanceFromStartKm?: number;
  // Google Place ID gốc (nếu draft đến từ chấm gợi ý Google) — dedupe khi thêm lại.
  googlePlaceId?: string;
};
