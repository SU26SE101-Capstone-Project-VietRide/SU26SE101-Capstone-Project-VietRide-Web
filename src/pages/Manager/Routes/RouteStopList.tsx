// Danh sách điểm dừng đang gắn vào tuyến (hoặc bản nháp) kèm nút gỡ
import { useTranslation } from "react-i18next";
import { FiTrash2 } from "react-icons/fi";
import type { RouteStopDraft } from "./types";

type RouteStopListProps = {
  activeRouteName: string;
  items: RouteStopDraft[];
  canManageRoutes: boolean;
  onRequestRemove: (item: RouteStopDraft) => void;
};

export default function RouteStopList({
  activeRouteName,
  items,
  canManageRoutes,
  onRequestRemove,
}: RouteStopListProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-sm font-bold text-gray-900">
        {activeRouteName}
        <span className="ml-2 font-normal text-gray-500">
          {items.length} {t("routes.stop").toLowerCase()}
        </span>
      </p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div
            key={`${item.stopId}-${item.orderIndex}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-semibold text-gray-900">
                #{item.orderIndex} · {item.stopName}
              </p>
              <p className="text-xs text-gray-500">
                {item.distanceFromOriginKm} km ·{" "}
                {item.estimatedDurationFromOriginMinutes} min
              </p>
            </div>
            {canManageRoutes && (
              <button
                type="button"
                onClick={() => onRequestRemove(item)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                aria-label={t("routes.removeRouteStop")}
                title={t("routes.removeRouteStop")}
              >
                <FiTrash2 size={16} />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-gray-500">
            {t("routes.noStopsAttached")}
          </p>
        )}
      </div>
    </div>
  );
}
