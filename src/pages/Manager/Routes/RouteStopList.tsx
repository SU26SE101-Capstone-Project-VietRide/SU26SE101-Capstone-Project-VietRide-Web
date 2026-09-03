// Danh sách gọn điểm dừng đang gắn vào tuyến (tên + km/phút) trong panel nổi.
// Bấm dòng chọn/sửa stop (đồng bộ highlight với marker đánh số trên bản đồ),
// nút thùng rác gỡ stop khỏi tuyến.
import { useTranslation } from "react-i18next";
import { FiTrash2 } from "react-icons/fi";
import type { RouteStopDraft } from "./types";

type RouteStopListProps = {
  items: RouteStopDraft[];
  canManageRoutes: boolean;
  // Stop đang chọn (state selectedStopId của màn) → highlight dòng tương ứng
  selectedStopId?: string;
  onSelectStop?: (stopId: string) => void;
  onRequestRemove: (item: RouteStopDraft) => void;
};

export default function RouteStopList({
  items,
  canManageRoutes,
  selectedStopId = "",
  onSelectStop,
  onRequestRemove,
}: RouteStopListProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isSelected = item.stopId === selectedStopId;

        return (
          <div
            key={`${item.stopId}-${item.orderIndex}`}
            data-testid={`route-stop-row-${item.stopId}`}
            data-selected={isSelected}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              isSelected
                ? "border-vr-300 bg-vr-50 ring-1 ring-vr-200"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <button
              type="button"
              aria-pressed={isSelected}
              data-testid={`route-stop-select-${item.stopId}`}
              disabled={!onSelectStop}
              onClick={() => onSelectStop?.(item.stopId)}
              className="min-w-0 flex-1 text-left"
            >
              <p
                className="truncate font-semibold text-gray-900"
                title={"#" + item.orderIndex + " · " + item.stopName}
              >
                #{item.orderIndex} · {item.stopName}
              </p>
              <p className="text-xs text-gray-500">
                {item.distanceFromOriginKm} km ·{" "}
                {item.estimatedDurationFromOriginMinutes} min
              </p>
            </button>
            {canManageRoutes && (
              <button
                type="button"
                onClick={() => onRequestRemove(item)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                aria-label={t("routes.removeRouteStop")}
                title={t("routes.removeRouteStop")}
              >
                <FiTrash2 size={16} />
              </button>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm text-gray-500">{t("routes.noStopsAttached")}</p>
      )}
    </div>
  );
}
