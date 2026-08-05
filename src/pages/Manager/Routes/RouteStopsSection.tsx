// Tab "Điểm dừng": chọn/tạo điểm dừng, đặt thứ tự và gắn vào tuyến đang chọn
import { useTranslation } from "react-i18next";
import { FiMapPin, FiPlus, FiRefreshCw } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import type { OperatorStop } from "../../../api/vietride";
import InlineFeedback from "./InlineFeedback";
import SectionHeader from "./SectionHeader";
import { Input } from "./formControls";
import StopEditorCard from "./StopEditorCard";
import RouteStopList from "./RouteStopList";
import type { UseStopFormResult } from "./useStopForm";
import type { RouteStopDraft } from "./types";

type RouteStopsSectionProps = {
  canManageRoutes: boolean;
  stops: OperatorStop[];
  selectedStopId: string;
  stopFormControl: UseStopFormResult;
  routeStopOrder: string;
  onChangeRouteStopOrder: (value: string) => void;
  routeStopDuration: string;
  onChangeRouteStopDuration: (value: string) => void;
  routeStopDistance: string;
  onChangeRouteStopDistance: (value: string) => void;
  allowPickup: boolean;
  onChangeAllowPickup: (value: boolean) => void;
  allowDropoff: boolean;
  onChangeAllowDropoff: (value: boolean) => void;
  canEstimate: boolean;
  activeRouteName: string;
  currentRouteStops: RouteStopDraft[];
  onAddRouteStop: () => void;
  onEstimateRouteStopMetrics: () => void;
  onRequestRemove: (item: RouteStopDraft) => void;
  onRunAction: (action: () => Promise<void>) => void;
  stopFeedbackMessage: string;
  routeStopFeedbackMessage: string;
};

export default function RouteStopsSection({
  canManageRoutes,
  stops,
  selectedStopId,
  stopFormControl,
  routeStopOrder,
  onChangeRouteStopOrder,
  routeStopDuration,
  onChangeRouteStopDuration,
  routeStopDistance,
  onChangeRouteStopDistance,
  allowPickup,
  onChangeAllowPickup,
  allowDropoff,
  onChangeAllowDropoff,
  canEstimate,
  activeRouteName,
  currentRouteStops,
  onAddRouteStop,
  onEstimateRouteStopMetrics,
  onRequestRemove,
  onRunAction,
  stopFeedbackMessage,
  routeStopFeedbackMessage,
}: RouteStopsSectionProps) {
  const { t } = useTranslation("manager");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={<FiMapPin />}
        title={t("routes.routeStopsTitle")}
        subtitle={t("routes.routeStopsHint")}
      />
      <div className="mt-4 space-y-3">
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
        {canManageRoutes && (
          <StopEditorCard
            selectedStopPlace={stopFormControl.selectedStopPlace}
            onSelectPlace={stopFormControl.applyStopPlace}
            description={stopFormControl.stopForm.description ?? ""}
            onChangeDescription={(value) =>
              stopFormControl.updateStop("description", value)
            }
            onCreateStop={() => onRunAction(stopFormControl.handleCreateStop)}
            onUpdateStop={() => onRunAction(stopFormControl.handleUpdateStop)}
            canUpdate={Boolean(selectedStopId)}
            feedbackMessage={stopFeedbackMessage}
          />
        )}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={t("routes.stopOrder")}
            value={routeStopOrder}
            onChange={onChangeRouteStopOrder}
            type="number"
            disabled={!canManageRoutes}
          />
          <Input
            label={t("routes.durationFromOrigin")}
            value={routeStopDuration}
            onChange={onChangeRouteStopDuration}
            type="number"
            disabled={!canManageRoutes}
          />
          <Input
            label={t("routes.distanceFromOrigin")}
            value={routeStopDistance}
            onChange={onChangeRouteStopDistance}
            type="number"
            disabled={!canManageRoutes}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allowPickup}
            disabled={!canManageRoutes}
            onChange={(event) => onChangeAllowPickup(event.target.checked)}
          />
          {t("routes.allowPickup")}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allowDropoff}
            disabled={!canManageRoutes}
            onChange={(event) => onChangeAllowDropoff(event.target.checked)}
          />
          {t("routes.allowDropoff")}
        </label>
        {canManageRoutes && (
          <>
            <button
              type="button"
              onClick={onAddRouteStop}
              disabled={!selectedStopId}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
            >
              <FiPlus size={16} />
              {t("routes.addStopToRoute")}
            </button>
            <button
              type="button"
              onClick={onEstimateRouteStopMetrics}
              disabled={!canEstimate || !selectedStopId}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiRefreshCw size={16} />
              {t("routes.estimateRouteStopMetrics")}
            </button>
          </>
        )}
      </div>
      <RouteStopList
        activeRouteName={activeRouteName}
        items={currentRouteStops}
        canManageRoutes={canManageRoutes}
        onRequestRemove={onRequestRemove}
      />
      <InlineFeedback message={routeStopFeedbackMessage} />
    </section>
  );
}
