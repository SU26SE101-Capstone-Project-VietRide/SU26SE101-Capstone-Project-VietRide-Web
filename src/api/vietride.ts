import { apiRequest, buildQuery } from "./client";

export type PageParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string;
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type OperatorStatus =
  | "PENDING"
  | "APPROVED"
  | "SUSPENDED"
  | "REJECTED"
  | string;

export type AdminOperator = {
  operatorId: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  businessRegistrationNumber: string;
  taxCode: string;
  registrationStatus: OperatorStatus;
  createdAt?: string;
  approvedAt?: string | null;
};

export type CreateAdminOperatorRequest = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  businessRegistrationNumber: string;
  taxCode: string;
  addressStreet: string;
  addressWard: string;
  addressDistrict: string;
  addressProvince: string;
  representativeName: string;
  representativePosition: string;
  representativePhone: string;
  representativeEmail: string;
};

export type AdminOperatorActionResult = {
  operatorId: string;
  message: string;
};

export type AdminUserRole =
  | "PASSENGER"
  | "DRIVER"
  | "ASSISTANT"
  | "OPERATOR_STAFF"
  | "OPERATOR_ADMIN"
  | "SYSTEM_ADMIN"
  | "customer"
  | "manager"
  | "operator"
  | "admin"
  | string;

export type AdminUser = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminUserRole;
  status: string;
  operatorId?: string | null;
  createdAt?: string;
};

export type AdminUserParams = PageParams & {
  role?: string;
  operatorId?: string;
};

export type CreateAdminUserRequest = {
  email: string;
  displayName: string;
  role: AdminUserRole;
};

export type OperatorProfile = {
  operatorId: string;
  name: string;
  businessRegistrationNumber: string;
  taxCode: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string | null;
  address: {
    street: string;
    ward: string;
    district: string;
    province: string;
  };
  representativeName: string;
  representativePhone: string;
  registrationStatus: string;
  isActive: boolean;
  cancellationPolicy?: string;
  parcelNoShowPolicy?: string;
  luggagePolicy?: string;
};

export type UpdateOperatorProfileRequest = {
  name: string;
  contactPhone: string;
  logoUrl?: string;
  addressStreet: string;
  addressWard: string;
  addressDistrict: string;
  addressProvince: string;
  representativeName: string;
  representativePhone: string;
  cancellationPolicy: string;
  parcelNoShowPolicy: string;
  luggagePolicy: string;
};

export type RegisterOperatorRequest = CreateAdminOperatorRequest & {
  password: string;
};

export type OperatorUser = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminUserRole;
  status: string;
  operatorId: string;
  createdAt?: string;
};

export type CreateOperatorUserRequest = {
  email: string;
  displayName: string;
  role: AdminUserRole;
};

export type InternalOperator = {
  operatorId: string;
  name: string;
  registrationStatus: string;
  isActive: boolean;
  contactEmail: string;
  contactPhone: string;
  businessRegistrationNumber: string;
  taxCode: string;
};

export type OperatorSubscription = {
  operatorId: string;
  subscriptionId: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  plan: {
    planId: string;
    name: string;
    limits: Record<string, number>;
    modules: Record<string, boolean>;
  };
  usage: Record<string, number>;
};

export type IncrementUsageRequest = {
  resource: string;
  delta: number;
};

export type Station = {
  id: string;
  name: string;
  slug?: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  isActive?: boolean;
  supportsShuttle?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type StationSearchParams = {
  q?: string;
  city?: string;
  province?: string;
};

export type OperatorStationRequest = {
  stationId: string;
  displayNameOverride?: string;
  counterLocation?: string;
  contactPhone?: string;
  instructions?: string;
  name?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  addressStreet?: string;
  contactEmail?: string;
  operatingHours?: string;
  facilities?: string;
  supportsShuttle?: boolean;
};

export type OperatorStation = OperatorStationRequest & {
  id?: string;
  operatorId: string;
  stationId: string;
  station?: Station;
};

export type OperatorStop = {
  id: string;
  operatorId: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  googlePlaceId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorStopRequest = {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  address: string;
  googlePlaceId: string;
};

export type OperatorRoute = {
  id: string;
  operatorId: string;
  name: string;
  originStationId: string;
  destinationStationId: string;
  returnRouteId?: string | null;
  baseFare: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorRouteRequest = {
  name: string;
  originStationId: string;
  destinationStationId: string;
  returnRouteId?: string;
  baseFare: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
};

export type RouteStop = {
  id: string;
  routeId: string;
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number;
  distanceFromOriginKm: number;
  allowPickup: boolean;
  allowDropoff: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type RouteStopRequest = {
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number;
  distanceFromOriginKm: number;
  allowPickup: boolean;
  allowDropoff: boolean;
};

export type FareTemplate = {
  id: string;
  routeId: string;
  stopId: string;
  fareFromThisStop: number;
  effectiveFrom: string;
  effectiveUntil: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FareTemplateRequest = {
  stopId: string;
  fareFromThisStop: number;
  effectiveFrom: string;
  effectiveUntil: string;
};

export type AlternativeRoute = {
  id: string;
  routeId: string;
  name: string;
  description: string;
  destinationStationId: string;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  stops: AlternativeRouteStop[];
  createdAt?: string;
  updatedAt?: string;
};

export type AlternativeRouteStop = {
  alternativeRouteId: string;
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number;
  distanceFromOriginKm: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AlternativeRouteRequest = {
  name: string;
  description: string;
  destinationStationId: string;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  stops: Array<{
    stopId: string;
    orderIndex: number;
    estimatedDurationFromOriginMinutes: number;
    distanceFromOriginKm: number;
  }>;
};

export type VehicleSeat = {
  seatNumber: string;
  row: number;
  col: number;
  type: string;
  isAvailable: boolean;
  metadata?: Record<string, unknown>;
};

export type VehicleDeck = {
  deck: number;
  seats: VehicleSeat[];
};

export type OperatorVehicle = {
  vehicleId: string;
  operatorId: string;
  licensePlate: string;
  vehicleTypeId: string;
  vehicleTypeName?: string;
  vehicleTypeCode?: string;
  totalSeats: number;
  maxCargoWeightKg: number;
  status: string;
  decks: VehicleDeck[];
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorVehicleRequest = {
  vehicleTypeId: string;
  licensePlate: string;
  totalSeats: number;
  maxCargoWeightKg: number;
  status: string;
  decks: VehicleDeck[];
};

export type VehicleType = {
  id: string;
  code: string;
  displayName: string;
  defaultSeatCount: number;
  estimatedPassengerLuggageKgPerSeat: number;
  isSystemDefined: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicTripSearchParams = {
  originStationId: string;
  destinationStationId: string;
  departureDate: string;
  passengerCount: number;
  allowAlongRoutePickup?: boolean;
};

export type PublicTrip = {
  tripId: string;
  operatorId: string;
  operatorName?: string;
  routeId: string;
  vehicleId?: string;
  status: string;
  departureTime: string;
  estimatedArrivalTime: string;
  baseFare: number;
  originStation: Pick<Station, "id" | "name">;
  destinationStation: Pick<Station, "id" | "name">;
  stops: Array<{
    stopId: string;
    orderIndex: number;
    allowPickup: boolean;
    allowDropoff: boolean;
    estimatedArrivalTime: string;
    distanceFromOriginKm: number;
    fareFromThisStop: number;
  }>;
};

export type SeatLockRequest = {
  seatNumbers: string[];
  holdOwnerId: string;
  ttlSeconds: number;
};

export type SeatLockResult = {
  seatLockToken: string;
  lockedSeats: string[];
  expiresAt: string;
};

export type RoundTripSeatLockRequest = {
  outbound: {
    tripId: string;
    seatNumbers: string[];
  };
  return: {
    tripId: string;
    seatNumbers: string[];
  };
  holdOwnerId: string;
  ttlSeconds: number;
};

export type RoundTripSeatLockResult = {
  outbound: {
    tripId: string;
    seatLockToken: string;
    lockedSeats: string[];
    expiresAt: string;
  };
  return: {
    tripId: string;
    seatLockToken: string;
    lockedSeats: string[];
    expiresAt: string;
  };
};

export type ReleaseSeatsRequest = {
  seatLockToken: string;
  seatNumbers: string[];
};

export type BookSeatsRequest = {
  seatLockToken: string;
  bookingId: string;
  passengers: Array<{
    passengerId: string;
    seatNumber: string;
  }>;
};

export function getAdminOperators(params: PageParams = {}) {
  return apiRequest<PagedResult<AdminOperator>>(
    `/v1/admin/operators${buildQuery(params)}`,
  );
}

export function createAdminOperator(request: CreateAdminOperatorRequest) {
  return apiRequest<AdminOperatorActionResult>("/v1/admin/operators", {
    method: "POST",
    body: request,
  });
}

export function approveAdminOperator(operatorId: string) {
  return apiRequest<AdminOperatorActionResult>(
    `/v1/admin/operators/${operatorId}/approve`,
    { method: "POST" },
  );
}

export function rejectAdminOperator(operatorId: string, reason: string) {
  return apiRequest<AdminOperatorActionResult>(
    `/v1/admin/operators/${operatorId}/reject`,
    { method: "POST", body: { reason } },
  );
}

export function suspendAdminOperator(operatorId: string, reason: string) {
  return apiRequest<AdminOperatorActionResult>(
    `/v1/admin/operators/${operatorId}/suspend`,
    { method: "POST", body: { reason } },
  );
}

export function getAdminOperatorUsers(params: AdminUserParams = {}) {
  return apiRequest<PagedResult<AdminUser>>(
    `/v1/admin/operator-users${buildQuery(params)}`,
  );
}

export function createAdminUser(request: CreateAdminUserRequest) {
  return apiRequest<AdminUser>("/v1/admin/users", {
    method: "POST",
    body: request,
  });
}

export function getOperatorProfile() {
  return apiRequest<OperatorProfile>("/v1/operator/profile");
}

export function updateOperatorProfile(request: UpdateOperatorProfileRequest) {
  return apiRequest<OperatorProfile>("/v1/operator/profile", {
    method: "PATCH",
    body: request,
  });
}

export function registerOperator(request: RegisterOperatorRequest) {
  return apiRequest<AdminOperatorActionResult>("/v1/operators/register", {
    method: "POST",
    body: request,
    authenticated: false,
  });
}

export function getOperatorUsers(params: AdminUserParams = {}) {
  return apiRequest<PagedResult<OperatorUser>>(
    `/v1/operator/users${buildQuery(params)}`,
  );
}

export function createOperatorUser(request: CreateOperatorUserRequest) {
  return apiRequest<OperatorUser>("/v1/operator/users", {
    method: "POST",
    body: request,
  });
}

export function resendInitialPassword(userId: string) {
  return apiRequest<{ userId: string; message: string }>(
    `/v1/operator/users/${userId}/resend-initial-password`,
    { method: "POST" },
  );
}

export function getInternalOperator(operatorId: string) {
  return apiRequest<InternalOperator>(`/internal/v1/operators/${operatorId}`);
}

export function getInternalOperatorSubscription(operatorId: string) {
  return apiRequest<OperatorSubscription>(
    `/internal/v1/operators/${operatorId}/subscription`,
  );
}

export function incrementInternalOperatorUsage(
  operatorId: string,
  request: IncrementUsageRequest,
) {
  return apiRequest<OperatorSubscription>(
    `/internal/v1/operators/${operatorId}/usage/increment`,
    { method: "POST", body: request },
  );
}

export function getInternalUser(userId: string) {
  return apiRequest<AdminUser>(`/internal/v1/users/${userId}`);
}

export function searchStations(params: StationSearchParams) {
  return apiRequest<Station[]>(`/v1/stations/search${buildQuery(params)}`);
}

export function createOperatorStation(request: OperatorStationRequest) {
  return apiRequest<OperatorStation>("/v1/operator/stations", {
    method: "POST",
    body: request,
  });
}

export function getOperatorStops(params: PageParams = {}) {
  return apiRequest<PagedResult<OperatorStop>>(
    `/v1/operator/stops${buildQuery(params)}`,
  );
}

export function getOperatorStop(id: string) {
  return apiRequest<OperatorStop>(`/v1/operator/stops/${id}`);
}

export function createOperatorStop(request: OperatorStopRequest) {
  return apiRequest<OperatorStop>("/v1/operator/stops", {
    method: "POST",
    body: request,
  });
}

export function updateOperatorStop(id: string, request: OperatorStopRequest) {
  return apiRequest<OperatorStop>(`/v1/operator/stops/${id}`, {
    method: "PATCH",
    body: request,
  });
}

export function getOperatorRoutes(params: PageParams = {}) {
  return apiRequest<PagedResult<OperatorRoute>>(
    `/v1/operator/routes${buildQuery(params)}`,
  );
}

export function getOperatorRoute(id: string) {
  return apiRequest<OperatorRoute>(`/v1/operator/routes/${id}`);
}

export function createOperatorRoute(request: OperatorRouteRequest) {
  return apiRequest<OperatorRoute>("/v1/operator/routes", {
    method: "POST",
    body: request,
  });
}

export function updateOperatorRoute(id: string, request: OperatorRouteRequest) {
  return apiRequest<OperatorRoute>(`/v1/operator/routes/${id}`, {
    method: "PATCH",
    body: request,
  });
}

export function addRouteStop(routeId: string, request: RouteStopRequest) {
  return apiRequest<RouteStop>(`/v1/operator/routes/${routeId}/stops`, {
    method: "POST",
    body: request,
  });
}

export function removeRouteStop(routeId: string, stopId: string) {
  return apiRequest<{ message?: string }>(
    `/v1/operator/routes/${routeId}/stops/${stopId}`,
    { method: "DELETE" },
  );
}

export function getRouteFareTemplates(routeId: string, params: PageParams = {}) {
  return apiRequest<PagedResult<FareTemplate>>(
    `/v1/operator/routes/${routeId}/fare-templates${buildQuery(params)}`,
  );
}

export function createRouteFareTemplate(
  routeId: string,
  request: FareTemplateRequest,
) {
  return apiRequest<FareTemplate>(
    `/v1/operator/routes/${routeId}/fare-templates`,
    { method: "POST", body: request },
  );
}

export function getAlternativeRoutes(routeId: string, params: PageParams = {}) {
  return apiRequest<PagedResult<AlternativeRoute>>(
    `/v1/operator/routes/${routeId}/alternative-routes${buildQuery(params)}`,
  );
}

export function createAlternativeRoute(
  routeId: string,
  request: AlternativeRouteRequest,
) {
  return apiRequest<AlternativeRoute>(
    `/v1/operator/routes/${routeId}/alternative-routes`,
    { method: "POST", body: request },
  );
}

export function updateAlternativeRoute(
  alternativeRouteId: string,
  request: AlternativeRouteRequest,
) {
  return apiRequest<AlternativeRoute>(
    `/v1/operator/alternative-routes/${alternativeRouteId}`,
    { method: "PATCH", body: request },
  );
}

export function deleteAlternativeRoute(alternativeRouteId: string) {
  return apiRequest<{ message?: string }>(
    `/v1/operator/alternative-routes/${alternativeRouteId}`,
    { method: "DELETE" },
  );
}

export function getOperatorVehicles(params: PageParams & { searchIn?: string } = {}) {
  return apiRequest<PagedResult<OperatorVehicle>>(
    `/v1/operator/vehicles${buildQuery(params)}`,
  );
}

export function getOperatorVehicle(id: string) {
  return apiRequest<OperatorVehicle>(`/v1/operator/vehicles/${id}`);
}

export function createOperatorVehicle(request: OperatorVehicleRequest) {
  return apiRequest<OperatorVehicle>("/v1/operator/vehicles", {
    method: "POST",
    body: request,
  });
}

export function updateOperatorVehicle(
  id: string,
  request: OperatorVehicleRequest,
) {
  return apiRequest<OperatorVehicle>(`/v1/operator/vehicles/${id}`, {
    method: "PATCH",
    body: request,
  });
}

export function getVehicleTypes(params: PageParams & { searchIn?: string } = {}) {
  return apiRequest<PagedResult<VehicleType>>(
    `/v1/vehicle-types${buildQuery(params)}`,
  );
}

export function searchPublicTrips(params: PublicTripSearchParams) {
  return apiRequest<PublicTrip[]>(`/v1/trips/search${buildQuery(params)}`);
}

export function getPublicTrip(tripId: string) {
  return apiRequest<PublicTrip>(`/v1/trips/${tripId}`);
}

export function getPublicTripSeatMap(tripId: string) {
  return apiRequest<unknown>(`/v1/trips/${tripId}/seat-map`);
}

export function getInternalStation(id: string) {
  return apiRequest<Station>(`/internal/v1/stations/${id}`);
}

export function getInternalStop(id: string) {
  return apiRequest<OperatorStop>(`/internal/v1/stops/${id}`);
}

export function getInternalTrip(tripId: string) {
  return apiRequest<PublicTrip>(`/internal/v1/trips/${tripId}`);
}

export function lockInternalTripSeats(tripId: string, request: SeatLockRequest) {
  return apiRequest<SeatLockResult>(`/internal/v1/trips/${tripId}/lock-seats`, {
    method: "POST",
    body: request,
  });
}

export function releaseInternalTripSeats(
  tripId: string,
  request: ReleaseSeatsRequest,
) {
  return apiRequest<null>(`/internal/v1/trips/${tripId}/release-seats`, {
    method: "POST",
    body: request,
  });
}

export function bookInternalTripSeats(tripId: string, request: BookSeatsRequest) {
  return apiRequest<null>(`/internal/v1/trips/${tripId}/book-seats`, {
    method: "POST",
    body: request,
  });
}

export function lockInternalRoundTripSeats(
  request: RoundTripSeatLockRequest,
  idempotencyKey?: string,
) {
  return apiRequest<RoundTripSeatLockResult>(
    "/internal/v1/trips/round-trip/lock-seats",
    {
      method: "POST",
      body: request,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    },
  );
}
