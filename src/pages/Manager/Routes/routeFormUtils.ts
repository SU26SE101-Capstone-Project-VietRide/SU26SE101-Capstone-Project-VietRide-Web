// Hằng form rỗng + helper thuần chuyển đổi dữ liệu của màn Routes
import type {
  AlternativeRoute,
  AlternativeRouteRequest,
  OperatorRoute,
  OperatorRouteDetail,
  OperatorRouteFullStopRequest,
  OperatorRouteRequest,
  OperatorStation,
  OperatorStopRequest,
} from "../../../api/vietride";
import type { RouteStopDraft, StationOption } from "./types";

export const draftRouteId = "__draft_route__";

// Tab của cột chi tiết (master–detail), sync với query param ?tab=.
// (2026-08-07): tách lại tab "Điểm dừng" riêng khỏi tab "Thông tin" — trước đó
// (2026-08-06) đã từng gộp chung nhưng owner yêu cầu tách lại thành tab độc lập.
export const routeTabs = ["info", "stops", "alternatives"] as const;

export type RouteTab = (typeof routeTabs)[number];

export function parseRouteTab(value: string | null): RouteTab {
  return routeTabs.find((tab) => tab === value) ?? "info";
}

export const emptyStopForm: OperatorStopRequest = {
  name: "",
  latitude: 0,
  longitude: 0,
  description: "",
  address: "",
  googlePlaceId: "",
};

export const emptyRouteForm: OperatorRouteRequest = {
  name: "",
  originStationId: "",
  destinationStationId: "",
  returnRouteId: "",
  baseFare: 0,
  totalDistanceKm: 0,
  estimatedDurationMinutes: 0,
  isActive: true,
};

export const emptyAlternativeRouteForm: AlternativeRouteRequest = {
  name: "",
  description: "",
  destinationStationId: "",
  totalDistanceKm: 0,
  estimatedDurationMinutes: 0,
  isActive: true,
  stops: [],
};

export function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function routeToForm(route: OperatorRoute): OperatorRouteRequest {
  return {
    name: route.name,
    originStationId: route.originStationId,
    destinationStationId: route.destinationStationId,
    returnRouteId: route.returnRouteId ?? "",
    baseFare: route.baseFare,
    totalDistanceKm: route.totalDistanceKm,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    isActive: route.isActive,
  };
}

export function alternativeRouteToForm(
  route: AlternativeRoute,
): AlternativeRouteRequest {
  return {
    name: route.name,
    description: route.description ?? "",
    destinationStationId: route.destinationStationId,
    totalDistanceKm: route.totalDistanceKm,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    isActive: route.isActive,
    stops: route.stops.map((stop) => ({
      stopId: stop.stopId,
      orderIndex: stop.orderIndex,
      estimatedDurationFromOriginMinutes:
        stop.estimatedDurationFromOriginMinutes,
      distanceFromOriginKm: stop.distanceFromOriginKm,
    })),
  };
}

export function toStationOption(
  operatorStation: OperatorStation,
): StationOption {
  const station = operatorStation.station;

  return {
    id: operatorStation.stationId || station?.id || operatorStation.id || "",
    operatorStationId: operatorStation.id,
    name:
      operatorStation.displayNameOverride ||
      station?.name ||
      operatorStation.name ||
      "",
    slug: station?.slug,
    address:
      station?.address ||
      station?.addressStreet ||
      operatorStation.addressStreet ||
      "",
    addressStreet:
      station?.addressStreet || operatorStation.addressStreet || "",
    city: station?.city || operatorStation.city || "",
    ward: station?.ward ?? operatorStation.ward ?? null,
    latitude: station?.latitude ?? operatorStation.latitude ?? 0,
    longitude: station?.longitude ?? operatorStation.longitude ?? 0,
    supportsShuttle:
      station?.supportsShuttle ?? operatorStation.supportsShuttle ?? false,
    isActive: station?.isActive ?? operatorStation.isActive,
    createdAt: station?.createdAt ?? operatorStation.createdAt,
    updatedAt: station?.updatedAt ?? operatorStation.updatedAt,
  };
}

// Route detail (8.2 và response /full) trả kèm `stops`, nhưng getOperatorRoute
// đang khai type OperatorRoute (không stops) — đọc an toàn qua guard để đồng bộ
// drafts cục bộ từ server (điều kiện bắt buộc cho lưu replace-all không mất stop)
export function extractDetailStops(
  route: OperatorRoute,
): OperatorRouteDetail["stops"] {
  const stops = (route as Partial<OperatorRouteDetail>).stops;
  return Array.isArray(stops) ? stops : [];
}

// Map stops từ Route detail về draft cục bộ của màn — server đã project
// distance/duration cho stop thiếu nên response là nguồn sự thật
export function detailStopsToDrafts(route: OperatorRoute): RouteStopDraft[] {
  return extractDetailStops(route).map((stop) => ({
    stopId: stop.stopId,
    orderIndex: stop.orderIndex,
    estimatedDurationFromOriginMinutes:
      stop.estimatedDurationFromOriginMinutes ?? 0,
    distanceFromOriginKm: stop.distanceFromOriginKm ?? 0,
    allowPickup: stop.allowPickup,
    allowDropoff: stop.allowDropoff,
    routeId: route.id,
    routeName: route.name,
    stopName: stop.name,
    latitude: stop.latitude,
    longitude: stop.longitude,
  }));
}

// Chuẩn hóa drafts thành stops payload /full (contract 8.6/8.7): sort theo
// orderIndex hiện có rồi đánh lại 1..N liên tục — server bắt buộc đúng tập 1..N
export function draftsToFullStops(
  drafts: RouteStopDraft[],
): OperatorRouteFullStopRequest[] {
  return [...drafts]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((draft, index) => ({
      stopId: draft.stopId,
      orderIndex: index + 1,
      estimatedDurationFromOriginMinutes:
        draft.estimatedDurationFromOriginMinutes,
      distanceFromOriginKm: draft.distanceFromOriginKm,
      allowPickup: draft.allowPickup,
      allowDropoff: draft.allowDropoff,
    }));
}

export function mergeStations(
  current: StationOption[],
  incoming: StationOption[],
) {
  const stationMap = new Map(current.map((station) => [station.id, station]));

  incoming.forEach((station) => {
    stationMap.set(station.id, { ...stationMap.get(station.id), ...station });
  });

  return Array.from(stationMap.values());
}
