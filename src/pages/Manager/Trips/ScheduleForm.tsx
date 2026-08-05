// Section form tạo/sửa lịch chuyến — tách từ index.tsx theo ngưỡng §2.
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { FiCalendar, FiCheckCircle, FiPlus } from "react-icons/fi";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import { Input, SectionHeader, Select } from "./formControls";
import type {
  RouteOption,
  ScheduleForm as ScheduleFormValues,
  ScheduleStatus,
  StaffOption,
  TripSchedule,
  VehicleOption,
} from "./types";

type ScheduleFormProps = {
  form: ScheduleFormValues;
  routes: RouteOption[];
  vehicles: VehicleOption[];
  drivers: StaffOption[];
  assistants: StaffOption[];
  editingSchedule?: TripSchedule;
  isSaving: boolean;
  isLoadingResources: boolean;
  formRef: Ref<HTMLElement>;
  onFieldChange: <K extends keyof ScheduleFormValues>(
    key: K,
    value: ScheduleFormValues[K],
  ) => void;
  onSuggestDeparture: () => void;
  onSave: (status: ScheduleStatus) => void;
};

export default function ScheduleForm({
  form,
  routes,
  vehicles,
  drivers,
  assistants,
  editingSchedule,
  isSaving,
  isLoadingResources,
  formRef,
  onFieldChange,
  onSuggestDeparture,
  onSave,
}: ScheduleFormProps) {
  const { t } = useTranslation("manager");

  return (
    <section
      ref={formRef}
      tabIndex={-1}
      aria-label={
        editingSchedule
          ? t("trips.editScheduleTitle", { code: editingSchedule.code })
          : t("trips.createScheduleTitle")
      }
      className="scroll-mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm outline-none focus:ring-2 focus:ring-vr-200"
    >
      <SectionHeader
        icon={<FiCalendar />}
        title={
          editingSchedule
            ? t("trips.editScheduleTitle", { code: editingSchedule.code })
            : t("trips.createScheduleTitle")
        }
        subtitle={t("trips.createScheduleSubtitle")}
      />

      {editingSchedule ? (
        <div
          className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800"
          role="status"
        >
          {t("trips.editScheduleFocusNotice")}
        </div>
      ) : null}

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
        <Input
          label={t("trips.ticketPrice")}
          value={form.fare}
          type="number"
          currency
          onChange={(value) => onFieldChange("fare", value)}
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
      </div>

      <div className="flex flex-wrap gap-3">
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
      </div>
    </section>
  );
}
