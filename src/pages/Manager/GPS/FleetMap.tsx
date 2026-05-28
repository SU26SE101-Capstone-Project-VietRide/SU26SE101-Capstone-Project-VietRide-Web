import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";

export type FleetVehicleMapPoint = {
  id: string;
  plate: string;
  driver: string;
  route: string;
  speedKmh: number | null;
  status: "moving" | "idle" | "offline";
  position: LatLngExpression;
};

const statusFill: Record<FleetVehicleMapPoint["status"], string> = {
  moving: "#16a34a",
  idle: "#f59e0b",
  offline: "#9ca3af",
};

type FleetMapProps = {
  vehicles: FleetVehicleMapPoint[];
  selectedId: string | null;
  focusCenter: LatLngExpression | null;
  onMarkerSelect: (id: string) => void;
};

function MapFocus({ center }: { center: LatLngExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo(center, 14, { duration: 0.55 });
  }, [center, map]);
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      map.invalidateSize();
    };
    run();
    const id = requestAnimationFrame(run);
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

export default function FleetMap({
  vehicles,
  selectedId,
  focusCenter,
  onMarkerSelect,
}: FleetMapProps) {
  const defaultCenter: LatLngExpression = [10.7769, 106.7009];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={11}
      className="z-0 h-full min-h-[420px] w-full rounded-xl"
      scrollWheelZoom
      preferCanvas
    >
      <MapResizeFix />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus center={focusCenter} />
      {vehicles.map((v) => {
        const selected = v.id === selectedId;
        const fill = statusFill[v.status];
        return (
          <CircleMarker
            key={v.id}
            center={v.position}
            radius={selected ? 12 : 8}
            pathOptions={{
              color: "#ffffff",
              weight: selected ? 3 : 2,
              fillColor: fill,
              fillOpacity: v.status === "offline" ? 0.55 : 0.95,
            }}
            eventHandlers={{
              click: () => onMarkerSelect(v.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div className="text-xs font-semibold text-gray-900">
                {v.plate}
              </div>
              <div className="text-[11px] text-gray-600">{v.driver}</div>
              <div className="text-[11px] text-gray-500">{v.route}</div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
