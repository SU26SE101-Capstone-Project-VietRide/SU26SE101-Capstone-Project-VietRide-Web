// Section thông tin tuyến: form sửa tuyến đang chọn (chọn tuyến do sidebar đảm nhiệm).
// Không còn nút lưu riêng — mọi thay đổi được lưu atomic qua nút "Lưu tuyến" ở header.
// Bến đi/bến đến bất biến sau khi tạo (PUT /full trả ROUTE_STATION_IMMUTABLE) → 2 ô khóa.
import { useTranslation } from "react-i18next";
import { FiEdit2, FiGitBranch, FiLoader } from "react-icons/fi";
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
  feedbackMessage: string;
  // Trạng thái auto-fill km/thời lượng theo đường đi (tính từ index)
  isAutoCalculatingMetrics: boolean;
  autoMetricsFallback: boolean;
  metricsLocked: boolean;
  onUnlockMetrics: () => void;
};

export default function RouteFormSection({
  canManageRoutes,
  routes,
  stations,
  selectedRouteId,
  form,
  onUpdateField,
  feedbackMessage,
  isAutoCalculatingMetrics,
  autoMetricsFallback,
  metricsLocked,
  onUnlockMetrics,
}: RouteFormSectionProps) {
  const { t } = useTranslation("manager");
  // Hiển thị chỉ đọc khi số liệu được khóa theo đường đi đã tính/vẽ
  const lockedTotalMinutes = Math.max(
    0,
    Math.round(form.estimatedDurationMinutes),
  );
  const lockedHours = Math.floor(lockedTotalMinutes / 60);
  const lockedMinutes = lockedTotalMinutes % 60;
  const lockedValueClass =
    "flex min-h-10.5 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        icon={<FiGitBranch />}
        title={t("routes.routeManagement")}
        subtitle={t("routes.routeManagementHint")}
      />
      <div className="mt-4 space-y-3">
        <Input
          label={t("routes.routeName")}
          value={form.name}
          onChange={(value) => onUpdateField("name", value)}
          placeholder={t("routes.namePlaceholder")}
          disabled={!canManageRoutes}
        />
        <div>
          <StationSelect
            label={t("routes.originStationId")}
            stations={stations}
            value={form.originStationId}
            placeholder={t("routes.selectOriginStation")}
            onChange={(value) => onUpdateField("originStationId", value)}
            disabled
          />
        </div>
        <div>
          <StationSelect
            label={t("routes.destinationStationId")}
            stations={stations}
            value={form.destinationStationId}
            placeholder={t("routes.selectDestinationStation")}
            onChange={(value) => onUpdateField("destinationStationId", value)}
            disabled
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("routes.stationsLockedHint")}
          </p>
        </div>
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
          {metricsLocked ? (
            <div>
              <label className={labelClass}>{t("routes.totalDistance")}</label>
              <div className={lockedValueClass}>
                {form.totalDistanceKm} {t("routes.kmUnit")}
              </div>
            </div>
          ) : (
            <NumberInput
              label={t("routes.totalDistance")}
              value={form.totalDistanceKm}
              onChange={(value) => onUpdateField("totalDistanceKm", value)}
              disabled={!canManageRoutes}
            />
          )}
        </div>
        {metricsLocked ? (
          <div>
            <label className={labelClass}>{t("routes.durationMinutes")}</label>
            <div className={lockedValueClass}>
              {lockedHours} {t("routes.hours")} {lockedMinutes}{" "}
              {t("routes.minutes")}
            </div>
          </div>
        ) : (
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
        )}
        {isAutoCalculatingMetrics ? (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <FiLoader className="animate-spin" size={12} />
            {t("routes.autoMetricsCalculating")}
          </p>
        ) : metricsLocked ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {t("routes.autoMetricsBadge")}
            </span>
            {canManageRoutes && (
              <button
                type="button"
                onClick={onUnlockMetrics}
                className="inline-flex items-center gap-1 text-xs font-semibold text-vr-700 hover:underline"
              >
                <FiEdit2 size={12} />
                {t("routes.editMetricsManually")}
              </button>
            )}
          </div>
        ) : autoMetricsFallback ? (
          <p className="text-xs text-amber-600">
            {t("routes.autoMetricsFallbackHint")}
          </p>
        ) : null}
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
      <InlineFeedback message={feedbackMessage} />
    </section>
  );
}
