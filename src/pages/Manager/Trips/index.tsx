import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCalendar, FiPlus, FiTrash2, FiTruck, FiUsers } from "react-icons/fi";
import { getAuthUser } from "../../../auth";
import {
  conflictReasonKey,
  parseResourceConflictError,
  resourceRoleKey,
} from "../../../utils/resourceConflict";
import { ApiRequestError } from "../../../api/client";
import { fetchAllPages } from "../../../api/pagination";
import Modal from "../../../components/Modal";
import { StatCard } from "../../../components/StatCard";
import { useToast } from "../../../components/toast/useToast";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatDateTime, toDatetimeLocalValue } from "../../../utils/date";
import {
  readSessionCache,
  writeSessionCache,
} from "../../../utils/sessionCache";
import ChangeCrewModal, { type ChangeCrewForm } from "./ChangeCrewModal";
import ScheduleFormModal from "./ScheduleFormModal";
import ScheduleTable from "./ScheduleTable";
import {
  emptyForm,
  getArrivalEstimateValue,
  getNextSuggestedDeparture,
  isSameDayOfWeek,
  normalizeDayOfWeek,
  resolveDayOfWeek,
  toRouteOption,
  toScheduleDateTime,
  toScheduleTimeValue,
  toStaffOption,
  isShuttle16SeatVehicle,
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
  checkDriverScheduleAvailability,
  createOperatorDriverSchedule,
  deactivateOperatorDriverSchedule,
  deleteOperatorDriverSchedule,
  getOperatorDriverSchedules,
  getOperatorRoutes,
  getOperatorUsers,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorDriverSchedule,
  updateOperatorDriverScheduleCrew,
  type DriverScheduleApplyTo,
  type OperatorDriverSchedulePatch,
  type ResourceAvailabilityResult,
} from "../../../api/vietride";
import { Button } from "../../../components/ui/Button";

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

// Đọc đồng hồ phải nằm NGOÀI thân component: `Date.now()` gọi bên trong bị
// rule react-hooks/purity chặn (kết quả đổi mỗi lần re-render). Hàm ở module
// scope không nằm trên đường render nên vừa hợp lệ vừa giữ nguyên hành vi —
// validateSchedule chỉ chạy từ handler bấm nút.
function isDepartureInPast(departureAt: string) {
  return new Date(departureAt).getTime() <= Date.now();
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
  const canManageSchedules = authUser?.role === "OPERATOR_ADMIN";
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
            !isShuttle16SeatVehicle(cachedResources.vehicles[0])
              ? cachedResources.staff.find((item) => item.role === "assistant")?.id ?? ""
              : "",
          // Xe trung chuyển 16 chỗ mới được để trống phụ xe.
          // tự gán người đầu danh sách, nếu không mọi lịch đều âm thầm có phụ
          // xe mà người tạo không hề chọn.
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
  // Lỗi validation/lưu khi form đang mở — không render inline, chỉ đẩy qua toast bên dưới.
  const [formError, setFormError] = useState("");
  const [availability, setAvailability] =
    useState<ResourceAvailabilityResult | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  // Lịch đang mở modal đổi crew — null nghĩa là modal đóng.
  const [crewTarget, setCrewTarget] = useState<TripSchedule | null>(null);
  const [crewForm, setCrewForm] = useState<ChangeCrewForm>({
    driverId: "",
    assistantId: "",
  });
  const [isSavingCrew, setIsSavingCrew] = useState(false);
  // Toast góc phải cho feedback hành động (tạo/sửa/xoá/bật-tắt/lỗi load).
  const toast = useToast();
  useToastFeedback({ error: formError });
  const [isLoadingResources, setIsLoadingResources] = useState(
    cachedResources === null,
  );
  const [resourcesReloadKey, setResourcesReloadKey] = useState(0);
  // STAFF: BE hiện 403 GET driver-schedules (xem ghi chú ở effect bên dưới) —
  // khởi tạo false ngay để không hiện skeleton cho một request sẽ không gọi.
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(
    canManageSchedules,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [scheduleTotalItems, setScheduleTotalItems] = useState(0);
  const [scheduleStats, setScheduleStats] = useState({ total: 0, open: 0, draft: 0 });
  const [scheduleStatsVersion, setScheduleStatsVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState("");
  const [departureFrom, setDepartureFrom] = useState("");
  const [departureTo, setDepartureTo] = useState("");
  const [formModalOpen, setFormModalOpen] = useState(false);
  const pageSize = 10;

  // Debounce ô tìm kiếm để tránh mỗi ký tự bắn một request (pattern giống Staff/Bookings)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const drivers = useMemo(
    () => staff.filter((person) => person.role === "driver" && person.status === "active"),
    [staff],
  );
  const assistants = useMemo(
    () => staff.filter((person) => person.role === "assistant" && person.status === "active"),
    [staff],
  );
  const editingSchedule = schedules.find((item) => item.id === editingId);

  useEffect(() => {
    const refreshResources = () => setResourcesReloadKey((current) => current + 1);
    window.addEventListener("vietride:operator-user-status-changed", refreshResources);
    return () => window.removeEventListener("vietride:operator-user-status-changed", refreshResources);
  }, []);
  useEffect(() => {
    let ignore = false;

    async function loadResources() {
      try {
        const [routeItems, vehicleItems, driverItems, assistantItems, vehicleTypeItems] = await Promise.all([
          fetchAllPages((params) => getOperatorRoutes(params)),
          fetchAllPages((params) => getOperatorVehicles(params)),
          fetchAllPages((params) => getOperatorUsers({ ...params, role: "DRIVER", status: "ACTIVE" })),
          fetchAllPages((params) => getOperatorUsers({ ...params, role: "ASSISTANT", status: "ACTIVE" })),
          fetchAllPages((params) => getVehicleTypes(params)),
        ]);

        if (ignore) {
          return;
        }

        const nextRoutes = routeItems.map(toRouteOption);
        const vehicleTypeById = new Map(
          vehicleTypeItems.map((vehicleType) => [
            vehicleType.id,
            vehicleType.displayName || vehicleType.code,
          ]),
        );
        const nextVehicles = vehicleItems.map((vehicle) => {
          const option = toVehicleOption(vehicle);
          return {
            ...option,
            vehicleType:
              vehicle.vehicleTypeCode ||
              vehicleTypeById.get(vehicle.vehicleTypeId) ||
              option.vehicleType,
            // Tên hiển thị lấy từ danh mục loại xe khi bản ghi xe không kèm
            // sẵn `vehicleTypeName` — bảng lịch chạy không được hiện mã thô.
            vehicleTypeName:
              vehicle.vehicleTypeName ||
              vehicleTypeById.get(vehicle.vehicleTypeId),
          };
        });
        // Hai lời gọi riêng cho DRIVER và ASSISTANT có thể trả trùng một người
        // (BE đổi role giữa hai request, hoặc một người mang cả hai vai trò) —
        // gộp thẳng sẽ nhân đôi họ trong mọi ô chọn nhân sự. Khử theo id.
        const nextStaff = [
          ...new Map(
            [...driverItems, ...assistantItems]
              .map(toStaffOption)
              .map((person) => [person.id, person]),
          ).values(),
        ];

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
        setStaff(nextStaff);

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
              !isShuttle16SeatVehicle(nextVehicles[0])
                ? nextStaff.find((item) => item.role === "assistant")?.id ?? current.assistantId
                : "",
            // Xe trung chuyển 16 chỗ mới được để trống phụ xe.
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
  }, [cacheKey, resourcesReloadKey, toast]);

  useEffect(() => {
    if (!canManageSchedules) {
      return;
    }

    let ignore = false;
    async function loadScheduleStats() {
      try {
        // Bỏ thẻ "lịch chạy một lần": domain chỉ có lịch lặp theo tuần nên BE
        // không có `isOneTime`. Trước đây query đó bị bỏ qua im lặng và thẻ
        // hiển thị đúng bằng tổng số lịch — một con số sai, không phải thiếu.
        const [all, open, draft] = await Promise.all([
          getOperatorDriverSchedules({ page: 1, pageSize: 1 }),
          getOperatorDriverSchedules({ page: 1, pageSize: 1, isActive: true }),
          getOperatorDriverSchedules({ page: 1, pageSize: 1, isActive: false }),
        ]);
        if (!ignore) {
          setScheduleStats({
            total: all.totalItems,
            open: open.totalItems,
            draft: draft.totalItems,
          });
        }
      } catch {
        // Danh sách chính vẫn hiển thị được nếu một truy vấn KPI lỗi.
      }
    }
    void loadScheduleStats();
    return () => {
      ignore = true;
    };
  }, [canManageSchedules, scheduleStatsVersion]);

  useEffect(() => {
    // BE hiện stack [Authorize] class-level (chỉ OPERATOR_ADMIN) cùng
    // method-level (STAFF,ADMIN) trên GET driver-schedules — ASP.NET Core
    // ghép AND nên STAFF luôn nhận 403 dù contract công bố STAFF được xem.
    // Không gọi API để tránh toast lỗi vô nghĩa; xem API-driver shedule.md
    // §3.2, §12 mục 3. isLoadingSchedules đã khởi tạo false cho STAFF (lazy
    // initializer ở trên) nên không cần setState ở đây.
    if (!canManageSchedules) {
      return;
    }

    let ignore = false;

    async function loadSchedules() {
      try {
        const result = await getOperatorDriverSchedules({
          page,
          pageSize,
          search: debouncedSearch,
          isActive: statusFilter === "" ? undefined : statusFilter === "open",
          vehicleTypeId: vehicleTypeFilter || undefined,
          routeId: routeFilter || undefined,
          driverUserId: driverFilter || undefined,
          // 1 = Thứ Hai … 7 = Chủ Nhật
          ...(dayOfWeekFilter ? { dayOfWeek: Number(dayOfWeekFilter) } : {}),
          // BE không hỗ trợ ca qua nửa đêm (22:00→02:00 sẽ trả 422)
          ...(departureFrom ? { departureFrom } : {}),
          ...(departureTo ? { departureTo } : {}),
          sortBy: "departureTime",
          sortDir: "asc",
        });

        if (!ignore) {
          setSchedules(result.items.map(toTripScheduleFromApi));
          setScheduleTotalItems(result.totalItems);
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
  }, [canManageSchedules, dayOfWeekFilter, debouncedSearch, departureFrom, departureTo, driverFilter, page, pageSize, routeFilter, statusFilter, vehicleTypeFilter, toast]);

  function updateForm<K extends keyof ScheduleForm>(
    key: K,
    value: ScheduleForm[K],
  ) {
    if (
      key === "baseFare" &&
      editingSchedule &&
      String(value) !== editingSchedule.baseFare
    ) {
      setApplyTo("FUTURE_ONLY");
    }
    // Draft đổi thì kết quả preview cũ không còn ứng với payload sắp gửi.
    setAvailability(null);
    setForm((current) => {
      const next: ScheduleForm = { ...current, [key]: value };

      if (key === "vehicleId" && !next.assistantId) {
        const selectedVehicle = vehicles.find((vehicle) => vehicle.id === next.vehicleId);
        if (!isShuttle16SeatVehicle(selectedVehicle)) {
          next.assistantId = assistants[0]?.id ?? "";
        }
      }

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

  function validateSchedule() {
    if (
      !form.routeId ||
      !form.vehicleId ||
      !form.driverId ||
      !form.departureAt ||
      !form.arrivalEstimate
    ) {
      return t("trips.validationRequired");
    }

    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicleId);
    const canSkipAssistant = Boolean(
      selectedVehicle && isShuttle16SeatVehicle(selectedVehicle),
    );
    if (!canSkipAssistant && !form.assistantId) {
      return t("trips.validationAssistantRequired");
    }

    if (form.baseFare !== "") {
      const baseFare = Number(form.baseFare);
      if (!Number.isSafeInteger(baseFare) || baseFare < 0) {
        return t("trips.validationBaseFare");
      }
    }

    const selectedRoute = routes.find((route) => route.id === form.routeId);
    if (!selectedRoute || selectedRoute.status !== "active") {
      return t("trips.validationRouteInactive");
    }

    const departure = new Date(form.departureAt);
    const arrival = new Date(form.arrivalEstimate);
    if (isDepartureInPast(form.departureAt)) {
      return t("trips.validationFutureDeparture");
    }
    if (arrival.getTime() <= departure.getTime()) {
      return t("trips.validationArrival");
    }

    // BE yêu cầu validUntil >= validFrom (§9.7). Bắt tại chỗ để user sửa ngay
    // trong form thay vì chờ 422 quay về.
    if (!form.isOneTime && form.validUntil && form.validUntil < form.departureAt.slice(0, 10)) {
      return t("trips.validationValidUntil");
    }

    // BE validate dayOfWeek NotEmpty — lịch lặp phải bật ít nhất một thứ.
    if (!form.isOneTime && resolveDayOfWeek(form).length === 0) {
      return t("trips.validationDayOfWeek");
    }

    // Lịch một lần luôn lưu với ALL_PENDING, mà BE cấm ALL_PENDING đi kèm
    // baseFare. Ô giá vé đã bị disable ở modal; nhánh này chỉ chặn trường hợp
    // người dùng đổi giá rồi mới chuyển loại lịch về "một lần".
    if (editingId && form.isOneTime && isScheduleBaseFareChanged()) {
      return t("trips.validationBaseFareOnce");
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

    return "";
  }

  // So sánh giá vé của form với bản gốc đang sửa. Trả false khi đang tạo mới.
  function isScheduleBaseFareChanged() {
    const original = schedules.find((item) => item.id === editingId);
    if (!original) return false;
    const next = form.baseFare === "" ? null : Number(form.baseFare);
    const before = original.baseFare === "" ? null : Number(original.baseFare);
    return next !== before;
  }

  // Conflict tài nguyên: message chung không nói rõ vướng ở đâu, phải đọc
  // error.fields để chỉ đúng tài xế/phụ xe/xe và lý do (handoff mục 6.2, 11.6).
  // ASSISTANT dùng chung code TRIP_DRIVER_CONFLICT nên chỉ resourceRole tách được.
  function handleCrewValidationError(err: unknown) {
    if (!(err instanceof ApiRequestError)) {
      return false;
    }

    const invalidDriver = err.fields.some((field) => field.field === "driverUserId");
    const invalidAssistant = err.fields.some((field) => field.field === "assistantUserId");
    if (!invalidDriver && !invalidAssistant) {
      return false;
    }

    setForm((current) => ({
      ...current,
      ...(invalidDriver ? { driverId: "" } : {}),
      ...(invalidAssistant ? { assistantId: "" } : {}),
    }));
    setCrewForm((current) => ({
      ...current,
      ...(invalidDriver ? { driverId: "" } : {}),
      ...(invalidAssistant ? { assistantId: "" } : {}),
    }));
    setResourcesReloadKey((current) => current + 1);
    setFormError(t("trips.crewNoLongerActive"));
    setCrewTarget(null);
    return true;
  }
  function getScheduleError(err: unknown, fallbackKey: string) {
    const conflict = parseResourceConflictError(err);
    if (conflict) {
      const role = t(resourceRoleKey(conflict.resourceRole));
      const detail = t(conflictReasonKey(conflict.reason));
      return conflict.blockingUntil
        ? `${role}: ${detail} · ${t("resourceConflict.blockingUntil", {
            time: formatDateTime(conflict.blockingUntil),
          })}`
        : `${role}: ${detail}`;
    }

    return err instanceof Error ? err.message : t(fallbackKey);
  }

  // Preview và create phải gửi đúng cùng một draft, nếu không kết quả kiểm tra
  // không nói lên điều gì về payload thật (handoff mục 11.1 bước 2).
  function buildScheduleDraft() {
    const validFrom = form.departureAt.slice(0, 10);
    return {
      routeId: form.routeId,
      vehicleId: form.vehicleId || null,
      driverUserId: form.driverId,
      assistantUserId: form.assistantId || null,
      departureTime: toScheduleTimeValue(form.departureAt),
      validFrom,
      // Lịch một lần luôn chốt validUntil = validFrom. Lịch lặp lấy ngày kết
      // thúc người dùng chọn; bỏ trống = null = chạy không giới hạn (§9.7).
      validUntil: form.isOneTime ? validFrom : form.validUntil || null,
      dayOfWeek: resolveDayOfWeek(form),
    };
  }

  async function checkScheduleAvailability() {
    const validationError = validateSchedule();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsCheckingAvailability(true);
    setFormError("");
    setAvailability(null);

    try {
      setAvailability(
        await checkDriverScheduleAvailability(buildScheduleDraft()),
      );
    } catch (err) {
      setFormError(getScheduleError(err, "trips.createScheduleFailed"));
    } finally {
      setIsCheckingAvailability(false);
    }
  }

  async function saveSchedule(status: ScheduleStatus) {
    setFormError("");

    if (!canManageSchedules) {
      setFormError(t("trips.staffReadOnlyHint"));
      return;
    }

    // Lỗi validation giữ INLINE trong modal — user đang nhập form, lỗi phải
    // nằm cạnh form, không toast.
    const validationError = validateSchedule();
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
      const nextBaseFare = form.baseFare === "" ? null : Number(form.baseFare);
      const originalBaseFare =
        original.baseFare === "" ? null : Number(original.baseFare);
      const baseFareChanged = nextBaseFare !== originalBaseFare;
      // ít nhất một editable field; field vắng mặt = giữ nguyên).
      const patch: OperatorDriverSchedulePatch = {};
      const nextDepartureTime = toScheduleTimeValue(form.departureAt);
      if (nextDepartureTime !== toScheduleTimeValue(original.departureAt)) {
        patch.departureTime = nextDepartureTime;
      }
      // So sánh theo MẢNG NGÀY thực tế người dùng chọn trên bộ chip.
      const nextDays = resolveDayOfWeek(form);
      if (nextDays.length > 0 && !isSameDayOfWeek(nextDays, original.dayOfWeek)) {
        patch.dayOfWeek = nextDays;
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
      // validUntil nullable: "" nghĩa là bỏ giới hạn -> gửi null để clear (§9.8).
      if (form.validUntil !== original.validUntil) {
        patch.validUntil = form.validUntil || null;
      }
      if (baseFareChanged) {
        patch.baseFare = nextBaseFare;
      }
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
          // Lịch một lần chỉ có đúng một chuyến nên FUTURE_ONLY là no-op —
          // luôn gửi ALL_PENDING để thay đổi rơi vào đúng chuyến đó.
          form.isOneTime
            ? "ALL_PENDING"
            : baseFareChanged
              ? "FUTURE_ONLY"
              : applyTo,
          patch,
        );

        // Cập nhật item từ response, giữ lại các field hiển thị chỉ có ở client.
        setScheduleStatsVersion((current) => current + 1);
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
                  baseFare: updated.baseFare === null ? "" : String(updated.baseFare),
                  validUntil:
                    updated.validUntil ?? updated.effectiveUntil ?? "",
                  // Ưu tiên mảng ngày server trả về (server normalize distinct
                  // + sort); nếu response cũ chưa có thì giữ mảng vừa gửi.
                  dayOfWeek: normalizeDayOfWeek(
                    updated.dayOfWeek ??
                      updated.daysOfWeek ??
                      patch.dayOfWeek ??
                      item.dayOfWeek,
                  ),
                  status: updated.isActive ? "open" : "draft",
                }
              : item,
          ),
        );
        setEditingId("");
        setFormModalOpen(false);
        toast.success(t("trips.scheduleUpdated"));
      } catch (err) {
        if (handleCrewValidationError(err)) {
          return;
        }
        // 409 (DRIVER_SCHEDULE_EDIT_TOO_LATE, TRIP_*_CONFLICT...) hiện trong modal
        // vì form vẫn đang mở — user sửa lại field ngay tại chỗ.
        setFormError(getScheduleError(err, "trips.updateScheduleFailed"));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);

    try {
      const saved = await createOperatorDriverSchedule({
        ...buildScheduleDraft(),
        baseFare: form.baseFare === "" ? null : Number(form.baseFare),
        isActive: status === "open",
      });
      const activeSchedule =
        status === "open"
          ? await activateOperatorDriverSchedule(saved.id)
          : saved;

      setScheduleStatsVersion((current) => current + 1);
      setSchedules((current) => [
        toTripSchedule(activeSchedule, form, status),
        ...current,
      ]);
      setForm({
        ...emptyForm,
        routeId: routes[0]?.id ?? "",
        vehicleId: vehicles[0]?.id ?? "",
        driverId: drivers[0]?.id ?? "",
        assistantId:
          !isShuttle16SeatVehicle(vehicles[0]) ? assistants[0]?.id ?? "" : "",
        // Xe trung chuyển 16 chỗ mới được để trống phụ xe.
      });
      setFormModalOpen(false);
      toast.success(
        status === "open"
          ? t("trips.scheduleOpened")
          : t("trips.scheduleSaved"),
      );
    } catch (err) {
      if (handleCrewValidationError(err)) {
        return;
      }
      // Lỗi tạo lịch hiện trong modal vì form vẫn đang mở.
      setFormError(getScheduleError(err, "trips.createScheduleFailed"));
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
      validUntil: schedule.validUntil,
      baseFare: schedule.baseFare,
      isOneTime: schedule.isOneTime,
      dayOfWeek: schedule.dayOfWeek,
    });
    setEditingId(schedule.id);
    setApplyTo(schedule.isOneTime ? "ALL_PENDING" : "FUTURE_ONLY");
    setFormError("");
    setFormModalOpen(true);
  }

  // Tắt/bật lịch — deactivate/activate là endpoint riêng, cập nhật hàng từ response.
  async function toggleScheduleActive(schedule: TripSchedule) {
    if (!canManageSchedules) {
      return;
    }

    // Kích hoạt lại một lịch đang gán xe không còn hoạt động là đưa xe đó trở
    // lại luồng sinh chuyến. Xe bị đổi do sự cố nằm ở `MAINTENANCE` và chỉ được
    // dùng lại sau khi nhà xe đưa về `ACTIVE` (handoff "đổi xe do sự cố",
    // 2026-08-30 mục "Audit và màn hình phương tiện").
    if (schedule.status !== "open") {
      const scheduleVehicle = vehicles.find(
        (vehicle) => vehicle.id === schedule.vehicleId,
      );
      if (scheduleVehicle && scheduleVehicle.status !== "available") {
        toast.error(
          t("trips.vehicleNotAssignable", { plate: scheduleVehicle.plate }),
        );
        return;
      }
    }

    try {
      const updated =
        schedule.status === "open"
          ? await deactivateOperatorDriverSchedule(schedule.id)
          : await activateOperatorDriverSchedule(schedule.id);

      setScheduleStatsVersion((current) => current + 1);
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
      setScheduleStatsVersion((current) => current + 1);
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
      assistantId:
        !isShuttle16SeatVehicle(vehicles[0]) ? assistants[0]?.id ?? "" : "",
      // Xe trung chuyển 16 chỗ mới được để trống phụ xe.
    });
    setEditingId("");
    setFormError("");
    setFormModalOpen(true);
  }

  function openCrewModal(schedule: TripSchedule) {
    setCrewForm({
      driverId: schedule.driverId,
      assistantId: schedule.assistantId ?? "",
    });
    setCrewTarget(schedule);
  }

  async function submitCrewChange() {
    if (!crewTarget || isSavingCrew) {
      return;
    }

    setIsSavingCrew(true);

    try {
      const updated = await updateOperatorDriverScheduleCrew(crewTarget.id, {
        driverUserId: crewForm.driverId,
        // "" = bỏ phụ xe; BE nhận null để xoá (mục 7.5).
        assistantUserId: crewForm.assistantId || null,
      });

      setScheduleStatsVersion((current) => current + 1);
      setSchedules((current) =>
        current.map((item) =>
          item.id === crewTarget.id
            ? {
                ...item,
                driverId: updated.driverUserId ?? crewForm.driverId,
                assistantId:
                  updated.assistantUserId ?? crewForm.assistantId ?? "",
              }
            : item,
        ),
      );
      setCrewTarget(null);
      toast.success(t("trips.changeCrewSuccess"));
    } catch (err) {
      if (handleCrewValidationError(err)) {
        return;
      }
      toast.error(getScheduleError(err, "trips.changeCrewFailed"));
    } finally {
      setIsSavingCrew(false);
    }
  }

  function closeFormModal() {
    setFormModalOpen(false);
    setForm(emptyForm);
    setEditingId("");
    setApplyTo("FUTURE_ONLY");
    setFormError("");
    setAvailability(null);
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
          <Button variant="primary" onClick={openCreateModal}>
            <FiPlus />
            {t("trips.createScheduleTitle")}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={t("trips.totalSchedules")}
          value={scheduleStats.total}
          icon={<FiCalendar size={20} />}
          iconClassName="bg-vr-50 text-vr-900"
          isLoading={isLoadingSchedules}
        />
        <StatCard
          label={t("trips.openSchedules")}
          value={scheduleStats.open}
          icon={<FiTruck size={20} />}
          iconClassName="bg-blue-50 text-blue-700"
          isLoading={isLoadingSchedules}
        />
        <StatCard
          label={t("trips.draftSchedules")}
          value={scheduleStats.draft}
          icon={<FiUsers size={20} />}
          iconClassName="bg-emerald-50 text-emerald-700"
          isLoading={isLoadingSchedules}
        />
      </div>

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
          applyTo={applyTo}
          onApplyToChange={setApplyTo}
          onFieldChange={updateForm}
          onSuggestDeparture={suggestNextDepartureTime}
          onSave={(status) => void saveSchedule(status)}
          availability={availability}
          isCheckingAvailability={isCheckingAvailability}
          onCheckAvailability={() => void checkScheduleAvailability()}
        />
      )}

      {canManageSchedules && (
        <ChangeCrewModal
          schedule={crewTarget}
          form={crewForm}
          drivers={drivers}
          assistants={assistants}
          isSaving={isSavingCrew}
          onFormChange={setCrewForm}
          onClose={() => setCrewTarget(null)}
          onSubmit={() => void submitCrewChange()}
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
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                {tc("cancel")}
              </Button>
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
            {t("trips.deleteScheduleConfirm")}
          </p>
        </Modal>
      ) : null}

      {canManageSchedules && (
        <ScheduleTable
          schedules={schedules}
          routes={routes}
          vehicles={vehicles}
          drivers={drivers}
          canManageSchedules={canManageSchedules}
          isLoading={isLoadingSchedules}
          page={page}
          pageSize={pageSize}
          totalItems={scheduleTotalItems}
          search={search}
          statusFilter={statusFilter}
          vehicleTypeFilter={vehicleTypeFilter}
          routeFilter={routeFilter}
          driverFilter={driverFilter}
          dayOfWeekFilter={dayOfWeekFilter}
          departureFrom={departureFrom}
          departureTo={departureTo}
          onSearchChange={(value) => { setSearch(value); setPage(1); }}
          onStatusFilterChange={(value) => { setStatusFilter(value); setPage(1); }}
          onVehicleTypeFilterChange={(value) => { setVehicleTypeFilter(value); setPage(1); }}
          onRouteFilterChange={(value) => { setRouteFilter(value); setPage(1); }}
          onDriverFilterChange={(value) => { setDriverFilter(value); setPage(1); }}
          onDayOfWeekFilterChange={(value) => { setDayOfWeekFilter(value); setPage(1); }}
          onDepartureFromChange={(value) => { setDepartureFrom(value); setPage(1); }}
          onDepartureToChange={(value) => { setDepartureTo(value); setPage(1); }}
          onPageChange={setPage}
          onEdit={editSchedule}
          onChangeCrew={openCrewModal}
          onToggleActive={(schedule) => void toggleScheduleActive(schedule)}
          onDelete={requestDeleteSchedule}
        />
      )}
    </div>
  );
}






