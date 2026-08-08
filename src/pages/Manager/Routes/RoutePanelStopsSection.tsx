// Nội dung tab "Điểm dừng" trong panel nổi: danh sách gọn các stop của tuyến
// (đồng bộ chọn với marker đánh số trên bản đồ) + chấm gợi ý (kho nhà xe/Google)
// dọc tuyến hiện sẵn trên map + ô tìm gộp bên dưới — vào tab là bật luôn, không
// còn nút bật/tắt riêng (chế độ thêm điểm dừng gắn thẳng vào việc mở tab này).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiChevronDown, FiChevronUp, FiMapPin } from "react-icons/fi";
import type { OperatorStop } from "../../../api/vietride";
import InlineFeedback from "./InlineFeedback";
import RouteStopList from "./RouteStopList";
import StopSearchBox from "./StopSearchBox";
import type { StopSuggestion } from "./types";
import type { UseRouteStopEditorResult } from "./useRouteStopEditor";

type RoutePanelStopsSectionProps = {
  canManageRoutes: boolean;
  stops: OperatorStop[];
  selectedStopId: string;
  // Chọn stop (từ dòng danh sách) — index chạy handleSelectStop race-safe
  onSelectStop: (stopId: string) => void;
  stopEditor: UseRouteStopEditorResult;
  onPickSearchResult: (result: StopSuggestion) => void;
  routeStopFeedbackMessage: string;
  // Đang tải gợi ý Google Places dọc tuyến (kho nhà xe lọc tức thời, không cần
  // chờ) — hiện dòng loading nhỏ cạnh hint, optional để không gãy nơi gọi cũ
  isLoadingSuggestions?: boolean;
};

export default function RoutePanelStopsSection({
  canManageRoutes,
  stops,
  selectedStopId,
  onSelectStop,
  stopEditor,
  onPickSearchResult,
  routeStopFeedbackMessage,
  isLoadingSuggestions = false,
}: RoutePanelStopsSectionProps) {
  const { t } = useTranslation("manager");
  // Mặc định mở để thấy ngay danh sách stop của tuyến đang chọn
  const [isExpanded, setIsExpanded] = useState(true);
  const items = stopEditor.currentRouteStops;

  return (
    <section>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-2 text-sm font-bold text-gray-900"
      >
        <span className="inline-flex items-center gap-2">
          <FiMapPin className="text-vr-700" size={15} />
          {t("routes.panelStopsTitle", { count: items.length })}
        </span>
        {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <RouteStopList
            items={items}
            canManageRoutes={canManageRoutes}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
            onRequestRemove={stopEditor.setRouteStopPendingRemoval}
          />

          {canManageRoutes && (
            <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-xs text-gray-500">
                {t("routes.suggestModeHint")}
              </p>
              {isLoadingSuggestions && (
                <p className="text-xs text-gray-400">
                  {t("routes.suggestLoading")}
                </p>
              )}
              <StopSearchBox stops={stops} onPick={onPickSearchResult} />
            </div>
          )}

          <InlineFeedback message={routeStopFeedbackMessage} />
        </div>
      )}
    </section>
  );
}
