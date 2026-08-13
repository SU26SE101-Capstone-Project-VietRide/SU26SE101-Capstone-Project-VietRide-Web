// Helper thuần của màn Trips — không phụ thuộc React.
import { toDatetimeLocalValue } from "../../../utils/date";
import { formatCurrency } from "../../../utils/currency";
import type {
  OperatorDriverSchedule,
  OperatorRoute,
  OperatorUser,
  OperatorVehicle,
} from "../../../api/vietride";
import type {
  ResourceStatus,
  RouteOption,
  ScheduleForm,
  ScheduleStatus,
  StaffOption,
  TripSchedule,
  VehicleOption,
} from "./types";

export const emptyForm: ScheduleForm = {
  routeId: "",
  vehicleId: "",
  driverId: "",
  assistantId: "",
  departureAt: "",
  arrivalEstimate: "",
  validUntil: "",
  baseFare: "",
  isOneTime: false,
  // Mặc định chạy đủ 7 ngày (tương đương "hằng ngày" của form cũ)
  dayOfWeek: [1, 2, 3, 4, 5, 6, 7],
};

export function optionLabel<T extends { id: string }>(
  options: T[],
  id: string,
  getLabel: (option: T) => string,
) {
  const match = options.find((option) => option.id === id);
  return match ? getLabel(match) : "-";
}

export function formatMoney(value: string) {
  return formatCurrency(value, value);
}

export function getNextSuggestedDeparture() {
  const next = new Date();
  next.setSeconds(0, 0);

  const minutes = next.getMinutes();
  const nextSlotMinutes = minutes < 30 ? 30 : 60;
  next.setMinutes(nextSlotMinutes, 0, 0);

  return next;
}

export function getArrivalEstimateValue(
  departureAt: string,
  route?: RouteOption,
) {
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

export function toScheduleTimeValue(dateTimeValue: string) {
  const timePart = dateTimeValue.split(/[T ]/)[1] ?? "";
  const [hour = "00", minute = "00", second = "00"] = timePart.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
}

export function toScheduleDateTime(validFrom?: string, departureTime?: string) {
  if (!validFrom || !departureTime) {
    return "";
  }

  const rawTime = departureTime.includes("T")
    ? departureTime.split("T")[1]
    : departureTime;
  const [hour = "00", minute = "00"] = rawTime
    .replace("Z", "")
    .split(".")[0]
    .split(":");

  return `${validFrom}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function toResourceStatus(status?: string): ResourceStatus {
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

export function toRouteOption(route: OperatorRoute): RouteOption {
  return {
    id: route.id,
    name: route.name,
    origin: route.originStation?.name ?? route.originStationId,
    destination: route.destinationStation?.name ?? route.destinationStationId,
    status: route.isActive ? "active" : "inactive",
    baseFare: route.baseFare,
    distanceKm: route.totalDistanceKm,
    durationMinutes: route.estimatedDurationMinutes,
  };
}

export function toVehicleOption(vehicle: OperatorVehicle): VehicleOption {
  return {
    id: vehicle.vehicleId || vehicle.id || "",
    plate: vehicle.licensePlate,
    vehicleTypeId: vehicle.vehicleTypeId,
    vehicleType:
      vehicle.vehicleTypeCode ||
      vehicle.vehicleTypeName ||
      vehicle.vehicleTypeId,
    seats: vehicle.totalSeats,
    status:
      vehicle.status === "ACTIVE"
        ? "available"
        : toResourceStatus(vehicle.status),
  };
}

export function isShuttle16SeatVehicle(vehicle?: VehicleOption | null) {
  const type = vehicle?.vehicleType?.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ -]+/g, "_");
  const isShuttleType = type === "SHUTTLE_16_SEAT" || type?.includes("SHUTTLE") || type?.includes("TRUNG_CHUYEN");
  return Boolean(isShuttleType && vehicle?.seats === 16);
}

export function toStaffOption(user: OperatorUser): StaffOption {
  return {
    id: user.userId || user.id || "",
    name: user.displayName,
    role: user.role === "ASSISTANT" ? "assistant" : "driver",
    status: toResourceStatus(user.status),
  };
}

// Chuẩn hoá dayOfWeek để so sánh/hiển thị: bỏ trùng, sort tăng dần (BE cũng
// normalize distinct + sort khi update — xem API-driver shedule.md §9.8).
export function normalizeDayOfWeek(days?: number[] | null) {
  return days ? [...new Set(days)].sort((left, right) => left - right) : [];
}

export function isSameDayOfWeek(left?: number[] | null, right?: number[] | null) {
  const a = normalizeDayOfWeek(left);
  const b = normalizeDayOfWeek(right);
  return a.length === b.length && a.every((day, index) => day === b[index]);
}

// Lịch "một lần" không phải khái niệm riêng ở BE — nó chỉ là lịch đúng 1 thứ và
// bị chặn hai đầu cùng một ngày (validUntil === validFrom), nên chỉ sinh được
// một chuyến duy nhất. Nhận diện lại từ dữ liệu thay vì lưu cờ riêng.
export function isOneTimeSchedule(
  days: number[] | undefined,
  validFrom?: string,
  validUntil?: string | null,
) {
  return (
    normalizeDayOfWeek(days).length <= 1 &&
    Boolean(validFrom) &&
    validUntil === validFrom
  );
}

// Thứ trong tuần của một giá trị datetime-local, theo chuẩn ISO 1..7 (1 = Thứ 2).
// Date#getDay() trả Chủ nhật = 0 nên phải quy về 7.
export function isoWeekdayOf(dateTimeValue: string) {
  const date = new Date(dateTimeValue);
  return Number.isNaN(date.getTime()) ? undefined : date.getDay() || 7;
}

// dayOfWeek cuối cùng gửi cho BE: lịch một lần luôn là đúng thứ của ngày khởi
// hành; lịch lặp là các thứ người dùng bật trên bộ chip.
export function resolveDayOfWeek(form: ScheduleForm) {
  if (!form.isOneTime) {
    return normalizeDayOfWeek(form.dayOfWeek);
  }

  const weekday = isoWeekdayOf(form.departureAt);
  return weekday ? [weekday] : [];
}

export function toTripSchedule(
  schedule: OperatorDriverSchedule,
  form: ScheduleForm,
  status: ScheduleStatus,
): TripSchedule {
  return {
    ...form,
    baseFare: schedule.baseFare === null ? "" : String(schedule.baseFare),
    id: schedule.id,
    routeId: schedule.routeId,
    vehicleId: schedule.vehicleId,
    driverId: schedule.driverUserId ?? schedule.driverId ?? "",
    assistantId: schedule.assistantUserId ?? schedule.assistantId ?? "",
    departureAt: form.departureAt,
    // Lấy từ response vì lịch "một lần" được server chốt validUntil = validFrom
    validUntil: schedule.validUntil ?? schedule.effectiveUntil ?? "",
    dayOfWeek: normalizeDayOfWeek(schedule.dayOfWeek ?? schedule.daysOfWeek),
    status: schedule.isActive || schedule.status === "ACTIVE" ? "open" : status,
    routeName: schedule.route?.name,
    vehiclePlate: schedule.vehicle?.licensePlate,
    driverName: schedule.driver?.displayName,
    assistantName: schedule.assistant?.displayName,
  };
}

export function toTripScheduleFromApi(
  schedule: OperatorDriverSchedule,
): TripSchedule {
  const routeOption = schedule.route
    ? toRouteOption(schedule.route)
    : undefined;
  const validFrom = schedule.validFrom ?? schedule.effectiveFrom;
  const validUntil = schedule.validUntil ?? schedule.effectiveUntil ?? "";
  const departureAt = toScheduleDateTime(validFrom, schedule.departureTime);
  const arrivalEstimate = getArrivalEstimateValue(departureAt, routeOption);
  const dayOfWeek = normalizeDayOfWeek(
    schedule.dayOfWeek ?? schedule.daysOfWeek,
  );

  return {
    id: schedule.id,
    routeId: schedule.routeId,
    vehicleId: schedule.vehicleId,
    driverId: schedule.driverUserId ?? schedule.driverId ?? "",
    assistantId: schedule.assistantUserId ?? schedule.assistantId ?? "",
    departureAt,
    arrivalEstimate,
    validUntil,
    baseFare: schedule.baseFare === null ? "" : String(schedule.baseFare),
    dayOfWeek,
    isOneTime: isOneTimeSchedule(dayOfWeek, validFrom, validUntil),
    status: schedule.isActive ? "open" : "draft",
    routeName: schedule.route?.name,
    vehiclePlate: schedule.vehicle?.licensePlate,
    driverName: schedule.driver?.displayName,
    assistantName: schedule.assistant?.displayName,
  };
}
