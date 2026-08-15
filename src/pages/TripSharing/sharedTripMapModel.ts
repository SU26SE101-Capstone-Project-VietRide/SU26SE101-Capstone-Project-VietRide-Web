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
} from "../../components/mapRouteStyle";
import type { GoogleMapCoordinate } from "../../lib/googleMaps";
// Chiếu vị trí xe lên tuyến để cắt đoạn "đã đi"/"còn lại" — dùng CHUNG hàm với
// Trung tâm vận hành thay vì chép lại phép chiếu, để hai bản đồ cắt giống nhau.
import { splitRouteAtPosition } from "../Manager/Operations/gpsHelpers";
import type { SharedTripContext, SharedTripVehicleLocation } from "./tripShareApi";

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
  /** Cờ bật/tắt từng mục của chú giải — không vẽ gì thì không chú giải thứ đó. */
  hasRoute: boolean;
  hasStops: boolean;
  hasTraveledSegment: boolean;
  hasVehicle: boolean;
};

/**
 * Dựng marker + polyline cho bản đồ chia sẻ hành trình, dùng ĐÚNG hình và bảng
 * màu của bản đồ tuyến trong app (bến đi pin teal, bến đến pin đỏ, điểm dừng
 * đĩa trắng đánh số, đoạn đã đi đậm / còn lại nhạt, xe là đĩa + mũi tên hướng).
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

  const stops = context?.route.stops ?? [];
  const markers: GoogleMapPointMarker[] = [];

  // Bến đi/bến đến lấy từ hai đầu geometry: đó là hai đầu thật của tuyến đã set
  // up, không phải điểm GPS đầu tiên nhận được.
  if (routePath.length > 0) {
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
      position: routePath[0],
      title: context?.route.originName,
      zIndex: 3,
    });
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
      position: routePath[routePath.length - 1],
      title: context?.route.destinationName,
      zIndex: 3,
    });
  }

  // Điểm dừng giữa tuyến: đĩa trắng viền teal, đánh số 1..N theo thứ tự chạy —
  // giống hệt marker điểm dừng của màn Tuyến & điểm dừng.
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

  // Xe: đĩa màu trạng thái + mũi tên chỉ hướng chạy đè lên, xếp chồng hai marker
  // cùng toạ độ vì một Symbol chỉ nhận một màu fill.
  if (vehiclePosition) {
    const moving = (location?.speedKph ?? 0) >= MOVING_SPEED_KPH;
    const fill = moving ? vehicleMovingColor : vehicleIdleColor;
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

  return {
    routePath,
    vehiclePosition,
    markers,
    polylines,
    hasRoute: routePath.length > 1,
    hasStops: stops.length > 0,
    hasTraveledSegment: traveled.length > 1,
    hasVehicle: vehiclePosition !== null,
  };
}
