// Chú giải bản đồ Trung tâm vận hành — cùng kiểu THANH NGANG nằm trên bản đồ
// như chú giải màn Tuyến & điểm dừng (RouteMapLegend), để hai màn đọc giống
// nhau. Khác một điểm: ở đây không có "Phương án tuyến khác" (màn vận hành chỉ
// theo dõi tuyến đã set up), bù lại có thêm màu trạng thái xe.
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import {
  destinationStopColor,
  originStopColor,
  routeRemainingColor,
  routeTraveledColor,
} from "../../../components/mapRouteStyle";

type FleetMapLegendProps = {
  /** Có đang vẽ đoạn tuyến xe đã đi qua không */
  showTraveledLine?: boolean;
  /** Có đang vẽ đoạn tuyến còn lại phía trước không */
  showRemainingLine?: boolean;
  /** Có đang vẽ marker bến đi/bến đến của tuyến không */
  showRouteStations?: boolean;
  /** Có điểm dừng giữa tuyến (đĩa đánh số) không */
  showRouteStops?: boolean;
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

function StatusLegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

export default function FleetMapLegend({
  showTraveledLine = false,
  showRemainingLine = false,
  showRouteStations = false,
  showRouteStops = false,
}: FleetMapLegendProps) {
  const { t } = useTranslation("manager");

  return (
    <aside
      aria-label={t("gps.legend")}
      data-testid="fleet-map-legend"
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
    >
      {/* Tuyến đã set up: bến đi → điểm dừng đánh số → bến đến, y như màn soạn tuyến */}
      {showRouteStations && (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <FiMapPin aria-hidden="true" color={originStopColor} size={15} />
            {t("gps.originStation")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <FiMapPin aria-hidden="true" color={destinationStopColor} size={15} />
            {t("gps.destinationStation")}
          </span>
        </>
      )}
      {showRouteStops && (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[9px] font-bold"
            style={{ borderColor: originStopColor, color: originStopColor }}
          >
            1
          </span>
          {t("gps.stopPoint")}
        </span>
      )}
      {showTraveledLine && (
        <LineLegendItem
          color={routeTraveledColor}
          label={t("gps.legendTraveledLine")}
        />
      )}
      {showRemainingLine && (
        <LineLegendItem
          color={routeRemainingColor}
          label={t("gps.legendRemainingLine")}
        />
      )}

      {/* Trạng thái xe — phần riêng của màn vận hành, màn soạn tuyến không có */}
      <span aria-hidden="true" className="h-4 w-px bg-gray-200" />
      <StatusLegendItem className="bg-red-500" label={t("gps.disruptedStatus")} />
      <StatusLegendItem className="bg-emerald-500" label={t("gps.moving")} />
      <StatusLegendItem className="bg-amber-500" label={t("gps.stopped")} />
      <StatusLegendItem
        className="bg-gray-400"
        label={t("gps.signalLostStatus")}
      />
    </aside>
  );
}
