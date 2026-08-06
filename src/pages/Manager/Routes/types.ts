// Type cục bộ của màn Routes — dùng chung giữa index, hook và các sub-component
import type { RouteStopRequest, Station } from "../../../api/vietride";

export type RouteStopDraft = RouteStopRequest & {
  routeId?: string;
  routeName: string;
  stopName: string;
  latitude: number;
  longitude: number;
};

export type StationOption = Station & {
  address?: string;
  operatorStationId?: string;
};

export type StationRouteRole = "" | "origin" | "destination";

export type FeedbackScope =
  | "global"
  | "station"
  | "stop"
  | "route"
  | "alternative"
  | "routeStop";

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
