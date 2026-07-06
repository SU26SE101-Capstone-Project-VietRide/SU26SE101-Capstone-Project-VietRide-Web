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
  addressStreet?: string;
  addressWard?: string;
  addressDistrict?: string;
  addressProvince?: string;
  representativeName?: string;
  representativePosition?: string;
  representativePhone?: string;
  representativeEmail?: string;
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
  phone?: string;
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
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  phone?: string;
  role: AdminUserRole;
  status: string;
  operatorId: string;
  createdAt?: string;
  initialPasswordExpiresAt?: string;
};

export type CreateOperatorUserRequest = {
  email: string;
  displayName: string;
  phone: string;
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

export type OperatorVoucher = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  totalUsageLimit: number;
  perUserLimit: number;
  usedCount?: number;
  validFrom: string;
  validUntil: string;
  applicableRouteIds: string[];
  fundingType?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateOperatorVoucherRequest = {
  code: string;
  name: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  totalUsageLimit: number;
  perUserLimit: number;
  validFrom: string;
  validUntil: string;
  applicableRouteIds: string[];
  fundingType: string;
};

export type UpdateOperatorVoucherRequest = Omit<
  CreateOperatorVoucherRequest,
  "code" | "type" | "fundingType"
>;

export type OperatorVoucherActionResult = {
  id: string;
  isActive?: boolean;
  deletedAt?: string;
};

export type OperatorVoucherConsent = {
  id: string;
  voucherId: string;
  voucherCode: string;
  voucherType: string;
  voucherValue: number;
  validFrom: string;
  validUntil: string;
  minOrderAmount: number;
  maxDiscountAmount: number;
  applicableRouteIds: string[];
  status: string;
  requestedAt?: string;
  respondedAt?: string;
  respondedByUserId?: string;
};

export type AdminVoucher = {
  id: string;
  code: string;
  name: string;
  description?: string;
  voucherType?: string;
  discountType?: string;
  discount?: number;
  applicableTo?: string;
  quantity?: number;
  totalUsageLimit?: number;
  usedCount?: number;
  expiryDate?: string;
  validUntil?: string;
  active?: boolean;
  isActive?: boolean;
  type?: string;
  value?: number;
  minOrderValue?: number;
  maxUsagePerUser?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateAdminVoucherRequest = {
  code: string;
  name: string;
  description: string;
  voucherType: string;
  discountType: string;
  discount: number;
  applicableTo: string;
  minOrderValue: number;
  quantity: number;
  expiryDate: string;
  maxUsagePerUser: number;
  active: boolean;
};

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PAID"
  | "CANCELLED"
  | "BOARDED"
  | string;

export type BookingPassengerRequest = {
  passengerId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  identityDocument?: string;
  seatNumber: string;
};

export type BookingPassengerRecord = BookingPassengerRequest & {
  passengerRecordId: string;
  checkedInAt?: string | null;
  boardedAt?: string | null;
  status?: string;
};

export type Booking = {
  bookingId: string;
  code?: string;
  tripId: string;
  operatorId?: string;
  status: BookingStatus;
  seatNumbers?: string[];
  passengers?: BookingPassengerRecord[];
  pickupStopId?: string;
  dropoffStopId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  subtotalAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  cancelledAt?: string | null;
};

export type CreateBookingRequest = {
  tripId: string;
  seatLockToken: string;
  pickupStopId?: string;
  dropoffStopId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  passengers: BookingPassengerRequest[];
  voucherCode?: string;
  paymentMethod?: string;
  note?: string;
};

export type CreateRoundTripBookingRequest = {
  outbound: CreateBookingRequest;
  return: CreateBookingRequest;
};

export type RoundTripBooking = {
  outbound: Booking;
  return: Booking;
};

export type EditBookingPickupRequest = {
  pickupStopId: string;
  note?: string;
};

export type EditBookingDropoffRequest = {
  dropoffStopId: string;
  note?: string;
};

export type CancelBookingRequest = {
  reason: string;
  note?: string;
};

export type BookingManifest = {
  tripId: string;
  operatorId?: string;
  bookingCount?: number;
  passengerCount?: number;
  passengers: BookingPassengerRecord[];
  bookings?: Booking[];
};

export type BoardPassengerRequest = {
  boardedAt?: string;
  note?: string;
};

export type BoardingQrScanRequest = {
  qrCode: string;
  scannedAt?: string;
  note?: string;
};

export type BoardingResult = {
  tripId: string;
  bookingId?: string;
  passengerRecordId?: string;
  status: string;
  boardedAt?: string;
};

export type BookingTrackingAuthorization = {
  tripId: string;
  bookings: Array<{
    bookingId: string;
    passengerRecordId?: string;
    passengerName?: string;
    phone?: string;
    seatNumber?: string;
    canTrack?: boolean;
    status?: string;
  }>;
};

export type PickupBooking = {
  bookingId: string;
  passengerRecordId?: string;
  passengerName?: string;
  phone?: string;
  seatNumber?: string;
  pickupStopId: string;
  status?: string;
};

export type BookingStatsParams = {
  from?: string;
  to?: string;
  operatorId?: string;
  routeId?: string;
  status?: string;
};

export type BookingStatsAggregate = {
  totalBookings: number;
  totalPassengers?: number;
  totalRevenue?: number;
  cancelledBookings?: number;
  pendingBookings?: number;
  confirmedBookings?: number;
  byStatus?: Record<string, number>;
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
  deck?: number;
  type: string;
  isAvailable: boolean;
  isWindow?: boolean;
  isAisle?: boolean;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type VehicleDeck = {
  deck: number;
  seats: VehicleSeat[];
};

export type SeatLayoutJson = {
  version: number;
  vehicleTypeCode: string;
  totalSeats: number;
  rows: number;
  cols: number;
  decks: number;
  aisles: Array<{
    afterCol: number;
  }>;
  seats: VehicleSeat[];
};

export type OperatorVehicle = {
  id?: string;
  vehicleId: string;
  operatorId: string;
  licensePlate: string;
  vehicleTypeId: string;
  vehicleTypeName?: string;
  vehicleTypeCode?: string;
  totalSeats: number;
  maxCargoWeightKg: number;
  maxCargoVolumeM3?: number;
  status: string;
  decks?: VehicleDeck[];
  seatLayoutJson?: SeatLayoutJson | string;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorVehicleRequest = {
  vehicleTypeId: string;
  licensePlate: string;
  totalSeats: number;
  maxCargoWeightKg: number;
  maxCargoVolumeM3: number;
  seatLayoutJson: SeatLayoutJson;
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

export type TripTrackingAuthorization = {
  tripId: string;
  operatorId?: string;
  userId?: string;
  role?: AdminUserRole;
  status?: string;
  isAuthorized?: boolean;
  allowedScopes?: string[];
  expiresAt?: string;
};

export type TripRouteStop = {
  tripId?: string;
  stopId: string;
  orderIndex: number;
  name?: string;
  allowPickup?: boolean;
  allowDropoff?: boolean;
  estimatedArrivalTime?: string;
  actualArrivalTime?: string | null;
  distanceFromOriginKm?: number;
  fareFromThisStop?: number;
  status?: string;
};

export type TripRouteGeometryPoint = {
  latitude: number;
  longitude: number;
  orderIndex?: number;
};

export type TripRouteGeometry = {
  tripId: string;
  encodedPolyline?: string;
  geoJson?: unknown;
  points?: TripRouteGeometryPoint[];
};

export type CargoCapacity = {
  tripId: string;
  reservedWeightKg?: number;
  loadedWeightKg?: number;
  percentFull?: number;
  maxCargoWeightKg: number;
  maxCargoVolumeM3?: number;
  reservedCargoWeightKg?: number;
  reservedCargoVolumeM3?: number;
  loadedCargoWeightKg?: number;
  loadedCargoVolumeM3?: number;
  availableCargoWeightKg?: number;
  availableCargoVolumeM3?: number;
};

export type CargoReserveRequest = {
  parcelId?: string;
  bookingId?: string;
  weightKg: number;
  volumeM3?: number;
  holdOwnerId?: string;
  ttlSeconds?: number;
};

export type CargoReserveResult = {
  tripId: string;
  cargoLockToken?: string;
  reservedWeightKg?: number;
  reservedVolumeM3?: number;
  expiresAt?: string;
};

export type CargoLoadRequest = {
  parcelId?: string;
  bookingId?: string;
  cargoLockToken?: string;
  weightKg?: number;
  volumeM3?: number;
  loadedByUserId?: string;
  note?: string;
};

export type CargoReleaseRequest = {
  parcelId?: string;
  bookingId?: string;
  cargoLockToken?: string;
  weightKg?: number;
  volumeM3?: number;
  reason?: string;
};

export type CargoActionResult = {
  tripId: string;
  status?: string;
  releasedAt?: string;
  loadedAt?: string;
};

export type OperatorDriverSchedule = {
  id: string;
  operatorId: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  assistantId?: string | null;
  departureTime: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  daysOfWeek?: number[];
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorDriverScheduleRequest = {
  routeId: string;
  vehicleId: string;
  driverId: string;
  assistantId?: string;
  departureTime: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  daysOfWeek?: number[];
};

export type TripStopArrivalRequest = {
  actualArrivalTime?: string;
  note?: string;
};

export type TripStopArrivalResult = {
  tripId: string;
  stopId: string;
  status?: string;
  actualArrivalTime?: string;
};

export type SubstituteVehicleRequest = {
  newVehicleId: string;
  newDriverUserId?: string;
  newAssistantUserId?: string;
  reason: string;
};

export type TripDisruptionRequest = {
  reason: string;
};

export type TripOperationResult = {
  tripId: string;
  oldTripId?: string;
  newTripId?: string;
  stopId?: string;
  status?: string;
  vehicleId?: string;
  actualArrivalTime?: string;
  message?: string;
};

export type VerifyEmailRequest = {
  email: string;
  code: string;
  purpose: string;
};

export type VerifyEmailResult = {
  userId: string;
  status: string;
};

export type SetInitialPasswordRequest = {
  token: string;
  password: string;
};

export type SetInitialPasswordResult = {
  userId: string;
  status: string;
};

export function verifyEmail(request: VerifyEmailRequest) {
  return apiRequest<VerifyEmailResult>("/v1/auth/verify-email", {
    method: "POST",
    body: request,
    authenticated: false,
  });
}

export function setInitialPassword(request: SetInitialPasswordRequest) {
  return apiRequest<SetInitialPasswordResult>("/v1/auth/set-initial-password", {
    method: "POST",
    body: request,
    authenticated: false,
  });
}

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

export async function getOperatorUsers(params: AdminUserParams = {}) {
  const response = await apiRequest<PagedResult<OperatorUser> | OperatorUser[]>(
    `/v1/operator/users${buildQuery(params)}`,
  );

  if (Array.isArray(response)) {
    return {
      items: response,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? response.length,
      totalItems: response.length,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };
  }

  return response;
}

export function createOperatorUser(request: CreateOperatorUserRequest) {
  return apiRequest<OperatorUser>("/v1/operator/users", {
    method: "POST",
    body: request,
  });
}

export function resendInitialPassword(userId: string) {
  return apiRequest<{ userId: string; status: string; expiresAt?: string }>(
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

export function createOperatorDriverSchedule(
  request: OperatorDriverScheduleRequest,
) {
  return apiRequest<OperatorDriverSchedule>("/v1/operator/driver-schedules", {
    method: "POST",
    body: request,
  });
}

export function activateOperatorDriverSchedule(id: string) {
  return apiRequest<OperatorDriverSchedule>(
    `/v1/operator/driver-schedules/${id}/activate`,
    { method: "PATCH" },
  );
}

export function getOperatorBookingStats(params: BookingStatsParams = {}) {
  return apiRequest<BookingStatsAggregate>(
    `/v1/operator/booking-stats${buildQuery(params)}`,
  );
}

export function getOperatorVouchers(params: PageParams = {}) {
  return apiRequest<PagedResult<OperatorVoucher>>(
    `/v1/operator/vouchers${buildQuery(params)}`,
  );
}

export function createOperatorVoucher(request: CreateOperatorVoucherRequest) {
  return apiRequest<OperatorVoucher>("/v1/operator/vouchers", {
    method: "POST",
    body: request,
  });
}

export function updateOperatorVoucher(
  id: string,
  request: UpdateOperatorVoucherRequest,
) {
  return apiRequest<OperatorVoucher>(`/v1/operator/vouchers/${id}`, {
    method: "PATCH",
    body: request,
  });
}

export function deleteOperatorVoucher(id: string) {
  return apiRequest<OperatorVoucherActionResult>(`/v1/operator/vouchers/${id}`, {
    method: "DELETE",
  });
}

export function activateOperatorVoucher(id: string) {
  return apiRequest<OperatorVoucherActionResult>(
    `/v1/operator/vouchers/${id}/activate`,
    { method: "POST" },
  );
}

export function deactivateOperatorVoucher(id: string) {
  return apiRequest<OperatorVoucherActionResult>(
    `/v1/operator/vouchers/${id}/deactivate`,
    { method: "POST" },
  );
}

export function getOperatorVoucherConsents(status?: string) {
  return apiRequest<PagedResult<OperatorVoucherConsent>>(
    `/v1/operator/voucher-consents${buildQuery({ status })}`,
  );
}

export function acceptOperatorVoucherConsent(id: string) {
  return apiRequest<{ id: string; status: string }>(
    `/v1/operator/voucher-consents/${id}/accept`,
    { method: "POST" },
  );
}

export function rejectOperatorVoucherConsent(id: string, reason: string) {
  return apiRequest<{ id: string; status: string }>(
    `/v1/operator/voucher-consents/${id}/reject`,
    { method: "POST", body: { reason } },
  );
}

export function getAdminBookingStatsAggregate(params: BookingStatsParams = {}) {
  return apiRequest<BookingStatsAggregate>(
    `/v1/admin/booking-stats/aggregate${buildQuery(params)}`,
  );
}

export function getAdminVoucherConsents(
  voucherId: string,
  params: PageParams & { status?: string } = {},
) {
  return apiRequest<PagedResult<OperatorVoucherConsent>>(
    `/v1/admin/vouchers/${voucherId}/consents${buildQuery(params)}`,
  );
}

export async function getAdminVouchers(params: PageParams = {}) {
  const response = await apiRequest<PagedResult<AdminVoucher> | AdminVoucher[]>(
    `/v1/admin/vouchers${buildQuery(params)}`,
  );

  if (Array.isArray(response)) {
    return {
      items: response,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? response.length,
      totalItems: response.length,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };
  }

  return response;
}

export function createAdminVoucher(request: CreateAdminVoucherRequest) {
  return apiRequest<AdminVoucher>("/v1/admin/vouchers", {
    method: "POST",
    body: request,
  });
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

export function createBooking(request: CreateBookingRequest) {
  return apiRequest<Booking>("/v1/bookings", {
    method: "POST",
    body: request,
  });
}

export function createRoundTripBooking(
  request: CreateRoundTripBookingRequest,
  idempotencyKey?: string,
) {
  return apiRequest<RoundTripBooking>("/v1/bookings/round-trip", {
    method: "POST",
    body: request,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function editBookingPickup(
  bookingId: string,
  request: EditBookingPickupRequest,
) {
  return apiRequest<Booking>(`/v1/bookings/${bookingId}/edit-pickup`, {
    method: "POST",
    body: request,
  });
}

export function editBookingDropoff(
  bookingId: string,
  request: EditBookingDropoffRequest,
) {
  return apiRequest<Booking>(`/v1/bookings/${bookingId}/edit-dropoff`, {
    method: "POST",
    body: request,
  });
}

export function cancelBooking(bookingId: string, request: CancelBookingRequest) {
  return apiRequest<Booking>(`/v1/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: request,
  });
}

export function getBookingTripManifest(tripId: string) {
  return apiRequest<BookingManifest>(`/v1/bookings/trips/${tripId}/manifest`);
}

export function boardBookingPassenger(
  tripId: string,
  passengerRecordId: string,
  request: BoardPassengerRequest = {},
) {
  return apiRequest<BoardingResult>(
    `/v1/bookings/trips/${tripId}/boarding/passenger/${passengerRecordId}`,
    { method: "POST", body: request },
  );
}

export function scanBookingBoardingQr(
  tripId: string,
  request: BoardingQrScanRequest,
) {
  return apiRequest<BoardingResult>(
    `/v1/bookings/trips/${tripId}/boarding/qr-scan`,
    { method: "POST", body: request },
  );
}

export function pingTripService() {
  return apiRequest<{ message?: string }>("/v1/ping", {
    authenticated: false,
  });
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

export function getInternalTripTrackingAuthorization(tripId: string) {
  return apiRequest<TripTrackingAuthorization>(
    `/internal/v1/trips/${tripId}/tracking-authorization`,
  );
}

export function getInternalTripRouteStops(tripId: string) {
  return apiRequest<TripRouteStop[]>(
    `/internal/v1/trips/${tripId}/route-stops`,
  );
}

export function getInternalTripRouteGeometry(tripId: string) {
  return apiRequest<TripRouteGeometry>(
    `/internal/v1/trips/${tripId}/route-geometry`,
  );
}

export function getInternalTripTrackingAuthorizationBookings(tripId: string) {
  return apiRequest<BookingTrackingAuthorization>(
    `/internal/v1/trips/${tripId}/tracking-authorization/bookings`,
  );
}

export function getInternalTripStopPickupBookings(
  tripId: string,
  stopId: string,
) {
  return apiRequest<PickupBooking[]>(
    `/internal/v1/trips/${tripId}/stops/${stopId}/pickup-bookings`,
  );
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

export function reserveInternalTripCargo(
  tripId: string,
  request: CargoReserveRequest,
) {
  return apiRequest<CargoReserveResult>(
    `/internal/v1/trips/${tripId}/cargo/reserve`,
    { method: "POST", body: request },
  );
}

export function loadInternalTripCargo(tripId: string, request: CargoLoadRequest) {
  return apiRequest<CargoActionResult>(
    `/internal/v1/trips/${tripId}/cargo/load`,
    { method: "POST", body: request },
  );
}

export function releaseInternalTripCargo(
  tripId: string,
  request: CargoReleaseRequest,
) {
  return apiRequest<CargoActionResult>(
    `/internal/v1/trips/${tripId}/cargo/release`,
    { method: "POST", body: request },
  );
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

export function getOperatorTripCargoCapacity(tripId: string) {
  return apiRequest<CargoCapacity>(
    `/v1/operator/trips/${tripId}/cargo-capacity`,
  );
}

export function arriveOperatorTripStop(
  tripId: string,
  stopId: string,
  request: TripStopArrivalRequest = {},
) {
  return apiRequest<TripStopArrivalResult>(
    `/v1/operator/trips/${tripId}/stops/${stopId}/arrive`,
    { method: "POST", body: request },
  );
}

export function substituteOperatorTripVehicle(
  tripId: string,
  request: SubstituteVehicleRequest,
) {
  return apiRequest<TripOperationResult>(
    `/v1/operator/trips/${tripId}/substitute-vehicle`,
    { method: "POST", body: request },
  );
}

export function disruptOperatorTripNoSubstitution(
  tripId: string,
  request: TripDisruptionRequest,
) {
  return apiRequest<TripOperationResult>(
    `/v1/operator/trips/${tripId}/disrupt-no-substitution`,
    { method: "POST", body: request },
  );
}
