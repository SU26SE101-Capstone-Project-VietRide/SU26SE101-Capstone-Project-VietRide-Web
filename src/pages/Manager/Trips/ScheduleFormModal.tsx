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
import { Input, Select } from "./formControls";
import type { DriverScheduleApplyTo } from "../../../api/vietride";
import type {
  RouteOption,
  ScheduleForm as ScheduleFormValues,
  ScheduleStatus,
  StaffOption,
  TripSchedule,
  VehicleOption,
} from "./types";

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
}: ScheduleFormModalProps) {
  const { t } = useTranslation("manager");
  const baseFareChanged =
    Boolean(editingSchedule) &&
    form.baseFare !== editingSchedule?.baseFare;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      extraWide
      icon={<FiCalendar />}
      title={
        editingSchedule
          ? t("trips.editScheduleTitle", { code: editingSchedule.code })
          : t("trips.createScheduleTitle")
      }
      subtitle={t("trips.createScheduleSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={() => onSave("draft")}
            disabled={isSaving || isLoadingResources}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPlus />
            {t("trips.saveDraft")}
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

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label={t("trips.route")}
              value={form.routeId}
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
              value={form.vehicleId}
              onChange={(value) => onFieldChange("vehicleId", value)}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} · {vehicle.seats} {t("trips.seats")} ·{" "}
                  {t(`trips.resourceStatus.${vehicle.status}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("trips.driver")}
              value={form.driverId}
              onChange={(value) => onFieldChange("driverId", value)}
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {t(`trips.resourceStatus.${driver.status}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("trips.assistant")}
              value={form.assistantId}
              onChange={(value) => onFieldChange("assistantId", value)}
            >
              <option value="">{t("trips.noAssistant")}</option>
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </option>
              ))}
            </Select>
            <div>
              <label className={labelClass}>{t("trips.departureTime")}</label>
              <CustomDateTimeInput
                className={inputClass}
                value={form.departureAt}
                type="datetime-local"
                onChange={(event) =>
                  onFieldChange("departureAt", event.target.value)
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                {t("trips.departureTimeTimezoneHint")}
              </p>
              <button
                type="button"
                onClick={onSuggestDeparture}
                className="mt-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-xs font-semibold text-vr-800 transition hover:bg-vr-100"
              >
                <FiCalendar />
                {t("trips.suggestNextDeparture")}
              </button>
            </div>
            <Input
              label={t("trips.arrivalEstimate")}
              value={form.arrivalEstimate}
              type="datetime-local"
              onChange={(value) => onFieldChange("arrivalEstimate", value)}
            />
            <Select
              label={t("trips.recurrence")}
              value={form.recurrence}
              onChange={(value) => onFieldChange("recurrence", value)}
            >
              <option value="once">{t("trips.recurrenceOnce")}</option>
              <option value="daily">{t("trips.recurrenceDaily")}</option>
              <option value="weekend">{t("trips.recurrenceWeekend")}</option>
              <option value="weekly">{t("trips.recurrenceWeekly")}</option>
            </Select>
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
            </div>
          </div>
          <details className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-gray-900">
              <span className="text-vr-700"><FiAlertCircle /></span>
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
    </Modal>
  );
}
