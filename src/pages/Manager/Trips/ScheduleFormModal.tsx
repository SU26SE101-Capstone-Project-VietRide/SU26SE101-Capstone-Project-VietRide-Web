// Modal tạo/sửa lịch chuyến — modal có form tách file riêng theo §2.
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiPlus,
} from "react-icons/fi";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CurrencyInput from "../../../components/CurrencyInput";
import Modal from "../../../components/Modal";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { formatDateTime } from "../../../utils/date";
import { formatCurrency } from "../../../utils/currency";
import { FieldLabel, FormSection, Input, Select } from "./formControls";
import ScheduleSummary from "./ScheduleSummary";
import WeekdayPicker from "./WeekdayPicker";
import ResourceConflictPanel from "../../../components/ResourceConflictPanel";
import type {
  DriverScheduleApplyTo,
  ResourceAvailabilityResult,
} from "../../../api/vietride";
import type {
  RouteOption,
  ScheduleForm as ScheduleFormValues,
  ScheduleStatus,
  StaffOption,
  TripSchedule,
  VehicleOption,
} from "./types";
import { isShuttle16SeatVehicle } from "./tripHelpers";

type ScheduleFormModalProps = {
  open: boolean;
  onClose: () => void;
  form: ScheduleFormValues;
  routes: RouteOption[];
  vehicles: VehicleOption[];
  drivers: StaffOption[];
  assistants: StaffOption[];
  editingSchedule?: TripSchedule;
  isSaving: boolean;
  isLoadingResources: boolean;
  applyTo: DriverScheduleApplyTo;
  onApplyToChange: (value: DriverScheduleApplyTo) => void;
  onFieldChange: <K extends keyof ScheduleFormValues>(
    key: K,
    value: ScheduleFormValues[K],
  ) => void;
  onSuggestDeparture: () => void;
  onSave: (status: ScheduleStatus) => void;
  availability: ResourceAvailabilityResult | null;
  isCheckingAvailability: boolean;
  onCheckAvailability: () => void;
};

export default function ScheduleFormModal({
  open,
  onClose,
  form,
  routes,
  vehicles,
  drivers,
  assistants,
  editingSchedule,
  isSaving,
  isLoadingResources,
  applyTo,
  onApplyToChange,
  onFieldChange,
  onSuggestDeparture,
  onSave,
  availability,
  isCheckingAvailability,
  onCheckAvailability,
}: ScheduleFormModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === form.vehicleId,
  );
  const canSkipAssistant = Boolean(
    selectedVehicle && isShuttle16SeatVehicle(selectedVehicle),
  );
  const selectedRoute = routes.find((route) => route.id === form.routeId);
  const baseFareChanged =
    Boolean(editingSchedule) && form.baseFare !== editingSchedule?.baseFare;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      extraWide
      icon={<FiCalendar />}
      title={
        editingSchedule
          ? t("trips.editScheduleTitle")
          : t("trips.createScheduleTitle")
      }
      subtitle={t("trips.createScheduleSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={onCheckAvailability}
            disabled={isSaving || isLoadingResources || isCheckingAvailability}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 bg-white px-4 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiAlertCircle />
            {t("resourceConflict.check")}
          </button>
          <button
            type="button"
            onClick={() => onSave("draft")}
            disabled={isSaving || isLoadingResources}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPlus />
            {t("trips.saveDraftAction")}
          </button>
          <button
            type="button"
            onClick={() => onSave("open")}
            disabled={isSaving || isLoadingResources}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiCheckCircle />
            {t("trips.openForOperation")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ResourceConflictPanel
          result={availability}
          loading={isCheckingAvailability}
        />

        {editingSchedule ? (
          <div
            className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800"
            role="status"
          >
            {t("trips.editScheduleFocusNotice")}
          </div>
        ) : null}

        {editingSchedule ? (
          // Phạm vi áp dụng khi sửa — bắt buộc (contract 9.1), mặc định FUTURE_ONLY.
          <fieldset className="rounded-lg border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-800">
              {t("trips.applyToLabel")}
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  {
                    value: "FUTURE_ONLY",
                    label: t("trips.applyToFutureOnly"),
                    description: t("trips.applyToFutureOnlyDesc"),
                  },
                  {
                    value: "ALL_PENDING",
                    label: t("trips.applyToAllPending"),
                    description: t("trips.applyToAllPendingDesc"),
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                    applyTo === option.value
                      ? "border-vr-300 bg-vr-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule-apply-to"
                    value={option.value}
                    checked={applyTo === option.value}
                    onChange={() => onApplyToChange(option.value)}
                    className="mt-1 accent-vr-600"
                    disabled={baseFareChanged && option.value === "ALL_PENDING"}
                    required
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
                      {option.label}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 px-1 text-xs leading-5 text-gray-500">
              {baseFareChanged
                ? t("trips.baseFareFutureOnlyHint")
                : applyTo === "FUTURE_ONLY"
                  ? t("trips.applyToFutureOnlyDesc")
                  : t("trips.applyToAllPendingDesc")}
            </p>
          </fieldset>
        ) : null}

        <div className="space-y-5">
          <FormSection title={t("trips.sectionRouteVehicle")}>
            <Select
              label={t("trips.route")}
              required
              value={form.routeId}
              searchable
              searchPlaceholder={tc("searchOptions", {
                label: t("trips.route"),
              })}
              emptyMessage={tc("noMatchingOptions")}
              onChange={(value) => onFieldChange("routeId", value)}
            >
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name} · {t(`trips.resourceStatus.${route.status}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("trips.vehicle")}
              required
              value={form.vehicleId}
              onChange={(value) => onFieldChange("vehicleId", value)}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} · {vehicle.vehicleType} · {vehicle.seats}{" "}
                  {t("trips.seats")} ·{" "}
                  {t(`trips.resourceStatus.${vehicle.status}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("trips.driver")}
              required
              value={form.driverId}
              onChange={(value) => onFieldChange("driverId", value)}
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </Select>
            <Select
              label={t("trips.assistant")}
              required={!canSkipAssistant}
              value={form.assistantId}
              onChange={(value) => onFieldChange("assistantId", value)}
            >
              {canSkipAssistant ? (
                <option value="">{t("trips.noAssistant")}</option>
              ) : null}
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </option>
              ))}
            </Select>
          </FormSection>

          <FormSection title={t("trips.sectionSchedule")}>
            <div>
              {/* Nhãn phải nói rõ nhập CẢ ngày lẫn giờ — phần ngày trở thành
                  validFrom (ngày bắt đầu lịch), phần giờ thành departureTime. */}
              <FieldLabel label={t("trips.departureDateTimeLabel")} required />
              <CustomDateTimeInput
                className={inputClass}
                value={form.departureAt}
                type="datetime-local"
                placeholder={t("trips.departureDateTimePlaceholder")}
                onChange={(event) =>
                  onFieldChange("departureAt", event.target.value)
                }
              />
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                {/* P2: nút gợi ý cũ là khối lớn phá vỡ lưới — thu về link nhỏ */}
                <button
                  type="button"
                  onClick={onSuggestDeparture}
                  className="inline-flex cursor-pointer items-center gap-1 font-semibold text-vr-700 hover:underline"
                >
                  <FiCalendar aria-hidden="true" />
                  {t("trips.suggestNextDeparture")}
                </button>
              </p>
              {editingSchedule ? (
                // API PATCH chỉ nhận departureTime, KHÔNG có validFrom
                // (API-driver shedule.md §9.8) — đổi phần ngày ở đây sẽ không
                // được lưu, phải nói rõ thay vì để user tưởng đã đổi được.
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {t("trips.editScheduleDateLocked")}
                </p>
              ) : null}
            </div>{" "}
            {/* BE tự tính estimatedArrivalTime từ thời lượng tuyến lúc sinh
                Trip và KHÔNG nhận field này (§9.7). Hiển thị dạng dòng thông
                tin, KHÔNG dùng input — ô nhập (dù disabled) vẫn mời thao tác
                và làm người dùng tưởng đặt được giờ đến. */}
            <div>
              <FieldLabel label={t("trips.arrivalEstimate")} />
              <p className="flex min-h-11 items-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                {form.arrivalEstimate
                  ? formatDateTime(form.arrivalEstimate)
                  : t("trips.arrivalEstimatePending")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("trips.arrivalEstimateHint")}
              </p>
            </div>
            <Select
              label={t("trips.scheduleKind")}
              value={form.isOneTime ? "once" : "repeat"}
              onChange={(value) => onFieldChange("isOneTime", value === "once")}
            >
              <option value="repeat">{t("trips.scheduleKindRepeat")}</option>
              <option value="once">{t("trips.scheduleKindOnce")}</option>
            </Select>
            {/* Lịch "một lần" chỉ chạy đúng ngày khởi hành (dayOfWeek = thứ của
                ngày đó, validUntil = validFrom) nên không cần chọn thứ/ngày kết
                thúc. Thứ tự field ghép cặp theo hàng để lưới 2 cột không bị
                trống hẳn nửa phải: [loại lịch | ngày kết thúc], rồi bộ chip và
                dòng tóm tắt trải hết chiều ngang. */}
            {!form.isOneTime && (
              <Input
                label={t("trips.validUntil")}
                value={form.validUntil}
                type="date"
                helper={
                  form.validUntil
                    ? t("trips.validUntilHint")
                    : t("trips.validUntilEmptyHint")
                }
                onChange={(value) => onFieldChange("validUntil", value)}
              />
            )}
            {!form.isOneTime && (
              <div className="md:col-span-2">
                <WeekdayPicker
                  value={form.dayOfWeek}
                  onChange={(days) => onFieldChange("dayOfWeek", days)}
                />
              </div>
            )}
            <div className="md:col-span-2">
              <ScheduleSummary form={form} />
            </div>
          </FormSection>

          {/* Giá vé chỉ có 1 field nên đứng riêng một hàng sẽ bỏ trống nửa phải
              — ghép cùng hàng với khối quy tắc nghiệp vụ cho cân. */}
          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <FormSection title={t("trips.sectionFare")} columns={1}>
              <div>
                <label className={labelClass}>
                  {t("trips.scheduleBaseFare")}
                </label>
                <CurrencyInput
                  className={inputClass}
                  value={form.baseFare}
                  placeholder={t("trips.scheduleBaseFarePlaceholder")}
                  onChange={(event) =>
                    onFieldChange("baseFare", event.target.value)
                  }
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("trips.scheduleBaseFareHint")}
                </p>
                {selectedRoute ? (
                  selectedRoute.baseFare !== undefined &&
                  selectedRoute.baseFare !== null &&
                  selectedRoute.baseFare > 0 ? (
                    <p className="mt-1 text-xs font-medium text-gray-600">
                      {t("trips.routeBaseFareValue", {
                        fare: formatCurrency(selectedRoute.baseFare),
                      })}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {t("trips.routeBaseFareNotSet")}
                    </p>
                  )
                ) : null}
              </div>
            </FormSection>
            <details className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 mt-2.5">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-gray-900">
                <span className="text-vr-700">
                  <FiAlertCircle />
                </span>
                {t("trips.businessRules")}
              </summary>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                <li>{t("trips.ruleFutureDeparture")}</li>
                <li>{t("trips.ruleAvailability")}</li>
                <li>{t("trips.ruleActiveRoute")}</li>
                <li>{t("trips.ruleSubscription")}</li>
              </ul>
            </details>
          </div>
        </div>
      </div>
    </Modal>
  );
}
