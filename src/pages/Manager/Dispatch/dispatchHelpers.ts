// Helper thuần + type cục bộ của màn Dispatch — không phụ thuộc React.
import type {
  AdminUserRole,
  OperatorUser,
  OperatorVehicle,
  ShuttleBookingGroup,
  ShuttleRequestGroup,
  ShuttleTrackingEta,
  ShuttleTrackingLatest,
} from "../../../api/vietride";

export type RequestType = "Đón" | "Trả";
export type RequestStatus =
  | "pending"
  | "assigned"
  | "picking"
  | "completed"
  | "cancelled";
export type VehicleStatus = "active" | "picking" | "idle";

export type ShuttleRequest = {
  id: string;
  mainTripId: string;
  bookingId: string;
  customerName: string;
  phone: string;
  trip: string;
  type: RequestType;
  address: string;
  note?: string;
  time: string;
  hardCutoffAt?: string;
  passengerCount: number;
  pickupLat?: number;
  pickupLng?: number;
  stationName?: string;
  assignedDriver?: string;
  assignedPlate?: string;
  assignedCap?: string;
  status: RequestStatus;
};

export type ShuttleVehicle = {
  id: string;
  plate: string;
  vehicleModel: string;
  capacity: number;
  status: VehicleStatus;
  currentPickups?: number;
};

export type TrackedShuttleTrip = {
  shuttleTripId: string;
  mainTripId: string;
  createdAt: string;
  isRefreshing: boolean;
  error?: string;
  latest?: ShuttleTrackingLatest | null;
  eta?: ShuttleTrackingEta | null;
};

export type ShuttleDriver = {
  id: string;
  name: string;
  phone?: string;
  status: string;
};

export const STATUS_CLASS: Record<RequestStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-50 text-blue-600",
  picking: "bg-teal-50 text-teal-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

export const V_STATUS_CLASS: Record<VehicleStatus, string> = {
  active: "text-teal-600",
  picking: "text-blue-500",
  idle: "text-gray-400",
};
export const V_DOT_CLASS: Record<VehicleStatus, string> = {
  active: "bg-teal-500",
  picking: "bg-blue-500",
  idle: "bg-gray-300",
};

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

export function toRequestRows(group: ShuttleRequestGroup): ShuttleRequest[] {
  const orderMap = new Map(
    group.suggestedBookingOrder.map((bookingId, index) => [bookingId, index]),
  );

  return [...group.bookingGroups]
    .sort((left, right) => {
      const leftOrder = orderMap.get(left.bookingId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderMap.get(right.bookingId) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    })
    .map((booking) => toRequestRow(group, booking));
}

export function toRequestRow(
  group: ShuttleRequestGroup,
  booking: ShuttleBookingGroup,
): ShuttleRequest {
  return {
    id: booking.bookingId,
    mainTripId: group.mainTripId,
    bookingId: booking.bookingId,
    customerName: booking.bookingId,
    phone: "-",
    trip: group.mainTripId,
    type: "Đón",
    address: booking.pickupAddress,
    note: `${group.stationName} - ${booking.distanceToStationMeters}m`,
    time: formatTime(group.departureDateTime),
    hardCutoffAt: group.hardCutoffAt,
    passengerCount: booking.passengerCount,
    pickupLat: booking.pickupLat,
    pickupLng: booking.pickupLng,
    stationName: group.stationName,
    status: "pending",
  };
}

export function toVehicleOption(vehicle: OperatorVehicle): ShuttleVehicle {
  return {
    id: vehicle.vehicleId || vehicle.id || "",
    plate: vehicle.licensePlate,
    vehicleModel: vehicle.vehicleTypeName || vehicle.vehicleTypeCode || "-",
    capacity: vehicle.totalSeats,
    status: vehicle.status === "ACTIVE" ? "active" : "idle",
  };
}

export function toDriverOption(user: OperatorUser): ShuttleDriver {
  return {
    id: user.userId || user.id || "",
    name: user.displayName || user.email,
    phone: user.phone,
    status: user.status,
  };
}

export function isDriverRole(role: AdminUserRole) {
  return role === "DRIVER" || role === "driver";
}
