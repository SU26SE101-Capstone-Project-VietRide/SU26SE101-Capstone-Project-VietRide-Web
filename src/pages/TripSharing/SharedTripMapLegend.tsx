// Chú giải bản đồ cho trang chia sẻ hành trình — cùng kiểu THANH NGANG như chú
// giải màn Tuyến & điểm dừng và Trung tâm vận hành, chỉ giữ những mục khách
// nhận link thực sự thấy trên bản đồ (không có trạng thái đội xe).
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
  /** Có vẽ tuyến (và do đó có pin bến đi/bến đến) không */
  showRoute: boolean;
  /** Có điểm dừng giữa tuyến (đĩa đánh số) không */
  showStops: boolean;
  /** Có đoạn tuyến xe đã đi qua không */
  showTraveled: boolean;
  /** Có marker xe trên bản đồ không */
  showVehicle: boolean;
};

function LineLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
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
  showStops,
  showTraveled,
  showVehicle,
}: SharedTripMapLegendProps) {
  const { t } = useTranslation("tripShare");

  return (
    <aside
      aria-label={t("map.legend")}
      data-testid="shared-trip-map-legend"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
    >
      {showRoute && (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <FiMapPin aria-hidden="true" color={originStopColor} size={15} />
            {t("map.legendOrigin")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <FiMapPin aria-hidden="true" color={destinationStopColor} size={15} />
            {t("map.legendDestination")}
          </span>
        </>
      )}
      {showStops && (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[9px] font-bold"
            style={{ borderColor: originStopColor, color: originStopColor }}
          >
            1
          </span>
          {t("map.legendStop")}
        </span>
      )}
      {showTraveled && (
        <LineLegendItem
          color={routeTraveledColor}
          label={t("map.legendTraveled")}
        />
      )}
      {showRoute && (
        <LineLegendItem
          color={routeRemainingColor}
          label={t("map.legendRemaining")}
        />
      )}
      {showVehicle && (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: vehicleMovingColor }}
          />
          {t("map.legendVehicle")}
        </span>
      )}
      <span className="ml-auto text-xs text-gray-400">{t("map.legendNote")}</span>
    </aside>
  );
}
