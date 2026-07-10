import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { getAuthUser } from "../../../auth";
import { formatDateTime } from "../../../utils/date";
import {
  activateOperatorDriverSchedule,
  createOperatorDriverSchedule,
  getOperatorRoutes,
  getOperatorUsers,
  getOperatorVehicles,
  type OperatorDriverSchedule,
  type OperatorRoute,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";

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
  distanceKm?: number;
  durationMinutes?: number;
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

const scheduleStorageKeyPrefix = "vietride.manager.tripSchedules";

const routeSeeds: RouteOption[] = [
  {
    id: "route-hcm-dl",
    name: "TP.HCM - Da Lat",
    origin: "Mien Dong Station",
    destination: "Da Lat Central",
    status: "active",
    distanceKm: 310,
    durationMinutes: 390,
  },
  {
    id: "route-hcm-nt",
    name: "TP.HCM - Nha Trang",
    origin: "Mien Dong Station",
    destination: "Nha Trang South",
    status: "active",
    distanceKm: 430,
    durationMinutes: 510,
  },
  {
    id: "route-hcm-ct",
    name: "TP.HCM - Can Tho",
    origin: "An Suong Station",
    destination: "Can Tho Center",
    status: "inactive",
    distanceKm: 170,
    durationMinutes: 210,
  },
];

const vehicleSeeds: VehicleOption[] = [
  {
    id: "vehicle-51b-22011",
    plate: "51B-220.11",
    seats: 34,
    status: "available",
  },
  {
    id: "vehicle-51b-88991",
    plate: "51B-889.91",
    seats: 22,
    status: "available",
  },
  { id: "vehicle-51f-12009", plate: "51F-120.09", seats: 16, status: "busy" },
];

const staffSeeds: StaffOption[] = [
  {
    id: "driver-an",
    name: "Nguyen Van An",
    role: "driver",
    status: "available",
  },
  {
    id: "driver-binh",
    name: "Tran Quoc Binh",
    role: "driver",
    status: "available",
  },
  { id: "driver-cu", name: "Le Manh Cu", role: "driver", status: "busy" },
  {
    id: "assistant-mai",
    name: "Pham Thu Mai",
    role: "assistant",
    status: "available",
  },
  {
    id: "assistant-linh",
    name: "Do Khanh Linh",
    role: "assistant",
    status: "available",
  },
];

const emptyForm: ScheduleForm = {
  routeId: routeSeeds[0]?.id ?? "",
  vehicleId: vehicleSeeds[0]?.id ?? "",
  driverId: staffSeeds.find((item) => item.role === "driver")?.id ?? "",
  assistantId: staffSeeds.find((item) => item.role === "assistant")?.id ?? "",
  departureAt: "",
  arrivalEstimate: "",
  fare: "250000",
  recurrence: "daily",
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseStoredSchedules(value: unknown): TripSchedule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = readString(item.id);
    const code = readString(item.code);
    const routeId = readString(item.routeId);
    const vehicleId = readString(item.vehicleId);
    const driverId = readString(item.driverId);
    const departureAt = readString(item.departureAt);
    const arrivalEstimate = readString(item.arrivalEstimate);
    const status = readString(item.status) as ScheduleStatus;

    if (
      !id ||
      !code ||
      !routeId ||
      !vehicleId ||
      !driverId ||
      !departureAt ||
      !arrivalEstimate ||
      !["draft", "open", "blocked"].includes(status)
    ) {
      return [];
    }

    return [
      {
        id,
        code,
        routeId,
        vehicleId,
        driverId,
        assistantId: readString(item.assistantId),
        departureAt,
        arrivalEstimate,
        fare: readString(item.fare),
        recurrence: readString(item.recurrence) || "once",
        status,
      },
    ];
  });
}

function loadStoredSchedules(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseStoredSchedules(
      JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]"),
    );
  } catch {
    return [];
  }
}

function saveStoredSchedules(storageKey: string, schedules: TripSchedule[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(schedules));
}

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getNextSuggestedDeparture() {
  const next = new Date();
  next.setSeconds(0, 0);

  const minutes = next.getMinutes();
  const nextSlotMinutes = minutes < 30 ? 30 : 60;
  next.setMinutes(nextSlotMinutes, 0, 0);

  return next;
}

function getArrivalEstimateValue(departureAt: string, route?: RouteOption) {
  if (!departureAt || !route) {
    return "";
  }

  const departure = new Date(departureAt);
  if (Number.isNaN(departure.getTime())) {
    return "";
  }

  const durationMinutes =
    route.durationMinutes && route.durationMinutes > 0
      ? route.durationMinutes
      : route.distanceKm && route.distanceKm > 0
        ? Math.round((route.distanceKm / 55) * 60)
        : 0;

  if (durationMinutes <= 0) {
    return "";
  }

  return toDatetimeLocalValue(
    new Date(departure.getTime() + durationMinutes * 60_000),
  );
}

function toScheduleTimeValue(dateTimeValue: string) {
  const timePart = dateTimeValue.split(/[T ]/)[1] ?? "";
  const [hour = "00", minute = "00", second = "00"] = timePart.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
}

function toResourceStatus(status?: string): ResourceStatus {
  if (status === "ACTIVE" || status === "active" || status === "APPROVED") {
    return "active";
  }

  if (status === "AVAILABLE" || status === "available") {
    return "available";
  }

  if (status === "BUSY" || status === "busy") {
    return "busy";
  }

  return "inactive";
}

function toRouteOption(route: OperatorRoute): RouteOption {
  return {
    id: route.id,
    name: route.name,
    origin: route.originStationId,
    destination: route.destinationStationId,
    status: route.isActive ? "active" : "inactive",
    distanceKm: route.totalDistanceKm,
    durationMinutes: route.estimatedDurationMinutes,
  };
}

function toVehicleOption(vehicle: OperatorVehicle): VehicleOption {
  return {
    id: vehicle.vehicleId || vehicle.id || "",
    plate: vehicle.licensePlate,
    seats: vehicle.totalSeats,
    status:
      vehicle.status === "ACTIVE"
        ? "available"
        : toResourceStatus(vehicle.status),
  };
}

function toStaffOption(user: OperatorUser): StaffOption {
  return {
    id: user.userId || user.id || "",
    name: user.displayName,
    role: user.role === "ASSISTANT" ? "assistant" : "driver",
    status: toResourceStatus(user.status),
  };
}

function recurrenceToDays(recurrence: string) {
  if (recurrence === "daily") {
    return [1, 2, 3, 4, 5, 6, 7];
  }

  if (recurrence === "weekend") {
    return [6, 7];
  }

  if (recurrence === "weekly") {
    return [1];
  }

  return undefined;
}

function toTripSchedule(
  schedule: OperatorDriverSchedule,
  form: ScheduleForm,
  status: ScheduleStatus,
): TripSchedule {
  return {
    ...form,
    id: schedule.id,
    code: `SCH-${schedule.id.slice(0, 8).toUpperCase()}`,
    routeId: schedule.routeId,
    vehicleId: schedule.vehicleId,
    driverId: schedule.driverUserId ?? schedule.driverId ?? "",
    assistantId: schedule.assistantUserId ?? schedule.assistantId ?? "",
    departureAt: form.departureAt,
    status: schedule.isActive || schedule.status === "ACTIVE" ? "open" : status,
  };
}

export default function TripsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const authUser = getAuthUser();
  const scheduleStorageKey = `${scheduleStorageKeyPrefix}.${authUser?.operatorId ?? authUser?.id ?? "guest"}`;
  const [schedules, setSchedules] = useState<TripSchedule[]>(() =>
    loadStoredSchedules(scheduleStorageKey),
  );
  const [routes, setRoutes] = useState<RouteOption[]>(routeSeeds);
  const [vehicles, setVehicles] = useState<VehicleOption[]>(vehicleSeeds);
  const [staff, setStaff] = useState<StaffOption[]>(staffSeeds);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const canManageSchedules = authUser?.role === "OPERATOR_ADMIN";

  const activeRoutes = useMemo(
    () => routes.filter((route) => route.status === "active"),
    [routes],
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "available"),
    [vehicles],
  );
  const drivers = useMemo(
    () => staff.filter((person) => person.role === "driver"),
    [staff],
  );
  const assistants = useMemo(
    () => staff.filter((person) => person.role === "assistant"),
    [staff],
  );
  const editingSchedule = schedules.find((item) => item.id === editingId);
  const paginatedSchedules = useMemo(
    () => schedules.slice((page - 1) * pageSize, page * pageSize),
    [page, schedules],
  );

  useEffect(() => {
    let ignore = false;

    async function loadResources() {
      setIsLoadingResources(true);

      try {
        const [routeResult, vehicleResult, userResult] = await Promise.all([
          getOperatorRoutes({ page: 1, pageSize: 100 }),
          getOperatorVehicles({ page: 1, pageSize: 100 }),
          getOperatorUsers({ page: 1, pageSize: 100 }),
        ]);

        if (ignore) {
          return;
        }

        const nextRoutes = routeResult.items.map(toRouteOption);
        const nextVehicles = vehicleResult.items.map(toVehicleOption);
        const nextStaff = userResult.items
          .filter((user) => user.role === "DRIVER" || user.role === "ASSISTANT")
          .map(toStaffOption);

        if (nextRoutes.length > 0) {
          setRoutes(nextRoutes);
        }
        if (nextVehicles.length > 0) {
          setVehicles(nextVehicles);
        }
        if (nextStaff.length > 0) {
          setStaff(nextStaff);
        }

        setForm((current) => ({
          ...current,
          routeId: nextRoutes[0]?.id ?? current.routeId,
          vehicleId: nextVehicles[0]?.id ?? current.vehicleId,
          driverId:
            nextStaff.find((item) => item.role === "driver")?.id ??
            current.driverId,
          assistantId:
            nextStaff.find((item) => item.role === "assistant")?.id ??
            current.assistantId,
        }));
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load trip resources");
        }
      } finally {
        if (!ignore) {
          setIsLoadingResources(false);
        }
      }
    }

    void loadResources();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    saveStoredSchedules(scheduleStorageKey, schedules);
  }, [scheduleStorageKey, schedules]);

  function updateForm<K extends keyof ScheduleForm>(
    key: K,
    value: ScheduleForm[K],
  ) {
    setForm((current) => {
      const next: ScheduleForm = { ...current, [key]: value };

      if (key === "departureAt" || key === "routeId") {
        const selectedRoute = routes.find((route) => route.id === next.routeId);
        const arrivalEstimate = getArrivalEstimateValue(
          next.departureAt,
          selectedRoute,
        );

        if (arrivalEstimate) {
          next.arrivalEstimate = arrivalEstimate;
        }
      }

      return next;
    });
  }

  function suggestNextDepartureTime() {
    if (!canManageSchedules) {
      return;
    }

    const departure = getNextSuggestedDeparture();
    const departureAt = toDatetimeLocalValue(departure);
    const selectedRoute = routes.find((route) => route.id === form.routeId);
    const arrivalEstimate = getArrivalEstimateValue(departureAt, selectedRoute);

    setForm((current) => ({
      ...current,
      departureAt,
      arrivalEstimate: arrivalEstimate || current.arrivalEstimate,
    }));
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

  async function saveSchedule(status: ScheduleStatus) {
    setMessage("");
    setError("");

    if (!canManageSchedules) {
      setError(t("trips.staffReadOnlyHint"));
      return;
    }

    const validationError = validateSchedule(status);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingId) {
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.id === editingId
            ? { ...schedule, ...form, status }
            : schedule,
        ),
      );
      setEditingId("");
      setMessage(t("trips.scheduleUpdated"));
      return;
    }

    setIsSaving(true);

    try {
      const saved = await createOperatorDriverSchedule({
        routeId: form.routeId,
        vehicleId: form.vehicleId || null,
        driverUserId: form.driverId,
        assistantUserId: form.assistantId || null,
        departureTime: toScheduleTimeValue(form.departureAt),
        validFrom: form.departureAt.slice(0, 10),
        validUntil: null,
        dayOfWeek: recurrenceToDays(form.recurrence) ?? [1],
        isActive: status === "open",
      });
      const activeSchedule =
        status === "open" ? await activateOperatorDriverSchedule(saved.id) : saved;

      setSchedules((current) => [
        toTripSchedule(activeSchedule, form, status),
        ...current,
      ]);
      setForm({
        ...emptyForm,
        routeId: routes[0]?.id ?? "",
        vehicleId: vehicles[0]?.id ?? "",
        driverId: drivers[0]?.id ?? "",
        assistantId: assistants[0]?.id ?? "",
      });
      setMessage(
        status === "open" ? t("trips.scheduleOpened") : t("trips.scheduleSaved"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setIsSaving(false);
    }
  }

  function editSchedule(schedule: TripSchedule) {
    if (!canManageSchedules) {
      return;
    }

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
        {canManageSchedules ? (
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <FiRefreshCw />
            {tc("reset")}
          </button>
        ) : null}
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
        <MetricCard
          label={t("trips.activeRoutes")}
          value={activeRoutes.length}
        />
        <MetricCard
          label={t("trips.availableVehicles")}
          value={availableVehicles.length}
        />
        <MetricCard
          label={t("trips.availableDrivers")}
          value={
            drivers.filter((driver) => driver.status === "available").length
          }
        />
        <MetricCard
          label={t("trips.openSchedules")}
          value={
            schedules.filter((schedule) => schedule.status === "open").length
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {canManageSchedules ? (
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
              <div>
                <label className={labelClass}>{t("trips.departureTime")}</label>
                <CustomDateTimeInput
                  className={inputClass}
                  value={form.departureAt}
                  type="datetime-local"
                  onChange={(event) =>
                    updateForm("departureAt", event.target.value)
                  }
                />
                <button
                  type="button"
                  onClick={suggestNextDepartureTime}
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
                onChange={(value) => updateForm("arrivalEstimate", value)}
              />
              <Input
                label={t("trips.ticketPrice")}
                value={form.fare}
                type="number"
                currency
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
                onClick={() => void saveSchedule("draft")}
                disabled={isSaving || isLoadingResources}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiPlus />
                {t("trips.saveDraft")}
              </button>
              <button
                type="button"
                onClick={() => void saveSchedule("open")}
                disabled={isSaving || isLoadingResources}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCheckCircle />
                {t("trips.openForOperation")}
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiCalendar />}
              title={t("trips.staffMonitorTitle")}
              subtitle={t("trips.staffMonitorSubtitle")}
            />
            <div className="rounded-lg border border-vr-100 bg-vr-50 px-4 py-3 text-sm text-vr-800">
              {t("trips.staffReadOnlyHint")}
            </div>
          </section>
        )}

        <aside className="space-y-4">
          <Panel title={t("trips.businessRules")} icon={<FiAlertCircle />}>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>{t("trips.ruleFutureDeparture")}</li>
              <li>{t("trips.ruleAvailability")}</li>
              <li>{t("trips.ruleActiveRoute")}</li>
              <li>{t("trips.ruleSubscription")}</li>
            </ul>
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
                {canManageSchedules ? (
                  <th className="px-5 py-3 text-right">{t("trips.actions")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSchedules.length > 0 ? (
                paginatedSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-semibold text-gray-900">
                      {schedule.code}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {optionLabel(
                        routes,
                        schedule.routeId,
                        (route) => route.name,
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {optionLabel(
                        vehicles,
                        schedule.vehicleId,
                        (vehicle) => vehicle.plate,
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <span className="block">
                        {optionLabel(
                          staff,
                          schedule.driverId,
                          (person) => person.name,
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {optionLabel(
                          staff,
                          schedule.assistantId,
                          (person) => person.name,
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <span className="block">
                        {formatDateTime(schedule.departureAt)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t("trips.eta")}:{" "}
                        {formatDateTime(schedule.arrivalEstimate)}
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
                    {canManageSchedules ? (
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
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={canManageSchedules ? 8 : 7}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    {t("trips.noSchedules")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {schedules.length > 0 ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={schedules.length}
            onPageChange={setPage}
          />
        ) : null}
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
  currency = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  currency?: boolean;
}) {
  const isCustomDateTime =
    type === "date" ||
    type === "datetime-local" ||
    type === "time" ||
    type === "month" ||
    type === "week";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {isCustomDateTime ? (
        <CustomDateTimeInput
          className={inputClass}
          value={value}
          type={type}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          value={value}
          type={type}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
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
      <CustomSelect
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </CustomSelect>
    </div>
  );
}
