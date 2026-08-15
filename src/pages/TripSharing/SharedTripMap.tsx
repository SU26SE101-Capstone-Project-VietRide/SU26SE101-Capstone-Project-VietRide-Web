import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import GoogleMapCanvas from "../../components/GoogleMapCanvas";
import SharedTripMapLegend from "./SharedTripMapLegend";
import { buildSharedTripMapModel } from "./sharedTripMapModel";
import type { SharedTripContext, SharedTripVehicleLocation } from "./tripShareApi";

type SharedTripMapProps = {
  context: SharedTripContext | null;
  location: SharedTripVehicleLocation | null;
};

/**
 * Bản đồ của link chia sẻ. Dùng CHUNG bản đồ nền + marker + bảng màu với bản đồ
 * tuyến trong app (không còn map style riêng): khách nhận link nhìn thấy đúng
 * tuyến, đúng bến đi/bến đến và đúng điểm dừng như nhà xe thấy trong Trung tâm
 * vận hành.
 */
export default function SharedTripMap({ context, location }: SharedTripMapProps) {
  const { t } = useTranslation("tripShare");

  const model = useMemo(
    () =>
      buildSharedTripMapModel(context, location, {
        origin: t("map.legendOrigin"),
        destination: t("map.legendDestination"),
        stop: t("map.legendStop"),
        vehicle: t("map.vehicle"),
      }),
    [context, location, t],
  );

  const center = useMemo(() => {
    if (model.routePath.length > 0) {
      return model.routePath[Math.floor(model.routePath.length / 2)];
    }
    return model.vehiclePosition ?? { lat: 10.8231, lng: 106.6297 };
  }, [model.routePath, model.vehiclePosition]);

  const fitPoints = useMemo(() => {
    // Khung nhìn cỡ nguyên tuyến giữ nguyên qua từng tick GPS — bám theo xe sẽ
    // làm bản đồ giật/pan liên tục.
    if (model.routePath.length > 0) return model.routePath;
    return model.vehiclePosition ? [model.vehiclePosition] : [];
  }, [model.routePath, model.vehiclePosition]);

  return (
    <div className="relative h-full w-full">
      <GoogleMapCanvas
        ariaLabel={t("map.ariaLabel")}
        center={center}
        className="h-full w-full"
        errorFallback={t("map.unavailable")}
        fitPoints={fitPoints.length > 0 ? fitPoints : undefined}
        pointMarkers={model.markers}
        polylines={model.polylines}
        scrollWheelZoom
        zoom={model.vehiclePosition ? 13 : 11}
      />

      {/* Ghi chú nằm ĐÈ lên bản đồ để không ăn chiều cao của bản đồ trên máy
          điện thoại — khách mở link chủ yếu bằng điện thoại. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 lg:inset-x-5 lg:bottom-5">
        <div className="pointer-events-auto overflow-x-auto">
          <SharedTripMapLegend
            showRoute={model.hasRoute}
            showStops={model.hasStops}
            showTraveled={model.hasTraveledSegment}
            showVehicle={model.hasVehicle}
          />
        </div>
      </div>
    </div>
  );
}
