import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import GoogleMapCanvas, {
  type GoogleMapPointMarker,
} from "../../../components/GoogleMapCanvas";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import type { TripRouteMarker } from "./gpsHelpers";

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
  /**
   * Hướng mũi xe (độ, thuận chiều kim đồng hồ từ bắc). null = chưa biết hướng
   * (xe đứng yên hoặc thiết bị không gửi) — vẽ mũi xe hướng bắc và bỏ mũi tên
   * chỉ hướng, không bịa ra một hướng sai.
   */
  headingDeg?: number | null;
};

const statusFill: Record<FleetVehicleMapPoint["status"], string> = {
  disrupted: "#dc2626",
  moving: "#16a34a",
  idle: "#f59e0b",
  offline: "#9ca3af",
  lost: "#d1d5db",
};

// Mũi tên nằm trên nền màu trạng thái. Trắng ăn với 3 màu đậm; xám nhạt của
// offline/lost thì mũi tên trắng biến mất nên đổi sang màu tối.
const statusArrowColor: Record<FleetVehicleMapPoint["status"], string> = {
  disrupted: "#ffffff",
  moving: "#ffffff",
  idle: "#ffffff",
  offline: "#334155",
  lost: "#334155",
};

// Marker xe = đĩa tròn màu trạng thái + mũi tên trắng chỉ hướng chạy bên trong.
// Một Symbol của Google chỉ nhận ĐÚNG MỘT màu fill nên phải xếp chồng hai marker
// cùng toạ độ; chỉ mũi tên xoay, đĩa tròn đứng yên.
//
// Vòng tròn phải vẽ bằng hai nửa cung: cung SVG có điểm đầu trùng điểm cuối là
// suy biến, trình duyệt bỏ qua không vẽ gì.
const vehicleDiscPath =
  "M 0 -11 A 11 11 0 1 0 0 11 A 11 11 0 1 0 0 -11 Z";

// Mũi tên điều hướng: đỉnh ở mũi, khuyết một góc ở đuôi để đọc rõ chiều ngay cả
// khi marker chỉ còn hơn chục pixel. Ở rotation = 0 mũi tên chỉ lên hướng bắc.
const vehicleArrowPath = "M 0 -6.5 L 5 5.5 L 0 2.5 L -5 5.5 Z";

// Chấm tròn cho bến/điểm dừng của tuyến
const stopIconPath = "M 0 -5 A 5 5 0 1 0 0 5 A 5 5 0 1 0 0 -5 Z";

// Marker giữ kích thước pixel cố định ở mọi mức zoom nên phải tự co: zoom rộng
// (nhìn cả tuyến liên tỉnh) thì thu nhỏ để đội xe không dính thành mảng màu che
// bản đồ; zoom sát (nhìn một con đường) thì phóng to để thấy xe đang ở làn nào.
function zoomScale(zoom: number, min: number, max: number) {
  // z<=9 → min, z>=16 → max, ở giữa nội suy tuyến tính
  const ratio = Math.max(0, Math.min(1, (zoom - 9) / 7));
  return min + (max - min) * ratio;
}

const originStopColor = "#0f766e";
const destinationStopColor = "#b45309";
const intermediateStopColor = "#ffffff";

type FleetMapProps = {
  vehicles: FleetVehicleMapPoint[];
  selectedId: string | null;
  focusCenter: GoogleMapCoordinate | null;
  /** Khung nhìn phải bao trọn các điểm này (nguyên tuyến + vị trí xe đang chọn). */
  fitPoints?: GoogleMapCoordinate[];
  /** Bến đi / điểm dừng / bến đến của chuyến đang chọn — vẽ dọc theo lộ trình. */
  routeStops?: TripRouteMarker[];
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

const initialZoom = 11;

function stopColor(kind: TripRouteMarker["kind"]) {
  if (kind === "origin") return originStopColor;
  if (kind === "destination") return destinationStopColor;
  return intermediateStopColor;
}

export default function FleetMap({
  vehicles,
  selectedId,
  focusCenter,
  fitPoints,
  routeStops,
  routeTraveledPath,
  routeRemainingPath,
  trailPath,
  onMarkerSelect,
}: FleetMapProps) {
  const { t } = useTranslation("manager");
  const [zoom, setZoom] = useState(initialZoom);
  const handleZoomChanged = useCallback((next: number) => setZoom(next), []);

  const pointMarkers = useMemo<GoogleMapPointMarker[]>(() => {
    const stopScale = zoomScale(zoom, 0.65, 1.5);

    // Bến/điểm dừng vẽ TRƯỚC để xe luôn nằm đè lên (zIndex thấp hơn)
    const stopMarkers = (routeStops ?? []).map((stop) => ({
      icon: {
        fillColor: stopColor(stop.kind),
        // Điểm đã qua mờ đi để thấy ngay xe đi tới đâu, nhưng vẫn đặc hơn hẳn
        // polyline tuyến (0.55) nên không chìm vào đường.
        fillOpacity: stop.passed ? 0.8 : 1,
        path: stopIconPath,
        scale: (stop.kind === "stop" ? 0.9 : 1.2) * stopScale,
        strokeColor: stop.kind === "stop" ? originStopColor : "#ffffff",
        strokeOpacity: stop.passed ? 0.65 : 1,
        strokeWeight: 2,
      },
      id: `route-${stop.id}`,
      infoTitle: stop.name,
      infoDescription: [
        stop.kind === "origin"
          ? t("gps.originStation")
          : stop.kind === "destination"
            ? t("gps.destinationStation")
            : t("gps.stopPoint"),
        ...(stop.passed ? [t("gps.stopPassed")] : []),
      ],
      position: stop.position,
      title: stop.name,
      // Điểm đã qua lùi xuống dưới điểm chưa qua khi hai marker chồng nhau
      zIndex: stop.passed ? 2 : 3,
    }));

    // Xe mất tín hiệu không có toạ độ thì không có marker — vẫn nằm trong danh sách xe
    const vehicleMarkers = vehicles.flatMap((vehicle) => {
      const position = vehicle.position;
      if (!position) return [];

      const selected = vehicle.id === selectedId;
      const fill = statusFill[vehicle.status];
      const opacity =
        vehicle.status === "lost" ? 0.45 : vehicle.status === "offline" ? 0.7 : 1;
      // Chuyến sự cố và xe đang chọn to hơn để nổi lên giữa đội xe
      const emphasis = selected ? 1.35 : vehicle.status === "disrupted" ? 1.2 : 1;
      // Đĩa tròn gọn hơn hình xe cũ nên dải scale nhích lên để ở zoom rộng vẫn
      // đủ to mà bấm trúng.
      const scale = zoomScale(zoom, 0.7, 1.35) * emphasis;
      const info = {
        infoTitle: vehicle.plate,
        infoDescription: [
          vehicle.driver,
          vehicle.route,
          vehicle.speedKmh == null
            ? t("gps.noSpeedData")
            : `${vehicle.speedKmh} km/h`,
        ],
      };

      // Không biết hướng thì để mũi xe hướng bắc thay vì bịa ra một hướng sai
      const rotation = vehicle.headingDeg ?? 0;
      const baseZIndex = selected ? 20 : 10;

      return [
        // Đĩa tròn — lớp duy nhất mang InfoWindow và onClick. Mũi tên nằm đè lên
        // nhưng không khai onClick/info nên không nhận chuột, click xuyên thẳng
        // xuống đĩa.
        {
          icon: {
            fillColor: fill,
            fillOpacity: opacity,
            path: vehicleDiscPath,
            scale,
            strokeColor: selected ? "#111827" : "#ffffff",
            strokeWeight: selected ? 3 : 2,
          },
          id: `vehicle-${vehicle.id}`,
          ...info,
          onClick: () => onMarkerSelect(vehicle.id),
          position,
          title: vehicle.plate,
          zIndex: baseZIndex,
        },
        {
          icon: {
            fillColor: statusArrowColor[vehicle.status],
            fillOpacity: opacity,
            path: vehicleArrowPath,
            rotation,
            scale,
            strokeWeight: 0,
          },
          id: `vehicle-arrow-${vehicle.id}`,
          position,
          zIndex: baseZIndex + 1,
        },
      ];
    });

    return [...stopMarkers, ...vehicleMarkers];
  }, [onMarkerSelect, routeStops, selectedId, t, vehicles, zoom]);

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
      fitPoints={fitPoints}
      focusCenter={focusCenter}
      onZoomChanged={handleZoomChanged}
      pointMarkers={pointMarkers}
      polylines={polylines}
      scrollWheelZoom
      zoom={initialZoom}
    />
  );
}
