// Form thông tin tuyến dạng gọn dọc — nhúng trong panel nổi trên bản đồ
// (RouteFloatingPanel), không tự mang card chrome. Không còn nút lưu riêng —
// mọi thay đổi lưu atomic qua nút "Lưu tuyến" nổi góc phải-dưới bản đồ.
// Bến đi/bến đến bất biến sau khi tạo (PUT /full trả ROUTE_STATION_IMMUTABLE) → 2 ô khóa.
import { useTranslation } from "react-i18next";
import { FiGitBranch, FiLoader } from "react-icons/fi";
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
import Checkbox from "../../../components/form/Checkbox";
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
  // Có đường đi (tính/vẽ) → khóa 2 ô số liệu: server bỏ qua manualMetrics khi có
  // pathPolyline nên số nhập tay sẽ bị ghi đè — muốn nhập tay phải xóa đường đi trước
  metricsLocked: boolean;
};

export default function RouteFormSection({
  canManageRoutes,
  routes,
  stations,
  selectedRouteId,
  form,
  onUpdateField,
  isAutoCalculatingMetrics,
  autoMetricsFallback,
  metricsLocked,
}: RouteFormSectionProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
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
    <section>
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
            aria-label={t("routes.returnRouteId")}
            className={inputClass}
            value={form.returnRouteId ?? ""}
            searchable
            searchPlaceholder={tc("searchOptions", {
              label: t("routes.returnRouteId"),
            })}
            emptyMessage={tc("noMatchingOptions")}
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
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {t("routes.autoMetricsBadge")}
            </span>
            {/* Không còn nút "Sửa tay": có pathPolyline thì server bỏ qua manualMetrics
                (số nhập tay bị ghi đè sau khi lưu) — muốn nhập tay phải xóa đường đi */}
            {canManageRoutes && (
              <p className="text-xs text-gray-500">
                {t("routes.metricsLockedHint")}
              </p>
            )}
          </div>
        ) : autoMetricsFallback ? (
          <p className="text-xs text-amber-600">
            {t("routes.autoMetricsFallbackHint")}
          </p>


        ) : null}

        {selectedRouteId && (
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 transition hover:border-vr-200 hover:bg-vr-50/50">
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                {t("routes.activeRoute")}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                {t("routes.activeRouteHint")}
              </span>
            </span>
            <Checkbox
              checked={form.isActive}
              disabled={!canManageRoutes}
              onChange={(checked) => onUpdateField("isActive", checked)}
              aria-label={t("routes.activeRoute")}
              size="md"
            />
          </label>
        )}

      </div>
    </section>
  );
}
