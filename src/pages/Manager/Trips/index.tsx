import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type ResourceStatus = "active" | "inactive" | "available" | "busy";
type ScheduleStatus = "draft" | "open" | "blocked";

type RouteOption = {
  id: string;
  name: string;
  origin: string;
  destination: string;
  status: ResourceStatus;
};

type VehicleOption = {
  id: string;
  plate: string;
  seats: number;
  status: ResourceStatus;
};

type StaffOption = {
  id: string;
  name: string;
  role: "driver" | "assistant";
  status: ResourceStatus;
};

type ScheduleForm = {
  routeId: string;
  vehicleId: string;
  driverId: string;
  assistantId: string;
  departureAt: string;
  arrivalEstimate: string;
  fare: string;
  recurrence: string;
};

type TripSchedule = ScheduleForm & {
  id: string;
  code: string;
  status: ScheduleStatus;
};

const routes: RouteOption[] = [
  {
    id: "route-hcm-dl",
    name: "TP.HCM - Da Lat",
    origin: "Mien Dong Station",
    destination: "Da Lat Central",
    status: "active",
  },
  {
    id: "route-hcm-nt",
    name: "TP.HCM - Nha Trang",
    origin: "Mien Dong Station",
    destination: "Nha Trang South",
    status: "active",
  },
  {
    id: "route-hcm-ct",
    name: "TP.HCM - Can Tho",
    origin: "An Suong Station",
    destination: "Can Tho Center",
    status: "inactive",
  },
];

const vehicles: VehicleOption[] = [
  { id: "vehicle-51b-22011", plate: "51B-220.11", seats: 34, status: "available" },
  { id: "vehicle-51b-88991", plate: "51B-889.91", seats: 22, status: "available" },
  { id: "vehicle-51f-12009", plate: "51F-120.09", seats: 16, status: "busy" },
];

const staff: StaffOption[] = [
  { id: "driver-an", name: "Nguyen Van An", role: "driver", status: "available" },
  { id: "driver-binh", name: "Tran Quoc Binh", role: "driver", status: "available" },
  { id: "driver-cu", name: "Le Manh Cu", role: "driver", status: "busy" },
  { id: "assistant-mai", name: "Pham Thu Mai", role: "assistant", status: "available" },
  { id: "assistant-linh", name: "Do Khanh Linh", role: "assistant", status: "available" },
];

const emptyForm: ScheduleForm = {
  routeId: routes[0]?.id ?? "",
  vehicleId: vehicles[0]?.id ?? "",
  driverId: staff.find((item) => item.role === "driver")?.id ?? "",
  assistantId: staff.find((item) => item.role === "assistant")?.id ?? "",
  departureAt: "",
  arrivalEstimate: "",
  fare: "250000",
  recurrence: "daily",
};

const initialSchedules: TripSchedule[] = [
  {
    id: "schedule-001",
    code: "SCH-001",
    routeId: "route-hcm-dl",
    vehicleId: "vehicle-51b-22011",
    driverId: "driver-an",
    assistantId: "assistant-mai",
    departureAt: "2026-07-02T07:30",
    arrivalEstimate: "2026-07-02T14:00",
    fare: "250000",
    recurrence: "daily",
    status: "open",
  },
  {
    id: "schedule-002",
    code: "SCH-002",
    routeId: "route-hcm-nt",
    vehicleId: "vehicle-51b-88991",
    driverId: "driver-binh",
    assistantId: "assistant-linh",
    departureAt: "2026-07-03T21:00",
    arrivalEstimate: "2026-07-04T05:30",
    fare: "320000",
    recurrence: "weekend",
    status: "draft",
  },
];

function optionLabel<T extends { id: string }>(
  options: T[],
  id: string,
  getLabel: (option: T) => string,
) {
  const match = options.find((option) => option.id === id);
  return match ? getLabel(match) : "-";
}

function formatMoney(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("vi-VN").format(amount)
    : value;
}

export default function TripsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [schedules, setSchedules] = useState<TripSchedule[]>(initialSchedules);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeRoutes = useMemo(
    () => routes.filter((route) => route.status === "active"),
    [],
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "available"),
    [],
  );
  const drivers = useMemo(
    () => staff.filter((person) => person.role === "driver"),
    [],
  );
  const assistants = useMemo(
    () => staff.filter((person) => person.role === "assistant"),
    [],
  );
  const editingSchedule = schedules.find((item) => item.id === editingId);

  function updateForm<K extends keyof ScheduleForm>(
    key: K,
    value: ScheduleForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateSchedule(status: ScheduleStatus) {
    if (
      !form.routeId ||
      !form.vehicleId ||
      !form.driverId ||
      !form.departureAt ||
      !form.arrivalEstimate ||
      !form.fare
    ) {
      return t("trips.validationRequired");
    }

    const selectedRoute = routes.find((route) => route.id === form.routeId);
    if (!selectedRoute || selectedRoute.status !== "active") {
      return t("trips.validationRouteInactive");
    }

    const departure = new Date(form.departureAt);
    const arrival = new Date(form.arrivalEstimate);
    if (departure.getTime() <= Date.now()) {
      return t("trips.validationFutureDeparture");
    }
    if (arrival.getTime() <= departure.getTime()) {
      return t("trips.validationArrival");
    }

    const hasConflict = schedules.some(
      (schedule) =>
        schedule.id !== editingId &&
        schedule.departureAt === form.departureAt &&
        (schedule.vehicleId === form.vehicleId ||
          schedule.driverId === form.driverId),
    );
    if (hasConflict) {
      return t("trips.validationResourceConflict");
    }

    if (!editingId && schedules.length >= 6 && status === "open") {
      return t("trips.validationSubscriptionLimit");
    }

    return "";
  }

  function saveSchedule(status: ScheduleStatus) {
    setMessage("");
    setError("");

    const validationError = validateSchedule(status);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingId) {
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.id === editingId ? { ...schedule, ...form, status } : schedule,
        ),
      );
      setEditingId("");
      setMessage(t("trips.scheduleUpdated"));
      return;
    }

    const nextNumber = schedules.length + 1;
    setSchedules((current) => [
      {
        ...form,
        id: `schedule-${Date.now()}`,
        code: `SCH-${String(nextNumber).padStart(3, "0")}`,
        status,
      },
      ...current,
    ]);
    setForm(emptyForm);
    setMessage(
      status === "open" ? t("trips.scheduleOpened") : t("trips.scheduleSaved"),
    );
  }

  function editSchedule(schedule: TripSchedule) {
    setForm({
      routeId: schedule.routeId,
      vehicleId: schedule.vehicleId,
      driverId: schedule.driverId,
      assistantId: schedule.assistantId,
      departureAt: schedule.departureAt,
      arrivalEstimate: schedule.arrivalEstimate,
      fare: schedule.fare,
      recurrence: schedule.recurrence,
    });
    setEditingId(schedule.id);
    setMessage("");
    setError("");
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
    setMessage("");
    setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("trips.scheduleManageTitle")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 sm:text-base">
            {t("trips.scheduleManageSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <FiRefreshCw />
          {tc("reset")}
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label={t("trips.activeRoutes")} value={activeRoutes.length} />
        <MetricCard label={t("trips.availableVehicles")} value={availableVehicles.length} />
        <MetricCard label={t("trips.availableDrivers")} value={drivers.filter((driver) => driver.status === "available").length} />
        <MetricCard label={t("trips.openSchedules")} value={schedules.filter((schedule) => schedule.status === "open").length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <SectionHeader
            icon={<FiCalendar />}
            title={
              editingSchedule
                ? t("trips.editScheduleTitle", { code: editingSchedule.code })
                : t("trips.createScheduleTitle")
            }
            subtitle={t("trips.createScheduleSubtitle")}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label={t("trips.route")}
              value={form.routeId}
              onChange={(value) => updateForm("routeId", value)}
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
              onChange={(value) => updateForm("vehicleId", value)}
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
              onChange={(value) => updateForm("driverId", value)}
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
              onChange={(value) => updateForm("assistantId", value)}
            >
              <option value="">{t("trips.noAssistant")}</option>
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </option>
              ))}
            </Select>
            <Input
              label={t("trips.departureTime")}
              value={form.departureAt}
              type="datetime-local"
              onChange={(value) => updateForm("departureAt", value)}
            />
            <Input
              label={t("trips.arrivalEstimate")}
              value={form.arrivalEstimate}
              type="datetime-local"
              onChange={(value) => updateForm("arrivalEstimate", value)}
            />
            <Input
              label={t("trips.ticketPrice")}
              value={form.fare}
              type="number"
              onChange={(value) => updateForm("fare", value)}
            />
            <Select
              label={t("trips.recurrence")}
              value={form.recurrence}
              onChange={(value) => updateForm("recurrence", value)}
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
              onClick={() => saveSchedule("draft")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <FiPlus />
              {t("trips.saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => saveSchedule("open")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-vr-700"
            >
              <FiCheckCircle />
              {t("trips.openForOperation")}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title={t("trips.businessRules")} icon={<FiAlertCircle />}>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>{t("trips.ruleFutureDeparture")}</li>
              <li>{t("trips.ruleAvailability")}</li>
              <li>{t("trips.ruleActiveRoute")}</li>
              <li>{t("trips.ruleSubscription")}</li>
            </ul>
          </Panel>
          <Panel title={t("trips.apiNoticeTitle")} icon={<FiClock />}>
            <p className="text-sm text-gray-600">{t("trips.apiNotice")}</p>
          </Panel>
        </aside>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <SectionHeader
            icon={<FiTruck />}
            title={t("trips.scheduleList")}
            subtitle={t("trips.scheduleListSubtitle")}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">{t("trips.tripCode")}</th>
                <th className="px-5 py-3">{t("trips.route")}</th>
                <th className="px-5 py-3">{t("trips.vehicle")}</th>
                <th className="px-5 py-3">{t("trips.crew")}</th>
                <th className="px-5 py-3">{t("trips.departure")}</th>
                <th className="px-5 py-3">{t("trips.fare")}</th>
                <th className="px-5 py-3">{t("trips.status")}</th>
                <th className="px-5 py-3 text-right">{t("trips.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {schedule.code}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {optionLabel(routes, schedule.routeId, (route) => route.name)}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {optionLabel(vehicles, schedule.vehicleId, (vehicle) => vehicle.plate)}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    <span className="block">
                      {optionLabel(staff, schedule.driverId, (person) => person.name)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {optionLabel(staff, schedule.assistantId, (person) => person.name)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    <span className="block">{schedule.departureAt}</span>
                    <span className="text-xs text-gray-500">
                      {t("trips.eta")}: {schedule.arrivalEstimate}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {formatMoney(schedule.fare)} đ
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-700">
                      {t(`trips.scheduleStatus.${schedule.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => editSchedule(schedule)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
                      title={t("trips.edit")}
                      aria-label={t("trips.edit")}
                    >
                      <FiEdit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="text-vr-700">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
