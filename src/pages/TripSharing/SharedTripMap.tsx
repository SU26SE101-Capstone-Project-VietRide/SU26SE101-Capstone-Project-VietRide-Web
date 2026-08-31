import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCrosshair, FiMaximize2 } from "react-icons/fi";

import GoogleMapCanvas from "../../components/GoogleMapCanvas";
import SharedTripMapLegend from "./SharedTripMapLegend";
import { buildSharedTripMapModel } from "./sharedTripMapModel";
import { sharedTripMapStyleUrl } from "./sharedTripVisualStyle";
import {
  isVehicleReplacementPending,
  type SharedTripContext,
  type SharedTripVehicleLocation,
} from "./tripShareApi";

type SharedTripMapProps = {
  context: SharedTripContext | null;
  location: SharedTripVehicleLocation | null;
};

/**
 * Bản đồ của link chia sẻ. Dùng CHUNG bản đồ nền + marker + bảng màu với bản đồ
 * tuyến trong app: khách nhận link nhìn thấy đúng tuyến, đúng bến đi/bến đến và
 * đúng điểm dừng như nhà xe thấy trong Trung tâm vận hành.
 */
export default function SharedTripMap({ context, location }: SharedTripMapProps) {
  const { t } = useTranslation("tripShare");
  const [followVehicle, setFollowVehicle] = useState(false);
  const [fitSequence, setFitSequence] = useState(0);
  const replacementPending = isVehicleReplacementPending(context?.status);
  const vehicleLabel = replacementPending
    ? t("map.vehicleBeforeReplacement")
    : t("map.vehicle");

  const model = useMemo(
    () =>
      buildSharedTripMapModel(context, location, {
        origin: t("map.legendOrigin"),
        destination: t("map.legendDestination"),
        stop: t("map.legendStop"),
        vehicle: vehicleLabel,
      }),
    [context, location, t, vehicleLabel],
  );

  const hasVehicle = Boolean(model.vehiclePosition);
  const isFollowingVehicle = hasVehicle && followVehicle;

  const center = useMemo(() => {
    if (model.routePath.length > 0) {
      return model.routePath[Math.floor(model.routePath.length / 2)];
    }
    return (
      model.vehiclePosition ??
      model.focusPoints[0] ?? { lat: 10.8231, lng: 106.6297 }
    );
  }, [model.focusPoints, model.routePath, model.vehiclePosition]);

  const fitPoints = useMemo(() => {
    if (isFollowingVehicle) return [];
    if (model.focusPoints.length > 0) return model.focusPoints;
    return model.vehiclePosition ? [model.vehiclePosition] : [];
  }, [isFollowingVehicle, model.focusPoints, model.vehiclePosition]);

  // Giữ key của viewport toàn tuyến ổn định trong lúc bám xe. Nếu đổi key sang
  // một giá trị riêng khi `fitPoints` đang rỗng, GoogleMapCanvas không thể ghi
  // nhận lượt fit đó; mỗi GPS update sau đó sẽ chạy lại setCenter/setZoom của
  // toàn tuyến trước khi panTo xe. Chỉ tạo lượt fit mới khi người dùng chủ động
  // rời focus mode để xem lại toàn tuyến.
  const fitKey = `fit-route-${fitSequence}`;

  const handleToggleFollow = () => {
    setFollowVehicle((prev) => {
      const next = !prev;
      if (!next) {
        setFitSequence((seq) => seq + 1);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Giữ chú giải ngoài canvas: không che tuyến và các control của bản đồ. */}
      <div className="border-b border-[#007A76]/15 bg-white/95 px-3 py-2.5 lg:px-4">
        <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <SharedTripMapLegend
            showRoute={model.hasRoute}
            showEndpoints={model.hasEndpoints}
            showStops={model.hasStops}
            showTraveled={model.hasTraveledSegment}
            showVehicle={model.hasVehicle}
            vehicleReplacementPending={replacementPending}
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 [&_.mapboxgl-ctrl-group]:overflow-hidden [&_.mapboxgl-ctrl-group]:rounded-xl [&_.mapboxgl-ctrl-group]:border [&_.mapboxgl-ctrl-group]:border-white/80 [&_.mapboxgl-ctrl-group]:shadow-[0_10px_28px_-14px_rgba(19,33,31,0.45)] [&_.mapboxgl-ctrl-group_button]:h-10 [&_.mapboxgl-ctrl-group_button]:w-10 [&_.mapboxgl-ctrl-top-right]:right-1 [&_.mapboxgl-ctrl-top-right]:top-1">
        <GoogleMapCanvas
          ariaLabel={t("map.ariaLabel")}
          center={center}
          className="h-full w-full"
          errorFallback={t("map.unavailable")}
          fitKey={fitKey}
          fitPoints={fitPoints.length > 0 ? fitPoints : undefined}
          focusCenter={isFollowingVehicle ? model.vehiclePosition : null}
          focusZoom={15}
          mapStyleUrl={sharedTripMapStyleUrl}
          pointMarkers={model.markers}
          polylines={model.polylines}
          scrollWheelZoom
          suspendViewportSync={isFollowingVehicle}
          zoom={model.vehiclePosition ? 13 : 11}
        />

        {model.hasVehicle && (
          <div className="absolute left-3 top-3 z-20 lg:left-4 lg:top-4">
            <button
              type="button"
              data-testid="follow-vehicle-toggle"
              aria-pressed={isFollowingVehicle}
              onClick={handleToggleFollow}
              className={`inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-[0_12px_28px_-18px_rgba(0,86,83,0.8)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007A76] focus-visible:ring-offset-2 ${
                isFollowingVehicle
                  ? "border-[#007A76]/35 bg-[#E7F8F7]/95 text-[#005653] ring-1 ring-[#007A76]/20 hover:bg-[#D5F2F0]"
                  : "border-white/80 bg-white/95 text-[#13211F] hover:border-[#007A76]/25 hover:bg-[#F4F8FA]"
              }`}
            >
              {isFollowingVehicle ? (
                <FiMaximize2 className="h-4 w-4 shrink-0 text-[#007A76]" aria-hidden />
              ) : (
                <FiCrosshair className="h-4 w-4 shrink-0 text-[#627A77]" aria-hidden />
              )}
              <span>
                {isFollowingVehicle ? t("map.viewWholeRoute") : vehicleLabel}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

