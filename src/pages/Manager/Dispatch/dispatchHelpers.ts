import type {
  AdminUserRole,
  OperatorUser,
  OperatorVehicle,
  ShuttleBookingGroup,
  ShuttleDirection,
  ShuttleRequestGroup,
  ShuttleTrackingEta,
  ShuttleTrackingLatest,
} from "../../../api/vietride";

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
 * Vị trí / ETA của một chuyến trung chuyển, tải theo yêu cầu (không tự poll).
 * Tách khỏi bản ghi chuyến vì danh sách chuyến đến từ server còn phần tracking
 * này là trạng thái cục bộ của từng thẻ.
 */
export type ShuttleTripTracking = {
  isRefreshing: boolean;
  error?: string;
  latest?: ShuttleTrackingLatest | null;
  eta?: ShuttleTrackingEta | null;
};

export const SHUTTLE_TRIP_ACTIVE_STATUSES = "SCHEDULED,IN_PROGRESS";

// Nhãn người đọc được cho một chuyến trung chuyển. BE chưa cấp mã chuyến dạng
// chữ nên biển số xe là định danh tự nhiên nhất với điều độ viên.
export function shuttleTripLabel(
  trip: { vehicle: { licensePlate: string } },
  fallback: string,
) {
  return trip.vehicle.licensePlate.trim() || fallback;
}

// Tên hành khách để hiển thị thay cho bookingId. BE trả `passengers` kèm mỗi
// lượt đặt; payload cũ không có thì lùi về nhãn thứ tự.
export function bookingPassengerLabel(
  booking: ShuttleBookingGroup,
  fallback: string,
) {
  const names = (booking.passengers ?? [])
    .map((passenger) => passenger.displayName?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return fallback;
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
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
