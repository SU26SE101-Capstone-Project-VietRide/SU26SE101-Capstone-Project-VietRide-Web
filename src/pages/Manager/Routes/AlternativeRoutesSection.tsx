// Section tuyến thay thế: danh sách 0-2 tuyến thay thế + form tạo/sửa/xoá
import { useTranslation } from "react-i18next";
import { FiGitBranch, FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import type { OperatorStop } from "../../../api/vietride";
import DurationInput from "./DurationInput";
import InlineFeedback from "./InlineFeedback";
import SectionHeader from "./SectionHeader";
import { Input, NumberInput, StationSelect } from "./formControls";
import type { UseAlternativeRoutesResult } from "./useAlternativeRoutes";
import type { StationOption } from "./types";

type AlternativeRoutesSectionProps = {
  canManageRoutes: boolean;
  hasSelectedRoute: boolean;
  stations: StationOption[];
  stops: OperatorStop[];
  alternatives: UseAlternativeRoutesResult;
  onRunAction: (action: () => Promise<void>) => void;
  feedbackMessage: string;
};

export default function AlternativeRoutesSection({
  canManageRoutes,
  hasSelectedRoute,
  stations,
  stops,
  alternatives,
  onRunAction,
  feedbackMessage,
}: AlternativeRoutesSectionProps) {
  const { t } = useTranslation("manager");
  const {
    alternativeRoutes,
    selectedAlternativeRouteId,
    alternativeForm,
    alternativeStopId,
    setAlternativeStopId,
    alternativeStopDuration,
    setAlternativeStopDuration,
    alternativeStopDistance,
    setAlternativeStopDistance,
    startNewAlternative,
    handleSelectAlternativeRoute,
    updateAlternative,
    handleAddAlternativeStop,
    handleRemoveAlternativeStop,
    handleCreateAlternativeRoute,
    handleUpdateAlternativeRoute,
    handleDeleteAlternativeRoute,
  } = alternatives;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={<FiGitBranch />}
        title={t("routes.alternativeManagement")}
        subtitle={t("routes.alternativeManagementHint")}
      />
      {!hasSelectedRoute ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("routes.alternativeSelectRoute")}
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-vr-100 bg-vr-50/60 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {t("routes.alternativeCapacity", { count: alternativeRoutes.length })}
              </p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-vr-700">
                {alternativeRoutes.length}/2
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              {t("routes.alternativeCapacityHint")}
            </p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {alternativeRoutes.map((alternative, index) => (
              <button
                key={alternative.id}
                type="button"
                onClick={() => handleSelectAlternativeRoute(alternative.id)}
                className={selectedAlternativeRouteId === alternative.id
                  ? "rounded-lg border border-vr-300 bg-vr-50 p-3 text-left ring-1 ring-vr-200"
                  : "rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-vr-200 hover:bg-gray-50"}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-vr-700">
                    {t("routes.alternativeNumber", { number: index + 1 })}
                  </span>
                  <span className={alternative.isActive
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                    : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500"}
                  >
                    {alternative.isActive ? t("routes.alternativeActive") : t("routes.alternativeInactive")}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-gray-900">{alternative.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {alternative.totalDistanceKm} km · {alternative.estimatedDurationMinutes} {t("routes.minutes")}
                </p>
              </button>
            ))}
            {!alternativeRoutes.length && (
              <p className="text-sm text-gray-500">{t("routes.alternativeEmpty")}</p>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Input
              label={t("routes.alternativeName")}
              value={alternativeForm.name}
              onChange={(value) => updateAlternative("name", value)}
              placeholder={t("routes.alternativeNamePlaceholder")}
              disabled={!canManageRoutes}
            />
            <StationSelect
              label={t("routes.alternativeDestination")}
              stations={stations}
              value={alternativeForm.destinationStationId}
              placeholder={t("routes.selectAlternativeDestination")}
              onChange={(value) => updateAlternative("destinationStationId", value)}
              disabled={!canManageRoutes}
            />
            <div className="md:col-span-2">
              <label className={labelClass}>{t("routes.alternativeDescription")}</label>
              <textarea
                className={inputClass + " min-h-20 resize-y"}
                value={alternativeForm.description}
                onChange={(event) => updateAlternative("description", event.target.value)}
                placeholder={t("routes.alternativeDescriptionPlaceholder")}
                disabled={!canManageRoutes}
              />
            </div>
            <NumberInput
              label={t("routes.totalDistance")}
              value={alternativeForm.totalDistanceKm}
              onChange={(value) => updateAlternative("totalDistanceKm", value)}
              disabled={!canManageRoutes}
            />
            <DurationInput
              label={t("routes.durationMinutes")}
              value={alternativeForm.estimatedDurationMinutes}
              onChange={(value) => updateAlternative("estimatedDurationMinutes", value)}
              hourLabel={t("routes.hours")}
              minuteLabel={t("routes.minutes")}
              disabled={!canManageRoutes}
            />
            <label className="flex items-end gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={alternativeForm.isActive}
                disabled={!canManageRoutes}
                onChange={(event) => updateAlternative("isActive", event.target.checked)}
              />
              {t("routes.activeAlternative")}
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t("routes.alternativeStops")}</p>
              <p className="mt-1 text-xs text-gray-500">{t("routes.alternativeStopsHint")}</p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <label className={labelClass}>{t("routes.stop")}</label>
                <CustomSelect
                  className={inputClass}
                  value={alternativeStopId}
                  onChange={(event) => setAlternativeStopId(event.target.value)}
                  disabled={!canManageRoutes}
                >
                  <option value="">{t("routes.selectStop")}</option>
                  {stops
                    .filter((stop) => !alternativeForm.stops.some((item) => item.stopId === stop.id))
                    .map((stop) => (
                      <option key={stop.id} value={stop.id}>{stop.name}</option>
                    ))}
                </CustomSelect>
              </div>
              <NumberInput
                label={t("routes.durationFromOrigin")}
                value={alternativeStopDuration}
                onChange={setAlternativeStopDuration}
                disabled={!canManageRoutes}
              />
              <NumberInput
                label={t("routes.distanceFromOrigin")}
                value={alternativeStopDistance}
                onChange={setAlternativeStopDistance}
                disabled={!canManageRoutes}
              />
              <button
                type="button"
                onClick={handleAddAlternativeStop}
                disabled={!canManageRoutes || !alternativeStopId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:col-span-2"
              >
                <FiPlus size={16} />
                {t("routes.addAlternativeStop")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {alternativeForm.stops.map((routeStop, index) => {
                const stop = stops.find((item) => item.id === routeStop.stopId);
                return (
                  <div key={routeStop.stopId} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-gray-800">
                      {index + 1}. {stop?.name ?? routeStop.stopId}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {routeStop.distanceFromOriginKm} km · {routeStop.estimatedDurationFromOriginMinutes} {t("routes.minutes")}
                    </span>
                    <button
                      type="button"
                      aria-label={t("routes.removeAlternativeStop")}
                      onClick={() => handleRemoveAlternativeStop(routeStop.stopId)}
                      disabled={!canManageRoutes}
                      className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {!alternativeForm.stops.length && (
                <p className="text-xs text-gray-500">{t("routes.alternativeNoStops")}</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canManageRoutes && (
              <>
                {!selectedAlternativeRouteId ? (
                  <button
                    type="button"
                    onClick={() => onRunAction(handleCreateAlternativeRoute)}
                    className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
                  >
                    <FiPlus size={16} />
                    {t("routes.createAlternative")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onRunAction(handleUpdateAlternativeRoute)}
                      className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
                    >
                      <FiSave size={16} />
                      {t("routes.updateAlternative")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRunAction(handleDeleteAlternativeRoute)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <FiTrash2 size={16} />
                      {t("routes.deleteAlternative")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={startNewAlternative}
                  disabled={alternativeRoutes.length >= 2}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <FiPlus size={16} />
                  {t("routes.newAlternative")}
                </button>
              </>
            )}
          </div>
          <InlineFeedback message={feedbackMessage} />
        </>
      )}
    </section>
  );
}
