import type {
  GoogleMapPointMarker,
  GoogleMapPolyline,
} from "../../components/GoogleMapCanvas";
import {
  routeEndpointPinPath,
  stopNumberPath,
  vehicleArrowPath,
  vehicleDiscPath,
} from "../../components/mapMarkerPaths";
import type { GoogleMapCoordinate } from "../../lib/googleMaps";
// Chiếu vị trí xe lên tuyến để cắt đoạn "đã đi"/"còn lại" — dùng CHUNG hàm với
// Trung tâm vận hành thay vì chép lại phép chiếu, để hai bản đồ cắt giống nhau.
import { splitRouteAtPosition } from "../Manager/Operations/gpsHelpers";
import {
  isVehicleReplacementPending,
  type SharedTripContext,
  type SharedTripVehicleLocation,
} from "./tripShareApi";
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
} from "./sharedTripVisualStyle";

/** Dưới ngưỡng này coi như xe đang dừng/đỗ chứ không phải đang chạy. */
const MOVING_SPEED_KPH = 5;

export type SharedTripMapLabels = {
  origin: string;
  destination: string;
  stop: string;
  vehicle: string;
};

export type SharedTripMapModel = {
  routePath: GoogleMapCoordinate[];
  vehiclePosition: GoogleMapCoordinate | null;
  markers: GoogleMapPointMarker[];
  polylines: GoogleMapPolyline[];
  /**
   * Mọi điểm khung nhìn phải bao trọn: cả tuyến, cả marker, cả xe. Tuyến chưa
   * có polyline thì đây là thứ duy nhất giữ được bến/điểm dừng trong màn hình.
   */
  focusPoints: GoogleMapCoordinate[];
  /** Cờ bật/tắt từng mục của chú giải — không vẽ gì thì không chú giải thứ đó. */
  hasRoute: boolean;
  hasEndpoints: boolean;
  hasStops: boolean;
  hasTraveledSegment: boolean;
  hasVehicle: boolean;
};

/**
 * Dựng marker + polyline cho bản đồ chia sẻ hành trình. Hình marker và logic
 * khung nhìn giữ nguyên; palette được scope riêng để khớp Passenger Mobile mà
 * không đổi giao diện bản đồ vận hành của Admin/Manager.
 *
 * Hàm thuần, không đụng Google Maps SDK nên test được thẳng.
 */
export function buildSharedTripMapModel(
  context: SharedTripContext | null,
  location: SharedTripVehicleLocation | null,
  labels: SharedTripMapLabels,
): SharedTripMapModel {
  const routePath: GoogleMapCoordinate[] = (
    context?.route.geometry?.coordinates ?? []
  ).map(([lng, lat]) => ({ lat, lng }));

  const vehiclePosition = location
    ? { lat: location.latitude, lng: location.longitude }
    : null;
  const replacementPending = isVehicleReplacementPending(context?.status);

  // `parseStops` đã sắp theo `sequence`, nhưng sắp lại ở đây để số trên đĩa luôn
  // bám thứ tự chạy kể cả khi context tới từ nguồn khác (vd cập nhật realtime).
  const stops = [...(context?.route.stops ?? [])].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const markers: GoogleMapPointMarker[] = [];

  // Toạ độ hai bến lấy thẳng từ `route.origin` / `route.destination`, KHÔNG suy
  // từ hai đầu geometry nữa: tuyến chưa lưu polyline vẫn phải chấm được bến.
  // BE có thể trả null cho từng bến — thiếu bến nào thì bỏ marker bến đó chứ
  // không lùi về một toạ độ đoán.
  const origin = context?.route.origin ?? null;
  const destination = context?.route.destination ?? null;

  if (origin) {
    markers.push({
      icon: {
        fillColor: originStopColor,
        fillOpacity: 1,
        path: routeEndpointPinPath,
        scale: routeEndpointPinScale,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      id: "route-origin",
      infoDescription: [labels.origin],
      infoTitle: context?.route.originName,
      position: { lat: origin.latitude, lng: origin.longitude },
      title: context?.route.originName,
      zIndex: 3,
    });
  }
  // Điểm dừng giữa tuyến: đĩa trắng viền teal, đánh số 1..N theo thứ tự chạy —
  // giống hệt marker điểm dừng của màn Tuyến & điểm dừng. `stops` đã được
  // `parseStops` sắp theo `sequence` nên số trên đĩa bám đúng thứ tự BE trả.
  stops.forEach((stop, index) => {
    markers.push({
      icon: {
        fillColor: intermediateStopColor,
        fillOpacity: 1,
        path: stopNumberPath,
        scale: routeStopBadgeScale,
        strokeColor: originStopColor,
        strokeWeight: 2,
      },
      id: `route-stop-${index}`,
      infoDescription: [labels.stop],
      infoTitle: stop.name,
      label: {
        color: originStopColor,
        fontSize: "11px",
        fontWeight: "700",
        text: String(index + 1),
      },
      position: { lat: stop.latitude, lng: stop.longitude },
      title: stop.name,
      zIndex: 2,
    });
  });

  // Bến đến đứng cuối để thứ tự marker đúng chiều chạy origin → stops →
  // destination, khớp thứ tự BE mô tả.
  if (destination) {
    markers.push({
      icon: {
        fillColor: destinationStopColor,
        fillOpacity: 1,
        path: routeEndpointPinPath,
        scale: routeEndpointPinScale,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      id: "route-destination",
      infoDescription: [labels.destination],
      infoTitle: context?.route.destinationName,
      position: { lat: destination.latitude, lng: destination.longitude },
      title: context?.route.destinationName,
      zIndex: 3,
    });
  }

  // Xe: đĩa màu trạng thái + mũi tên chỉ hướng chạy đè lên, xếp chồng hai marker
  // cùng toạ độ vì một Symbol chỉ nhận một màu fill.
  if (vehiclePosition) {
    const moving = (location?.speedKph ?? 0) >= MOVING_SPEED_KPH;
    const fill = replacementPending
      ? vehicleIdleColor
      : moving
        ? vehicleMovingColor
        : vehicleIdleColor;
    markers.push({
      icon: {
        fillColor: fill,
        fillOpacity: 1,
        path: vehicleDiscPath,
        scale: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      id: "vehicle",
      infoTitle: labels.vehicle,
      position: vehiclePosition,
      title: labels.vehicle,
      zIndex: 10,
    });
    markers.push({
      icon: {
        fillColor: "#ffffff",
        fillOpacity: 1,
        path: vehicleArrowPath,
        // Không biết hướng thì để mũi xe hướng bắc thay vì bịa ra hướng sai.
        rotation: location?.heading ?? 0,
        scale: 1,
        strokeWeight: 0,
      },
      id: "vehicle-arrow",
      position: vehiclePosition,
      zIndex: 11,
    });
  }

  // Chỉ vẽ tuyến nhà xe đã set up; tiến độ thể hiện bằng đoạn đã đi/chưa đi của
  // chính tuyến đó, KHÔNG nối các điểm GPS lại thành lộ trình bịa.
  const { traveled, remaining } = splitRouteAtPosition(routePath, vehiclePosition);
  const polylines: GoogleMapPolyline[] = [];
  if (remaining.length > 1) {
    polylines.push({
      color: routeRemainingColor,
      id: "shared-route-remaining",
      opacity: 0.95,
      path: remaining,
      weight: 5,
      zIndex: 1,
    });
  }
  if (traveled.length > 1) {
    polylines.push({
      color: routeTraveledColor,
      id: "shared-route-traveled",
      opacity: 1,
      path: traveled,
      weight: 6,
      zIndex: 2,
    });
  }

  // Gom mọi thứ đang vẽ: tuyến (nếu có) + toạ độ từng marker. Chỉ lấy routePath
  // như trước thì tuyến chưa có polyline sẽ khiến bản đồ rơi về tâm mặc định và
  // bến/điểm dừng nằm ngoài khung nhìn.
  const focusPoints: GoogleMapCoordinate[] = [
    ...routePath,
    ...markers.map((marker) => marker.position),
  ];

  return {
    routePath,
    vehiclePosition,
    markers,
    polylines,
    focusPoints,
    hasRoute: routePath.length > 1,
    hasEndpoints: origin !== null || destination !== null,
    hasStops: stops.length > 0,
    hasTraveledSegment: traveled.length > 1,
    hasVehicle: vehiclePosition !== null,
  };
}
