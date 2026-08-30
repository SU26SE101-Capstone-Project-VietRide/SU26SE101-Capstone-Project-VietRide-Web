import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCrosshair, FiMaximize2 } from "react-icons/fi";

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
 * tuyến trong app: khách nhận link nhìn thấy đúng tuyến, đúng bến đi/bến đến và
 * đúng điểm dừng như nhà xe thấy trong Trung tâm vận hành.
 */
export default function SharedTripMap({ context, location }: SharedTripMapProps) {
  const { t } = useTranslation("tripShare");
  const [followVehicle, setFollowVehicle] = useState(false);
  const [fitSequence, setFitSequence] = useState(0);

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

  const fitKey = useMemo(() => {
    if (isFollowingVehicle) return "follow-vehicle";
    return `fit-route-${fitSequence}`;
  }, [isFollowingVehicle, fitSequence]);

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
    <div className="relative h-full w-full">
      <GoogleMapCanvas
        ariaLabel={t("map.ariaLabel")}
        center={center}
        className="h-full w-full"
        errorFallback={t("map.unavailable")}
        fitKey={fitKey}
        fitPoints={fitPoints.length > 0 ? fitPoints : undefined}
        focusCenter={isFollowingVehicle ? model.vehiclePosition : null}
        focusZoom={15}
        pointMarkers={model.markers}
        polylines={model.polylines}
        scrollWheelZoom
        zoom={model.vehiclePosition ? 13 : 11}
      />

      {model.hasVehicle && (
        <div className="absolute left-3 top-3 z-10 lg:left-5 lg:top-5">
          <button
            type="button"
            data-testid="follow-vehicle-toggle"
            aria-pressed={isFollowingVehicle}
            onClick={handleToggleFollow}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-md backdrop-blur-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-vr-700 focus-visible:ring-offset-2 ${
              isFollowingVehicle
                ? "border-vr-300 bg-vr-50/95 text-vr-900 ring-1 ring-vr-400 hover:bg-vr-100"
                : "border-slate-200 bg-white/95 text-slate-800 hover:bg-slate-50"
            }`}
          >
            {isFollowingVehicle ? (
              <FiMaximize2 className="h-4 w-4 shrink-0 text-vr-700" aria-hidden />
            ) : (
              <FiCrosshair className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
            )}
            <span>
              {isFollowingVehicle ? t("map.viewWholeRoute") : t("map.focusVehicle")}
            </span>
          </button>
        </div>
      )}

      {/* Ghi chú nằm ĐÈ lên bản đồ để không ăn chiều cao của bản đồ trên máy
          điện thoại — khách mở link chủ yếu bằng điện thoại. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 lg:inset-x-5 lg:bottom-5">
        <div className="pointer-events-auto overflow-x-auto">
          <SharedTripMapLegend
            showRoute={model.hasRoute}
            showEndpoints={model.hasEndpoints}
            showStops={model.hasStops}
            showTraveled={model.hasTraveledSegment}
            showVehicle={model.hasVehicle}
          />
        </div>
      </div>
    </div>
  );
}

