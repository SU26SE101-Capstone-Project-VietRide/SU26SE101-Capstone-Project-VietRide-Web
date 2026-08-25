import type {
  AdminUserRole,
  OperatorShuttleContext,
  OperatorShuttleTrackingStop,
  OperatorShuttleTripListItem,
  OperatorShuttleTripStatus,
  OperatorUser,
  OperatorVehicle,
  ShuttleBookingGroup,
  ShuttleDirection,
  ShuttleRequestGroup,
  ShuttleTrackingEta,
  ShuttleTrackingLatest,
} from "../../../api/vietride";
import {
  getFleetStatus,
  type FleetVehicleMapPoint,
  type TripRouteMarker,
} from "../../../components/fleetMapPoint";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";

export type ShuttleVehicle = {
  id: string;
  plate: string;
  vehicleModel: string;
  capacity: number;
};

export type ShuttleDriver = {
  id: string;
  name: string;
  phone: string;
};

/**
 * Vị trí / ETA của một chuyến trung chuyển. Nạp một lần khi join room realtime
 * (hoặc khi bấm làm mới), sau đó tự cập nhật theo event socket.
 * Tách khỏi bản ghi chuyến vì danh sách chuyến đến từ server còn phần tracking
 * này là trạng thái cục bộ của từng thẻ.
 */
export type ShuttleTripTracking = {
  isRefreshing: boolean;
  error?: string;
  latest?: ShuttleTrackingLatest | null;
  eta?: ShuttleTrackingEta | null;
  /** Số liệu đang hiện đến từ event socket chứ không phải lượt gọi REST */
  isLive?: boolean;
  /**
   * Điểm đón + bến lấy từ `operator-context`. Nạp cùng lượt `latest`/`eta`;
   * `undefined` = chưa nạp, `null` = nạp lỗi (không được coi là không có điểm).
   */
  context?: OperatorShuttleContext | null;
};

/**
 * Tìm điểm đón ứng với `nextPickupOrder` của ETA.
 *
 * Đối chiếu bằng `pickupOrder` chứ KHÔNG bằng index mảng: `pickupOrder` là thứ
 * tự nghiệp vụ, có thể không trùng vị trí trong mảng (điểm bị huỷ vẫn giữ số).
 */
export function findStopByPickupOrder(
  context: OperatorShuttleContext | null | undefined,
  pickupOrder: number | null | undefined,
) {
  if (!context || pickupOrder == null) return null;
  return (
    context.stops.find((stop) => stop.pickupOrder === pickupOrder) ?? null
  );
}

/**
 * Chọn điểm đón mà một thông báo trỏ tới.
 *
 * Thứ tự ưu tiên do BE quy định (FE-RESPONSE-shuttle-dispatch-notifications
 * 2026-08-22): khớp cả `bookingId` + `pickupOrder` → chỉ `bookingId` → chỉ
 * `pickupOrder` → không chọn gì.
 *
 * Khác bản mẫu trong tài liệu ở một điểm: tài liệu lùi cuối cùng về
 * `ownPickups[0]` vì app hành khách luôn phải hiện MỘT điểm của chính họ. Console
 * nhà xe thì nhìn cả chuyến, nên không có điểm nào khớp thì KHÔNG tô sáng bừa —
 * tô nhầm một điểm của khách khác còn tệ hơn là không tô.
 */
export function findNotifiedStop(
  stops: OperatorShuttleTrackingStop[] | undefined,
  target: { bookingId?: string | null; pickupOrder?: number | null },
) {
  if (!stops || stops.length === 0) return null;

  const { bookingId, pickupOrder } = target;
  if (!bookingId && pickupOrder == null) return null;

  const exact =
    bookingId && pickupOrder != null
      ? stops.find(
          (stop) =>
            stop.bookingId === bookingId && stop.pickupOrder === pickupOrder,
        )
      : undefined;
  if (exact) return exact;

  const byBooking = bookingId
    ? stops.find((stop) => stop.bookingId === bookingId)
    : undefined;
  if (byBooking) return byBooking;

  const byOrder =
    pickupOrder == null
      ? undefined
      : stops.find((stop) => stop.pickupOrder === pickupOrder);

  return byOrder ?? null;
}

/**
 * Nhãn "điểm đón kế tiếp": ưu tiên địa chỉ phục vụ, thiếu thì lùi về số thứ tự.
 * BE khai `serviceAddress` là optional nên luôn phải có nhánh dự phòng.
 */
export function nextPickupLabel(
  context: OperatorShuttleContext | null | undefined,
  eta: ShuttleTrackingEta | null | undefined,
  fallback: (order: number) => string,
) {
  if (!eta) return null;
  const stop = findStopByPickupOrder(context, eta.nextPickupOrder);
  return stop?.serviceAddress?.trim() || fallback(eta.nextPickupOrder);
}

/**
 * Trạng thái kết nối realtime của mục theo dõi. Khai tại đây thay vì dùng chung
 * `RealtimeStatus` của màn Operations để hai màn không phụ thuộc lẫn nhau.
 * Không có trạng thái "idle": mục theo dõi luôn mở socket khi màn được mở.
 */
export type ShuttleRealtimeStatus = "connecting" | "connected" | "error";

export const SHUTTLE_TRIP_ACTIVE_STATUSES = "SCHEDULED,IN_PROGRESS";

/**
 * Không lọc gì cả — chuỗi rỗng nghĩa là KHÔNG gửi `status` lên BE. Đây là mặc
 * định của mục theo dõi: xem hết rồi mới thu hẹp. Đừng đổi thành danh sách bốn
 * trạng thái viết cứng, BE thêm trạng thái mới là màn này lọc mất.
 */
export const SHUTTLE_TRIP_ALL_STATUSES = "";

/**
 * Các lựa chọn của dropdown lọc trạng thái ở mục theo dõi. `status` của
 * `GET /v1/operator/shuttle-trips` nhận nhiều giá trị ngăn cách bởi dấu phẩy
 * (BE tự split), nên một option có thể gói nhiều trạng thái.
 */
export const SHUTTLE_TRIP_STATUS_FILTERS = [
  // `id` là khoá i18n + khoá React, KHÔNG dùng `value` làm khoá vì option
  // "đang hoạt động" chứa dấu phẩy còn "tất cả" là chuỗi rỗng.
  { id: "ALL", value: SHUTTLE_TRIP_ALL_STATUSES },
  { id: "ACTIVE", value: SHUTTLE_TRIP_ACTIVE_STATUSES },
  { id: "SCHEDULED", value: "SCHEDULED" },
  { id: "IN_PROGRESS", value: "IN_PROGRESS" },
  { id: "COMPLETED", value: "COMPLETED" },
  { id: "CANCELLED", value: "CANCELLED" },
] as const;

export type ShuttleTripStatusFilter =
  (typeof SHUTTLE_TRIP_STATUS_FILTERS)[number]["value"];

/**
 * Chuyến đã kết thúc thì tài xế không còn gửi GPS: không mở socket, không tải
 * vị trí/ETA, và thẻ hiển thị mốc thời gian thay cho khối theo dõi trực tiếp.
 * Dùng chung ở cả trang (lọc id đăng ký realtime) lẫn thẻ (đổi cách render) để
 * hai nơi không lệch nhau.
 */
export function isTrackableShuttleStatus(status: OperatorShuttleTripStatus) {
  return status === "SCHEDULED" || status === "IN_PROGRESS";
}

function isNewer(candidate: string, current: string) {
  const candidateTime = new Date(candidate).getTime();
  const currentTime = new Date(current).getTime();
  // Mốc thời gian hỏng thì coi như không mới hơn, tránh đá văng số liệu đang có.
  if (Number.isNaN(candidateTime)) return false;
  if (Number.isNaN(currentTime)) return true;
  return candidateTime > currentTime;
}

/**
 * Chọn điểm GPS được hiển thị giữa bản đang có và bản vừa nhận.
 *
 * Hai nguồn chạy song song và không đảm bảo thứ tự: event socket có thể tới
 * trước khi lượt REST nạp lần đầu kịp trả về, còn socket khi reconnect có thể
 * đẩy lại điểm cũ. Luôn giữ bản có `recordedAt` mới hơn.
 *
 * Trả về đúng tham chiếu cũ khi bản mới không thắng — caller dựa vào đó để bỏ
 * qua lượt cập nhật state thừa.
 */
export function pickNewerLatest(
  current: ShuttleTrackingLatest | null | undefined,
  incoming: ShuttleTrackingLatest | null | undefined,
) {
  if (!incoming) return current ?? null;
  if (!current) return incoming;
  return isNewer(incoming.recordedAt, current.recordedAt) ? incoming : current;
}

/** Như `pickNewerLatest` nhưng cho ETA, mốc so sánh là `updatedAt`. */
export function pickNewerEta(
  current: ShuttleTrackingEta | null | undefined,
  incoming: ShuttleTrackingEta | null | undefined,
) {
  if (!incoming) return current ?? null;
  if (!current) return incoming;
  return isNewer(incoming.updatedAt, current.updatedAt) ? incoming : current;
}

// Nhãn chính của một nhóm điều phối là tên tuyến chuyến chính. `mainTripId`
// chỉ dùng làm khoá kỹ thuật khi gửi request — điều độ viên không đọc UUID —
// nên tuyến thiếu tên thì lùi về tên bến, không bao giờ lộ UUID.
export function shuttleRouteLabel(
  group: ShuttleRequestGroup,
  fallback: string,
) {
  return group.routeName?.trim() || fallback;
}

// Tên hành khách để hiển thị thay cho bookingId. `passengers` luôn là mảng
// nhưng `displayName` có thể null khi Identity không tìm được hồ sơ.
export function bookingPassengerLabel(
  booking: ShuttleBookingGroup,
  fallback: string,
) {
  const names = booking.passengers
    .map((passenger) => passenger.displayName?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return fallback;
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

/**
 * SĐT liên hệ của một lượt đặt, đã bỏ trùng và bỏ rỗng.
 *
 * Điều độ viên cần gọi khách khi tài xế tới nơi mà không thấy người — số này BE
 * đã trả sẵn trong `passengers[]`, trước đây màn chỉ lấy mỗi `displayName`.
 * Nhiều hành khách chung một lượt đặt có thể dùng chung một số nên phải lọc
 * trùng, không thì danh sách hiện cùng một số hai lần.
 */
export function bookingPassengerPhones(booking: ShuttleBookingGroup) {
  const phones = booking.passengers
    .map((passenger) => passenger.phone?.trim())
    .filter((phone): phone is string => Boolean(phone));

  return [...new Set(phones)];
}

/**
 * Tổng số vé của một lượt đặt. `ticketIds` gộp từ mọi hành khách trong lượt và
 * bỏ trùng — BE gom theo hành khách nên một vé không xuất hiện hai lần, nhưng
 * đây là dữ liệu tổng hợp qua Identity nên không dựa vào giả định đó.
 */
export function bookingTicketCount(booking: ShuttleBookingGroup) {
  return new Set(booking.passengers.flatMap((passenger) => passenger.ticketIds))
    .size;
}

/**
 * Điểm GPS đã quá TTL Redis của BE (`SHUTTLE_LATEST_TTL_SECONDS`) — số liệu
 * đang hiện chỉ là bản socket đẩy về trước đây, không còn phản ánh vị trí thật.
 *
 * Mốc thời gian hỏng thì KHÔNG coi là cũ: `NaN` so sánh nào cũng false, báo
 * "mất tín hiệu" cho một chuyến vừa gửi dữ liệu còn tệ hơn là im lặng.
 */
export function isStaleSignal(
  latest: ShuttleTrackingLatest | null | undefined,
  now = Date.now(),
) {
  if (!latest) return false;

  const recordedAt = new Date(latest.recordedAt).getTime();
  return Number.isFinite(recordedAt) && now - recordedAt > SHUTTLE_SIGNAL_TTL_MS;
}

/**
 * Marker điểm đón của một nhóm yêu cầu CHỜ điều phối, theo thứ tự đề xuất.
 *
 * Khác `toShuttleRouteMarkers` (dựng từ `operator-context` của chuyến ĐÃ tạo):
 * ở đây chưa có chuyến, chưa có bến trong payload — `ShuttleRequestTripGroup`
 * chỉ có `stationId`/`stationName`, không có toạ độ bến — nên bản đồ chỉ vẽ
 * điểm đón. Không điểm nào `passed`: chưa có xe nào chạy.
 */
export function toRequestPickupMarkers(
  group: ShuttleRequestGroup,
): TripRouteMarker[] {
  return getOrderedBookingGroups(group).map((booking, index) => ({
    id: `pickup:${booking.bookingId}`,
    kind: "stop",
    name: booking.pickupAddress,
    orderIndex: index + 1,
    position: { lat: booking.pickupLat, lng: booking.pickupLng },
  }));
}

/** Toạ độ để khung nhìn bao trọn mọi điểm đón của nhóm yêu cầu. */
export function toRequestPickupPoints(
  group: ShuttleRequestGroup,
): GoogleMapCoordinate[] {
  return group.bookingGroups.map((booking) => ({
    lat: booking.pickupLat,
    lng: booking.pickupLng,
  }));
}

/**
 * BE giữ điểm GPS shuttle mới nhất trong Redis 300s (`SHUTTLE_LATEST_TTL_SECONDS`).
 * Quá ngưỡng đó thì điểm đang hiện chỉ là bản socket đẩy về trước đây, không còn
 * phản ánh vị trí thật — đánh dấu "lost" thay vì để marker đứng yên như xe đang
 * đỗ.
 */
export const SHUTTLE_SIGNAL_TTL_MS = 300_000;

/**
 * Dựng marker XE cho một chuyến trung chuyển. Trả null khi chưa có toạ độ —
 * chuyến đó vẫn hiện ở lưới thẻ, chỉ không có marker.
 *
 * Điểm đón và bến là marker riêng, dựng bằng `toShuttleRouteMarkers` từ
 * `operator-context`. Không có polyline nào cho shuttle: lộ trình dựng động lúc
 * điều phối nên hệ thống không lưu hình dạng đường đi.
 */
export function toShuttleMapPoint(
  trip: OperatorShuttleTripListItem,
  tracking: ShuttleTripTracking | undefined,
  labels: { unknownVehicle: string; unassignedDriver: string; route: string },
  now = Date.now(),
): FleetVehicleMapPoint | null {
  const latest = tracking?.latest;
  if (!latest) return null;

  const isStale = isStaleSignal(latest, now);

  return {
    id: trip.shuttleTripId,
    plate: trip.vehicle.licensePlate.trim() || labels.unknownVehicle,
    driver: trip.driver.displayName?.trim() || labels.unassignedDriver,
    route: labels.route,
    speedKmh: latest.speedKmh ?? null,
    status: isStale ? "lost" : getFleetStatus(latest),
    position: { lat: latest.latitude, lng: latest.longitude },
    // Shuttle gửi `heading`, chuyến thường gửi `headingDeg` — hai tên khác nhau
    // cho cùng một thứ, xem API-ETA-Tracking.md mục `shuttle:gps:update`.
    headingDeg: latest.heading ?? null,
  };
}

export function formatTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Chỉ giờ:phút. Dùng cho vế thứ hai của một cặp mốc cùng ngày (giờ kết thúc,
 * giờ đến dự kiến) — lặp lại nguyên ngày/tháng/năm ở đó chỉ làm loãng thông tin
 * cần đọc nhanh.
 */
export function formatClock(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDistance(distanceMeters?: number | null) {
  if (distanceMeters === null || distanceMeters === undefined) {
    return "-";
  }

  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1_000).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  })} km`;
}

export function getBookingDistance(booking: ShuttleBookingGroup) {
  return booking.roadDistanceMeters ?? booking.distanceToStationMeters;
}

export function getGroupKey(group: ShuttleRequestGroup) {
  return `${group.mainTripId}:${group.direction}`;
}

export function isInboundDirection(direction: ShuttleDirection) {
  return direction === "INBOUND_TO_STATION";
}

export function getOrderedBookingGroups(group: ShuttleRequestGroup) {
  const orderMap = new Map(
    group.suggestedBookingOrder.map((bookingId, index) => [bookingId, index]),
  );

  return [...group.bookingGroups].sort((left, right) => {
    const leftOrder = orderMap.get(left.bookingId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderMap.get(right.bookingId) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime();
  });
}

export function getOrderedSelectedBookingIds(
  group: ShuttleRequestGroup,
  selectedBookingIds: string[],
) {
  const selectedIds = new Set(selectedBookingIds);
  return getOrderedBookingGroups(group)
    .map((booking) => booking.bookingId)
    .filter((bookingId) => selectedIds.has(bookingId));
}

export function getSelectedPassengerCount(
  group: ShuttleRequestGroup,
  selectedBookingIds: string[],
) {
  const selectedIds = new Set(selectedBookingIds);
  return group.bookingGroups.reduce(
    (total, booking) =>
      selectedIds.has(booking.bookingId)
        ? total + booking.passengerCount
        : total,
    0,
  );
}

function toLocalDateTimeInput(date: Date) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export function buildInitialSchedule(group: ShuttleRequestGroup) {
  const now = new Date();
  const earliestStart = new Date(now.getTime() + 10 * 60_000);
  const boundary = new Date(group.hardCutoffAt);

  if (Number.isNaN(boundary.getTime())) {
    return { scheduledDepartureTime: "", scheduledEndTime: "" };
  }

  if (isInboundDirection(group.direction)) {
    const scheduledEnd = new Date(boundary.getTime() - 5 * 60_000);
    const suggestedStart = new Date(scheduledEnd.getTime() - 60 * 60_000);
    const scheduledDeparture =
      suggestedStart > earliestStart ? suggestedStart : earliestStart;

    if (scheduledDeparture >= scheduledEnd) {
      return { scheduledDepartureTime: "", scheduledEndTime: "" };
    }

    return {
      scheduledDepartureTime: toLocalDateTimeInput(scheduledDeparture),
      scheduledEndTime: toLocalDateTimeInput(scheduledEnd),
    };
  }

  const scheduledDeparture = boundary > earliestStart ? boundary : earliestStart;
  const scheduledEnd = new Date(scheduledDeparture.getTime() + 60 * 60_000);
  return {
    scheduledDepartureTime: toLocalDateTimeInput(scheduledDeparture),
    scheduledEndTime: toLocalDateTimeInput(scheduledEnd),
  };
}

export function toVehicleOption(
  vehicle: OperatorVehicle,
): ShuttleVehicle | null {
  const id = vehicle.vehicleId || vehicle.id || "";
  const isActive =
    vehicle.isActive !== false && vehicle.status.trim().toUpperCase() === "ACTIVE";

  if (!id || !isActive || vehicle.totalSeats <= 0) {
    return null;
  }

  return {
    id,
    plate: vehicle.licensePlate,
    vehicleModel: vehicle.vehicleTypeName || vehicle.vehicleTypeCode || "-",
    capacity: vehicle.totalSeats,
  };
}

export function toDriverOption(user: OperatorUser): ShuttleDriver | null {
  const id = user.userId || user.id || "";
  const name = user.displayName.trim();
  const phone = user.phone?.trim() ?? "";
  const isActive = user.status.trim().toUpperCase() === "ACTIVE";

  if (!id || !name || !phone || !isActive || !isDriverRole(user.role)) {
    return null;
  }

  return { id, name, phone };
}

export function isDriverRole(role: AdminUserRole) {
  return role.toUpperCase() === "DRIVER";
}
