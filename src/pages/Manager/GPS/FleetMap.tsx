import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import GoogleMapCanvas from "../../../components/GoogleMapCanvas";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";

export type FleetVehicleMapPoint = {
  id: string;
  plate: string;
  driver: string;
  route: string;
  speedKmh: number | null;
  status: "moving" | "idle" | "offline";
  position: GoogleMapCoordinate;
};

const statusFill: Record<FleetVehicleMapPoint["status"], string> = {
  moving: "#16a34a",
  idle: "#f59e0b",
  offline: "#9ca3af",
};

type FleetMapProps = {
  vehicles: FleetVehicleMapPoint[];
  selectedId: string | null;
  focusCenter: GoogleMapCoordinate | null;
  routePath?: GoogleMapCoordinate[] | null;
  trailPath?: GoogleMapCoordinate[] | null;
  onMarkerSelect: (id: string) => void;
};

const defaultCenter: GoogleMapCoordinate = {
  lat: 10.7769,
  lng: 106.7009,
};

export default function FleetMap({
  vehicles,
  selectedId,
  focusCenter,
  routePath,
  trailPath,
  onMarkerSelect,
}: FleetMapProps) {
  const { t } = useTranslation("manager");
  const markers = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        color: statusFill[vehicle.status],
        description: [
          vehicle.driver,
          vehicle.route,
          vehicle.speedKmh == null
            ? t("gps.noSpeedData")
            : `${vehicle.speedKmh} km/h`,
        ],
        fillOpacity: vehicle.status === "offline" ? 0.55 : 0.95,
        id: vehicle.id,
        onClick: () => onMarkerSelect(vehicle.id),
        position: vehicle.position,
        radiusMeters: vehicle.id === selectedId ? 360 : 240,
        selected: vehicle.id === selectedId,
        title: vehicle.plate,
      })),
    [onMarkerSelect, selectedId, t, vehicles],
  );

  const polylines = useMemo(() => {
    const lines: Array<{
      id: string;
      path: GoogleMapCoordinate[];
      color: string;
      opacity: number;
      weight: number;
    }> = [];
    if (routePath && routePath.length > 1) {
      lines.push({
        id: "selected-trip-route",
        path: routePath,
        color: "#0f766e",
        opacity: 0.45,
        weight: 4,
      });
    }
    if (trailPath && trailPath.length > 1) {
      lines.push({
        id: "selected-trip-trail",
        path: trailPath,
        color: "#2563eb",
        opacity: 0.95,
        weight: 6,
      });
    }
    return lines;
  }, [routePath, trailPath]);

  return (
    <GoogleMapCanvas
      ariaLabel={t("gps.fleetMapAria")}
      center={defaultCenter}
      className="h-full min-h-[420px] w-full rounded-xl"
      emptyState={t("gps.noVehiclesMatchFilter")}
      focusCenter={focusCenter}
      markers={markers}
      polylines={polylines}
      scrollWheelZoom
      zoom={11}
    />
  );
}
