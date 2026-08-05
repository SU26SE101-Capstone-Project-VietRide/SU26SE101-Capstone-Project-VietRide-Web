// Section tuyến chính: chọn tuyến + form tạo/sửa tuyến
import { useTranslation } from "react-i18next";
import { FiGitBranch, FiPlus, FiSave } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import type {
  OperatorRoute,
  OperatorRouteRequest,
} from "../../../api/vietride";
import DurationInput from "./DurationInput";
import InlineFeedback from "./InlineFeedback";
import SectionHeader from "./SectionHeader";
import { Input, NumberInput, StationSelect } from "./formControls";
import type { StationOption } from "./types";

type RouteFormSectionProps = {
  canManageRoutes: boolean;
  routes: OperatorRoute[];
  stations: StationOption[];
  selectedRouteId: string;
  form: OperatorRouteRequest;
  onUpdateField: <K extends keyof OperatorRouteRequest>(
    key: K,
    value: OperatorRouteRequest[K],
  ) => void;
  onSelectRoute: (routeId: string) => void;
  onCreateRoute: () => void;
  onUpdateRoute: () => void;
  feedbackMessage: string;
};

export default function RouteFormSection({
  canManageRoutes,
  routes,
  stations,
  selectedRouteId,
  form,
  onUpdateField,
  onSelectRoute,
  onCreateRoute,
  onUpdateRoute,
  feedbackMessage,
}: RouteFormSectionProps) {
  const { t } = useTranslation("manager");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={<FiGitBranch />}
        title={t("routes.routeManagement")}
        subtitle={t("routes.routeManagementHint")}
      />
      <div className="mt-4 flex gap-2">
        <div className="min-w-0 flex-1">
          <CustomSelect
            className={inputClass}
            value={selectedRouteId}
            onChange={(event) => onSelectRoute(event.target.value)}
          >
            <option value="">{t("routes.selectRoute")}</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name} · {route.totalDistanceKm} km
              </option>
            ))}
          </CustomSelect>
        </div>
        {canManageRoutes && selectedRouteId && (
          <button
            type="button"
            onClick={() => onSelectRoute("")}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiPlus size={16} />
            {t("routes.newRoute")}
          </button>
        )}
      </div>
      <div className="mt-4 space-y-3">
        <Input
          label={t("routes.routeName")}
          value={form.name}
          onChange={(value) => onUpdateField("name", value)}
          placeholder={t("routes.namePlaceholder")}
          disabled={!canManageRoutes}
        />
        <StationSelect
          label={t("routes.originStationId")}
          stations={stations}
          value={form.originStationId}
          placeholder={t("routes.selectOriginStation")}
          onChange={(value) => onUpdateField("originStationId", value)}
          disabled={!canManageRoutes}
        />
        <StationSelect
          label={t("routes.destinationStationId")}
          stations={stations}
          value={form.destinationStationId}
          placeholder={t("routes.selectDestinationStation")}
          onChange={(value) => onUpdateField("destinationStationId", value)}
          disabled={!canManageRoutes}
        />
        <div>
          <label className={labelClass}>
            {t("routes.returnRouteId")}
          </label>
          <CustomSelect
            className={inputClass}
            value={form.returnRouteId ?? ""}
            onChange={(event) =>
              onUpdateField("returnRouteId", event.target.value)
            }
            disabled={!canManageRoutes}
          >
            <option value="">{t("routes.noReturnRoute")}</option>
            {routes
              .filter((route) => route.id !== selectedRouteId)
              .map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
          </CustomSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label={t("routes.baseFare")}
            value={form.baseFare}
            onChange={(value) => onUpdateField("baseFare", value)}
            disabled={!canManageRoutes}
            currency
          />
          <NumberInput
            label={t("routes.totalDistance")}
            value={form.totalDistanceKm}
            onChange={(value) => onUpdateField("totalDistanceKm", value)}
            disabled={!canManageRoutes}
          />
        </div>
        <DurationInput
          label={t("routes.durationMinutes")}
          value={form.estimatedDurationMinutes}
          onChange={(value) =>
            onUpdateField("estimatedDurationMinutes", value)
          }
          hourLabel={t("routes.hours")}
          minuteLabel={t("routes.minutes")}
          disabled={!canManageRoutes}
        />
        <label className="flex items-end gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={!canManageRoutes}
            onChange={(event) =>
              onUpdateField("isActive", event.target.checked)
            }
          />
          {t("routes.activeRoute")}
        </label>
      </div>
      {canManageRoutes && (
        <div className="mt-4">
          {selectedRouteId ? (
            <button
              type="button"
              onClick={onUpdateRoute}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
            >
              <FiSave size={16} />
              {t("routes.updateRoute")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreateRoute}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
            >
              <FiPlus size={16} />
              {t("routes.createRoute")}
            </button>
          )}
        </div>
      )}
      <InlineFeedback message={feedbackMessage} />
    </section>
  );
}
