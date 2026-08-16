import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  FiClock,
  FiRefreshCw,
  FiTruck,
  FiUsers,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  cancelOperatorShuttleRequest,
  cancelOperatorShuttleTrip,
  checkShuttleTripAvailability,
  createOperatorShuttleTrip,
  getOperatorShuttleRequests,
  getOperatorShuttleTrips,
  getOperatorUsers,
  getOperatorVehicles,
  getShuttleTripEta,
  getOperatorShuttleContext,
  getShuttleTripLatest,
  type OperatorShuttleContext,
  type OperatorShuttleTripListItem,
  type OperatorUser,
  type OperatorVehicle,
  type PagedResult,
  type ResourceAvailabilityResult,
  type ShuttleBookingGroup,
  type ShuttleDirection,
  type ShuttleRequestGroup,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import type {
  ShuttleEtaUpdateEvent,
  ShuttleGpsUpdateEvent,
} from "../../../lib/trackingSocket";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import FleetMap from "../../../components/FleetMap";
import {
  toShuttleRouteMarkers,
  type FleetVehicleMapPoint,
} from "../../../components/fleetMapPoint";
import { formatDateTime } from "../../../utils/date";
import {
  conflictReasonKey,
  parseResourceConflictError,
  resourceRoleKey,
} from "../../../utils/resourceConflict";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import Pagination from "../../../components/Pagination";
import { StatCard } from "../../../components/StatCard";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import AssignVehicleModal, {
  type AssignVehicleForm,
} from "./AssignVehicleModal";
import CancelShuttleModal from "./CancelShuttleModal";
import RequestDetailModal from "./RequestDetailModal";
import RequestTable from "./RequestTable";
import ShuttleTrackingCard from "./ShuttleTrackingCard";
import ShuttleTripDetailModal from "./ShuttleTripDetailModal";
import {
  buildInitialSchedule,
  getBookingDistance,
  getOrderedBookingGroups,
  getOrderedSelectedBookingIds,
  getSelectedPassengerCount,
  isInboundDirection,
  isTrackableShuttleStatus,
  pickNewerEta,
  pickNewerLatest,
  SHUTTLE_TRIP_ALL_STATUSES,
  SHUTTLE_TRIP_STATUS_FILTERS,
  shuttleRouteLabel,
  toDriverOption,
  toShuttleMapPoint,
  toVehicleOption,
  type ShuttleDriver,
  type ShuttleRealtimeStatus,
  type ShuttleTripStatusFilter,
  type ShuttleTripTracking,
  type ShuttleVehicle,
} from "./dispatchHelpers";
import { useShuttleTrackingSocket } from "./useShuttleTrackingSocket";

const REQUEST_PAGE_SIZE = 10;
const RESOURCE_PAGE_SIZE = 50;
const SHUTTLE_TRIP_PAGE_SIZE = 12;
// Mức zoom khi bám một xe, giống màn Operations.
const FOLLOW_VEHICLE_ZOOM = 15;
// Mảng rỗng ổn định identity — fitPoints đổi identity vô cớ là một lần fitBounds
// thừa, kéo khung nhìn về giữa lúc điều độ viên đang kéo bản đồ.
const EMPTY_FIT_POINTS: GoogleMapCoordinate[] = [];

// Mục tiêu của hộp thoại huỷ: một yêu cầu chờ điều phối (theo
// mainTripId + bookingId + direction) hoặc một chuyến trung chuyển đã tạo.
type CancelTarget =
  | {
      kind: "request";
      mainTripId: string;
      bookingId: string;
      direction: ShuttleDirection;
      label: string;
    }
  | { kind: "trip"; shuttleTripId: string; label: string };

const EMPTY_ASSIGN_FORM: AssignVehicleForm = {
  vehicleId: "",
  driverId: "",
  scheduledDepartureTime: "",
  scheduledEndTime: "",
  selectedBookingIds: [],
  notes: "",
};

async function loadEveryPage<T>(
  loadPage: (page: number) => Promise<PagedResult<T>>,
) {
  const firstPage = await loadPage(1);
  const items = [...firstPage.items];

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const result = await loadPage(page);
    items.push(...result.items);
  }

  return items;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export default function DispatchPanel() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const authUser = getAuthUser();
  const canDispatchShuttle = authUser?.role === "OPERATOR_ADMIN";
  // BE mở hai endpoint huỷ cho cả OPERATOR_STAFF, nhưng console chỉ còn phục vụ
  // OPERATOR_ADMIN nên hai quyền này trùng nhau.
  const canCancelShuttle = canDispatchShuttle;
  const tRef = useRef(t);

  const [searchParams] = useSearchParams();
  const [requestSearch, setRequestSearch] = useState("");
  const [debouncedRequestSearch, setDebouncedRequestSearch] = useState("");
  const [requestFrom, setRequestFrom] = useState("");
  const [requestTo, setRequestTo] = useState("");
  const linkedShuttleTripId = searchParams.get("shuttleTripId");
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [groups, setGroups] = useState<ShuttleRequestGroup[]>([]);
  const [page, setPage] = useState(1);
  // Metadata phân trang lấy nguyên từ PagedResult của BE — không tự tính
  // Math.ceil(totalItems / pageSize) nữa.
  const [pageMeta, setPageMeta] = useState({
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  const [vehicles, setVehicles] = useState<ShuttleVehicle[]>([]);
  const [drivers, setDrivers] = useState<ShuttleDriver[]>([]);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const resourcesLoadingRef = useRef(false);

  const [availability, setAvailability] =
    useState<ResourceAvailabilityResult | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);
  const cancelKeyRef = useRef<string | null>(null);

  const [openAssignVehicle, setOpenAssignVehicle] = useState(false);
  const [openRequestDetail, setOpenRequestDetail] = useState(false);
  const [selectedGroup, setSelectedGroup] =
    useState<ShuttleRequestGroup | null>(null);
  const [assignForm, setAssignForm] =
    useState<AssignVehicleForm>(EMPTY_ASSIGN_FORM);
  const [assignError, setAssignError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // resourceError/assignError hiển thị ngay trong modal phân công; toast chỉ
  // dùng cho lỗi ở tầng trang để không báo trùng hai chỗ.
  useToastFeedback({ message, error: loadError });
  const isSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Danh sách chuyến trung chuyển lấy thẳng từ BE (GET /v1/operator/shuttle-trips).
  // Trước đây màn chỉ nhớ các chuyến do chính trình duyệt này tạo qua localStorage,
  // nên đổi máy/đổi trình duyệt là mất sạch và điều độ viên khác không thấy gì.
  const [shuttleTrips, setShuttleTrips] = useState<OperatorShuttleTripListItem[]>(
    [],
  );
  const [isLoadingShuttleTrips, setIsLoadingShuttleTrips] = useState(true);
  const [shuttleTripsError, setShuttleTripsError] = useState("");
  const [shuttleTripsVersion, setShuttleTripsVersion] = useState(0);
  // Mặc định xem TẤT CẢ trạng thái (không gửi `status` lên BE) rồi mới lọc lại
  // nếu cần. Chuyến đã kết thúc vẫn hiện nhưng không được đăng ký realtime — xem
  // trackableShuttleTripIds.
  const [shuttleStatusFilter, setShuttleStatusFilter] =
    useState<ShuttleTripStatusFilter>(SHUTTLE_TRIP_ALL_STATUSES);
  // Vị trí/ETA của từng chuyến, khoá theo shuttleTripId
  const [trackingByTripId, setTrackingByTripId] = useState<
    Record<string, ShuttleTripTracking>
  >({});
  const [realtimeStatus, setRealtimeStatus] =
    useState<ShuttleRealtimeStatus>("connecting");
  // Xe đang bám trên bản đồ. null = xem toàn đội.
  const [selectedShuttleTripId, setSelectedShuttleTripId] = useState<
    string | null
  >(null);
  // Chuyến đang mở modal chi tiết + lộ trình điểm đón của nó
  const [detailTrip, setDetailTrip] =
    useState<OperatorShuttleTripListItem | null>(null);
  const [detailContext, setDetailContext] =
    useState<OperatorShuttleContext | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  // Mở nhanh hai thẻ liên tiếp: lượt nạp về sau không được ghi đè chuyến đang mở
  const detailRequestRef = useRef("");

  const directionLabel = useCallback(
    (direction: ShuttleDirection) =>
      isInboundDirection(direction)
        ? t("dispatch.pickup")
        : t("dispatch.dropoff"),
    [t],
  );

  useEffect(() => {
    let ignore = false;

    async function loadRequests() {
      setIsLoading(true);
      setLoadError("");

      try {
        // Endpoint này tự thân đã là hàng đợi pending/unassigned — KHÔNG gửi
        // `status` hay `unassignedOnly` (sẽ 422). Lịch sử đã gán/huỷ nằm ở
        // `getOperatorShuttleTrips`.
        const result = await getOperatorShuttleRequests({
          page,
          pageSize: REQUEST_PAGE_SIZE,
          ...(debouncedRequestSearch ? { search: debouncedRequestSearch } : {}),
          ...(requestFrom ? { from: requestFrom } : {}),
          ...(requestTo ? { to: requestTo } : {}),
        });

        if (ignore) {
          return;
        }

        // Huỷ bớt yêu cầu có thể làm trang cuối biến mất — lùi về trang cuối
        // theo `totalPages` của BE thay vì hiển thị danh sách rỗng.
        const lastPage = Math.max(1, result.totalPages);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setGroups(result.items);
        setPageMeta({
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        });
      } catch (error) {
        if (!ignore) {
          setLoadError(
            error instanceof Error
              ? error.message
              : tRef.current("dispatch.loadFailed"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadRequests();
    return () => {
      ignore = true;
    };
  }, [debouncedRequestSearch, page, refreshVersion, requestFrom, requestTo]);

  // Search đi thẳng lên BE nên phải debounce; đổi điều kiện thì về trang 1.
  // Bỏ qua lượt chạy đầu: effect này cũng chạy lúc mount và sau đó gọi
  // `setPage(1)` dù người dùng chưa gõ gì — ai bấm sang trang trong khoảng
  // debounce đầu tiên sẽ bị đá ngược về trang 1. Giá trị debounce lúc mount vốn
  // đã bằng ô nhập nên bỏ lượt này không làm lệch state.
  const hasFilterChanged = useRef(false);
  useEffect(() => {
    if (!hasFilterChanged.current) {
      hasFilterChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedRequestSearch(requestSearch.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [requestSearch]);

  const loadAssignmentResources = useCallback(
    async (force = false) => {
      if (!canDispatchShuttle || resourcesLoadingRef.current) {
        return;
      }

      if (resourcesLoaded && !force) {
        return;
      }

      resourcesLoadingRef.current = true;
      setIsLoadingResources(true);
      setResourceError("");

      try {
        const [vehicleItems, userItems] = await Promise.all([
          loadEveryPage<OperatorVehicle>((resourcePage) =>
            getOperatorVehicles({
              page: resourcePage,
              pageSize: RESOURCE_PAGE_SIZE,
              status: "ACTIVE",
              sortBy: "licensePlate",
              sortDir: "asc",
            }),
          ),
          loadEveryPage<OperatorUser>((resourcePage) =>
            getOperatorUsers({
              page: resourcePage,
              pageSize: RESOURCE_PAGE_SIZE,
              role: "DRIVER",
              status: "ACTIVE",
              sortBy: "displayName",
              sortDir: "asc",
            }),
          ),
        ]);

        const nextVehicles = uniqueById(
          vehicleItems
            .map(toVehicleOption)
            .filter((vehicle): vehicle is ShuttleVehicle => vehicle !== null),
        );
        const nextDrivers = uniqueById(
          userItems
            .map(toDriverOption)
            .filter((driver): driver is ShuttleDriver => driver !== null),
        );

        setVehicles(nextVehicles);
        setDrivers(nextDrivers);
        setResourcesLoaded(true);
        setAssignForm((current) => ({
          ...current,
          vehicleId: nextVehicles.some(
            (vehicle) => vehicle.id === current.vehicleId,
          )
            ? current.vehicleId
            : nextVehicles[0]?.id || "",
          driverId: nextDrivers.some(
            (driver) => driver.id === current.driverId,
          )
            ? current.driverId
            : nextDrivers[0]?.id || "",
        }));
      } catch (error) {
        setResourceError(
          error instanceof Error
            ? error.message
            : t("dispatch.resourceLoadFailed", {
                defaultValue: "Không thể tải danh sách xe và tài xế.",
              }),
        );
      } finally {
        resourcesLoadingRef.current = false;
        setIsLoadingResources(false);
      }
    },
    [canDispatchShuttle, resourcesLoaded, t],
  );

  const openTripDetail = useCallback(
    async (trip: OperatorShuttleTripListItem) => {
      detailRequestRef.current = trip.shuttleTripId;
      setDetailTrip(trip);
      setDetailError("");

      // Chuyến đang theo dõi đã nạp sẵn context cùng lượt latest/eta — dùng lại
      // thay vì bắn thêm một request cho đúng dữ liệu vừa có.
      const cached = trackingByTripId[trip.shuttleTripId]?.context ?? null;
      setDetailContext(cached);
      if (cached) return;

      setIsLoadingDetail(true);
      try {
        const context = await getOperatorShuttleContext(trip.shuttleTripId);
        if (detailRequestRef.current !== trip.shuttleTripId) return;
        setDetailContext(context);
      } catch (error) {
        if (detailRequestRef.current !== trip.shuttleTripId) return;
        setDetailError(
          error instanceof Error
            ? error.message
            : tRef.current("dispatch.trackingFailed"),
        );
      } finally {
        if (detailRequestRef.current === trip.shuttleTripId) {
          setIsLoadingDetail(false);
        }
      }
    },
    [trackingByTripId],
  );

  function closeTripDetail() {
    detailRequestRef.current = "";
    setDetailTrip(null);
    setDetailContext(null);
    setDetailError("");
    setIsLoadingDetail(false);
  }

  const refreshShuttleTracking = useCallback(
    async (shuttleTripId: string) => {
      setTrackingByTripId((current) => ({
        ...current,
        [shuttleTripId]: {
          ...current[shuttleTripId],
          isRefreshing: true,
          error: undefined,
        },
      }));

      try {
        // `operator-context` nạp song song với latest/eta: nó là source of
        // truth cho điểm đón, đừng ghép lại từ danh sách yêu cầu pending.
        // Lỗi riêng của context không được kéo đổ cả lượt tracking, nên bắt
        // riêng và hạ về null.
        const [latest, eta, context] = await Promise.all([
          getShuttleTripLatest(shuttleTripId),
          getShuttleTripEta(shuttleTripId),
          getOperatorShuttleContext(shuttleTripId).catch(() => null),
        ]);
        setTrackingByTripId((current) => {
          const existing = current[shuttleTripId];
          // Lượt REST này có thể về sau một event socket mới hơn (nạp lần đầu
          // khi join, hoặc người dùng bấm làm mới đúng lúc xe đang gửi GPS) —
          // không được để nó kéo thẻ lùi về số liệu cũ.
          const nextLatest = pickNewerLatest(existing?.latest, latest);
          const nextEta = pickNewerEta(existing?.eta, eta);

          return {
            ...current,
            [shuttleTripId]: {
              latest: nextLatest,
              eta: nextEta,
              // Giữ context cũ khi lượt này nạp lỗi — mất điểm đón trên bản đồ
              // còn tệ hơn là hiển thị bộ điểm của lượt trước.
              context: context ?? existing?.context ?? null,
              isRefreshing: false,
              isLive:
                Boolean(existing?.isLive) && nextLatest === existing?.latest,
            },
          };
        });
      } catch (error) {
        setTrackingByTripId((current) => ({
          ...current,
          [shuttleTripId]: {
            ...current[shuttleTripId],
            isRefreshing: false,
            // `FORBIDDEN` = principal không phải operator hoặc thiếu operatorId;
            // với người dùng thì cùng nghĩa "không có quyền" như
            // TRACKING_ACCESS_DENIED nên dùng chung một câu.
            error:
              error instanceof ApiRequestError &&
              (error.code === "TRACKING_ACCESS_DENIED" ||
                error.code === "FORBIDDEN")
                ? t("dispatch.operatorTrackingDenied")
                : error instanceof ApiRequestError &&
                    (error.code === "TRACKING_FLEET_UNAVAILABLE" ||
                      error.code === "TRACKING_CONTEXT_UNAVAILABLE")
                  ? t("dispatch.trackingTemporarilyUnavailable")
                  : error instanceof Error
                    ? error.message
                    : t("dispatch.trackingFailed"),
          },
        }));
      }
    },
    [t],
  );

  // Chỉ chuyến chưa kết thúc mới mở socket: chuyến COMPLETED/CANCELLED không còn
  // tài xế gửi GPS, join room cho chúng chỉ tốn kết nối và làm trạng thái
  // realtime nhấp nháy vô cớ.
  const trackableShuttleTripIds = useMemo(
    () =>
      shuttleTrips
        .filter((trip) => isTrackableShuttleStatus(trip.status))
        .map((trip) => trip.shuttleTripId),
    [shuttleTrips],
  );

  // Chỉ chuyến đã có toạ độ mới lên bản đồ; các chuyến còn lại vẫn nằm ở lưới
  // thẻ bên dưới với hint "chưa gửi tín hiệu".
  const shuttleMapPoints = useMemo(
    () =>
      shuttleTrips
        .map((trip) =>
          toShuttleMapPoint(trip, trackingByTripId[trip.shuttleTripId], {
            unknownVehicle: t("dispatch.unknownVehicle"),
            unassignedDriver: t("dispatch.unassignedDriver"),
            route: directionLabel(trip.direction),
          }),
        )
        .filter((point): point is FleetVehicleMapPoint => point !== null),
    [directionLabel, shuttleTrips, t, trackingByTripId],
  );

  const selectedShuttlePosition = useMemo(
    () =>
      shuttleMapPoints.find((point) => point.id === selectedShuttleTripId)
        ?.position ?? null,
    [selectedShuttleTripId, shuttleMapPoints],
  );

  // Chưa chọn xe nào thì để bản đồ tự khung nhìn bao trọn cả đội; chọn rồi thì
  // bám theo xe đó và bỏ fit để khung nhìn không giật về mỗi lượt GPS.
  const shuttleFitPoints = useMemo(
    () =>
      selectedShuttlePosition
        ? EMPTY_FIT_POINTS
        : shuttleMapPoints
            .map((point) => point.position)
            .filter((position): position is GoogleMapCoordinate =>
              Boolean(position),
            ),
    [selectedShuttlePosition, shuttleMapPoints],
  );

  // Điểm đón + bến của chuyến đang chọn, vẽ dọc lộ trình như màn Vận hành.
  const selectedShuttleStops = useMemo(
    () =>
      toShuttleRouteMarkers(
        selectedShuttleTripId
          ? trackingByTripId[selectedShuttleTripId]?.context
          : null,
        t("dispatch.shuttleStationFallback"),
      ),
    [selectedShuttleTripId, t, trackingByTripId],
  );

  const applyShuttleGps = useCallback((event: ShuttleGpsUpdateEvent) => {
    setTrackingByTripId((current) => {
      const existing = current[event.shuttleTripId];
      const latest = pickNewerLatest(existing?.latest, event);
      // Event cũ hơn điểm đang hiện (reconnect đẩy lại): bỏ qua hẳn lượt cập
      // nhật thay vì render lại với đúng dữ liệu cũ.
      if (latest === existing?.latest) return current;

      return {
        ...current,
        [event.shuttleTripId]: {
          ...existing,
          isRefreshing: existing?.isRefreshing ?? false,
          latest,
          isLive: true,
          error: undefined,
        },
      };
    });
  }, []);

  const applyShuttleEta = useCallback((event: ShuttleEtaUpdateEvent) => {
    setTrackingByTripId((current) => {
      const existing = current[event.shuttleTripId];
      const eta = pickNewerEta(existing?.eta, event);
      if (eta === existing?.eta) return current;

      return {
        ...current,
        [event.shuttleTripId]: {
          ...existing,
          isRefreshing: existing?.isRefreshing ?? false,
          eta,
          isLive: true,
          error: undefined,
        },
      };
    });
  }, []);

  useShuttleTrackingSocket({
    shuttleTripIds: trackableShuttleTripIds,
    onGps: applyShuttleGps,
    onEta: applyShuttleEta,
    // Room chỉ phát khi tài xế gửi GPS tiếp theo nên nạp một lần từ REST để thẻ
    // có số liệu ngay; các lượt sau do socket đẩy về.
    onJoined: (shuttleTripId) => void refreshShuttleTracking(shuttleTripId),
    onStatus: setRealtimeStatus,
  });

  useEffect(() => {
    let ignore = false;

    async function loadShuttleTrips() {
      setIsLoadingShuttleTrips(true);
      setShuttleTripsError("");

      try {
        // Filter rỗng = xem tất cả → không gửi `status` lên BE.
        const result = await getOperatorShuttleTrips({
          page: 1,
          pageSize: SHUTTLE_TRIP_PAGE_SIZE,
          ...(shuttleStatusFilter ? { status: shuttleStatusFilter } : {}),
        });
        if (!ignore) setShuttleTrips(result.items);
      } catch (error) {
        if (!ignore) {
          setShuttleTripsError(
            error instanceof Error
              ? error.message
              : tRef.current("dispatch.shuttleTripsLoadFailed"),
          );
        }
      } finally {
        if (!ignore) setIsLoadingShuttleTrips(false);
      }
    }

    void loadShuttleTrips();
    return () => {
      ignore = true;
    };
  }, [shuttleStatusFilter, shuttleTripsVersion]);

  // Deep-link ?shuttleTripId= — tải sẵn vị trí cho đúng chuyến đó nếu nó nằm
  // trong danh sách đang hiển thị.
  useEffect(() => {
    const shuttleTripId = linkedShuttleTripId?.trim();
    if (!shuttleTripId) return;
    if (!shuttleTrips.some((trip) => trip.shuttleTripId === shuttleTripId)) {
      return;
    }
    void refreshShuttleTracking(shuttleTripId);
  }, [linkedShuttleTripId, refreshShuttleTracking, shuttleTrips]);

  function openDetail(group: ShuttleRequestGroup) {
    setSelectedGroup(group);
    setOpenRequestDetail(true);
  }

  function openAssign(group: ShuttleRequestGroup) {
    if (!canDispatchShuttle) {
      return;
    }

    const schedule = buildInitialSchedule(group);
    const selectedBookingIds = getOrderedBookingGroups(group)
      .filter((booking) => getBookingDistance(booking) !== null)
      .map((booking) => booking.bookingId);

    setSelectedGroup(group);
    setAssignError("");
    setResourceError("");
    setAssignForm({
      vehicleId: vehicles[0]?.id || "",
      driverId: drivers[0]?.id || "",
      selectedBookingIds,
      notes: "",
      ...schedule,
    });
    idempotencyKeyRef.current = createIdempotencyKey();
    setAvailability(null);
    setOpenAssignVehicle(true);
    void loadAssignmentResources();
  }

  function closeAssign() {
    if (isSubmittingRef.current) {
      return;
    }

    setOpenAssignVehicle(false);
    setAssignError("");
    setAvailability(null);
    idempotencyKeyRef.current = null;
  }

  function getAssignmentValidationError() {
    if (!selectedGroup) {
      return t("dispatch.invalidRequest", {
        defaultValue: "Nhóm yêu cầu không còn hợp lệ.",
      });
    }

    const orderedBookingIds = getOrderedSelectedBookingIds(
      selectedGroup,
      assignForm.selectedBookingIds,
    );
    if (orderedBookingIds.length === 0) {
      return t("dispatch.selectAtLeastOneBooking", {
        defaultValue: "Chọn ít nhất một lượt đặt vé để điều phối.",
      });
    }

    if (
      orderedBookingIds.some((bookingId) => {
        const booking = selectedGroup.bookingGroups.find(
          (item) => item.bookingId === bookingId,
        );
        return !booking || getBookingDistance(booking) === null;
      })
    ) {
      return t("dispatch.distanceRequired", {
        defaultValue:
          "Không thể điều phối lượt đặt vé chưa có khoảng cách đường bộ.",
      });
    }

    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.id === assignForm.vehicleId,
    );
    if (!selectedVehicle) {
      return t("dispatch.selectVehiclePlaceholder");
    }

    if (!drivers.some((driver) => driver.id === assignForm.driverId)) {
      return t("dispatch.selectDriverPlaceholder");
    }

    const passengerCount = getSelectedPassengerCount(
      selectedGroup,
      orderedBookingIds,
    );
    if (passengerCount > selectedVehicle.capacity) {
      return t("dispatch.capacityExceeded", {
        defaultValue:
          "Số khách đã chọn vượt quá sức chứa {{capacity}} chỗ của xe.",
        capacity: selectedVehicle.capacity,
      });
    }

    const departure = new Date(assignForm.scheduledDepartureTime);
    const end = new Date(assignForm.scheduledEndTime);
    if (
      !assignForm.scheduledDepartureTime ||
      !assignForm.scheduledEndTime ||
      Number.isNaN(departure.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return t("dispatch.fillRequired");
    }

    if (departure.getTime() <= Date.now()) {
      return t("dispatch.departureMustBeFuture", {
        defaultValue: "Giờ xuất phát trung chuyển phải ở tương lai.",
      });
    }

    if (end <= departure) {
      return t("dispatch.endAfterDeparture", {
        defaultValue: "Giờ kết thúc phải sau giờ xuất phát.",
      });
    }

    const boundary = new Date(selectedGroup.hardCutoffAt);
    if (!Number.isNaN(boundary.getTime())) {
      if (
        isInboundDirection(selectedGroup.direction) &&
        Date.now() >= boundary.getTime()
      ) {
        return t("dispatch.cutoffPassed", {
          defaultValue: "Đã quá hạn điều phối.",
        });
      }

      if (
        isInboundDirection(selectedGroup.direction) &&
        end.getTime() > boundary.getTime()
      ) {
        return t("dispatch.endBeforeCutoff", {
          defaultValue:
            "Chuyến trung chuyển phải kết thúc trước hạn của chuyến chính.",
        });
      }

      if (
        !isInboundDirection(selectedGroup.direction) &&
        departure.getTime() < boundary.getTime()
      ) {
        return t("dispatch.departureAfterBoundary", {
          defaultValue:
            "Chuyến trả khách chỉ được xuất phát sau thời điểm chuyến chính đến bến.",
        });
      }
    }

    if (assignForm.notes.length > 1_000) {
      return t("dispatch.notesTooLong", {
        defaultValue: "Ghi chú không được vượt quá 1.000 ký tự.",
      });
    }

    return null;
  }

  function getSubmitError(error: unknown) {
    if (!(error instanceof ApiRequestError)) {
      return error instanceof Error ? error.message : t("dispatch.assignFailed");
    }

    // Conflict tài nguyên: message chung không nói rõ vướng ở đâu, phải đọc
    // error.fields để chỉ đúng tài xế/xe và lý do (handoff mục 6.2 và 11.6).
    const conflict = parseResourceConflictError(error);
    if (conflict) {
      const detail = t(conflictReasonKey(conflict.reason));
      const role = t(resourceRoleKey(conflict.resourceRole));
      return conflict.blockingUntil
        ? `${role}: ${detail} · ${t("resourceConflict.blockingUntil", {
            time: formatDateTime(conflict.blockingUntil),
          })}`
        : `${role}: ${detail}`;
    }

    const messages: Record<string, string> = {
      SHUTTLE_REQUEST_CUTOFF_PASSED: t("dispatch.cutoffPassed", {
        defaultValue: "Đã quá hạn điều phối.",
      }),
      SHUTTLE_DRIVER_CONFLICT: t("dispatch.driverConflict", {
        defaultValue: "Tài xế đã có chuyến trùng thời gian.",
      }),
      SHUTTLE_VEHICLE_CONFLICT: t("dispatch.vehicleConflict", {
        defaultValue: "Xe đã có chuyến trùng thời gian hoặc không còn hoạt động.",
      }),
      SHUTTLE_REQUEST_SET_CHANGED: t("dispatch.requestSetChanged", {
        defaultValue:
          "Danh sách yêu cầu vừa thay đổi. Hãy đóng biểu mẫu và tải lại trang.",
      }),
      SHUTTLE_CAPACITY_EXCEEDED: t("dispatch.capacityChanged", {
        defaultValue: "Sức chứa xe không còn đủ cho số khách đã chọn.",
      }),
      SHUTTLE_DISTANCE_UNAVAILABLE: t("dispatch.distanceRequired", {
        defaultValue: "Một điểm đón/trả chưa có khoảng cách đường bộ.",
      }),
      SHUTTLE_DISTANCE_EXCEEDED: t("dispatch.distanceExceeded", {
        defaultValue: "Một điểm đón/trả vượt quá phạm vi trung chuyển.",
      }),
      DRIVER_NOT_FOUND: t("dispatch.driverUnavailable", {
        defaultValue: "Tài xế không còn sẵn sàng để điều phối.",
      }),
      VEHICLE_NOT_FOUND: t("dispatch.vehicleUnavailable", {
        defaultValue: "Xe không còn sẵn sàng để điều phối.",
      }),
    };

    return (error.code && messages[error.code]) || error.message;
  }

  // Preview và create phải gửi đúng cùng một draft, đặc biệt là thứ tự
  // orderedBookingIds vì nó quyết định điểm đầu/cuối dùng để tính availability
  // (handoff mục 8.2). Dựng payload ở một chỗ để hai luồng không lệch nhau.
  function buildShuttleDraft(group: ShuttleRequestGroup) {
    return {
      mainTripId: group.mainTripId,
      direction: group.direction,
      vehicleId: assignForm.vehicleId,
      driverUserId: assignForm.driverId,
      scheduledDepartureTime: new Date(
        assignForm.scheduledDepartureTime,
      ).toISOString(),
      scheduledEndTime: new Date(assignForm.scheduledEndTime).toISOString(),
      orderedBookingIds: getOrderedSelectedBookingIds(
        group,
        assignForm.selectedBookingIds,
      ),
    };
  }

  async function handleCheckAvailability() {
    if (!selectedGroup) {
      return;
    }

    const validationError = getAssignmentValidationError();
    if (validationError) {
      setAssignError(validationError);
      return;
    }

    setIsCheckingAvailability(true);
    setAssignError("");
    setAvailability(null);

    try {
      setAvailability(
        await checkShuttleTripAvailability(buildShuttleDraft(selectedGroup)),
      );
    } catch (error) {
      setAssignError(getSubmitError(error));
    } finally {
      setIsCheckingAvailability(false);
    }
  }

  async function handleAssignVehicle() {
    if (isSubmittingRef.current || !selectedGroup) {
      return;
    }

    const validationError = getAssignmentValidationError();
    if (validationError) {
      setAssignError(validationError);
      return;
    }

    const orderedBookingIds = getOrderedSelectedBookingIds(
      selectedGroup,
      assignForm.selectedBookingIds,
    );
    // Giữ lại biển số để báo thành công bằng thông tin người đọc được
    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.id === assignForm.vehicleId,
    );
    const idempotencyKey =
      idempotencyKeyRef.current ?? createIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setAssignError("");

    try {
      const result = await createOperatorShuttleTrip(
        {
          ...buildShuttleDraft(selectedGroup),
          orderedBookingIds,
          notes: assignForm.notes.trim() || undefined,
        },
        idempotencyKey,
      );

      // Danh sách chuyến do server giữ — tải lại thay vì tự chèn vào state.
      setShuttleTripsVersion((current) => current + 1);
      setMessage(
        t("dispatch.assignSuccessDetail", {
          plate: selectedVehicle?.plate ?? "",
          count: result.assignedPassengerCount,
        }),
      );
      setOpenAssignVehicle(false);
      setSelectedGroup(null);
      setAssignForm(EMPTY_ASSIGN_FORM);
      idempotencyKeyRef.current = null;
      if (page === 1) {
        setRefreshVersion((current) => current + 1);
      } else {
        setPage(1);
      }
      void refreshShuttleTracking(result.shuttleTripId);
    } catch (error) {
      setAssignError(getSubmitError(error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function openCancelRequest(
    group: ShuttleRequestGroup,
    booking: ShuttleBookingGroup,
    passengerLabel: string,
  ) {
    if (!canCancelShuttle) {
      return;
    }

    setCancelReason("");
    setCancelError("");
    cancelKeyRef.current = createIdempotencyKey();
    setCancelTarget({
      kind: "request",
      mainTripId: group.mainTripId,
      bookingId: booking.bookingId,
      direction: group.direction,
      label: `${passengerLabel} · ${shuttleRouteLabel(
        group,
        group.stationName,
      )}`,
    });
  }

  function openCancelTrip(trip: OperatorShuttleTripListItem) {
    if (!canCancelShuttle) {
      return;
    }

    setCancelReason("");
    setCancelError("");
    cancelKeyRef.current = createIdempotencyKey();
    setCancelTarget({
      kind: "trip",
      shuttleTripId: trip.shuttleTripId,
      label:
        trip.vehicle.licensePlate.trim() || t("dispatch.unknownVehicle"),
    });
  }

  function closeCancel() {
    if (isCancellingRef.current) {
      return;
    }

    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
    cancelKeyRef.current = null;
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || isCancellingRef.current) {
      return;
    }

    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError(t("dispatch.cancelReasonRequired"));
      return;
    }

    // Giữ nguyên key qua các lần bấm lại của cùng một hộp thoại để BE dedupe
    // được khi request đầu tiên đã tới nhưng response bị mất.
    const idempotencyKey = cancelKeyRef.current ?? createIdempotencyKey();
    cancelKeyRef.current = idempotencyKey;
    isCancellingRef.current = true;
    setIsCancelling(true);
    setCancelError("");

    try {
      if (cancelTarget.kind === "request") {
        await cancelOperatorShuttleRequest(
          cancelTarget.mainTripId,
          cancelTarget.bookingId,
          cancelTarget.direction,
          { reason },
          idempotencyKey,
        );
        setMessage(
          t("dispatch.cancelRequestSuccess", { label: cancelTarget.label }),
        );
        setOpenRequestDetail(false);
        setSelectedGroup(null);
      } else {
        await cancelOperatorShuttleTrip(
          cancelTarget.shuttleTripId,
          { reason },
          idempotencyKey,
        );
        setMessage(
          t("dispatch.cancelTripSuccess", { label: cancelTarget.label }),
        );
      }

      setCancelTarget(null);
      setCancelReason("");
      cancelKeyRef.current = null;
      // Điều độ viên khác hoặc safety job có thể đã đổi dữ liệu — tải lại cả
      // hai danh sách thay vì tự sửa state ở client.
      setRefreshVersion((current) => current + 1);
      setShuttleTripsVersion((current) => current + 1);
    } catch (error) {
      setCancelError(getSubmitError(error));
    } finally {
      isCancellingRef.current = false;
      setIsCancelling(false);
    }
  }

  const passengersOnPage = useMemo(
    () =>
      groups.reduce(
        (total, group) => total + group.pendingPassengerCount,
        0,
      ),
    [groups],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("dispatch.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("dispatch.pendingSubtitle", {
              defaultValue:
                "Điều phối các nhóm yêu cầu đang chờ theo chuyến chính và chiều trung chuyển.",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setRefreshVersion((current) => current + 1);
          }}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw
            size={18}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {tc("refresh")}
        </button>
      </div>

      {!canDispatchShuttle && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {t("dispatch.staffReadOnly", {
            defaultValue:
              "Nhân viên có thể theo dõi các yêu cầu chờ. Chỉ quản trị viên nhà xe được phân công xe và tài xế.",
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("dispatch.pendingGroups", {
            defaultValue: "Nhóm yêu cầu đang chờ",
          })}
          value={pageMeta.totalItems}
          icon={<FiClock size={20} />}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          label={t("dispatch.passengersOnPage", {
            defaultValue: "Khách chờ trên trang hiện tại",
          })}
          value={passengersOnPage}
          icon={<FiUsers size={20} />}
          iconClassName="bg-vr-50 text-vr-700"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-gray-900">
            {t("dispatch.awaiting")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t("dispatch.serverPaginationHint", {
              defaultValue:
                "Danh sách được phân trang trực tiếp từ hệ thống; mỗi thẻ là một chuyến chính và một chiều trung chuyển.",
            })}
          </p>
        </div>

        {/* Query kiểu `date`: gửi YYYY-MM-DD theo `requestedAt`, inclusive */}
        <div className="grid gap-3 border-b border-gray-100 px-5 pb-4 sm:grid-cols-[minmax(0,1fr)_170px_170px]">
          <input
            type="search"
            aria-label={t("dispatch.requestSearchLabel")}
            placeholder={t("dispatch.requestSearchPlaceholder")}
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100"
          />
          <label className="min-w-0">
            <span className="sr-only">{t("dispatch.requestFromLabel")}</span>
            <CustomDateTimeInput
              type="date"
              value={requestFrom}
              max={requestTo || undefined}
              placeholder={t("dispatch.requestFromLabel")}
              onChange={(event) => {
                if (requestTo && event.target.value > requestTo) return;
                setRequestFrom(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100"
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">{t("dispatch.requestToLabel")}</span>
            <CustomDateTimeInput
              type="date"
              value={requestTo}
              min={requestFrom || undefined}
              placeholder={t("dispatch.requestToLabel")}
              onChange={(event) => {
                if (requestFrom && event.target.value < requestFrom) return;
                setRequestTo(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100"
            />
          </label>
        </div>

        <RequestTable
          groups={groups}
          isLoading={isLoading}
          canDispatchShuttle={canDispatchShuttle}
          onAssign={openAssign}
          onOpenDetail={openDetail}
          directionLabel={directionLabel}
        />

        <Pagination
          page={page}
          pageSize={REQUEST_PAGE_SIZE}
          totalItems={pageMeta.totalItems}
          totalPages={pageMeta.totalPages}
          hasNextPage={pageMeta.hasNextPage}
          hasPreviousPage={pageMeta.hasPreviousPage}
          onPageChange={setPage}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dispatch.shuttleTracking")}
              </h2>
              {/* Mất realtime nghĩa là số liệu đứng im tới khi bấm làm mới —
                  điều độ viên phải thấy được điều đó ngay cạnh tiêu đề. */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  realtimeStatus === "connected"
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : realtimeStatus === "connecting"
                      ? "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                      : "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
                }`}
              >
                {realtimeStatus === "error" ? (
                  <FiWifiOff size={12} aria-hidden="true" />
                ) : (
                  <FiWifi size={12} aria-hidden="true" />
                )}
                {t(`dispatch.realtime.${realtimeStatus}`)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {realtimeStatus === "error"
                ? t("dispatch.shuttleTrackingOfflineHint")
                : t("dispatch.shuttleTrackingHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-52">
              <CustomSelect
                aria-label={t("dispatch.shuttleStatusFilter")}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
                value={shuttleStatusFilter}
                onChange={(event) =>
                  setShuttleStatusFilter(
                    event.target.value as ShuttleTripStatusFilter,
                  )
                }
              >
                {SHUTTLE_TRIP_STATUS_FILTERS.map((filter) => (
                  <option key={filter.id} value={filter.value}>
                    {t(`dispatch.shuttleStatusFilters.${filter.id}`)}
                  </option>
                ))}
              </CustomSelect>
            </div>
            <button
              type="button"
              onClick={() => setShuttleTripsVersion((current) => current + 1)}
              disabled={isLoadingShuttleTrips}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw
                size={15}
                className={isLoadingShuttleTrips ? "animate-spin" : ""}
                aria-hidden="true"
              />
              {tc("refresh")}
            </button>
          </div>
        </div>

        {shuttleTripsError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {shuttleTripsError}
          </p>
        )}

        {/* Bản đồ chỉ dựng khi đã có ít nhất một toạ độ: một khung bản đồ trống
            không nói được gì mà vẫn tốn một lượt tải Google Maps. */}
        {shuttleMapPoints.length > 0 && (
          <div className="mt-4 h-72 overflow-hidden rounded-xl border border-gray-200 sm:h-96">
            <FleetMap
              vehicles={shuttleMapPoints}
              selectedId={selectedShuttleTripId}
              focusCenter={selectedShuttlePosition}
              focusZoom={FOLLOW_VEHICLE_ZOOM}
              fitPoints={shuttleFitPoints}
              routeStops={selectedShuttleStops}
              onMarkerSelect={(shuttleTripId) =>
                setSelectedShuttleTripId((current) =>
                  current === shuttleTripId ? null : shuttleTripId,
                )
              }
            />
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shuttleTrips.map((trip) => (
            <ShuttleTrackingCard
              key={trip.shuttleTripId}
              trip={trip}
              tracking={trackingByTripId[trip.shuttleTripId]}
              canCancelShuttle={canCancelShuttle}
              isSelected={selectedShuttleTripId === trip.shuttleTripId}
              hasPosition={Boolean(
                trackingByTripId[trip.shuttleTripId]?.latest,
              )}
              onSelect={(shuttleTripId) =>
                setSelectedShuttleTripId((current) =>
                  current === shuttleTripId ? null : shuttleTripId,
                )
              }
              onRefresh={(shuttleTripId) =>
                void refreshShuttleTracking(shuttleTripId)
              }
              onCancel={openCancelTrip}
              onOpenDetail={(selected) => void openTripDetail(selected)}
              directionLabel={directionLabel}
            />
          ))}
          {shuttleTrips.length === 0 && !shuttleTripsError && (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center sm:col-span-2 xl:col-span-3">
              {isLoadingShuttleTrips ? (
                <p className="text-sm text-gray-500">{t("dispatch.loading")}</p>
              ) : (
                <>
                  <FiTruck
                    className="mx-auto text-gray-300"
                    size={28}
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    {/* Rỗng vì lọc khác hẳn rỗng vì nhà xe chưa có chuyến nào —
                        nói nhầm là điều độ viên tưởng mất dữ liệu. */}
                    {shuttleStatusFilter === SHUTTLE_TRIP_ALL_STATUSES
                      ? t("dispatch.shuttleTrackingEmpty")
                      : t("dispatch.shuttleTrackingFilteredEmpty")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <AssignVehicleModal
        open={openAssignVehicle}
        onClose={closeAssign}
        group={selectedGroup}
        vehicles={vehicles}
        drivers={drivers}
        form={assignForm}
        onFormChange={(nextForm) => {
          setAssignError("");
          // Draft đổi thì kết quả preview cũ không còn đúng với payload sắp gửi.
          setAvailability(null);
          setAssignForm(nextForm);
        }}
        onSubmit={() => void handleAssignVehicle()}
        onRefreshResources={() => void loadAssignmentResources(true)}
        directionLabel={directionLabel}
        resourceError={resourceError}
        submitError={assignError}
        isLoadingResources={isLoadingResources}
        isSubmitting={isSubmitting}
        availability={availability}
        isCheckingAvailability={isCheckingAvailability}
        onCheckAvailability={() => void handleCheckAvailability()}
      />

      <RequestDetailModal
        open={openRequestDetail}
        onClose={() => setOpenRequestDetail(false)}
        group={selectedGroup}
        canDispatchShuttle={canDispatchShuttle}
        canCancelShuttle={canCancelShuttle}
        onAssign={() => {
          if (!selectedGroup) {
            return;
          }

          const group = selectedGroup;
          setOpenRequestDetail(false);
          openAssign(group);
        }}
        onCancelBooking={(booking, passengerLabel) => {
          if (!selectedGroup) {
            return;
          }

          openCancelRequest(selectedGroup, booking, passengerLabel);
        }}
        directionLabel={directionLabel}
      />

      <ShuttleTripDetailModal
        open={detailTrip !== null}
        onClose={closeTripDetail}
        trip={detailTrip}
        context={detailContext}
        isLoading={isLoadingDetail}
        error={detailError}
        directionLabel={directionLabel}
      />

      <CancelShuttleModal
        open={cancelTarget !== null}
        title={
          cancelTarget?.kind === "trip"
            ? t("dispatch.cancelShuttleTrip")
            : t("dispatch.cancelRequest")
        }
        message={
          cancelTarget?.kind === "trip"
            ? t("dispatch.cancelTripConfirm", { label: cancelTarget.label })
            : t("dispatch.cancelRequestConfirm", {
                label: cancelTarget?.label ?? "",
              })
        }
        reason={cancelReason}
        error={cancelError}
        busy={isCancelling}
        onReasonChange={(reason) => {
          setCancelError("");
          setCancelReason(reason);
        }}
        onClose={closeCancel}
        onConfirm={() => void handleConfirmCancel()}
      />
    </div>
  );
}
