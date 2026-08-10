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
  /**
   * "disrupted" = chuyến đang ở trạng thái sự cố (DISRUPTED) — ưu tiên cao nhất,
   * đè lên trạng thái suy ra từ tốc độ. "lost" = mất tín hiệu GPS (không còn
   * trong fleet-latest, TTL 300s).
   */
  status: "disrupted" | "moving" | "idle" | "offline" | "lost";
  /** null khi mất tín hiệu và không còn toạ độ cuối — xe vẫn hiện trong list, không có marker */
  position: GoogleMapCoordinate | null;
};

const statusFill: Record<FleetVehicleMapPoint["status"], string> = {
  disrupted: "#dc2626",
  moving: "#16a34a",
  idle: "#f59e0b",
  offline: "#9ca3af",
  lost: "#d1d5db",
};

type FleetMapProps = {
  vehicles: FleetVehicleMapPoint[];
  selectedId: string | null;
  focusCenter: GoogleMapCoordinate | null;
  /** Đoạn tuyến xe đã đi qua — tô đậm. */
  routeTraveledPath?: GoogleMapCoordinate[] | null;
  /** Đoạn tuyến còn lại phía trước — tô nhạt hơn để phân biệt với đoạn đã đi. */
  routeRemainingPath?: GoogleMapCoordinate[] | null;
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
  routeTraveledPath,
  routeRemainingPath,
  trailPath,
  onMarkerSelect,
}: FleetMapProps) {
  const { t } = useTranslation("manager");
  const markers = useMemo(
    () =>
      // Xe mất tín hiệu không có toạ độ thì không có marker — vẫn nằm trong danh sách xe
      vehicles.flatMap((vehicle) => {
        const position = vehicle.position;
        if (!position) return [];
        return [
          {
            color: statusFill[vehicle.status],
            description: [
              vehicle.driver,
              vehicle.route,
              vehicle.speedKmh == null
                ? t("gps.noSpeedData")
                : `${vehicle.speedKmh} km/h`,
            ],
            fillOpacity:
              vehicle.status === "lost"
                ? 0.35
                : vehicle.status === "offline"
                  ? 0.55
                  : 0.95,
            id: vehicle.id,
            onClick: () => onMarkerSelect(vehicle.id),
            position,
            // Chuyến sự cố luôn to hơn xe thường để nổi lên giữa đội xe
            radiusMeters:
              vehicle.id === selectedId
                ? 360
                : vehicle.status === "disrupted"
                  ? 320
                  : 240,
            selected: vehicle.id === selectedId,
            title: vehicle.plate,
          },
        ];
      }),
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
    // Vẽ đoạn CHƯA đi trước để đoạn đã đi và vệt GPS nằm đè lên trên.
    if (routeRemainingPath && routeRemainingPath.length > 1) {
      lines.push({
        id: "selected-trip-route-remaining",
        path: routeRemainingPath,
        color: "#94a3b8",
        opacity: 0.55,
        weight: 4,
      });
    }
    if (routeTraveledPath && routeTraveledPath.length > 1) {
      lines.push({
        id: "selected-trip-route-traveled",
        path: routeTraveledPath,
        color: "#0f766e",
        opacity: 0.95,
        weight: 6,
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
  }, [routeRemainingPath, routeTraveledPath, trailPath]);

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
