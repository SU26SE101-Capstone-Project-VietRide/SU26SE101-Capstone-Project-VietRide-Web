import type {
  AdminUserRole,
  OperatorShuttleContext,
  OperatorShuttleTripListItem,
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
 * Đổi stop của `operator-context` thành marker cho `FleetMap`.
 *
 * `isStation` quyết định đầu tuyến: chuyến vào bến thì bến là điểm CUỐI, chuyến
 * rời bến thì bến là điểm ĐẦU — vẽ ngược lại là đọc sai chiều chạy.
 */
export function toShuttleRouteMarkers(
  context: OperatorShuttleContext | null | undefined,
  stationFallbackName: string,
): TripRouteMarker[] {
  if (!context) return [];

  const stationKind =
    context.direction === "OUTBOUND_FROM_STATION" ? "origin" : "destination";

  return context.stops.map((stop) => ({
    id: `shuttle-stop:${stop.pickupOrder}`,
    kind: stop.isStation ? stationKind : "stop",
    name:
      stop.serviceAddress?.trim() ||
      (stop.isStation
        ? context.station?.name?.trim() || stationFallbackName
        : String(stop.pickupOrder)),
    orderIndex: stop.isStation ? undefined : stop.pickupOrder,
    // PENDING = xe chưa tới; mọi trạng thái khác coi như đã xử lý xong điểm đó.
    passed: stop.status !== "PENDING",
    position: { lat: stop.latitude, lng: stop.longitude },
  }));
}

/**
 * Trạng thái kết nối realtime của mục theo dõi. Khai tại đây thay vì dùng chung
 * `RealtimeStatus` của màn Operations để hai màn không phụ thuộc lẫn nhau.
 * Không có trạng thái "idle": mục theo dõi luôn mở socket khi màn được mở.
 */
export type ShuttleRealtimeStatus = "connecting" | "connected" | "error";

export const SHUTTLE_TRIP_ACTIVE_STATUSES = "SCHEDULED,IN_PROGRESS";

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
 * BE giữ điểm GPS shuttle mới nhất trong Redis 300s (`SHUTTLE_LATEST_TTL_SECONDS`).
 * Quá ngưỡng đó thì điểm đang hiện chỉ là bản socket đẩy về trước đây, không còn
 * phản ánh vị trí thật — đánh dấu "lost" thay vì để marker đứng yên như xe đang
 * đỗ.
 */
export const SHUTTLE_SIGNAL_TTL_MS = 300_000;

/**
 * Dựng marker bản đồ cho một chuyến trung chuyển. Trả null khi chưa có toạ độ —
 * chuyến đó vẫn hiện ở lưới thẻ, chỉ không có marker.
 *
 * Chưa vẽ được điểm đón hay bến vì BE chưa mở `stops` của shuttle cho vai trò
 * OPERATOR (chỉ `passenger-context` có, và chặn cứng role PASSENGER), nên bản đồ
 * hiện chỉ có chấm xe.
 */
export function toShuttleMapPoint(
  trip: OperatorShuttleTripListItem,
  tracking: ShuttleTripTracking | undefined,
  labels: { unknownVehicle: string; unassignedDriver: string; route: string },
  now = Date.now(),
): FleetVehicleMapPoint | null {
  const latest = tracking?.latest;
  if (!latest) return null;

  const recordedAt = new Date(latest.recordedAt).getTime();
  const isStale =
    Number.isFinite(recordedAt) && now - recordedAt > SHUTTLE_SIGNAL_TTL_MS;

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
