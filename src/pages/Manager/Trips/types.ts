// Type cục bộ của màn Trips — dùng chung giữa index, ScheduleForm, ScheduleTable, tripHelpers.

export type ResourceStatus = "active" | "inactive" | "available" | "busy";
export type ScheduleStatus = "draft" | "open" | "blocked";

export type RouteOption = {
  id: string;
  name: string;
  origin: string;
  destination: string;
  status: ResourceStatus;
  distanceKm?: number;
  durationMinutes?: number;
};

export type VehicleOption = {
  id: string;
  plate: string;
  vehicleType: string;
  seats: number;
  status: ResourceStatus;
};

export type StaffOption = {
  id: string;
  name: string;
  role: "driver" | "assistant";
  status: ResourceStatus;
};

export type ScheduleForm = {
  routeId: string;
  vehicleId: string;
  driverId: string;
  assistantId: string;
  departureAt: string;
  arrivalEstimate: string;
  fare: string;
  recurrence: string;
};

export type TripSchedule = ScheduleForm & {
  id: string;
  code: string;
  status: ScheduleStatus;
  routeName?: string;
  vehiclePlate?: string;
  driverName?: string;
  assistantName?: string;
};
