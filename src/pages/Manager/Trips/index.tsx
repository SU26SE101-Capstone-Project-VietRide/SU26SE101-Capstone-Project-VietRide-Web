import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCalendar, FiPlus, FiTrash2 } from "react-icons/fi";
import { getAuthUser } from "../../../auth";
import { ApiRequestError } from "../../../api/client";
import Modal from "../../../components/Modal";
import { useToast } from "../../../components/toast/useToast";
import { toDatetimeLocalValue } from "../../../utils/date";
import {
  readSessionCache,
  writeSessionCache,
} from "../../../utils/sessionCache";
import ScheduleFormModal from "./ScheduleFormModal";
import ScheduleTable from "./ScheduleTable";
import { MetricCard, SectionHeader } from "./formControls";
import {
  emptyForm,
  getArrivalEstimateValue,
  getNextSuggestedDeparture,
  recurrenceToDays,
  toRouteOption,
  toScheduleDateTime,
  toScheduleTimeValue,
  toStaffOption,
  toTripSchedule,
  toTripScheduleFromApi,
  toVehicleOption,
} from "./tripHelpers";
import type {
  RouteOption,
  ScheduleForm,
  ScheduleStatus,
  StaffOption,
  TripSchedule,
  VehicleOption,
} from "./types";
import {
  activateOperatorDriverSchedule,
  createOperatorDriverSchedule,
  deactivateOperatorDriverSchedule,
  deleteOperatorDriverSchedule,
  getOperatorDriverSchedules,
  getOperatorRoutes,
  getOperatorUsers,
  getOperatorVehicles,
  updateOperatorDriverSchedule,
  type DriverScheduleApplyTo,
  type OperatorDriverSchedulePatch,
} from "../../../api/vietride";

// Cache danh mục (tuyến/xe/nhân sự) theo phiên — stale-while-revalidate, hạn 10 phút.
// KHÔNG cache schedules vì đó là dữ liệu nghiệp vụ đổi thường xuyên.
const resourcesCacheMaxAgeMs = 10 * 60 * 1000;

type TripResourcesCache = {
  routes: RouteOption[];
  vehicles: VehicleOption[];
  staff: StaffOption[];
};

// Key chứa ID user hiện tại để đổi tài khoản không dính cache của nhà xe khác.
function resourcesCacheKey(userId?: string) {
  return `vietride:tripResources:${userId || "anonymous"}`;
}

export default function TripsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để effect tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const authUser = getAuthUser();
  const cacheKey = resourcesCacheKey(authUser?.id);
  // Đọc cache một lần khi mount (lazy initializer): có cache → hiện dữ liệu ngay,
  // không bật skeleton; vẫn fetch nền để cập nhật + ghi đè cache.
  const [cachedResources] = useState(() =>
    readSessionCache<TripResourcesCache>(cacheKey, resourcesCacheMaxAgeMs),
  );
  const [schedules, setSchedules] = useState<TripSchedule[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>(
    cachedResources?.routes ?? [],
  );
  const [vehicles, setVehicles] = useState<VehicleOption[]>(
    cachedResources?.vehicles ?? [],
  );
  const [staff, setStaff] = useState<StaffOption[]>(
    cachedResources?.staff ?? [],
  );
  const [form, setForm] = useState<ScheduleForm>(() =>
    cachedResources
      ? {
          ...emptyForm,
          routeId: cachedResources.routes[0]?.id ?? "",
          vehicleId: cachedResources.vehicles[0]?.id ?? "",
          driverId:
            cachedResources.staff.find((item) => item.role === "driver")?.id ??
            "",
          assistantId:
            cachedResources.staff.find((item) => item.role === "assistant")
              ?.id ?? "",
        }
      : emptyForm,
  );
  // Chỉ set default form theo phần tử đầu MỘT lần — fetch nền về sau không được
  // ghi đè lựa chọn user đang thao tác.
  const hasSetFormDefaultsRef = useRef(cachedResources !== null);
  const [editingId, setEditingId] = useState("");
  // Phạm vi áp dụng khi sửa lịch — bắt buộc theo contract 9.1, mặc định FUTURE_ONLY.
  const [applyTo, setApplyTo] = useState<DriverScheduleApplyTo>("FUTURE_ONLY");
  // Lịch đang chờ xác nhận xoá — null nghĩa là modal confirm đóng.
  const [deleteTarget, setDeleteTarget] = useState<TripSchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Lỗi hiển thị INLINE trong ScheduleFormModal (validation + lỗi lưu khi form
  // đang mở). Mọi feedback hành động khác đi qua toast.
  const [formError, setFormError] = useState("");
  // Toast góc phải cho feedback hành động (tạo/sửa/xoá/bật-tắt/lỗi load).
  const toast = useToast();
  const [isLoadingResources, setIsLoadingResources] = useState(
    cachedResources === null,
  );
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [formModalOpen, setFormModalOpen] = useState(false);
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

  useEffect(() => {
    let ignore = false;

    async function loadResources() {
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

        // Ghi đè cache bằng dữ liệu mới nhất cho lần vào màn tiếp theo
        writeSessionCache<TripResourcesCache>(cacheKey, {
          routes: nextRoutes,
          vehicles: nextVehicles,
          staff: nextStaff,
        });

        if (nextRoutes.length > 0) {
          setRoutes(nextRoutes);
        }
        if (nextVehicles.length > 0) {
          setVehicles(nextVehicles);
        }
        if (nextStaff.length > 0) {
          setStaff(nextStaff);
        }

        if (!hasSetFormDefaultsRef.current) {
          hasSetFormDefaultsRef.current = true;
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
        }
      } catch (err) {
        if (!ignore) {
          toast.error(
            err instanceof Error
              ? err.message
              : tRef.current("trips.loadResourcesFailed"),
          );
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
    // toast API là object memo hoá ổn định — không làm effect refetch
  }, [cacheKey, toast]);

  useEffect(() => {
    let ignore = false;

    async function loadSchedules() {
      try {
        const result = await getOperatorDriverSchedules({
          page: 1,
          pageSize: 100,
        });

        if (!ignore) {
          setSchedules(result.items.map(toTripScheduleFromApi));
        }
      } catch (err) {
        if (!ignore) {
          toast.error(
            err instanceof Error
              ? err.message
              : tRef.current("trips.loadSchedulesFailed"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingSchedules(false);
        }
      }
    }

    void loadSchedules();

    return () => {
      ignore = true;
    };
  }, [toast]);

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
    setFormError("");

    if (!canManageSchedules) {
      setFormError(t("trips.staffReadOnlyHint"));
      return;
    }

    // Lỗi validation giữ INLINE trong modal — user đang nhập form, lỗi phải
    // nằm cạnh form, không toast.
    const validationError = validateSchedule(status);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (editingId) {
      const original = schedules.find((item) => item.id === editingId);
      if (!original) {
        setFormError(t("trips.updateScheduleFailed"));
        return;
      }

      // Patch chỉ gồm field ĐÃ ĐỔI so với bản gốc (contract 9.1: body phải có
      // ít nhất một editable field; field vắng mặt = giữ nguyên).
      const patch: OperatorDriverSchedulePatch = {};
      const nextDepartureTime = toScheduleTimeValue(form.departureAt);
      if (nextDepartureTime !== toScheduleTimeValue(original.departureAt)) {
        patch.departureTime = nextDepartureTime;
      }
      if (form.recurrence !== original.recurrence) {
        const days = recurrenceToDays(form.recurrence);
        if (days) {
          patch.dayOfWeek = days;
        }
      }
      if (form.driverId !== original.driverId) {
        patch.driverUserId = form.driverId;
      }
      if (form.assistantId !== original.assistantId) {
        // assistantUserId nullable — gửi null để clear phụ xe.
        patch.assistantUserId = form.assistantId || null;
      }
      if (form.vehicleId !== original.vehicleId) {
        patch.vehicleId = form.vehicleId;
      }
      // Form không có validUntil nên không gửi field đó (giữ nguyên trên server).
      const nextIsActive = status === "open";
      if (nextIsActive !== (original.status === "open")) {
        patch.isActive = nextIsActive;
      }

      if (Object.keys(patch).length === 0) {
        setFormError(t("trips.noScheduleChanges"));
        return;
      }

      setIsSaving(true);

      try {
        const updated = await updateOperatorDriverSchedule(
          editingId,
          applyTo,
          patch,
        );

        // Cập nhật item từ response, giữ lại các field hiển thị chỉ có ở client.
        setSchedules((current) =>
          current.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  ...form,
                  departureAt:
                    toScheduleDateTime(
                      updated.validFrom ?? updated.effectiveFrom,
                      updated.departureTime,
                    ) || form.departureAt,
                  vehicleId: updated.vehicleId ?? form.vehicleId,
                  driverId: updated.driverUserId ?? form.driverId,
                  assistantId: updated.assistantUserId ?? "",
                  status: updated.isActive ? "open" : "draft",
                }
              : item,
          ),
        );
        setEditingId("");
        setFormModalOpen(false);
        toast.success(t("trips.scheduleUpdated"));
      } catch (err) {
        // 409 (DRIVER_SCHEDULE_EDIT_TOO_LATE, TRIP_*_CONFLICT...) hiện trong modal
        // vì form vẫn đang mở — user sửa lại field ngay tại chỗ.
        setFormError(
          err instanceof Error ? err.message : t("trips.updateScheduleFailed"),
        );
      } finally {
        setIsSaving(false);
      }
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
        status === "open"
          ? await activateOperatorDriverSchedule(saved.id)
          : saved;

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
      setFormModalOpen(false);
      toast.success(
        status === "open"
          ? t("trips.scheduleOpened")
          : t("trips.scheduleSaved"),
      );
    } catch (err) {
      // Lỗi tạo lịch hiện trong modal vì form vẫn đang mở.
      setFormError(
        err instanceof Error ? err.message : t("trips.createScheduleFailed"),
      );
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
    setApplyTo("FUTURE_ONLY");
    setFormError("");
    setFormModalOpen(true);
  }

  // Tắt/bật lịch — deactivate/activate là endpoint riêng, cập nhật hàng từ response.
  async function toggleScheduleActive(schedule: TripSchedule) {
    if (!canManageSchedules) {
      return;
    }

    try {
      const updated =
        schedule.status === "open"
          ? await deactivateOperatorDriverSchedule(schedule.id)
          : await activateOperatorDriverSchedule(schedule.id);

      setSchedules((current) =>
        current.map((item) =>
          item.id === schedule.id
            ? { ...item, status: updated.isActive ? "open" : "draft" }
            : item,
        ),
      );
      toast.success(
        updated.isActive
          ? t("trips.scheduleActivated")
          : t("trips.scheduleDeactivated"),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("trips.toggleScheduleFailed"),
      );
    }
  }

  function requestDeleteSchedule(schedule: TripSchedule) {
    if (!canManageSchedules) {
      return;
    }

    setDeleteTarget(schedule);
  }

  async function confirmDeleteSchedule() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteOperatorDriverSchedule(deleteTarget.id);
      setSchedules((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      toast.success(t("trips.scheduleDeleted"));
    } catch (err) {
      setDeleteTarget(null);
      // 409 SCHEDULE_HAS_TRIPS: client.ts không expose error.fields nên không
      // đọc được tripCount — dùng message chung + gợi ý tắt lịch thay vì xoá.
      if (
        err instanceof ApiRequestError &&
        err.code === "SCHEDULE_HAS_TRIPS"
      ) {
        toast.error(t("trips.deleteHasTrips"));
      } else {
        toast.error(
          err instanceof Error ? err.message : t("trips.deleteScheduleFailed"),
        );
      }
    } finally {
      setIsDeleting(false);
    }
  }

  function openCreateModal() {
    if (!canManageSchedules) {
      return;
    }

    setForm({
      ...emptyForm,
      routeId: routes[0]?.id ?? "",
      vehicleId: vehicles[0]?.id ?? "",
      driverId: drivers[0]?.id ?? "",
      assistantId: assistants[0]?.id ?? "",
    });
    setEditingId("");
    setFormError("");
    setFormModalOpen(true);
  }

  function closeFormModal() {
    setFormModalOpen(false);
    setForm(emptyForm);
    setEditingId("");
    setApplyTo("FUTURE_ONLY");
    setFormError("");
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
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-vr-600"
          >
            <FiPlus />
            {t("trips.createScheduleTitle")}
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label={t("trips.activeRoutes")}
          value={activeRoutes.length}
          isLoading={isLoadingResources}
        />
        <MetricCard
          label={t("trips.availableVehicles")}
          value={availableVehicles.length}
          isLoading={isLoadingResources}
        />
        <MetricCard
          label={t("trips.availableDrivers")}
          value={drivers.filter((driver) => driver.status === "active").length}
          helper={t("trips.activeDriversHelper")}
          isLoading={isLoadingResources}
        />
        <MetricCard
          label={t("trips.openSchedules")}
          value={
            schedules.filter((schedule) => schedule.status === "open").length
          }
          isLoading={isLoadingSchedules}
        />
      </div>

      {!canManageSchedules && (
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

      {canManageSchedules && (
        <ScheduleFormModal
          open={formModalOpen}
          onClose={closeFormModal}
          form={form}
          routes={routes}
          vehicles={vehicles}
          drivers={drivers}
          assistants={assistants}
          editingSchedule={editingSchedule}
          isSaving={isSaving}
          isLoadingResources={isLoadingResources}
          error={formError}
          applyTo={applyTo}
          onApplyToChange={setApplyTo}
          onFieldChange={updateForm}
          onSuggestDeparture={suggestNextDepartureTime}
          onSave={(status) => void saveSchedule(status)}
        />
      )}

      {canManageSchedules ? (
        <Modal
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          icon={<FiTrash2 />}
          title={t("trips.deleteScheduleTitle")}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSchedule()}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 />
                {t("trips.deleteSchedule")}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            {t("trips.deleteScheduleConfirm", { code: deleteTarget?.code })}
          </p>
        </Modal>
      ) : null}

      <ScheduleTable
        schedules={schedules}
        routes={routes}
        vehicles={vehicles}
        staff={staff}
        canManageSchedules={canManageSchedules}
        isLoading={isLoadingSchedules}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onEdit={editSchedule}
        onToggleActive={(schedule) => void toggleScheduleActive(schedule)}
        onDelete={requestDeleteSchedule}
      />
    </div>
  );
}
