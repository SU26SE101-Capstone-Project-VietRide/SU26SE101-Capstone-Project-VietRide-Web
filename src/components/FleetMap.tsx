import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import GoogleMapCanvas, {
  type GoogleMapPointMarker,
} from "./GoogleMapCanvas";
import type { GoogleMapCoordinate } from "../lib/googleMaps";
import {
  routeEndpointPinPath,
  stopNumberPath,
  vehicleArrowPath,
  vehicleDiscPath,
} from "./mapMarkerPaths";
import {
  destinationStopColor,
  intermediateStopColor,
  originStopColor,
  routeEndpointPinScale,
  routeRemainingColor,
  routeStopBadgeScale,
  routeTraveledColor,
  vehicleIdleColor,
  vehicleMovingColor,
} from "./mapRouteStyle";
import type { FleetVehicleMapPoint, TripRouteMarker } from "./fleetMapPoint";

export type { FleetVehicleMapPoint };

const statusFill: Record<FleetVehicleMapPoint["status"], string> = {
  disrupted: "#dc2626",
  moving: vehicleMovingColor,
  idle: vehicleIdleColor,
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

// Bến đi/bến đến/điểm dừng/marker xe dùng CHUNG hình và bảng màu với màn Tuyến
// & điểm dừng và trang chia sẻ hành trình (components/mapMarkerPaths +
// mapRouteStyle) — cùng một tuyến nhìn ở ba nơi phải ra một kiểu.

// Marker giữ kích thước pixel cố định ở mọi mức zoom nên phải tự co: zoom rộng
// (nhìn cả tuyến liên tỉnh) thì thu nhỏ để đội xe không dính thành mảng màu che
// bản đồ; zoom sát (nhìn một con đường) thì phóng to để thấy xe đang ở làn nào.
function zoomScale(zoom: number, min: number, max: number) {
  // z<=9 → min, z>=16 → max, ở giữa nội suy tuyến tính
  const ratio = Math.max(0, Math.min(1, (zoom - 9) / 7));
  return min + (max - min) * ratio;
}


type FleetMapProps = {
  vehicles: FleetVehicleMapPoint[];
  selectedId: string | null;
  focusCenter: GoogleMapCoordinate | null;
  /** Mức zoom khoá khi bắt đầu bám xe — chỉ áp một lần mỗi lượt bám. */
  focusZoom?: number;
  /** Khung nhìn phải bao trọn các điểm này (nguyên tuyến + vị trí xe đang chọn). */
  fitPoints?: GoogleMapCoordinate[];
  /** Bến đi / điểm dừng / bến đến của chuyến đang chọn — vẽ dọc theo lộ trình. */
  routeStops?: TripRouteMarker[];
  /** Đoạn tuyến xe đã đi qua — tô đậm. */
  routeTraveledPath?: GoogleMapCoordinate[] | null;
  /** Đoạn tuyến còn lại phía trước — tô nhạt hơn để phân biệt với đoạn đã đi. */
  routeRemainingPath?: GoogleMapCoordinate[] | null;
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
  focusZoom,
  fitPoints,
  routeStops,
  routeTraveledPath,
  routeRemainingPath,
  onMarkerSelect,
}: FleetMapProps) {
  const { t } = useTranslation("manager");
  const [zoom, setZoom] = useState(initialZoom);
  const handleZoomChanged = useCallback((next: number) => setZoom(next), []);

  const pointMarkers = useMemo<GoogleMapPointMarker[]>(() => {
    // Bến/điểm dừng vẽ TRƯỚC để xe luôn nằm đè lên (zIndex thấp hơn)
    const stopMarkers = (routeStops ?? []).map((stop): GoogleMapPointMarker => {
      const isEndpoint = stop.kind !== "stop";

      return {
        icon: {
          fillColor: stopColor(stop.kind),
          // Điểm đã qua mờ đi để thấy ngay xe đi tới đâu, nhưng vẫn đặc hơn hẳn
          // polyline tuyến nên không chìm vào đường.
          fillOpacity: stop.passed ? 0.8 : 1,
          path: isEndpoint ? routeEndpointPinPath : stopNumberPath,
          scale: isEndpoint ? routeEndpointPinScale : routeStopBadgeScale,
          strokeColor: isEndpoint ? "#ffffff" : originStopColor,
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
        // Số thứ tự điểm dừng ngay trong đĩa — đọc được thứ tự chạy mà không
        // phải bấm từng marker (giống marker 1..N của màn Tuyến & điểm dừng)
        ...(stop.orderIndex
          ? {
              label: {
                color: originStopColor,
                fontSize: "11px",
                fontWeight: "700",
                text: String(stop.orderIndex),
              },
            }
          : {}),
        position: stop.position,
        title: stop.name,
        // Điểm đã qua lùi xuống dưới điểm chưa qua khi hai marker chồng nhau
        zIndex: stop.passed ? 2 : 3,
      };
    });

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
    // Bản đồ CHỈ vẽ tuyến nhà xe đã set up, không vẽ đường xe thực đi: điểm GPS
    // bắn thưa/nhảy cóc nên nối chúng lại là bịa ra một lộ trình không có thật.
    // Vị trí xe thể hiện bằng marker, tiến độ thể hiện bằng đoạn đã đi/chưa đi
    // của chính tuyến đó (chiếu vị trí xe lên tuyến, xem splitRouteAtPosition).
    //
    // Vẽ đoạn CHƯA đi trước để đoạn đã đi nằm đè lên trên.
    if (routeRemainingPath && routeRemainingPath.length > 1) {
      lines.push({
        id: "selected-trip-route-remaining",
        path: routeRemainingPath,
        color: routeRemainingColor,
        opacity: 0.95,
        weight: 5,
      });
    }
    if (routeTraveledPath && routeTraveledPath.length > 1) {
      lines.push({
        id: "selected-trip-route-traveled",
        path: routeTraveledPath,
        color: routeTraveledColor,
        opacity: 1,
        weight: 6,
      });
    }
    return lines;
  }, [routeRemainingPath, routeTraveledPath]);

  return (
    <GoogleMapCanvas
      ariaLabel={t("gps.fleetMapAria")}
      center={defaultCenter}
      className="h-full min-h-[420px] w-full rounded-xl"
      emptyState={t("gps.noVehiclesMatchFilter")}
      fitPoints={fitPoints}
      focusCenter={focusCenter}
      focusZoom={focusZoom}
      onZoomChanged={handleZoomChanged}
      pointMarkers={pointMarkers}
      polylines={polylines}
      scrollWheelZoom
      zoom={initialZoom}
    />
  );
}
