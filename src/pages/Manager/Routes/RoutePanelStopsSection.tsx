// Mục "Điểm dừng (N)" expandable trong panel nổi: danh sách gọn các stop của
// tuyến (đồng bộ chọn với marker đánh số trên bản đồ) + editor thêm/sửa stop
// mở ngay trong panel (không modal — gọn nhất với các component sẵn có).
// Logic gắn/gỡ/ước lượng giữ nguyên từ useRouteStopEditor/useStopForm.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiChevronDown,
  FiChevronUp,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
} from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import type { OperatorStop } from "../../../api/vietride";
import InlineFeedback from "./InlineFeedback";
import { Input } from "./formControls";
import StopEditorCard from "./StopEditorCard";
import RouteStopList from "./RouteStopList";
import type { UseStopFormResult } from "./useStopForm";
import type { UseRouteStopEditorResult } from "./useRouteStopEditor";

type RoutePanelStopsSectionProps = {
  canManageRoutes: boolean;
  stops: OperatorStop[];
  selectedStopId: string;
  // Chọn stop (từ dòng danh sách) — index chạy handleSelectStop race-safe
  onSelectStop: (stopId: string) => void;
  stopFormControl: UseStopFormResult;
  stopEditor: UseRouteStopEditorResult;
  canEstimate: boolean;
  onRunAction: (action: () => Promise<void>) => void;
  stopFeedbackMessage: string;
  routeStopFeedbackMessage: string;
};

export default function RoutePanelStopsSection({
  canManageRoutes,
  stops,
  selectedStopId,
  onSelectStop,
  stopFormControl,
  stopEditor,
  canEstimate,
  onRunAction,
  stopFeedbackMessage,
  routeStopFeedbackMessage,
}: RoutePanelStopsSectionProps) {
  const { t } = useTranslation("manager");
  // Mặc định mở để thấy ngay danh sách stop của tuyến đang chọn
  const [isExpanded, setIsExpanded] = useState(true);
  // Editor thêm/sửa stop chỉ mở khi cần — panel hẹp, giữ danh sách là chính
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const items = stopEditor.currentRouteStops;

  return (
    <section className="border-t border-gray-100 pt-4">
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
            onSelectStop={(stopId) => {
              // Bấm dòng = chọn/sửa stop đó → mở luôn editor để chỉnh
              onSelectStop(stopId);
              setIsEditorOpen(true);
            }}
            onRequestRemove={stopEditor.setRouteStopPendingRemoval}
          />

          {canManageRoutes && (
            <button
              type="button"
              aria-expanded={isEditorOpen}
              onClick={() => setIsEditorOpen((current) => !current)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-vr-300 px-3 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-100/40"
            >
              <FiPlus size={15} />
              {t("routes.addStop")}
            </button>
          )}

          {canManageRoutes && isEditorOpen && (
            <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <div>
                <label className={labelClass}>{t("routes.stop")}</label>
                <CustomSelect
                  className={inputClass}
                  value={selectedStopId}
                  onChange={(event) =>
                    onRunAction(() =>
                      stopFormControl.handleSelectStop(event.target.value),
                    )
                  }
                >
                  <option value="">{t("routes.selectStop")}</option>
                  {stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </CustomSelect>
              </div>

              <StopEditorCard
                selectedStopPlace={stopFormControl.selectedStopPlace}
                onSelectPlace={stopFormControl.applyStopPlace}
                description={stopFormControl.stopForm.description ?? ""}
                onChangeDescription={(value) =>
                  stopFormControl.updateStop("description", value)
                }
                onCreateStop={() =>
                  onRunAction(stopFormControl.handleCreateStop)
                }
                onUpdateStop={() =>
                  onRunAction(stopFormControl.handleUpdateStop)
                }
                canUpdate={Boolean(selectedStopId)}
                feedbackMessage={stopFeedbackMessage}
              />

              {/* Panel hẹp (340px) → xếp dọc thay vì 3 cột như tab cũ */}
              <div className="space-y-2">
                <Input
                  label={t("routes.stopOrder")}
                  value={stopEditor.routeStopOrder}
                  onChange={stopEditor.setRouteStopOrder}
                  type="number"
                />
                <Input
                  label={t("routes.durationFromOrigin")}
                  value={stopEditor.routeStopDuration}
                  onChange={stopEditor.setRouteStopDuration}
                  type="number"
                />
                <Input
                  label={t("routes.distanceFromOrigin")}
                  value={stopEditor.routeStopDistance}
                  onChange={stopEditor.setRouteStopDistance}
                  type="number"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={stopEditor.allowPickup}
                    onChange={(event) =>
                      stopEditor.setAllowPickup(event.target.checked)
                    }
                  />
                  {t("routes.allowPickup")}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={stopEditor.allowDropoff}
                    onChange={(event) =>
                      stopEditor.setAllowDropoff(event.target.checked)
                    }
                  />
                  {t("routes.allowDropoff")}
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRunAction(stopEditor.handleAddRouteStop)}
                  disabled={!selectedStopId}
                  className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-3 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
                >
                  <FiPlus size={15} />
                  {t("routes.addStopToRoute")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onRunAction(stopEditor.handleEstimateRouteStopMetrics)
                  }
                  disabled={!canEstimate || !selectedStopId}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <FiRefreshCw size={15} />
                  {t("routes.estimateRouteStopMetrics")}
                </button>
              </div>
            </div>
          )}

          <InlineFeedback message={routeStopFeedbackMessage} />
        </div>
      )}
    </section>
  );
}
