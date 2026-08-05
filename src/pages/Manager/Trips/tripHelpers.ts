// Helper thuần của màn Trips — không phụ thuộc React.
import { toDatetimeLocalValue } from "../../../utils/date";
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
  fare: "250000",
  recurrence: "daily",
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
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("vi-VN").format(amount)
    : value;
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
    distanceKm: route.totalDistanceKm,
    durationMinutes: route.estimatedDurationMinutes,
  };
}

export function toVehicleOption(vehicle: OperatorVehicle): VehicleOption {
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

export function toStaffOption(user: OperatorUser): StaffOption {
  return {
    id: user.userId || user.id || "",
    name: user.displayName,
    role: user.role === "ASSISTANT" ? "assistant" : "driver",
    status: toResourceStatus(user.status),
  };
}

export function recurrenceToDays(recurrence: string) {
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

export function toTripSchedule(
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
  const departureAt = toScheduleDateTime(
    schedule.validFrom ?? schedule.effectiveFrom,
    schedule.departureTime,
  );
  const arrivalEstimate = getArrivalEstimateValue(departureAt, routeOption);

  return {
    id: schedule.id,
    code: `SCH-${schedule.id.slice(0, 8).toUpperCase()}`,
    routeId: schedule.routeId,
    vehicleId: schedule.vehicleId,
    driverId: schedule.driverUserId ?? schedule.driverId ?? "",
    assistantId: schedule.assistantUserId ?? schedule.assistantId ?? "",
    departureAt,
    arrivalEstimate,
    fare: String(schedule.route?.baseFare ?? ""),
    recurrence: "once",
    status: schedule.isActive ? "open" : "draft",
    routeName: schedule.route?.name,
    vehiclePlate: schedule.vehicle?.licensePlate,
    driverName: schedule.driver?.displayName,
    assistantName: schedule.assistant?.displayName,
  };
}
