// Chú giải bản đồ cho trang chia sẻ hành trình — cùng ngôn ngữ màu với bản đồ
// tuyến trong hệ thống, nhưng giữ dạng một hàng ngang để không che quá nhiều
// không gian bản đồ trên điện thoại.
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";

import {
  destinationStopColor,
  originStopColor,
  routeRemainingColor,
  routeTraveledColor,
  vehicleMovingColor,
} from "../../components/mapRouteStyle";

type SharedTripMapLegendProps = {
  showRoute: boolean;
  showEndpoints: boolean;
  showStops: boolean;
  showTraveled: boolean;
  showVehicle: boolean;
};

function LineLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
      <span
        aria-hidden="true"
        className="h-1.5 w-6 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export default function SharedTripMapLegend({
  showRoute,
  showEndpoints,
  showStops,
  showTraveled,
  showVehicle,
}: SharedTripMapLegendProps) {
  const { t } = useTranslation("tripShare");

  return (
    <aside
      aria-label={t("map.legend")}
      data-testid="shared-trip-map-legend"
      className="flex w-max min-w-full flex-nowrap items-center gap-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm"
    >
      {showVehicle ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: vehicleMovingColor }}
          />
          {t("map.legendVehicle")}
        </span>
      ) : null}
      {showEndpoints ? (
        <>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
            <FiMapPin aria-hidden="true" color={originStopColor} size={15} />
            {t("map.legendOrigin")}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
            <FiMapPin aria-hidden="true" color={destinationStopColor} size={15} />
            {t("map.legendDestination")}
          </span>
        </>
      ) : null}
      {showStops ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[9px] font-bold"
            style={{ borderColor: originStopColor, color: originStopColor }}
          >
            1
          </span>
          {t("map.legendStop")}
        </span>
      ) : null}
      {showTraveled ? (
        <LineLegendItem color={routeTraveledColor} label={t("map.legendTraveled")} />
      ) : null}
      {showRoute ? (
        <LineLegendItem color={routeRemainingColor} label={t("map.legendRemaining")} />
      ) : null}
      <span className="hidden shrink-0 text-xs text-slate-500 md:inline">
        {t("map.legendNote")}
      </span>
    </aside>
  );
}
