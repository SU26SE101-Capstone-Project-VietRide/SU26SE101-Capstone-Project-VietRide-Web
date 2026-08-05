// Hook cục bộ: dựng danh sách điểm hiển thị trên bản đồ (bến đi → điểm dừng → bến đến)
// và waypoint tương ứng để tính đường. Logic giữ nguyên từ index.tsx khi tách.
import { useMemo } from "react";
import type { RouteCoordinate } from "./polyline";
import type { RouteMapPoint, RouteStopDraft, StationOption, TranslateFn } from "./types";

type UseRouteMapPointsParams = {
  stations: StationOption[];
  originStationId: string;
  destinationStationId: string;
  currentRouteStops: RouteStopDraft[];
  t: TranslateFn;
};

export function useRouteMapPoints({
  stations,
  originStationId,
  destinationStationId,
  currentRouteStops,
  t,
}: UseRouteMapPointsParams) {
  const routeMapPoints = useMemo(() => {
    const origin = stations.find((station) => station.id === originStationId);
    const destination = stations.find(
      (station) => station.id === destinationStationId,
    );

    return [
      origin
        ? {
            id: `origin-${origin.id}`,
            name: `${t("routes.origin")}: ${origin.name}`,
            latitude: origin.latitude,
            longitude: origin.longitude,
            color: "#0f766e",
          }
        : null,
      ...currentRouteStops.map((stop) => ({
        id: `stop-${stop.stopId}-${stop.orderIndex}`,
        name: `#${stop.orderIndex} · ${stop.stopName}`,
        latitude: stop.latitude,
        longitude: stop.longitude,
        color: stop.allowPickup && stop.allowDropoff ? "#2563eb" : "#f59e0b",
      })),
      destination
        ? {
            id: `destination-${destination.id}`,
            name: `${t("routes.destination")}: ${destination.name}`,
            latitude: destination.latitude,
            longitude: destination.longitude,
            color: "#dc2626",
          }
        : null,
    ].filter((point): point is RouteMapPoint => Boolean(point));
  }, [currentRouteStops, destinationStationId, originStationId, stations, t]);

  const routeWaypoints = useMemo<RouteCoordinate[]>(
    () =>
      routeMapPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [routeMapPoints],
  );

  return { routeMapPoints, routeWaypoints };
}
