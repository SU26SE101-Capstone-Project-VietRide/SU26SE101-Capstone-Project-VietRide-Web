import { useTranslation } from "react-i18next";

// Chú giải màu trạng thái xe, nổi ở góc dưới trái bản đồ
export default function FleetMapLegend() {
  const { t } = useTranslation("manager");

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-2">
      <div className="pointer-events-auto rounded-lg border border-gray-200/90 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
        <p className="font-semibold text-gray-800">{t("gps.legend")}</p>
        <div className="mt-1.5 flex flex-col gap-1 text-gray-600">
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
      </div>
    </div>
  );
}
