import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import type { RouteTab } from "./routeFormUtils";

type RouteMapLegendProps = {
  panelMode: Extract<RouteTab, "info" | "stops">;
};

const originColor = "#0f766e";
const destinationColor = "#dc2626";
const otherRouteColor = "#64748b";

function DotLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span
        aria-hidden="true"
        className="h-3 w-3 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function LineLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span
        aria-hidden="true"
        className="h-1 w-6 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export default function RouteMapLegend({ panelMode }: RouteMapLegendProps) {
  const { t } = useTranslation("manager");

  return (
    <aside
      aria-label={t("routes.mapLegend")}
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
      data-testid="route-map-legend"
    >
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
        <FiMapPin aria-hidden="true" color={originColor} size={15} />
        {t("routes.legendOrigin")}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
        <FiMapPin aria-hidden="true" color={destinationColor} size={15} />
        {t("routes.legendDestination")}
      </span>
      <LineLegendItem
        color={originColor}
        label={t("routes.legendSelectedRoute")}
      />
      <LineLegendItem
        color={otherRouteColor}
        label={t("routes.legendOtherRoutes")}
      />
      {panelMode === "stops" && (
        <>
          <DotLegendItem
            color={destinationColor}
            label={t("routes.legendSuggestedStop")}
          />
          <DotLegendItem
            color={originColor}
            label={t("routes.legendOperatorStop")}
          />
        </>
      )}
    </aside>
  );
}
