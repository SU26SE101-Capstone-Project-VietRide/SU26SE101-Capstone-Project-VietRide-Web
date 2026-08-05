// Bản đồ thiết kế tuyến: hiển thị marker bến/điểm dừng + polyline hình học tuyến
import { useTranslation } from "react-i18next";
import GoogleMapCanvas from "../../../components/GoogleMapCanvas";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import type { RouteCoordinate } from "./polyline";
import type { RouteMapPoint } from "./types";

const defaultRouteMapCenter: GoogleMapCoordinate = {
  lat: 10.7769,
  lng: 106.7009,
};

type RouteDesignMapProps = {
  points: RouteMapPoint[];
  pathPoints: RouteCoordinate[];
  isEditing: boolean;
  onAppendPoint: (point: RouteCoordinate) => void;
  emptyText: string;
};

export default function RouteDesignMap({
  points,
  pathPoints,
  isEditing,
  onAppendPoint,
  emptyText,
}: RouteDesignMapProps) {
  const { t } = useTranslation("manager");
  const displayedPath = pathPoints.length > 0 ? pathPoints : points;
  const center: GoogleMapCoordinate =
    displayedPath.length > 0
      ? {
          lat:
            displayedPath.reduce(
              (total, point) => total + point.latitude,
              0,
            ) / displayedPath.length,
          lng:
            displayedPath.reduce(
              (total, point) => total + point.longitude,
              0,
            ) / displayedPath.length,
        }
      : defaultRouteMapCenter;
  const linePositions: GoogleMapCoordinate[] = displayedPath.map((point) => ({
    lat: point.latitude,
    lng: point.longitude,
  }));
  const hasSavedOrDraftPath = pathPoints.length > 1;
  const mapMarkers = [
    ...points.map((point) => ({
      color: point.color,
      id: point.id,
      position: {
        lat: point.latitude,
        lng: point.longitude,
      },
      radiusMeters: 1_200,
      title: point.name,
    })),
    ...(isEditing
      ? pathPoints.map((point, index) => ({
          color: "#0f766e",
          id: `geometry-${index}-${point.latitude}-${point.longitude}`,
          position: {
            lat: point.latitude,
            lng: point.longitude,
          },
          radiusMeters: 550,
        }))
      : []),
  ];
  const mapPolylines =
    linePositions.length > 1
      ? [
          {
            color: hasSavedOrDraftPath ? "#0f766e" : "#64748b",
            id: "route-geometry",
            opacity: hasSavedOrDraftPath ? 1 : 0.62,
            path: linePositions,
            weight: hasSavedOrDraftPath ? 5 : 3,
          },
        ]
      : [];

  return (
    <div className={`relative h-full ${isEditing ? "cursor-crosshair" : ""}`}>
      <GoogleMapCanvas
        ariaLabel={t("routes.designMapAria")}
        center={center}
        fitPoints={linePositions}
        markers={mapMarkers}
        onMapClick={
          isEditing
            ? (position) =>
                onAppendPoint({
                  latitude: position.lat,
                  longitude: position.lng,
                })
            : undefined
        }
        polylines={mapPolylines}
        className="h-full w-full"
        zoom={displayedPath.length > 1 ? 8 : 13}
      />
      {points.length === 0 && (
        <p className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 px-3 py-2 text-xs text-gray-500">
          {emptyText}
        </p>
      )}
    </div>
  );
}
