import { useTranslation } from "react-i18next";

type FleetMapLegendProps = {
  /** Có đang vẽ đoạn tuyến xe đã đi qua không */
  showTraveledLine?: boolean;
  /** Có đang vẽ đoạn tuyến còn lại phía trước không */
  showRemainingLine?: boolean;
  /** Có đang vẽ hành trình GPS đã đi không */
  showTrailLine?: boolean;
};

// Giữ đồng bộ với màu polyline trong FleetMap
const traveledLineColor = "#0f766e";
const remainingLineColor = "#94a3b8";
const trailLineColor = "#2563eb";

// Chú giải màu trạng thái xe, nổi ở góc dưới trái bản đồ
export default function FleetMapLegend({
  showTraveledLine = false,
  showRemainingLine = false,
  showTrailLine = false,
}: FleetMapLegendProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-2">
      <div className="pointer-events-auto rounded-lg border border-gray-200/90 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
        <p className="font-semibold text-gray-800">{t("gps.legend")}</p>
        <div className="mt-1.5 flex flex-col gap-1 text-gray-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            {t("gps.disruptedStatus")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {t("gps.moving")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            {t("gps.stopped")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
            {t("gps.signalLostStatus")}
          </span>
        </div>

        {/* Bản đồ vẽ hai đường màu khác nhau nhưng trước đây không chú giải —
            người dùng không biết đâu là tuyến kế hoạch, đâu là đường đã đi. */}
        {(showTraveledLine || showRemainingLine || showTrailLine) && (
          <div className="mt-2 flex flex-col gap-1 border-t border-gray-200 pt-2 text-gray-600">
            {showTraveledLine && (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-1.5 w-5 shrink-0 rounded-full"
                  style={{ backgroundColor: traveledLineColor }}
                />
                {t("gps.legendTraveledLine")}
              </span>
            )}
            {showRemainingLine && (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-1 w-5 shrink-0 rounded-full"
                  style={{ backgroundColor: remainingLineColor }}
                />
                {t("gps.legendRemainingLine")}
              </span>
            )}
            {showTrailLine && (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-1 w-5 shrink-0 rounded-full"
                  style={{ backgroundColor: trailLineColor }}
                />
                {t("gps.legendTrailLine")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
