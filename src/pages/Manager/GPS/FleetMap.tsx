import { useMemo } from "react";
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
  onMarkerSelect,
}: FleetMapProps) {
  const markers = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        color: statusFill[vehicle.status],
        description: [
          vehicle.driver,
          vehicle.route,
          vehicle.speedKmh == null
            ? "Không có dữ liệu tốc độ"
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
    [onMarkerSelect, selectedId, vehicles],
  );

  return (
    <GoogleMapCanvas
      ariaLabel="Bản đồ theo dõi đội xe"
      center={defaultCenter}
      className="h-full min-h-[420px] w-full rounded-xl"
      emptyState="Không có phương tiện phù hợp với bộ lọc."
      focusCenter={focusCenter}
      markers={markers}
      scrollWheelZoom
      zoom={11}
    />
  );
}
