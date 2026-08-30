import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiGitBranch,
  FiRefreshCw,
  FiRepeat,
  FiTruck,
} from "react-icons/fi";
import {
  changeOperatorTripRoute,
  disruptOperatorTripNoSubstitution,
  getAlternativeRoutes,
  getOperatorIncidents,
  getOperatorTripCargoCapacity,
  getPublicTrip,
  getPublicTripSeatMap,
  substituteOperatorTripVehicle,
  type AlternativeRoute,
  type CargoCapacity,
  type OperatorIncident,
  type OperatorUser,
  type OperatorVehicle,
  type ReplacementSeatShortage,
  type TripOperationResult,
} from "../../../api/vietride";
import { parseReplacementSeatShortage } from "../../../utils/resourceConflict";
import {
  planSubstitutionError,
  type SubstitutionFormField,
} from "../../../utils/vehicleSubstitution";
import { displayBusinessCode } from "../../../utils/businessCode";
import { formatDateTime } from "../../../utils/date";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { toDatetimeLocalValue } from "../../../utils/date";
import Checkbox from "../../../components/form/Checkbox";
import { Badge } from "../../../components/ui/Badge";
import {
  SubstitutionResultCard,
  type SubstitutionSummary,
} from "./SubstitutionResultCard";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

/**
 * Trạng thái chuyến còn đổi lộ trình được. Ngoài tập này BE chặn bằng
 * `409 TRIP_NOT_EDITABLE` ("Only scheduled, boarding, or in-progress trips can
 * change alternative route" — `Trip.EnsureAlternativeRouteChangeAllowed`).
 */
const ROUTE_CHANGE_TRIP_STATUSES = new Set([
  "SCHEDULED",
  "BOARDING",
  "IN_PROGRESS",
]);

/**
 * Thay xe và ghi nhận gián đoạn HẸP HƠN đổi lộ trình: BE bắt buộc chuyến phải
 * ĐANG CHẠY (`TripVehicleSubstitutionPolicy.CanSubstitute` → `409
 * TRIP_NOT_SUBSTITUTABLE`, `Trip.Disrupt` → `EnsureStatus(IN_PROGRESS)`). Gộp
 * chung một tập với đổi lộ trình là chuyến Đã lên lịch / Đang lên xe vẫn hiện
 * nút rồi mới ăn 409 — đúng cái mà chặn-sẵn-ở-FE muốn tránh.
 */
const DISRUPTABLE_TRIP_STATUSES = new Set(["IN_PROGRESS"]);

function vehicleId(vehicle: OperatorVehicle) {
  return vehicle.id ?? vehicle.vehicleId ?? "";
}

/**
 * Số ghế chở khách thật của xe. `usablePassengerCapacity` đã trừ ghế bị vô hiệu
 * và khu vực tài xế nên khớp với cách BE dựng ghế cho chuyến thay thế
 * (`ParsePassengerLayout` bỏ ghế `disabled` và `DRIVER_AREA`). `totalSeats` chỉ
 * là phương án dự phòng cho xe chưa có projection, và nó ĐẾM DƯ so với BE — nên
 * cảnh báo thiếu ghế dựng trên nó có thể lạc quan hơn thực tế.
 */
function usableSeats(vehicle: OperatorVehicle) {
  return vehicle.usablePassengerCapacity ?? vehicle.totalSeats ?? 0;
}

function userId(user: OperatorUser) {
  return user.userId || user.id || "";
}

function getDefaultRecoveryDeparture() {
  const recoveryDeparture = new Date(Date.now() + 30 * 60_000);
  recoveryDeparture.setSeconds(0, 0);
  return toDatetimeLocalValue(recoveryDeparture);
}

/**
 * Đúng những mảnh dữ liệu chuyến mà panel dùng. Khai riêng thay vì nhận nguyên
 * `OperatorTripListItem` để màn Báo cáo sự cố dùng lại được: ở đó chỉ ghép được
 * từng phần (bản ghi sự cố có `status` + `routeId`, `GET /v1/trips/{id}` có
 * `vehicleId`) và không có cách nào lấy `canSubstituteVehicle` cho một chuyến
 * lẻ vì `GET /v1/operator/trips` không lọc theo tripId.
 */
export type TripActionsContext = {
  status?: string | null;
  routeId?: string | null;
  /** Xe đang chạy chuyến — để loại khỏi danh sách xe thay thế */
  vehicleId?: string | null;
  /** Bỏ trống = CHƯA BIẾT: không pre-disable, để BE từ chối nếu không đủ điều kiện */
  canSubstituteVehicle?: boolean;
  /**
   * Kíp và xe của chuyến CŨ. Handoff 2026-08-30 cấm chọn lại bất kỳ tài nguyên
   * nào của chuyến cũ (`409 TRIP_VEHICLE_SAME_AS_OLD` /
   * `409 TRIP_CREW_SAME_AS_OLD`), nên panel phải loại họ khỏi bộ chọn chứ
   * không đợi BE từ chối. Bỏ trống = chưa biết, không loại ai.
   */
  driverUserId?: string | null;
  assistantUserId?: string | null;
  /** Chỉ để hiển thị khối "trước khi đổi" — không tham gia validate */
  tripCode?: string | null;
  vehiclePlate?: string | null;
  vehicleStatus?: string | null;
  driverName?: string | null;
  assistantName?: string | null;
};

type TripActionsPanelProps = {
  /** Chuyến do map/list của Trung tâm vận hành chọn — panel không tự chọn chuyến */
  tripId: string;
  /** Ngữ cảnh chuyến (nếu có) — dùng để lọc xe thay thế và cờ canSubstituteVehicle */
  trip?: TripActionsContext | null;
  /** Ghi đè câu mô tả dưới tiêu đề; mỗi màn nhúng panel nói một ngữ cảnh khác */
  subtitle?: string;
  /**
   * Sự cố đã biết trước (panel mở từ modal Báo cáo sự cố). Có giá trị thì
   * `incidentId` bị KHOÁ: người vận hành đang xử lý đúng sự cố đó, đổi sang sự
   * cố khác giữa chừng chỉ tạo ra ghi nhận sai.
   */
  incidentId?: string | null;
  // Danh sách xe và nhân sự do trang cha tải sẵn, tránh gọi API trùng lặp
  vehicles: OperatorVehicle[];
  staff: OperatorUser[];
  /** Chỉ OPERATOR_ADMIN được thay xe / huỷ chuyến / đổi lộ trình */
  canMutate: boolean;
  /**
   * Sau khi thay xe thành công — trang cha chuyển selection sang chuyến mới.
   * Đổi lộ trình cũng gọi callback này (cùng tripId) để trang cha tải lại
   * geometry của chuyến + danh sách fleet.
   */
  onTripReplaced?: (newTripId: string) => void;
  /**
   * Kết quả thay xe, đẩy lên trang cha. Cần riêng `onTripReplaced` vì trang cha
   * đổi selection sang chuyến mới làm panel remount và mất state ngay — trong
   * khi `pendingSeatAssignmentCount` là thứ nhà xe phải đọc SAU đó.
   */
  onSubstituted?: (
    result: TripOperationResult,
    summary: SubstitutionSummary,
  ) => void;
  /**
   * `422 VEHICLE_NOT_ACTIVE`: danh sách xe FE đang giữ đã cũ. Trang cha tải
   * lại `vehicles` rồi panel bắt chọn lại (handoff 2026-08-30, bảng lỗi).
   */
  onVehiclesStale?: () => void;
  /**
   * `409 TRIP_NOT_SUBSTITUTABLE`: chuyến hết quyền đổi xe. Panel đóng form,
   * trang cha tải lại trạng thái chuyến.
   */
  onTripStale?: () => void;
  /**
   * Bắn sau MỌI hành động thành công kèm câu đã dịch. Cần riêng vì ghi nhận gián
   * đoạn không đổi tripId nên không đi qua `onTripReplaced`, mà màn Báo cáo sự
   * cố thì cần cả ba để gợi ý sẵn ghi chú xử lý.
   */
  onActionCompleted?: (message: string) => void;
};

export default function TripActionsPanel({
  tripId,
  trip = null,
  subtitle,
  incidentId = null,
  vehicles,
  staff,
  canMutate,
  onTripReplaced,
  onSubstituted,
  onVehiclesStale,
  onTripStale,
  onActionCompleted,
}: TripActionsPanelProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [capacity, setCapacity] = useState<CargoCapacity | null>(null);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [newDriverUserId, setNewDriverUserId] = useState("");
  const [newAssistantUserId, setNewAssistantUserId] = useState("");
  const [reason, setReason] = useState("");
  /**
   * Sự cố gắn với lần đổi xe này — BẮT BUỘC từ handoff 2026-08-30. Mở từ modal
   * Báo cáo sự cố thì đã có sẵn qua prop; mở từ Trung tâm vận hành thì phải tự
   * chọn trong danh sách sự cố CỦA CHÍNH chuyến đó.
   */
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  /**
   * Kết quả tải sự cố kèm CHUYẾN mà nó thuộc về. Gắn kèm `tripId` để trạng thái
   * "đang tải" suy ra được lúc render (chưa có kết quả của chuyến hiện tại =
   * đang tải) thay vì phải `setState` ngay trong thân effect — cách đó bị
   * `react-hooks/set-state-in-effect` chặn và gây render dây chuyền.
   * `items === null` = tải hỏng, khác với mảng rỗng = chuyến không có sự cố nào.
   */
  const [incidentsResult, setIncidentsResult] = useState<{
    tripId: string;
    items: OperatorIncident[] | null;
  } | null>(null);
  /**
   * Trường bị BE từ chối — giữ nguyên giá trị người dùng đã nhập và chỉ tô đỏ,
   * đúng yêu cầu "Giữ form và đánh dấu trường bắt buộc" của handoff.
   */
  const [fieldErrors, setFieldErrors] = useState<SubstitutionFormField[]>([]);
  const [errorHint, setErrorHint] = useState("");
  /**
   * `409 TRIP_NOT_SUBSTITUTABLE` — chuyến hết quyền đổi xe. Đóng hẳn form thay
   * vì để người vận hành bấm lại vào một request chắc chắn hỏng.
   */
  const [isSubstituteClosed, setIsSubstituteClosed] = useState(false);
  const [estimatedRecoveryDepartureAt, setEstimatedRecoveryDepartureAt] =
    useState(getDefaultRecoveryDeparture);
  const [notifyPassengers, setNotifyPassengers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Section "Đổi lộ trình": null = chưa tải danh sách tuyến thay thế
  const [isChangeRouteOpen, setIsChangeRouteOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeRoute[] | null>(
    null,
  );
  const [isAlternativesLoading, setIsAlternativesLoading] = useState(false);
  const [selectedAlternativeRouteId, setSelectedAlternativeRouteId] =
    useState("");
  const [routeChangeMessage, setRouteChangeMessage] = useState("");
  const [routeChangeError, setRouteChangeError] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "substitute" | "disrupt" | "route" | null
  >(null);
  /**
   * Con số thiếu ghế do CHÍNH BE trả về kèm `409
   * REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS`. Khác hẳn `missingSeats` đoán từ sơ
   * đồ ghế phía dưới: BE đếm theo `usableSeats` thật của xe thay và số khách
   * thật phải chuyển, nên khi có nó thì phải hiện nó, không hiện số của FE.
   *
   * Khác `null` = đang chờ người vận hành trả lời "vẫn thay dù thiếu ghế?".
   */
  const [seatShortage, setSeatShortage] =
    useState<ReplacementSeatShortage | null>(null);
  /**
   * Số khách phải chuyển sang xe thay, đếm từ ghế `BOOKED` của sơ đồ ghế.
   * `null` = chưa tải hoặc tải hỏng — lúc đó KHÔNG cảnh báo thiếu ghế, vì đoán
   * bừa một con số rồi chặn người dùng còn tệ hơn là không kiểm tra.
   *
   * Cố ý không đếm ghế `HELD`: đó là khách đang giữ chỗ chờ thanh toán, chưa
   * phải booking đã xác nhận, và BE cũng không đưa họ vào `impact` để chuyển.
   */
  const [occupiedSeats, setOccupiedSeats] = useState<number | null>(null);
  const [acknowledgeSeatShortage, setAcknowledgeSeatShortage] = useState(false);
  // Kết quả lần đổi xe gần nhất — giữ trên màn thay vì chỉ bắn toast, vì
  // `pendingSeatAssignmentCount` là việc nhà xe phải xử lý tiếp, không phải một
  // thông báo đọc xong rồi bỏ.
  const [substitutionResult, setSubstitutionResult] =
    useState<TripOperationResult | null>(null);
  // Biển số / tên kíp mới không có trong response — panel giữ lại từ chính lựa
  // chọn của người vận hành để banner "sau khi đổi" nói được xe nào, ai lái.
  const [substitutionSummary, setSubstitutionSummary] =
    useState<SubstitutionSummary | null>(null);
  useToastFeedback({
    message: message || routeChangeMessage,
    error: error || routeChangeError,
  });

  // Chưa biết trạng thái (panel mở từ deep-link mà fleet chưa có chuyến đó) thì
  // KHÔNG tự chặn — thà để BE từ chối còn hơn khoá nhầm chuyến vẫn sửa được.
  const canChangeRoute =
    !trip?.status || ROUTE_CHANGE_TRIP_STATUSES.has(trip.status);
  const canDisruptTrip =
    !trip?.status || DISRUPTABLE_TRIP_STATUSES.has(trip.status);
  // Chuyến đã kết thúc/huỷ/gián đoạn: không còn thao tác nào chạy được.
  const isTripEditable = canChangeRoute || canDisruptTrip;

  /**
   * Kíp của chuyến CŨ. Handoff 2026-08-30: không được chọn lại tài xế hoặc phụ
   * xe của chuyến cũ — loại cả hai người khỏi CẢ HAI ô chọn, vì "phụ xe cũ lên
   * làm tài xế mới" vẫn là dùng lại kíp cũ và BE trả `409 TRIP_CREW_SAME_AS_OLD`.
   */
  const previousCrewIds = useMemo(() => {
    const ids = new Set<string>();
    if (trip?.driverUserId) ids.add(trip.driverUserId);
    if (trip?.assistantUserId) ids.add(trip.assistantUserId);
    return ids;
  }, [trip?.assistantUserId, trip?.driverUserId]);

  const drivers = useMemo(
    () =>
      staff.filter(
        (user) =>
          user.role === "DRIVER" &&
          (user.status === "ACTIVE" || user.status === "APPROVED") &&
          !previousCrewIds.has(userId(user)) &&
          // Một người không thể vừa lái vừa làm phụ xe trên cùng chuyến
          userId(user) !== newAssistantUserId,
      ),
    [newAssistantUserId, previousCrewIds, staff],
  );
  const assistants = useMemo(
    () =>
      staff.filter(
        (user) =>
          user.role === "ASSISTANT" &&
          (user.status === "ACTIVE" || user.status === "APPROVED") &&
          !previousCrewIds.has(userId(user)) &&
          userId(user) !== newDriverUserId,
      ),
    [newDriverUserId, previousCrewIds, staff],
  );
  /**
   * Lọc MỀM chứ không loại xe thiếu ghế khỏi danh sách: đây là tình huống sự cố
   * giữa đường, chở được 29/40 khách vẫn hơn bỏ cả 40 người lại. Xe đủ ghế xếp
   * lên trước, xe thiếu xếp sau theo mức thiếu tăng dần, và nhãn nói thẳng
   * thiếu bao nhiêu để nhà xe cân nhắc chứ không phải mò.
   */
  const replacementVehicles = useMemo(() => {
    // CHỈ `ACTIVE` (handoff 2026-08-30 mục "Quy tắc bắt buộc"). Trước đây danh
    // sách còn nhận `AVAILABLE`, nhưng BE trả `422 VEHICLE_NOT_ACTIVE` cho mọi
    // trạng thái khác `ACTIVE` nên hiện chúng chỉ dẫn người dùng vào lỗi.
    const eligible = vehicles.filter(
      (vehicle) =>
        vehicle.status === "ACTIVE" && vehicleId(vehicle) !== trip?.vehicleId,
    );

    if (occupiedSeats === null) return eligible;

    return [...eligible].sort(
      (left, right) =>
        Math.max(0, occupiedSeats - usableSeats(left)) -
        Math.max(0, occupiedSeats - usableSeats(right)),
    );
  }, [occupiedSeats, trip, vehicles]);

  const selectedVehicle = useMemo(
    () =>
      replacementVehicles.find(
        (vehicle) => vehicleId(vehicle) === newVehicleId,
      ) ?? null,
    [newVehicleId, replacementVehicles],
  );

  const selectedDriver = useMemo(
    () => drivers.find((user) => userId(user) === newDriverUserId) ?? null,
    [drivers, newDriverUserId],
  );
  const selectedAssistant = useMemo(
    () =>
      assistants.find((user) => userId(user) === newAssistantUserId) ?? null,
    [assistants, newAssistantUserId],
  );

  const missingSeats =
    occupiedSeats !== null && selectedVehicle
      ? Math.max(0, occupiedSeats - usableSeats(selectedVehicle))
      : 0;

  /**
   * Sự cố của CHÍNH chuyến này. `incidentId` bắt buộc và BE kiểm sự cố có
   * thuộc đúng chuyến/operator hay không, nên danh sách phải lọc theo `tripId`
   * chứ không lấy sự cố chung của nhà xe.
   *
   * Không lọc `status=OPEN`: một chuyến có thể đã đóng sự cố trước rồi phát
   * sinh tiếp, và BE mới là nơi quyết định sự cố nào dùng được — FE chỉ cần
   * hiện đúng tập của chuyến kèm trạng thái để người vận hành chọn đúng.
   */
  useEffect(() => {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId || !canMutate) return;

    let ignore = false;
    getOperatorIncidents({
      tripId: normalizedTripId,
      page: 1,
      pageSize: 50,
      sortBy: "reportedAt",
      sortDir: "desc",
    })
      .then((result) => {
        if (ignore) return;
        setIncidentsResult({ tripId: normalizedTripId, items: result.items });
      })
      .catch(() => {
        // Tải hỏng thì để `null` = KHÔNG BIẾT. Panel nói rõ không tải được và
        // vẫn cho gõ tay id sự cố, chứ không khoá cứng người vận hành giữa lúc
        // xe đang hỏng.
        if (!ignore)
          setIncidentsResult({ tripId: normalizedTripId, items: null });
      });

    return () => {
      ignore = true;
    };
  }, [canMutate, tripId]);

  // Kết quả của CHUYẾN KHÁC (panel vừa đổi chuyến) không được tính là đã tải
  // xong — coi như đang tải cho tới khi có kết quả của đúng chuyến này.
  const hasIncidentsFor = incidentsResult?.tripId === tripId.trim();
  const incidents = hasIncidentsFor ? incidentsResult.items : null;
  const isIncidentsLoading =
    canMutate && Boolean(tripId.trim()) && !hasIncidentsFor;

  /**
   * Giá trị thật của ô "Sự cố", tính theo thứ tự: prop khoá > lựa chọn của
   * người dùng > tự chọn khi chuyến chỉ có đúng một sự cố (không bắt bấm thêm
   * một lần cho danh sách một dòng). Tính lúc render thay vì đồng bộ bằng
   * `useEffect` để khỏi render dây chuyền.
   */
  const soleIncidentId =
    incidents && incidents.length === 1 ? incidents[0].incidentId : "";
  const effectiveIncidentId =
    incidentId ?? (selectedIncidentId || soleIncidentId);

  const selectedIncident = useMemo(
    () =>
      incidents?.find(
        (incident) => incident.incidentId === effectiveIncidentId,
      ) ?? null,
    [incidents, effectiveIncidentId],
  );

  /** Sự cố đến từ prop nhưng danh sách chưa tải xong / tải hỏng vẫn phải gửi được */
  const isIncidentLocked = Boolean(incidentId);
  const hasNoIncident = incidents !== null && incidents.length === 0;

  const tripStatusLabel = tc(`enumLabels.${trip?.status}`, {
    defaultValue: trip?.status ?? "-",
  });
  const tripBeforeLabel =
    displayBusinessCode(trip?.tripCode) !== "-"
      ? `${displayBusinessCode(trip?.tripCode)} · ${tripStatusLabel}`
      : tripStatusLabel;
  const vehicleBeforeLabel = trip?.vehiclePlate
    ? `${trip.vehiclePlate} · ${tc(
        `enumLabels.${trip.vehicleStatus ?? "ACTIVE"}`,
        { defaultValue: trip.vehicleStatus ?? "ACTIVE" },
      )}`
    : "-";

  function markFields(fields: SubstitutionFormField[], hintKey: string | null) {
    setFieldErrors(fields);
    setErrorHint(hintKey ? t(hintKey) : "");
  }

  function clearFieldErrors() {
    setFieldErrors([]);
    setErrorHint("");
  }

  const fieldClass = (field: SubstitutionFormField) =>
    fieldErrors.includes(field)
      ? `${inputClass} border-red-400 focus:border-red-500 focus:ring-red-100`
      : inputClass;

  // Tải số khách ngay khi panel mount thay vì đợi mở mục "Thay xe": mục đó phải
  // mở ra mới chọn được xe, nên đợi tới lúc đó thì cảnh báo thiếu ghế đến sau
  // khi người dùng đã chọn xong. Panel chỉ mount khi đã có chuyến được chọn nên
  // đây là một GET nhỏ cho mỗi lần chọn chuyến, không phải mỗi lần render.
  useEffect(() => {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId || !canMutate) return;

    let ignore = false;
    getPublicTripSeatMap(normalizedTripId)
      .then((seatMap) => {
        if (ignore) return;
        setOccupiedSeats(
          seatMap.seats.filter((seat) => seat.status === "BOOKED").length,
        );
      })
      .catch(() => {
        // Không kiểm được thì nói thẳng là không kiểm được (xem
        // `seatCountUnknown`), không chặn thao tác — BE mới là nơi quyết định
        // cuối, và chặn nhà xe giữa lúc xe hỏng thì tệ hơn nhiều.
        if (!ignore) setOccupiedSeats(null);
      });

    return () => {
      ignore = true;
    };
  }, [canMutate, tripId]);

  async function loadCapacity() {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) {
      setError(t("tripOperations.tripRequired"));
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      setCapacity(await getOperatorTripCargoCapacity(normalizedTripId));
    } catch (loadError) {
      setCapacity(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("tripOperations.capacityFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function substituteVehicle() {
    // Handoff 2026-08-30: KHÔNG được submit khi thiếu xe / tài xế / phụ xe /
    // sự cố. Đánh dấu đúng trường thiếu thay vì chỉ bắn một câu chung chung.
    const missingFields: SubstitutionFormField[] = [];
    if (!effectiveIncidentId.trim()) missingFields.push("incident");
    if (!newVehicleId) missingFields.push("vehicle");
    if (!newDriverUserId) missingFields.push("driver");
    if (!newAssistantUserId) missingFields.push("assistant");
    if (!reason.trim()) missingFields.push("reason");
    if (!estimatedRecoveryDepartureAt) missingFields.push("recoveryDeparture");

    if (!tripId.trim() || missingFields.length > 0) {
      markFields(missingFields, null);
      setError(t("tripOperations.substituteRequired"));
      return;
    }

    const recoveryDeparture = new Date(estimatedRecoveryDepartureAt);
    if (
      Number.isNaN(recoveryDeparture.getTime()) ||
      recoveryDeparture.getTime() <= Date.now()
    ) {
      markFields(["recoveryDeparture"], null);
      setError(t("tripOperations.recoveryDepartureFuture"));
      return;
    }

    clearFieldErrors();

    // Cảnh báo thiếu ghế ĐOÁN TỪ SƠ ĐỒ GHẾ: chặn ở đây chỉ để khỏi bắn một
    // request chắc chắn bị BE từ chối. Nơi quyết định thật là `409
    // REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS` phía dưới — số của FE có thể
    // đếm dư (xem `usableSeats`) nên không được coi là kết luận.
    if (missingSeats > 0 && !acknowledgeSeatShortage) {
      setError(t("tripOperations.seatShortageBlocked"));
      return;
    }

    if (pendingAction !== "substitute") {
      setPendingAction("substitute");
      return;
    }

    await sendSubstitution(recoveryDeparture, acknowledgeSeatShortage);
  }

  /**
   * Một lần gửi `substitute-vehicle`.
   *
   * `acknowledgeInsufficientSeats` là hai lượt gọi RIÊNG BIỆT theo handoff B1-B7:
   * lượt đầu gửi `false`, nếu BE trả `409` thì hỏi lại người vận hành rồi gửi
   * lượt hai với `true`. Body đổi nên BẮT BUỘC dùng Idempotency-Key mới — key
   * mặc định của `substituteOperatorTripVehicle` sinh mới mỗi lần gọi, nên gọi
   * lại hàm này là đủ; đừng tái sử dụng một key đã bắt.
   */
  async function sendSubstitution(
    recoveryDeparture: Date,
    acknowledgeInsufficientSeats: boolean,
  ) {
    setIsMutating(true);
    setError("");
    setMessage("");
    try {
      const result = await substituteOperatorTripVehicle(tripId.trim(), {
        replacementVehicleId: newVehicleId,
        // Bắt buộc và phải là sự cố của chính chuyến này
        incidentId: effectiveIncidentId.trim(),
        estimatedRecoveryDepartureAt: recoveryDeparture.toISOString(),
        reason: reason.trim(),
        notifyPassengers,
        // Không bao giờ gửi `null` cho ba field này — form đã chặn ở trên
        replacementCrew: {
          driverId: newDriverUserId,
          assistantId: newAssistantUserId,
        },
        acknowledgeInsufficientSeats,
      });
      const newTripId = result.newTripId ?? result.tripId;
      let tripLabel = newTripId ?? "";
      if (newTripId) {
        try {
          const replacementTrip = await getPublicTrip(newTripId);
          tripLabel =
            displayBusinessCode(replacementTrip.tripCode) !== "-"
              ? displayBusinessCode(replacementTrip.tripCode)
              : replacementTrip.originStation.name &&
                  replacementTrip.destinationStation.name
                ? `${replacementTrip.originStation.name} → ${replacementTrip.destinationStation.name}`
                : newTripId;
        } catch {
          tripLabel = newTripId;
        }
      }

      const successMessage = t("tripOperations.substituteSuccess", {
        tripId: tripLabel,
      });
      const summary: SubstitutionSummary = {
        oldTripLabel:
          displayBusinessCode(trip?.tripCode) !== "-"
            ? displayBusinessCode(trip?.tripCode)
            : (result.oldTripId ?? tripId.trim()),
        oldVehiclePlate: trip?.vehiclePlate ?? null,
        newTripLabel: tripLabel || (newTripId ?? ""),
        newVehiclePlate: selectedVehicle?.licensePlate ?? null,
        newDriverName: selectedDriver?.displayName ?? null,
        newAssistantName: selectedAssistant?.displayName ?? null,
      };
      setMessage(successMessage);
      setSubstitutionResult(result);
      setSubstitutionSummary(summary);
      setAcknowledgeSeatShortage(false);
      setSeatShortage(null);
      clearFieldErrors();
      onSubstituted?.(result, summary);
      // Trang cha chuyển selection + URL sang chuyến mới
      if (newTripId) {
        onTripReplaced?.(newTripId);
      }
      onActionCompleted?.(successMessage);
    } catch (mutationError) {
      const shortage = parseReplacementSeatShortage(mutationError);
      if (shortage && !acknowledgeInsufficientSeats) {
        // BE KHÔNG tạo chuyến mới và không giữ resource nào khi trả lỗi này,
        // nên mở hộp xác nhận rồi gửi lại là an toàn — không phải dọn dẹp gì.
        setSeatShortage(shortage);
        return;
      }

      // Bảng lỗi của handoff 2026-08-30: mỗi mã ứng với một việc phải làm, không
      // chỉ là một câu thông báo.
      const plan = planSubstitutionError(mutationError);
      markFields(plan.fields, plan.hintKey);
      if (plan.refreshVehicles) {
        // Xe vừa rời `ACTIVE` — bỏ lựa chọn cũ và xin trang cha tải lại danh sách
        setNewVehicleId("");
        setAcknowledgeSeatShortage(false);
        onVehiclesStale?.();
      }
      if (plan.closeForm) {
        setIsSubstituteClosed(true);
        onTripStale?.();
      }

      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.substituteFailed"),
      );
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  /** Người vận hành bấm "vẫn thay" trong hộp cảnh báo thiếu ghế của BE. */
  async function confirmSubstitutionDespiteShortage() {
    const recoveryDeparture = new Date(estimatedRecoveryDepartureAt);
    if (Number.isNaN(recoveryDeparture.getTime())) {
      setSeatShortage(null);
      setError(t("tripOperations.recoveryDepartureFuture"));
      return;
    }

    setSeatShortage(null);
    await sendSubstitution(recoveryDeparture, true);
  }

  async function disruptTrip() {
    if (!tripId.trim() || !reason.trim()) {
      setError(t("tripOperations.disruptRequired"));
      return;
    }

    if (pendingAction !== "disrupt") {
      setPendingAction("disrupt");
      return;
    }

    setIsMutating(true);
    setError("");
    setMessage("");
    try {
      const result = await disruptOperatorTripNoSubstitution(tripId.trim(), {
        reason: reason.trim(),
      });
      const successMessage = t("tripOperations.disruptSuccess", {
        status: result.status ?? result.tripId,
      });
      setMessage(successMessage);
      onActionCompleted?.(successMessage);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.disruptFailed"),
      );
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  async function loadAlternatives() {
    const routeId = trip?.routeId;
    if (!routeId) {
      setRouteChangeError(t("tripOperations.alternativesFailed"));
      return;
    }

    setIsAlternativesLoading(true);
    setRouteChangeError("");
    try {
      const result = await getAlternativeRoutes(routeId, {
        page: 1,
        pageSize: 2,
      });
      // Chỉ cho đổi sang tuyến thay thế đang active
      setAlternatives(result.items.filter((route) => route.isActive));
    } catch (loadError) {
      setAlternatives(null);
      setRouteChangeError(
        loadError instanceof Error
          ? loadError.message
          : t("tripOperations.alternativesFailed"),
      );
    } finally {
      setIsAlternativesLoading(false);
    }
  }

  function toggleChangeRoute() {
    const nextOpen = !isChangeRouteOpen;
    setIsChangeRouteOpen(nextOpen);
    // Mở lần đầu mới tải — đóng/mở lại không gọi API lần nữa
    if (nextOpen && alternatives === null && !isAlternativesLoading) {
      void loadAlternatives();
    }
  }

  async function changeRoute() {
    if (!tripId.trim() || !selectedAlternativeRouteId) {
      setRouteChangeError(t("tripOperations.changeRouteRequired"));
      return;
    }

    // Confirm 2 bước như pattern huỷ chuyến — đổi lộ trình ảnh hưởng booking đang chạy
    if (pendingAction !== "route") {
      setPendingAction("route");
      return;
    }

    setIsMutating(true);
    setRouteChangeError("");
    setRouteChangeMessage("");
    try {
      const result = await changeOperatorTripRoute(tripId.trim(), {
        alternativeRouteId: selectedAlternativeRouteId,
      });
      const successMessage = t("tripOperations.changeRouteSuccess", {
        status: result.status,
      });
      setRouteChangeMessage(successMessage);
      // Cùng tripId — trang cha re-select để tải lại geometry lộ trình mới + fleet
      onTripReplaced?.(result.tripId ?? tripId.trim());
      onActionCompleted?.(successMessage);
    } catch (mutationError) {
      setRouteChangeError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.changeRouteFailed"),
      );
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FiTruck className="text-vr-900" />
            {t("tripOperations.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {subtitle ?? t("operations.actionsSubtitle")}
          </p>
        </div>
        {!canMutate && (
          <Badge tone="info">{t("tripOperations.readOnly")}</Badge>
        )}
      </div>

      {/* Chuyến đã kết thúc/huỷ/gián đoạn: mọi mutation đều bị BE chặn, nên ẩn
          hẳn hai khối bên dưới và nói rõ lý do một lần ở đây. "Tải sức chứa" là
          GET nên giữ. */}
      {!isTripEditable && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("tripOperations.notEditable", {
            status: tc(`enumLabels.${trip?.status}`, {
              defaultValue: trip?.status ?? "",
            }),
          })}
        </p>
      )}

      {/* Chuyến Đã lên lịch / Đang lên xe: đổi lộ trình được nhưng chưa thay xe
          hay ghi nhận gián đoạn được — nói trước thay vì ẩn khối không lời. */}
      {isTripEditable && !canDisruptTrip && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("tripOperations.notDisruptableYet", {
            status: tc(`enumLabels.${trip?.status}`, {
              defaultValue: trip?.status ?? "",
            }),
          })}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void loadCapacity()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-vr-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {t("tripOperations.loadCapacity")}
        </button>
      </div>

      {capacity && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CapacityMetric
            label={t("tripOperations.maxWeight")}
            value={`${capacity.maxCargoWeightKg.toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.reservedWeight")}
            value={`${(
              capacity.reservedCargoWeightKg ??
              capacity.reservedWeightKg ??
              0
            ).toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.loadedWeight")}
            value={`${(capacity.loadedWeightKg ?? 0).toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.percentFull")}
            value={`${(capacity.percentFull ?? 0).toLocaleString("vi-VN")}%`}
          />
        </div>
      )}

      {/* `409 TRIP_NOT_SUBSTITUTABLE`: chuyến hết quyền đổi xe giữa chừng. Đóng
          hẳn form thay vì để bấm lại vào một request chắc chắn hỏng. */}
      {canMutate && canDisruptTrip && isSubstituteClosed && (
        <p
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {t("tripOperations.substituteClosed")}
        </p>
      )}

      {canMutate && canDisruptTrip && !isSubstituteClosed && (
        <details className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-slate-50/40">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-gray-900 marker:hidden select-none">
            <span>{t("tripOperations.substitute")}</span>
            <span
              className="mt-0.5 text-lg leading-none text-gray-500"
              aria-hidden="true"
            >
              ⌄
            </span>
          </summary>
          <div className="border-t border-gray-200 px-4 pb-4 pt-4">
            <p className="mb-4 text-xs text-gray-500">
              {t("tripOperations.scopeSubstitute")}
            </p>

            {/* "Trước khi đổi" — handoff yêu cầu Web hiện rõ chuyến/xe/kíp hiện
                tại để đối chiếu với khối kết quả sau khi đổi. */}
            {(trip?.vehiclePlate || trip?.driverName || trip?.status) && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
                {/* Tiêu đề nằm NGOÀI `dl`: nội dung hợp lệ của `dl` chỉ có cặp
                    `dt`/`dd` (hoặc `div` bọc chúng), không nhận `p`. */}
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("tripOperations.beforeTitle")}
                </p>
                <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  <BeforeRow
                    label={t("tripOperations.beforeTrip")}
                    value={tripBeforeLabel}
                  />
                  <BeforeRow
                    label={t("tripOperations.beforeVehicle")}
                    value={vehicleBeforeLabel}
                  />
                  <BeforeRow
                    label={t("tripOperations.beforeDriver")}
                    value={trip?.driverName ?? "-"}
                  />
                  <BeforeRow
                    label={t("tripOperations.beforeAssistant")}
                    value={trip?.assistantName ?? "-"}
                  />
                </dl>
              </div>
            )}

            {/* Xe cũ sẽ bị chuyển sang MAINTENANCE — cảnh báo TRƯỚC khi xác
                nhận, không phải sau khi đã đổi xong (handoff, "Quy tắc bắt buộc"). */}
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("tripOperations.oldVehicleMaintenanceWarning", {
                plate: trip?.vehiclePlate ?? t("tripOperations.oldVehicle"),
              })}
            </p>

            {/* Chuyến chưa có sự cố nào thì không đổi xe được: `incidentId` là
                field bắt buộc của BE và phải thuộc đúng chuyến này. */}
            {hasNoIncident && !isIncidentLocked && (
              <div
                className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="alert"
              >
                <p>{t("tripOperations.noIncidentForTrip")}</p>
                <Link
                  to={`/manager/incidents?tripId=${encodeURIComponent(tripId)}`}
                  className="mt-1 inline-block font-semibold text-vr-800 hover:underline"
                >
                  {t("tripOperations.goToIncidents")}
                </Link>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Sự cố — field BẮT BUỘC của handoff 2026-08-30. Mở từ modal Báo
                  cáo sự cố thì đã khoá sẵn theo đúng sự cố đang xử lý. */}
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  {t("tripOperations.incident")}
                  <span className="text-red-500" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
                {isIncidentLocked ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                    {selectedIncident
                      ? incidentLabel(selectedIncident, t)
                      : t("tripOperations.incidentLocked")}
                  </p>
                ) : (
                  <CustomSelect
                    value={effectiveIncidentId}
                    onChange={(event) => {
                      setSelectedIncidentId(event.target.value);
                      setFieldErrors((current) =>
                        current.filter((field) => field !== "incident"),
                      );
                    }}
                    className={fieldClass("incident")}
                    aria-label={t("tripOperations.incident")}
                    disabled={isIncidentsLoading || hasNoIncident}
                  >
                    <option value="">
                      {isIncidentsLoading
                        ? t("tripOperations.incidentsLoading")
                        : t("tripOperations.selectIncident")}
                    </option>
                    {(incidents ?? []).map((incident) => (
                      <option
                        key={incident.incidentId}
                        value={incident.incidentId}
                      >
                        {incidentLabel(incident, t)}
                      </option>
                    ))}
                  </CustomSelect>
                )}
                {incidents === null && !isIncidentsLoading && (
                  <span className="mt-1 block text-xs text-amber-700">
                    {t("tripOperations.incidentsFailed")}
                  </span>
                )}
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  {t("tripOperations.vehicle")}
                  <span className="text-red-500" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
                <CustomSelect
                  value={newVehicleId}
                  onChange={(event) => {
                    setNewVehicleId(event.target.value);
                    setAcknowledgeSeatShortage(false);
                    setFieldErrors((current) =>
                      current.filter((field) => field !== "vehicle"),
                    );
                  }}
                  className={fieldClass("vehicle")}
                  aria-label={t("tripOperations.vehicle")}
                >
                  <option value="">{t("tripOperations.selectVehicle")}</option>
                  {replacementVehicles.map((vehicle) => {
                    const seats = usableSeats(vehicle);
                    const missing =
                      occupiedSeats === null
                        ? 0
                        : Math.max(0, occupiedSeats - seats);
                    return (
                      <option
                        key={vehicleId(vehicle)}
                        value={vehicleId(vehicle)}
                      >
                        {missing > 0
                          ? t("tripOperations.vehicleSeatsShortOption", {
                              plate: vehicle.licensePlate,
                              seats,
                              missing,
                            })
                          : t("tripOperations.vehicleSeatsOption", {
                              plate: vehicle.licensePlate,
                              seats,
                            })}
                      </option>
                    );
                  })}
                </CustomSelect>
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  {t("tripOperations.driver")}
                  <span className="text-red-500" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
                <CustomSelect
                  value={newDriverUserId}
                  onChange={(event) => {
                    setNewDriverUserId(event.target.value);
                    setFieldErrors((current) =>
                      current.filter((field) => field !== "driver"),
                    );
                  }}
                  className={fieldClass("driver")}
                  aria-label={t("tripOperations.driver")}
                >
                  <option value="">{t("tripOperations.selectDriver")}</option>
                  {drivers.map((driver) => (
                    <option key={userId(driver)} value={userId(driver)}>
                      {driver.displayName}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              {/* Phụ xe BẮT BUỘC từ handoff 2026-08-30 — `assistantId` không
                  được gửi `null`, nên bỏ hẳn lựa chọn "không chọn phụ xe". */}
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  {t("tripOperations.assistant")}
                  <span className="text-red-500" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
                <CustomSelect
                  value={newAssistantUserId}
                  onChange={(event) => {
                    setNewAssistantUserId(event.target.value);
                    setFieldErrors((current) =>
                      current.filter((field) => field !== "assistant"),
                    );
                  }}
                  className={fieldClass("assistant")}
                  aria-label={t("tripOperations.assistant")}
                >
                  <option value="">
                    {t("tripOperations.selectAssistant")}
                  </option>
                  {assistants.map((assistant) => (
                    <option key={userId(assistant)} value={userId(assistant)}>
                      {assistant.displayName}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  {t("tripOperations.reason")}
                  <span className="text-red-500" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
                <input
                  aria-label={t("tripOperations.reason")}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setFieldErrors((current) =>
                      current.filter((field) => field !== "reason"),
                    );
                  }}
                  className={fieldClass("reason")}
                  maxLength={500}
                  required
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  {t("tripOperations.recoveryDeparture")}
                  <span className="text-red-500" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
                <CustomDateTimeInput
                  invalid={fieldErrors.includes("recoveryDeparture")}
                  value={estimatedRecoveryDepartureAt}
                  onChange={(event) => {
                    setEstimatedRecoveryDepartureAt(event.target.value);
                    setFieldErrors((current) =>
                      current.filter((field) => field !== "recoveryDeparture"),
                    );
                  }}
                  type="datetime-local"
                  aria-label={t("tripOperations.recoveryDeparture")}
                />
              </label>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <Checkbox
                className="mt-0.5"
                checked={notifyPassengers}
                onChange={setNotifyPassengers}
              />
              <span>
                <span className="block text-sm font-semibold text-gray-800">
                  {t("tripOperations.notifyPassengers")}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {t("tripOperations.notifyPassengersHint")}
                </span>
              </span>
            </label>
            {occupiedSeats === null && (
              <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                {t("tripOperations.seatCountUnknown")}
              </p>
            )}
            {missingSeats > 0 && (
              <div
                className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="alert"
              >
                <p className="font-semibold">
                  {t("tripOperations.seatShortageTitle")}
                </p>
                <p className="mt-1">
                  {t("tripOperations.seatShortageBody", {
                    seats: selectedVehicle ? usableSeats(selectedVehicle) : 0,
                    passengers: occupiedSeats ?? 0,
                    missing: missingSeats,
                  })}
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={acknowledgeSeatShortage}
                    onChange={setAcknowledgeSeatShortage}
                  />
                  <span className="text-sm font-medium">
                    {t("tripOperations.seatShortageAck", {
                      missing: missingSeats,
                    })}
                  </span>
                </label>
              </div>
            )}
            {trip?.canSubstituteVehicle === false && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("tripOperations.substituteUnavailable")}
              </p>
            )}
            {/* Việc phải làm tiếp theo cho đúng mã lỗi BE vừa trả — câu gốc của
                BE nói "sai cái gì", câu này nói "giờ làm gì". */}
            {errorHint && (
              <p
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {errorHint}
              </p>
            )}
            {substitutionResult && (
              <div className="mt-3">
                <SubstitutionResultCard
                  result={substitutionResult}
                  summary={substitutionSummary}
                  t={t}
                  tc={tc}
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  isMutating ||
                  trip?.canSubstituteVehicle === false ||
                  // Không có sự cố nào của chuyến = thiếu field bắt buộc, gửi
                  // lên chỉ ăn 422
                  (hasNoIncident && !isIncidentLocked)
                }
                onClick={() => void substituteVehicle()}
                className="inline-flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <FiRepeat />
                {t("tripOperations.substitute")}
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void disruptTrip()}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                <FiAlertTriangle />
                {t("tripOperations.disrupt")}
              </button>
            </div>
          </div>
        </details>
      )}

      {canMutate && canChangeRoute && (
        <div className="mt-4 rounded-xl border border-vr-100 bg-vr-50/30 p-4">
          <button
            type="button"
            onClick={toggleChangeRoute}
            aria-expanded={isChangeRouteOpen}
            className="inline-flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <FiGitBranch className="text-vr-900" />
            {t("tripOperations.changeRoute")}
          </button>

          {isChangeRouteOpen && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                {t("tripOperations.changeRouteHint")}
              </p>

              {isAlternativesLoading ? (
                <p className="text-sm text-gray-500">
                  {t("tripOperations.alternativesLoading")}
                </p>
              ) : alternatives !== null && alternatives.length === 0 ? (
                // Tuyến chưa có tuyến thay thế active — dẫn sang màn Routes để khai báo
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p>{t("tripOperations.noAlternatives")}</p>
                  {trip?.routeId && (
                    <Link
                      to={`/manager/routes?routeId=${trip.routeId}&tab=alternatives`}
                      className="mt-1 inline-block font-semibold text-vr-800 hover:underline"
                    >
                      {t("tripOperations.declareAlternatives")}
                    </Link>
                  )}
                </div>
              ) : alternatives !== null ? (
                <>
                  <div className="flex flex-col gap-2">
                    {alternatives.map((alternative) => (
                      <label
                        key={alternative.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 transition hover:border-vr-500"
                      >
                        <input
                          type="radio"
                          name="alternative-route"
                          checked={
                            selectedAlternativeRouteId === alternative.id
                          }
                          onChange={() =>
                            setSelectedAlternativeRouteId(alternative.id)
                          }
                          className="mt-1 h-4 w-4 border-gray-300 text-vr-900 focus:ring-vr-500"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-800">
                            {alternative.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {t("tripOperations.alternativeMeta", {
                              km: alternative.totalDistanceKm,
                              minutes: alternative.estimatedDurationMinutes,
                            })}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={isMutating || !selectedAlternativeRouteId}
                      onClick={() => void changeRoute()}
                      className="inline-flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <FiGitBranch />
                      {t("tripOperations.changeRouteApply")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction === "substitute") void substituteVehicle();
          else if (pendingAction === "disrupt") void disruptTrip();
          else if (pendingAction === "route") void changeRoute();
        }}
        title={tc("confirm")}
        message={
          pendingAction === "substitute"
            ? t("tripOperations.substituteConfirm")
            : pendingAction === "disrupt"
              ? t("tripOperations.disruptConfirm")
              : t("tripOperations.changeRouteConfirm")
        }
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone={pendingAction === "disrupt" ? "danger" : "warning"}
        busy={isMutating}
      >
        {/* Nhắc lại hậu quả đúng lúc bấm: xe cũ rời `ACTIVE` sang `MAINTENANCE`
            và không dùng cho lịch/phân phối chuyến được nữa. */}
        {pendingAction === "substitute" && (
          <p className="text-xs text-amber-800">
            {t("tripOperations.oldVehicleMaintenanceWarning", {
              plate: trip?.vehiclePlate ?? t("tripOperations.oldVehicle"),
            })}
          </p>
        )}
      </ConfirmModal>
      {/* Cảnh báo thiếu ghế do BE trả về — tách khỏi ConfirmModal chung vì nó
          mang số liệu riêng và chỉ mở SAU khi request đầu đã bị từ chối. */}
      <ConfirmModal
        open={Boolean(seatShortage)}
        onClose={() => setSeatShortage(null)}
        onConfirm={() => void confirmSubstitutionDespiteShortage()}
        title={t("tripOperations.seatShortageTitle")}
        message={t("tripOperations.seatShortageServerBody", {
          seats: formatShortageNumber(seatShortage?.usableSeats, t),
          passengers: formatShortageNumber(
            seatShortage?.passengersToTransfer,
            t,
          ),
          missing: formatShortageNumber(seatShortage?.missingSeats, t),
        })}
        confirmLabel={t("tripOperations.seatShortageProceed")}
        cancelLabel={tc("cancel")}
        tone="warning"
        busy={isMutating}
      >
        <p className="text-xs text-gray-500">
          {t("tripOperations.seatShortageServerHint")}
        </p>
      </ConfirmModal>
    </section>
  );
}

/**
 * BE gửi ba con số thiếu ghế dưới dạng chuỗi và có thể thiếu field. Không parse
 * được thì hiện nhãn "không rõ" chứ KHÔNG hiện 0 — 0 ghế dùng được là một khẳng
 * định khác hẳn "không đọc được số".
 */
function formatShortageNumber(
  value: number | null | undefined,
  t: TFunction<"manager">,
) {
  return value == null
    ? t("tripOperations.seatShortageUnknownValue")
    : String(value);
}

/**
 * Một dòng của khối "trước khi đổi". Tách ra vì `dl` dùng grid hai cột: cặp
 * `dt`/`dd` phải nằm cạnh nhau chứ không bọc thêm `div`, nếu không lưới vỡ.
 */
function BeforeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

/**
 * Nhãn một sự cố trong ô chọn: loại sự cố · giờ báo · trạng thái. Mô tả của tài
 * xế thêm vào cuối khi có — hai sự cố cùng loại trong một chuyến chỉ phân biệt
 * được bằng nó.
 */
function incidentLabel(incident: OperatorIncident, t: TFunction<"manager">) {
  // Loại và trạng thái sự cố đã có bảng dịch riêng ở màn Báo cáo sự cố
  // (`incidents.categories.*` / `incidents.statuses.*`) — dùng lại đúng bảng đó
  // để hai màn không gọi cùng một sự cố bằng hai cái tên khác nhau.
  const category = t(`incidents.categories.${incident.category}`, {
    defaultValue: String(incident.category),
  });
  const status = t(`incidents.statuses.${incident.status}`, {
    defaultValue: String(incident.status),
  });
  const base = t("tripOperations.incidentOption", {
    category,
    reportedAt: formatDateTime(incident.reportedAt),
    status,
  });
  const description = incident.description?.trim();
  return description ? `${base} — ${description}` : base;
}

function CapacityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
