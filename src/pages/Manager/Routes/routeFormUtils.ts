// Hằng form rỗng + helper thuần chuyển đổi dữ liệu của màn Routes
import type {
  AlternativeRoute,
  AlternativeRouteRequest,
  OperatorRoute,
  OperatorRouteRequest,
  OperatorStation,
  OperatorStopRequest,
  RouteStopRequest,
} from "../../../api/vietride";
import type { RouteStopDraft, StationOption } from "./types";

export const draftRouteId = "__draft_route__";

// Tab của cột chi tiết (master–detail), sync với query param ?tab=
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

export function toStationOption(operatorStation: OperatorStation): StationOption {
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
    ward: station?.ward || operatorStation.ward || "",
    latitude: station?.latitude ?? operatorStation.latitude ?? 0,
    longitude: station?.longitude ?? operatorStation.longitude ?? 0,
    supportsShuttle:
      station?.supportsShuttle ?? operatorStation.supportsShuttle ?? false,
    isActive: station?.isActive ?? operatorStation.isActive,
    createdAt: station?.createdAt ?? operatorStation.createdAt,
    updatedAt: station?.updatedAt ?? operatorStation.updatedAt,
  };
}

export function toRouteStopRequest(draft: RouteStopDraft): RouteStopRequest {
  return {
    stopId: draft.stopId,
    orderIndex: draft.orderIndex,
    estimatedDurationFromOriginMinutes:
      draft.estimatedDurationFromOriginMinutes,
    distanceFromOriginKm: draft.distanceFromOriginKm,
    allowPickup: draft.allowPickup,
    allowDropoff: draft.allowDropoff,
  };
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
