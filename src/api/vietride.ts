import {
  apiBlobRequest,
  apiRequest,
  apiSseRequest,
  buildQuery,
} from "./client";
import { createIdempotencyKey } from "./idempotency";

export type PageParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string;
};

export type VoucherService = "BOOKING" | "PARCEL" | string;

export type PaymentMethod = "VNPAY" | "WALLET" | string;

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: unknown | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationParams = {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "readAt" | "type";
  sortDir?: "asc" | "desc";
};

export type OperatorNotificationScope = "TRIP" | "OPERATOR";

export type SendOperatorNotificationRequest = {
  scope: OperatorNotificationScope;
  tripId?: string;
  title: string;
  body: string;
};

export type SendOperatorNotificationResult = {
  announcementId: string;
  recipientCount: number;
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
  logoUrl?: string | null;
  address?: {
    street?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  addressStreet?: string;
  addressWard?: string;
  addressDistrict?: string;
  addressProvince?: string;
  representativeName?: string;
  representativePhone?: string;
  registrationStatus: OperatorStatus;
  isActive?: boolean;
  cancellationPolicy?: CancellationPolicyRule[] | null;
  parcelNoShowPolicy?: ParcelNoShowPolicy | null;
  luggagePolicy?: LuggagePolicy | null;
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
  representativePhone: string;
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
  id?: string;
  email: string;
  displayName: string;
  phone?: string;
  avatarUrl?: string | null;
  role: AdminUserRole;
  status: string;
  operatorId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type AdminUserParams = PageParams & {
  role?: string;
  operatorId?: string;
  includeDeleted?: boolean;
};

export type AdminUserActionResult = {
  userId: string;
  status: string;
  statusChanged: boolean;
};

export type AdminActivityLogActor = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export type AdminActivityLog = {
  id: string;
  actor: AdminActivityLogActor;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export type AdminActivityLogParams = Pick<PageParams, "page" | "pageSize"> & {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
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
  cancellationPolicy?: CancellationPolicyRule[] | null;
  parcelNoShowPolicy?: ParcelNoShowPolicy | null;
  luggagePolicy?: LuggagePolicy | null;
};

export type CancellationPolicyRule = {
  hoursBeforeDeparture: number;
  feePercent: number;
};

export type ParcelNoShowPolicy = {
  noShowFeePercent: number;
  additionalPaymentTimeoutMinutes: number;
};

export type LuggagePolicy = {
  defaultLuggageKgPerSeat: number;
};

export type UpdateOperatorProfileRequest = {
  name: string;
  contactPhone: string;
  logoUrl?: string | null;
  addressStreet: string;
  addressWard: string;
  addressDistrict: string;
  addressProvince: string;
  representativeName: string;
  representativePhone: string;
  cancellationPolicy: CancellationPolicyRule[] | null;
  parcelNoShowPolicy: ParcelNoShowPolicy | null;
  luggagePolicy: LuggagePolicy | null;
};

export type RegisterOperatorRequest = Pick<
  CreateAdminOperatorRequest,
  | "name"
  | "contactEmail"
  | "contactPhone"
  | "businessRegistrationNumber"
  | "taxCode"
  | "addressStreet"
  | "addressWard"
  | "addressDistrict"
  | "addressProvince"
  | "representativeName"
  | "representativePhone"
> & {
  password: string;
};

export type OperatorUser = {
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  phone?: string;
  avatarUrl?: string | null;
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

export type SubscriptionBillingPeriod = "MONTHLY" | "YEARLY";

export type SubscriptionPlan = {
  planId: string;
  name: string;
  description?: string;
  pricePerMonth: number;
  pricePerYear: number;
  limits: {
    maxVehicles: number;
    maxDrivers: number;
    maxAssistants: number;
    maxOperatorUsers: number;
    maxRoutes: number;
    maxTripsPerMonth: number;
  };
  modules: {
    enableParcel: boolean;
    enableShuttle: boolean;
    enableRag: boolean;
  };
  isActive: boolean;
};

export type SubscriptionPlanReference = Pick<
  SubscriptionPlan,
  "planId" | "name"
>;

export type SubscriptionPendingUpgrade = {
  upgradeAttemptId: string;
  targetPlan?: SubscriptionPlanReference | null;
  targetPlanId?: string;
  billingPeriod: SubscriptionBillingPeriod;
  amount: number;
  dueAt: string | null;
  remainingSeconds: number;
  latestPayment?: {
    paymentId: string;
    status: string;
    canRetry: boolean;
  } | null;
};

export type OperatorSubscriptionDetail = {
  subscriptionId: string;
  status: string;
  billingPeriod: SubscriptionBillingPeriod | null;
  startedAt: string | null;
  expiresAt: string | null;
  plan: SubscriptionPlan;
  usage: {
    currentVehicles: number;
    currentDrivers: number;
    currentAssistants: number;
    currentOperatorUsers: number;
    currentRoutes: number;
    currentTripsThisMonth: number;
    lastResetAt?: string;
  };
  pendingUpgrade?: SubscriptionPendingUpgrade | null;
};

export type SubscriptionUpgradeRequest = {
  planId: string;
  billingPeriod: SubscriptionBillingPeriod;
  paymentMethod: "VNPAY";
  returnUrl: string;
};

export type SubscriptionUpgradeResult = {
  subscriptionId: string;
  upgradeAttemptId: string;
  status: string;
  paymentId: string;
  amount: number;
  billingPeriod: SubscriptionBillingPeriod;
  paymentRedirectUrl: string | null;
  dueAt: string | null;
  activePlan: SubscriptionPlanReference;
  pendingTargetPlan: SubscriptionPlanReference;
};

export type SubscriptionRetryPaymentResult = {
  upgradeAttemptId: string;
  status: string;
  paymentId: string;
  paymentRedirectUrl: string | null;
  dueAt: string | null;
};

export type FinancialListParams = Pick<
  PageParams,
  "page" | "pageSize" | "sortBy" | "sortDir"
> & {
  from?: string;
  to?: string;
};

export type WalletTransactionType = "CREDIT" | "DEBIT";

export type OperatorWallet = {
  operatorId: string;
  balance: number;
  pendingHoldAmount: number;
  eligibleAmount: number;
  updatedAt: string;
};

export type WalletTransaction = {
  transactionId: string;
  type: WalletTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  actorType?: "USER" | "SYSTEM";
  actor?: {
    userId: string;
    displayName: string;
    email: string;
    role: string;
  } | null;
};

export type WalletTransactionParams = FinancialListParams & {
  type?: WalletTransactionType;
  referenceType?: string;
};

export type TripSettlementStatus =
  | "PENDING_HOLD"
  | "ELIGIBLE"
  | "SETTLED"
  | "CANCELLED";

export type TripSettlement = {
  settlementId: string;
  tripId: string;
  operatorId?: string;
  status: TripSettlementStatus;
  eligibleAt: string | null;
  netAmount: number;
  settlementMethod: "AUTO_WEEKLY" | "ADMIN_MANUAL" | null;
  settledAt: string | null;
  createdAt: string;
  failureCount?: number;
  activeFailureCode?: string | null;
  severity?: "HIGH" | "WARNING" | null;
  operator?: {
    operatorId: string;
    name: string;
    logoUrl: string | null;
    contactPhone: string | null;
  } | null;
  settledBy?: {
    userId: string;
    displayName: string;
    email: string;
    role: string;
  } | null;
};

export type OperatorTripSettlementParams = FinancialListParams & {
  status?: TripSettlementStatus;
  tripId?: string;
};

export type AdminTripSettlementParams = OperatorTripSettlementParams & {
  operatorId?: string;
  stuckOnly?: boolean;
  severity?: "HIGH" | "WARNING";
};

export type OperatorLedgerEntry = {
  ledgerEntryId: string;
  tripId: string;
  actorType?: "USER" | "SYSTEM" | string;
  actor?: {
    userId: string;
    displayName: string;
    email?: string;
    role?: string;
  } | null;
  entryType: string;
  amount: number;
  referenceType: string;
  referenceId: string | null;
  note?: string | null;
  createdAt: string;
};

export type OperatorLedgerParams = FinancialListParams & {
  tripId?: string;
  entryType?: string;
  referenceType?: string;
};

export type OperatorInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  status: "DRAFT" | "ISSUED" | "CANCELLED";
  amount: number;
  billingPeriod: SubscriptionBillingPeriod;
  periodFrom: string;
  periodTo: string;
  pdfGenerationStatus: "PENDING" | "PROCESSING" | "FAILED" | "COMPLETED";
  createdAt: string;
  issuedAt: string | null;
};

export type OperatorInvoiceDetail = OperatorInvoice & {
  planName: string;
  buyerSnapshot: {
    name: string;
    businessRegistrationNumber: string;
    taxCode: string;
    contactEmail: string;
    contactPhone: string;
    addressStreet: string;
    addressWard: string | null;
    addressDistrict: string;
    addressProvince: string;
  };
  invoiceWebUrl: string;
  downloadApiUrl: string;
};

export type OperatorInvoiceParams = FinancialListParams & {
  status?: OperatorInvoice["status"];
};

export type InvoiceDownload = {
  downloadUrl: string;
  expiresAt: string;
};

export type PlatformWallet = {
  platformWalletId: string;
  balance: number;
  updatedAt: string;
};

export type WalletAdjustmentRequest = {
  type: WalletTransactionType;
  amount: number;
  note: string;
};

export type InvoiceRetryResult = {
  invoiceId: string;
  pdfGenerationStatus: "PENDING";
  attemptsUsed: number;
};

export type AdminSubscriptionPlanRequest = {
  name: string;
  description: string;
  pricePerMonth: number;
  pricePerYear: number;
  maxVehicles: number;
  maxDrivers: number;
  maxAssistants: number;
  maxOperatorUsers: number;
  maxRoutes: number;
  maxTripsPerMonth: number;
  enableParcel: boolean;
  enableShuttle: boolean;
  enableRag: boolean;
  isActive: boolean;
};

export type AdminSubscriptionPlanParams = {
  includeInactive?: boolean;
};

export type IncrementUsageRequest = {
  resource: string;
  delta: number;
};

export type Station = {
  id: string;
  name: string;
  slug?: string;
  address?: string;
  addressStreet?: string;
  locationId?: string;
  // Contract mới: city = tỉnh/thành phố trực thuộc TƯ, ward = xã/phường/đặc khu
  // (legacy row có thể null). Không còn field province FE-facing.
  city: string;
  ward?: string | null;
  latitude: number;
  longitude: number;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  facilities?: string;
  isActive?: boolean;
  supportsShuttle?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminStation = {
  id: string;
  name: string;
  slug: string;
  addressStreet?: string | null;
  locationId?: string | null;
  city: string;
  ward?: string | null;
  latitude: number;
  longitude: number;
  contactPhone?: string | null;
  contactEmail?: string | null;
  operatingHours?: unknown;
  facilities?: unknown;
  supportsShuttle: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type StationSearchParams = {
  q?: string;
  city?: string;
  ward?: string;
  locationId?: string;
};

export type AdminStationParams = PageParams & {
  isActive?: boolean;
};

export type AdminStationRequest = Partial<
  Pick<
    AdminStation,
    | "name"
    | "addressStreet"
    | "locationId"
    | "city"
    | "ward"
    | "latitude"
    | "longitude"
    | "contactPhone"
    | "contactEmail"
    | "operatingHours"
    | "facilities"
    | "supportsShuttle"
    | "isActive"
  >
>;

export type AdminStationMergeResult = {
  primaryStation: AdminStation;
  duplicateStationId: string;
  relinkedCounts: {
    operatorMappings: number;
    collapsedOperatorMappings: number;
    routeOrigins: number;
    routeDestinations: number;
    alternativeRoutes: number;
    shuttleTrips: number;
    flattenedRedirects: number;
  };
};

export type AdminPlatformReportMetrics = {
  completedBookingCount: number;
  completedTripCount: number;
  deliveredParcelCount: number;
  netTicketRevenueVnd: number;
  netParcelRevenueVnd: number;
  netTransportRevenueVnd: number;
};

export type AdminPlatformOperatorReport = AdminPlatformReportMetrics & {
  operatorId: string;
  operatorName: string | null;
};

export type AdminPlatformReport = {
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  totals: AdminPlatformReportMetrics;
  byOperator: AdminPlatformOperatorReport[];
  generatedAt: string;
};

export type AdminPlatformReportParams = {
  from: string;
  to: string;
};

export const OPERATOR_REPORT_EXPORT_TYPES = [
  "bookings",
  "parcels",
  "revenue",
  "occupancy",
  "cancellation",
  "refunds",
] as const;

export type OperatorReportExportType =
  (typeof OPERATOR_REPORT_EXPORT_TYPES)[number];

export type OperatorReportExportParams = {
  from?: string;
  to?: string;
};

export type AdminOutboxDlqParams = {
  cursor?: string;
  pageSize?: number;
  service?: string;
  eventType?: string;
  sortDir?: "asc" | "desc";
};

export type AdminOutboxDlqItem = {
  service: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  terminalAt: string;
};

export type AdminOutboxDlqPage = {
  items: AdminOutboxDlqItem[];
  nextCursor: string | null;
  unavailableServices: string[];
};

export type AdminLocation = {
  id: string;
  code: string;
  name: string;
  type: "PROVINCE" | "MUNICIPALITY" | string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminLocationRequest = {
  code: string;
  name: string;
  type: "PROVINCE" | "MUNICIPALITY";
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateAdminLocationRequest = Partial<AdminLocationRequest>;

export type OperatorStationRequest = {
  stationId?: string;
  displayNameOverride?: string;
  counterLocation?: string;
  contactPhone?: string;
  instructions?: string;
  name?: string;
  // Create mới: name/city/ward/latitude/longitude bắt buộc (BE validate); link chỉ cần stationId
  city?: string;
  ward?: string;
  latitude?: number;
  longitude?: number;
  addressStreet?: string;
  contactEmail?: string;
  operatingHours?: string;
  facilities?: string;
  supportsShuttle?: boolean;
  locationId?: string;
  locationCode?: string;
};

export type OperatorStation = OperatorStationRequest & {
  id?: string;
  operatorId: string;
  stationId: string;
  station?: Station;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorStop = {
  id: string;
  operatorId: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  googlePlaceId: string | null;
  locationId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorStopRequest = {
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  address?: string;
  googlePlaceId?: string | null;
  locationId?: string;
  locationCode?: string;
};

export type AdminStopParams = PageParams & {
  operatorId?: string;
  isActive?: boolean;
};

export type AdminStopRequest = Partial<OperatorStopRequest> & {
  isActive?: boolean;
};

export type OperatorRoute = {
  id: string;
  operatorId: string;
  name: string;
  originStationId: string;
  destinationStationId: string;
  returnRouteId?: string | null;
  pathPolyline?: string | null;
  baseFare: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  originStation?: Station;
  destinationStation?: Station;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorRouteRequest = {
  name: string;
  originStationId: string;
  destinationStationId: string;
  returnRouteId?: string | null;
  baseFare: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
};

// Stop item trong Route detail (RouteDto mục 6.2): giữ map fields của stop
// (name/address/latitude/longitude/isActive) bên cạnh metrics.
export type OperatorRouteStop = {
  routeId: string;
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number | null;
  distanceFromOriginKm: number | null;
  allowPickup: boolean;
  allowDropoff: boolean;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorRouteDetail = OperatorRoute & {
  stops: OperatorRouteStop[];
};

export type RouteManualMetrics = {
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
};

export type OperatorRouteFullStopRequest = {
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes?: number | null;
  distanceFromOriginKm?: number | null;
  allowPickup: boolean;
  allowDropoff: boolean;
};

export type OperatorRouteFullRequest = {
  name: string;
  originStationId: string;
  destinationStationId: string;
  returnRouteId?: string | null;
  baseFare: number;
  isActive?: boolean;
  pathPolyline?: string | null;
  manualMetrics?: RouteManualMetrics | null;
  stops?: OperatorRouteFullStopRequest[];
};

export type OperatorRouteStopMetric = {
  stopId: string;
  stopName: string;
  orderIndex: number;
  distanceFromOriginKm: number | null;
  estimatedDurationFromOriginMinutes: number | null;
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
  effectiveUntil?: string;
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
  applicableServices?: VoucherService[];
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
  applicableServices: VoucherService[];
  applicableRouteIds: string[];
  fundingType: string;
};

export type UpdateOperatorVoucherRequest = Omit<
  CreateOperatorVoucherRequest,
  "code" | "type" | "fundingType" | "applicableServices"
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

export type AdminVoucherConsent = {
  id: string;
  operatorId: string;
  voucherId: string;
  status: string;
  requestedAt: string;
  respondedAt: string | null;
  respondedByUserId: string | null;
  rejectReason: string | null;
};

export type AdminVoucherConsentResult = {
  voucherId: string;
  items: AdminVoucherConsent[];
};

export type PromotionVoucher = {
  voucherId: string;
  code: string;
  name: string;
  type: string;
  value: number;
  applicableServices: string[];
  validUntil: string;
};

export type AvailableVoucher = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  discountAmount: number;
  applicableServices: string[];
  applicablePaymentMethods: string[];
  validUntil: string;
};

export type AvailableVoucherParams = {
  service: VoucherService;
  tripId?: string;
  operatorId?: string;
  routeId?: string;
  paymentMethod?: PaymentMethod;
  orderAmount?: number;
};

export type ParcelSizeCategory =
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "EXTRA_LARGE"
  | string;

export type ParcelAvailableTripsParams = PageParams & {
  originStationId?: string;
  destinationStationId?: string;
  originLocationCode?: string;
  destinationLocationCode?: string;
  departureDate: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  estimatedWeightKg: number;
  sizeCategory: ParcelSizeCategory;
};

export type ParcelAvailableTrip = {
  tripId: string;
  routeId: string;
  operatorName: string;
  departureDateTime: string;
  availableCargoWeightKg: number;
  priceVnd: number;
};

export type ParcelRecipientRequest = {
  fullName: string;
  phoneNumber: string;
  email?: string;
};

export type CreateParcelRequest = {
  tripId: string;
  dropoffStopId?: string | null;
  bookingId?: string | null;
  itemName?: string | null;
  description?: string | null;
  sizeCategory: ParcelSizeCategory;
  estimatedWeightKg: number;
  photoUrl?: string | null;
  recipient: ParcelRecipientRequest;
  deliveryMethod: "TERMINAL_PICKUP" | string;
  paymentMethod: PaymentMethod;
  voucherCode?: string | null;
};

export type CreateParcelResult = {
  parcelId: string;
  parcelCode: string;
  status: string;
  totalAmount: number;
  originalDepositAmount?: number;
  discountAmount?: number;
  voucherCode?: string | null;
  paymentRedirectUrl?: string | null;
};

export type ParcelStationSummary = {
  id: string;
  name: string;
};

export type ReceivedParcel = {
  parcelId: string;
  parcelCode: string;
  status: string;
  originStation?: ParcelStationSummary;
  destinationStation?: ParcelStationSummary;
  eta?: string | null;
  senderUserId?: string;
  recipientName: string;
  sizeCategory: string;
  createdAt: string;
  operatorId: string;
  tripId: string;
};

export type ParcelDetail = {
  parcelId: string;
  parcelCode: string;
  status: string;
  senderUserId?: string;
  recipientUserId?: string | null;
  recipientName: string;
  recipientPhone?: string;
  operatorId: string;
  tripId: string;
  dropoffStopId?: string | null;
  description?: string | null;
  sizeCategory: string;
  estimatedWeightKg: number;
  actualWeightKg?: number | null;
  deliveryMethod: string;
  depositAmount: number;
  originalDepositAmount?: number;
  discountAmount?: number;
  voucherCode?: string | null;
  voucherUsageId?: string | null;
  additionalAmount?: number;
  createdAt: string;
  updatedAt?: string | null;
  loadedAt?: string | null;
  unloadedAt?: string | null;
  deliveredPendingConfirmAt?: string | null;
  confirmedAt?: string | null;
  rejectedAt?: string | null;
  originStationName?: string;
  destinationStationName?: string;
  eta?: string | null;
  pendingActionType?: string | null;
  refundAmount?: number | null;
  routeName?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  pendingActionReason?: string | null;
  photoUrl?: string | null;
  estimatedChargeableWeightKg?: number | null;
  estimatedVolumeM3?: number | null;
  actualChargeableWeightKg?: number | null;
  actualVolumeM3?: number | null;
  estimatedSizeCategory?: string | null;
  actualSizeCategory?: string | null;
  estimatedTotalPriceVnd?: number | null;
  finalTotalPriceVnd?: number | null;
  depositPaidVnd?: number | null;
  depositRequiredVnd?: number | null;
  balancePaidVnd?: number | null;
  balanceRequiredVnd?: number | null;
  forfeitedDepositVnd?: number | null;
  refundDueVnd?: number | null;
  refundedAmountVnd?: number | null;
  finalPaymentDeadline?: string | null;
  latestCheckInAt?: string | null;
  loadCutoffAt?: string | null;
  sender?: {
    userId?: string | null;
    displayName?: string | null;
    phone?: string | null;
  } | null;
  recipient?: {
    userId?: string | null;
    displayName?: string | null;
    phone?: string | null;
  } | null;
  route?: {
    routeId?: string | null;
    routeName?: string | null;
    originStationName?: string | null;
    destinationStationName?: string | null;
  } | null;
  trip?: {
    tripId?: string | null;
    status?: string | null;
    departureAt?: string | null;
    arrivalEstimate?: string | null;
    vehicle?: {
      vehicleId?: string | null;
      licensePlate?: string | null;
    } | null;
  } | null;
};

export type ParcelDeliveryTokenRequest = {
  token: string;
};

export type ParcelDeliveryRejectRequest = ParcelDeliveryTokenRequest & {
  rejectionReason: string;
};

export type ParcelActionResult = {
  parcelId: string;
  parcelCode?: string;
  status: string;
  confirmedAt?: string;
  rejectedAt?: string;
  undoneAt?: string;
  canUndoUntil?: string;
  depositAmount?: number;
  paymentRedirectUrl?: string | null;
  tripId?: string;
  transferTargetTripId?: string;
  transferConfirmedAt?: string;
  returnReason?: string;
  returnedAt?: string;
  additionalAmount?: number;
};

export type OperatorParcelReportParams = {
  from?: string;
  to?: string;
};

export type OperatorParcelReportExportParams = OperatorParcelReportParams & {
  format?: "csv" | string;
};

export type OperatorParcelReportSummary = {
  operatorId: string;
  from?: string;
  to?: string;
  totalParcels: number;
  totalLoaded: number;
  totalDelivered: number;
  totalRejected: number;
  totalReturned: number;
  grossParcelRevenueVnd: number;
  parcelRefundsVnd: number;
  source?: string;
};

export type OperatorParcelListParams = Pick<
  PageParams,
  "page" | "pageSize" | "status"
> & {
  tripId?: string;
  pendingActionType?: string;
};

export type OperatorParcelListItem = {
  parcelId: string;
  parcelCode: string;
  status: string;
  pendingActionType?: string | null;
  pendingActionReason?: string | null;
  tripId?: string | null;
  tripCode?: string | null;
  routeName?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  sizeCategory?: string | null;
  estimatedWeightKg?: number | null;
  estimatedVolumeM3?: number | null;
  actualWeightKg?: number | null;
  actualSizeCategory?: string | null;
  actualChargeableWeightKg?: number | null;
  actualVolumeM3?: number | null;
  estimatedSizeCategory?: string | null;
  estimatedChargeableWeightKg?: number | null;
  chargeableWeightKg?: number | null;
  depositAmount?: number | null;
  balanceAmount?: number | null;
  refundAmount?: number | null;
  forfeitureAmount?: number | null;
  estimatedTotalPriceVnd?: number | null;
  finalTotalPriceVnd?: number | null;
  depositPaidVnd?: number | null;
  depositRequiredVnd?: number | null;
  balancePaidVnd?: number | null;
  balanceRequiredVnd?: number | null;
  discountAmount?: number | null;
  forfeitedDepositVnd?: number | null;
  refundDueVnd?: number | null;
  refundedAmountVnd?: number | null;
  finalPaymentDeadline?: string | null;
  latestCheckInAt?: string | null;
  loadCutoffAt?: string | null;
  operatorActionDeadline?: string | null;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  trip?: {
    tripId: string;
    status: string;
    departureAt: string | null;
    arrivalEstimate: string | null;
    vehicle?: { vehicleId: string; licensePlate: string } | null;
  } | null;
  route?: {
    routeId: string;
    routeName: string;
    originStationName: string;
    destinationStationName: string;
  } | null;
  sender?: {
    userId?: string | null;
    name?: string | null;
    displayName?: string | null;
    phone?: string | null;
  } | null;
  recipient?: {
    userId?: string | null;
    name?: string | null;
    displayName?: string | null;
    phone?: string | null;
  } | null;
};

export type OperatorParcelReviewRequest = {
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
};

export type OperatorParcelTransferRequest = {
  targetTripId: string;
  reason: string;
};

export type OperatorParcelReturnRequest = {
  returnReason: string;
};

export type OperatorParcelCancelRequest = {
  reason: string;
  refundChoice?: "FULL_REFUND" | "POLICY_REFUND" | "NO_REFUND" | string | null;
};

export type OperatorParcelConfirmDeliveryRequest = {
  note: string;
};

export type OperatorParcelReasonRequest = {
  reason: string;
};

export type OperatorParcelStatusRequest = {
  targetStatus: "RETURNED" | string;
  reason: string;
};

export type ParcelRouteFare = {
  routeId: string;
  sizeCategory: string;
  operatorId: string;
  priceVnd: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ParcelRouteFareParams = PageParams & {
  routeId?: string;
  sizeCategory?: ParcelSizeCategory;
};

export type CreateParcelRouteFareRequest = {
  routeId: string;
  sizeCategory: ParcelSizeCategory;
  priceVnd: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
};

export type UpdateParcelRouteFareRequest = {
  priceVnd?: number | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
};

export type AssistantParcelReweighRequest = {
  actualLengthCm: number;
  actualWidthCm: number;
  actualHeightCm: number;
  actualWeightKg: number;
  actualSizeCategory: ParcelSizeCategory;
  paymentMethod: PaymentMethod;
};

export type BatchParcelRouteFareRequest = {
  effectiveFrom: string;
  effectiveUntil?: string | null;
  items: Array<{
    sizeCategory: ParcelSizeCategory;
    priceVnd: number;
  }>;
};

export type BatchParcelRouteFareResult = {
  routeId: string;
  items: Array<{
    sizeCategory: ParcelSizeCategory;
    priceVnd: number;
    effectiveFrom: string;
    effectiveUntil: string | null;
    created: boolean;
  }>;
};

export type OperatorParcelStatsParams = {
  from?: string;
  to?: string;
  groupBy: "status" | "route";
  limit?: number;
};

export type OperatorParcelStats = {
  items: Array<{
    key?: string;
    count?: number;
    routeId?: string;
    routeName?: string;
    parcelCount?: number;
  }>;
  totalParcels: number;
};
export type RagRole =
  | "PASSENGER"
  | "SYSTEM_ADMIN"
  | "DRIVER"
  | "ASSISTANT"
  | "OPERATOR_STAFF"
  | "OPERATOR_ADMIN"
  | string;

export type RagDocumentAccessLevel = "PUBLIC" | "OPERATOR" | "ADMIN" | string;

export type RagDocumentCategory =
  | "CUSTOMER_SUPPORT"
  | "OPERATOR_POLICY"
  | "PLATFORM_ADMIN"
  | string;

export type RagDocumentType =
  | "FAQ"
  | "POLICY"
  | "SOP"
  | "GUIDE"
  | "TERMS"
  | string;

export type RagDocumentStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED"
  | string;

export type RagIngestStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | string;

export type RagChatRequest = {
  message: string;
  conversationId?: string | null;
  operatorId?: string | null;
};

export type RagChatTokenEvent = {
  type: "token";
  content: string;
};

export type RagChatDoneEvent = {
  type: "done";
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  citedChunkIds: string[];
};

export type RagChatErrorEvent = {
  type: "error";
  code: string;
  message: string;
};

export type RagChatEvent =
  | RagChatTokenEvent
  | RagChatDoneEvent
  | RagChatErrorEvent;

export type RagFeedbackRequest = {
  rating: -1 | 1;
  comment?: string | null;
};

export type RagFeedback = {
  id: string;
  messageId: string;
  conversationId?: string;
  rating: number;
  comment?: string | null;
  userId?: string;
  role?: RagRole;
  createdAt: string;
  updatedAt?: string;
};

export type RagDocumentUploadRequest = {
  file: File;
  title: string;
  description?: string;
  accessLevel: RagDocumentAccessLevel;
  operatorId?: string;
  category: RagDocumentCategory;
  documentType: RagDocumentType;
  audienceRoles?: string[];
  language?: "vi" | string;
};

export type RagDocument = {
  id: string;
  title: string;
  description?: string | null;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: string | number;
  fileType?: string;
  accessLevel: RagDocumentAccessLevel;
  operatorId?: string | null;
  category: RagDocumentCategory;
  documentType: RagDocumentType;
  audienceRoles?: string[];
  language?: string;
  status: RagDocumentStatus;
  ingestStatus?: RagIngestStatus;
  previewUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string | null;
};

export type RagDocumentParams = PageParams & {
  status?: RagDocumentStatus;
  accessLevel?: RagDocumentAccessLevel;
  category?: RagDocumentCategory;
  search?: string;
};

export type RagRuntimeConfig = {
  key: string;
  value: unknown;
  valueType?: string;
  editableGroup?: string;
  riskLevel?: "low" | "medium" | "high" | string;
  requiresRestart?: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type RagRuntimeConfigUpdateRequest = {
  value: unknown;
  reason: string;
};

export type RagRuntimeConfigHistory = {
  id: string;
  key: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  changedBy?: string | null;
  createdAt: string;
};

export type RagRuntimeConfigReloadResult = {
  reloaded: boolean;
};

export type TrackingLatestLocation = {
  tripId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDeg?: number;
  recordedAt: string;
};

export type TrackingLatestResponse = {
  latest: TrackingLatestLocation | null;
};

export type TrackingTrailPoint = TrackingLatestLocation;

export type TrackingTrailParams = {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "recordedAt" | string;
  sortDir?: "asc" | "desc";
};

export type TrackingDelayStatus = "DELAYED" | "ON_TIME" | "UNKNOWN";

export type TrackingEta = {
  tripId: string;
  stopId: string;
  stopName: string | null;
  etaMinutes: number;
  estimatedArrivalTime: string;
  distanceMeters: number;
  updatedAt: string;
  delayed: boolean | null;
  delayStatus: TrackingDelayStatus;
  delayMinutes: number | null;
};

export type TrackingEtaResponse = {
  eta: TrackingEta | null;
};

// Sáu status Trip operator (mục 9.4/9.5 contract); Zod phía Tracking so khớp
// case-sensitive nên không nới bằng | string cho query param.
export type OperatorTripStatus =
  | "SCHEDULED"
  | "BOARDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISRUPTED";

export type FleetLatestParams = {
  status?: OperatorTripStatus;
};

// speedKmh/headingDeg bị omit khỏi payload khi nguồn GPS không có.
export type FleetLatestItem = {
  tripId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDeg?: number;
  recordedAt: string;
  status: OperatorTripStatus;
};

export type FleetLatestResponse = {
  items: FleetLatestItem[];
  generatedAt: string;
};

export type ShuttleBookingGroup = {
  bookingId: string;
  passengerCount: number;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  distanceToStationMeters: number | null;
  roadDistanceMeters?: number | null;
  requestedAt: string;
};

export type ShuttleDirection = "INBOUND_TO_STATION" | "OUTBOUND_FROM_STATION";

export type ShuttleRequestGroup = {
  mainTripId: string;
  direction: ShuttleDirection;
  departureDateTime: string;
  hardCutoffAt: string;
  stationId: string;
  stationName: string;
  pendingPassengerCount: number;
  bookingGroups: ShuttleBookingGroup[];
  suggestedBookingOrder: string[];
};

export type CreateShuttleTripRequest = {
  mainTripId: string;
  direction: ShuttleDirection;
  driverUserId: string;
  vehicleId: string;
  scheduledDepartureTime: string;
  scheduledEndTime: string;
  orderedBookingIds: string[];
  notes?: string;
};

export type CreateShuttleTripResult = {
  shuttleTripId: string;
  mainTripId: string;
  assignedPassengerCount: number;
  remainingPassengerCount: number;
};

export type ShuttleTrackingLatest = {
  shuttleTripId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  heading?: number;
  recordedAt: string;
};

export type ShuttleTrackingEta = {
  shuttleTripId: string;
  nextPickupOrder: number;
  etaMinutes: number;
  estimatedArrivalTime: string;
  distanceMeters: number;
  updatedAt: string;
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
  fundingType?: string;
  operatorScope?: string;
  applicableOperatorIds?: string[];
  quantity?: number;
  totalUsageLimit?: number;
  usedCount?: number;
  expiryDate?: string;
  validFrom?: string;
  validUntil?: string;
  active?: boolean;
  isActive?: boolean;
  type?: string;
  value?: number;
  minOrderAmount?: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  perUserLimit?: number;
  maxUsagePerUser?: number;
  newUserOnly?: boolean;
  applicablePaymentMethods?: string[];
  applicableServices?: string[];
  ownerOperatorId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateAdminVoucherRequest = {
  code?: string;
  name: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  totalUsageLimit: number;
  perUserLimit: number;
  validFrom: string;
  validUntil: string;
  newUserOnly: boolean;
  applicablePaymentMethods: PaymentMethod[];
  applicableServices: VoucherService[];
  applicableRouteIds: string[] | null;
  applicableOperatorIds: string[] | null;
  fundingType: string;
};

export type UpdateAdminVoucherRequest = Partial<
  Omit<
    CreateAdminVoucherRequest,
    "code" | "type" | "fundingType" | "applicableOperatorIds"
  >
>;

export type AdminVoucherParams = PageParams & {
  ownerOperatorId?: string;
  fundingType?: string;
  isActive?: boolean;
};

export type AdminCampaign = {
  id: string;
  name: string;
  description?: string;
  ownerOperatorId?: string | null;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  createdAt?: string;
};

export type AdminCampaignRequest = {
  name: string;
  description?: string;
  ownerOperatorId?: string | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  voucherIds: string[];
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
  groupBy?: string;
  operatorId?: string;
  routeId?: string;
  status?: string;
};

export type OperatorBookingParams = {
  status?: string;
  tripId?: string;
  date?: string;
  passengerPhone?: string;
  bookingCode?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export type OperatorBookingTrip = {
  routeName?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  departureAt?: string | null;
  currentDepartureAt?: string | null;
};

export type OperatorBookingListItem = {
  id: string;
  bookingCode?: string | null;
  tripId: string;
  status?: string | null;
  trip: OperatorBookingTrip;
  seatCount: number;
  totalAmount: number;
  createdAt: string;
  buyer?: OperatorBookingBuyer | null;
};

export type OperatorBookingSeat = {
  passengerRecordId: string;
  ticketId: string;
  ticketCode?: string | null;
  seatNumber?: string | null;
  ticketStatus?: string | null;
  boardingStatus?: string | null;
};

export type OperatorBookingStatusTimeline = {
  status?: string | null;
  occurredAt: string;
  reasonCode?: string | null;
};

export type OperatorBookingDetail = {
  id: string;
  bookingCode?: string | null;
  buyerUserId: string;
  tripId: string;
  status?: string | null;
  trip: OperatorBookingTrip;
  seatCount: number;
  baseFare: number;
  discountAmount: number;
  totalAmount: number;
  pickupStationId?: string | null;
  pickupStopId?: string | null;
  dropoffStationId?: string | null;
  dropoffStopId?: string | null;
  bookingGroupId?: string | null;
  tripDirection?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  seats?: OperatorBookingSeat[] | null;
  statusTimeline?: OperatorBookingStatusTimeline[] | null;
  buyer?: OperatorBookingBuyer | null;
};

export type BookingStatsItem = {
  operatorId?: string;
  operatorName?: string;
  date?: string;
  totalBookings: number;
  totalCancellations?: number;
  totalNoShows?: number;
  totalPartialNoShows?: number;
  totalCompleted?: number;
};

export type BookingStatsAggregate = {
  items: BookingStatsItem[];
  totalBookings?: number;
  totalCancellations?: number;
  totalNoShows?: number;
  totalPartialNoShows?: number;
  totalCompleted?: number;
  totalPassengers?: number;
  cancelledBookings?: number;
  pendingBookings?: number;
  confirmedBookings?: number;
  byStatus?: Record<string, number>;
};

export type OperatorBookingBuyer = {
  userId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type MetricValue = {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: "UP" | "DOWN" | "FLAT";
};

export type ReportPeriod = {
  from: string;
  to: string;
  timezone: string;
};

export type AdminDashboardSummary = {
  period: ReportPeriod;
  totalProjectRevenueVnd: MetricValue;
  netTransportRevenueVnd: MetricValue;
  netTicketRevenueVnd: MetricValue;
  netParcelRevenueVnd: MetricValue;
  subscriptionRevenueVnd: MetricValue;
  activeOperators: MetricValue;
  activeUsers: MetricValue;
  bookings: MetricValue;
  userDistribution: Array<{ role: string; count: number }>;
  operatorStatusDistribution: Array<{
    status: string;
    count: number;
    percent: number;
  }>;
};

export type AdminRevenueAnalytics = {
  period: ReportPeriod;
  summary: {
    revenue: {
      totalProjectRevenueVnd: MetricValue;
      netTransportRevenueVnd: MetricValue;
      netTicketRevenueVnd: MetricValue;
      netParcelRevenueVnd: MetricValue;
      subscriptionRevenueVnd: MetricValue;
    };
    settlement: {
      paidToOperatorsVnd: MetricValue;
    };
  };
  monthly: Array<{
    month: string;
    revenue: {
      totalProjectRevenueVnd: number;
      netTransportRevenueVnd: number;
      netTicketRevenueVnd: number;
      netParcelRevenueVnd: number;
      subscriptionRevenueVnd: number;
    };
    settlement: {
      paidToOperatorsVnd: number;
    };

  }>;
  topOperators: Array<{
    rank: number;
    operatorId: string;
    operatorName: string;
    logoUrl: string | null;
    revenueVnd: number;
    vehicleCount: number;
  }>;
};

export type OperatorRevenueAnalytics = {
  period: ReportPeriod & { month?: string | null; year?: number | null; groupBy: "month" };
  summary: {
    netRevenueVnd: MetricValue;
    netTicketRevenueVnd: MetricValue;
    netParcelRevenueVnd: MetricValue;
    averageNetRevenuePerTripVnd: MetricValue;
  };
  monthly: Array<{
    month: string;
    netRevenueVnd: number;
    netTicketRevenueVnd: number;
    netParcelRevenueVnd: number;
    tripCount: number;
  }>;
  routePerformance?: Array<{
    routeId: string;
    routeName: string;
    originName: string;
    destinationName: string;
    tripCount: number;
    completedTripCount: number;
    bookingCount: number;
    parcelCount: number;
    netRevenueVnd: number;
    completionRatePercent: number;
  }>;
};

export type OperatorTripListParams = PageParams & {
  from?: string;
  to?: string;
};

export type OperatorTripListItem = {
  tripId: string;
  status: string;
  route: {
    routeId: string;
    name: string;
    originName: string;
    destinationName: string;
  };
  vehicle: { vehicleId: string; licensePlate: string; status: string };
  driver: { userId: string; displayName: string; phone: string | null } | null;
  assistant: {
    userId: string;
    displayName: string;
    phone: string | null;
  } | null;
  departureAt: string;
  arrivalEstimate: string | null;
  canSubstituteVehicle: boolean;
};

export type PolicyAudience = "FOR_OPERATOR" | "FOR_USER";

export type PolicyItem = {
  id: string;
  operatorId?: string | null;
  title: string;
  description: string;
  content: string;
  policyType: PolicyAudience;
  category: string;
  version: number;
  active: boolean;
  createdBy?: { userId: string; displayName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type PolicyListParams = PageParams & {
  policyType?: PolicyAudience;
  category?: string;
  active?: boolean;
};

export type CreatePolicyRequest = Pick<
  PolicyItem,
  "title" | "description" | "content" | "policyType" | "category" | "active"
>;

export type UpdatePolicyRequest = Partial<CreatePolicyRequest> & {
  version: number;
};
export type AlternativeRoute = {
  id: string;
  routeId: string;
  name: string;
  description: string;
  destinationStationId: string;
  pathPolyline?: string | null;
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

export type RouteChangeProposalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED"
  | "EXPIRED";
export type RouteChangeProposalType = "EXISTING" | "CUSTOM";
export type RouteChangeProposalSnapshot = {
  name: string;
  description: string | null;
  destinationStationId: string;
  totalDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  pathPolyline: string | null;
  stops: Array<{
    stopId: string;
    orderIndex: number;
    estimatedDurationFromOriginMinutes: number;
    distanceFromOriginKm: number;
  }>;
};
export type RouteChangeProposal = {
  id: string;
  tripId: string;
  operatorId: string;
  proposedByUserId: string;
  type: RouteChangeProposalType;
  status: RouteChangeProposalStatus;
  sourceAlternativeRouteId: string | null;
  sourceUpdatedAt: string | null;
  incidentId: string | null;
  reason: string;
  snapshot: RouteChangeProposalSnapshot;
  decidedByUserId: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  resolutionCode: string | null;
  supersededByProposalId: string | null;
  approvedAlternativeRouteId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type OperatorRouteChangeProposalParams = PageParams & {
  tripId?: string;
  status?: RouteChangeProposalStatus;
  type?: RouteChangeProposalType;
};
export type RouteChangeAffectedBooking = {
  bookingId: string;
  candidateStops: Array<{
    stopId: string | null;
    stationId: string | null;
    stationName: string;
    sequence: number;
    estimatedArrivalAt: string;
  }>;
};
export type RouteChangeResult = {
  tripId: string;
  status: string;
  alternativeRouteId: string;
  affectedBookings: RouteChangeAffectedBooking[];
};
export type ApproveRouteChangeProposalResult = {
  proposal: RouteChangeProposal;
  routeChange: RouteChangeResult;
};
export type RejectRouteChangeProposalRequest = { reason?: string | null };
export type DirectRouteChangeRequest = { alternativeRouteId: string };
export type AdminOperatorDetail = AdminOperator & {
  address: {
    street: string | null;
    ward: string | null;
    district: string | null;
    province: string | null;
  } | null;
  representativeName: string | null;
  representativePhone: string | null;
  registrationStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  isActive: boolean;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  cancellationPolicy: Array<{
    hoursBeforeDeparture: number;
    feePercent: number;
  }> | null;
  parcelNoShowPolicy: {
    noShowFeePercent: number;
    additionalPaymentTimeoutMinutes: number;
  };
  luggagePolicy: { defaultLuggageKgPerSeat: number };
  updatedAt: string;
};
export type FareSurchargeSetting = { isEnabled: boolean };
export type FareSurchargeStatus =
  | "DISABLED"
  | "UPCOMING"
  | "EXPIRED"
  | "APPLYING";
export type FareSurchargePeriod = {
  periodId: string;
  name: string;
  startDate: string;
  endDate: string;
  surchargePercent: number;
  isActive: boolean;
  status: FareSurchargeStatus;
  createdAt: string;
  updatedAt: string;
};
export type FareSurchargePeriodRequest = {
  name: string;
  startDate: string;
  endDate: string;
  surchargePercent: number;
  isActive?: boolean | null;
};
export type FareSurchargePeriodPatch = Partial<FareSurchargePeriodRequest>;
export type VehicleSeatType =
  | "STANDARD"
  | "SLEEPER_LOWER"
  | "SLEEPER_UPPER"
  | "VIP"
  | "DRIVER_AREA";

export type VehicleSeat = {
  seatNumber: string;
  row: number;
  col: number;
  deck?: number;
  type: VehicleSeatType;
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
  vehicleId?: string;
  operatorId: string;
  licensePlate: string;
  vehicleTypeId: string;
  vehicleTypeName?: string;
  vehicleTypeCode?: string;
  totalSeats: number;
  maxCargoWeightKg: number;
  maxCargoVolumeM3?: number;
  status: string;
  isActive?: boolean;
  imageUrls?: string[];
  decks?: VehicleDeck[];
  seatLayoutJson?: SeatLayoutJson | string;
  createdAt?: string;
  updatedAt?: string;
};

export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "OFF_DUTY" | "RETIRED";

export type OperatorVehicleCreateRequest = {
  vehicleTypeId: string;
  licensePlate: string;
  totalSeats: number;
  maxCargoWeightKg: number;
  maxCargoVolumeM3: number;
  seatLayoutJson: SeatLayoutJson;
  imageUrls: string[];
};

export type OperatorVehicleUpdateRequest = {
  vehicleTypeId?: string;
  licensePlate?: string;
  seatLayoutJson?: SeatLayoutJson | null;
  totalSeats?: number;
  maxCargoWeightKg?: number | null;
  maxCargoVolumeM3?: number | null;
  imageUrls?: string[] | null;
  status?: VehicleStatus;
  isActive?: boolean;
};

export type TripSeatMapSeat = {
  seatNumber: string;
  status: string;
  type: string;
  row: number;
  col: number;
  deck: number;
};

export type TripSeatMap = {
  tripId: string;
  vehicleType: string;
  seats: TripSeatMapSeat[];
};

export type FirebaseUploadPurpose =
  | "VEHICLE_IMAGE"
  | "OPERATOR_LOGO"
  | "PARCEL_PHOTO"
  | "INCIDENT_PHOTO"
  | "USER_AVATAR";

export type FirebaseCustomToken = {
  token: string;
  purpose: FirebaseUploadPurpose;
  uploadPath: string;
};

export type UserAvatarResult = {
  userId: string;
  avatarUrl: string | null;
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
  departureDateTime?: string;
  availableSeats?: number;
  allowAlongRoutePickup?: boolean;
  allowAlongRouteDropoff?: boolean;
  baseFare: number;
  surchargePercent?: number;
  surchargeAmount?: number;
  effectiveFare?: number;
  surchargePeriodId?: string | null;
  surchargePeriodName?: string | null;
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
  reservedVolumeM3?: number;
  loadedWeightKg?: number;
  loadedVolumeM3?: number;
  maxCargoWeightKg: number;
  maxCargoVolumeM3?: number;
  availableWeightKg?: number;
  availableVolumeM3?: number;
  percentFull?: number;
  // Legacy aliases kept for existing operations UI consumers.
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
  driverId?: string;
  driverUserId?: string;
  assistantId?: string | null;
  assistantUserId?: string | null;
  departureTime: string;
  effectiveFrom: string;
  validFrom?: string;
  effectiveUntil?: string | null;
  validUntil?: string | null;
  daysOfWeek?: number[];
  dayOfWeek?: number[];
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  route?: OperatorRoute;
  vehicle?: OperatorVehicle;
  driver?: Pick<
    OperatorUser,
    "id" | "displayName" | "role" | "operatorId" | "status"
  > & {
    avatarUrl?: string;
  };
  assistant?: Pick<
    OperatorUser,
    "id" | "displayName" | "role" | "operatorId" | "status"
  > & {
    avatarUrl?: string;
  };
};

export type OperatorDriverScheduleRequest = {
  routeId: string;
  vehicleId?: string | null;
  driverUserId: string;
  assistantUserId?: string | null;
  departureTime: string;
  validFrom: string;
  validUntil?: string | null;
  dayOfWeek: number[];
  isActive: boolean;
};

export type OperatorDriverScheduleParams = PageParams & {
  routeId?: string;
  driverUserId?: string;
  isActive?: boolean;
};

export type DriverScheduleItem = OperatorDriverSchedule & {
  routeName?: string;
  vehiclePlate?: string;
  driverName?: string;
  assistantName?: string;
};

export type RouteGeometryRequest = {
  pathPolyline: string | null;
  // Chỉ dùng khi pathPolyline=null: set metrics thủ công rồi clear geometry
  // (mục 8.5); có polyline thì server tự tính và bỏ qua manual metrics.
  manualMetrics?: RouteManualMetrics | null;
};

// Phân biệt field vắng mặt (giữ nguyên) vs null (clear) theo contract 9.1:
// assistantUserId/vehicleId/validUntil nhận null để clear, các field còn lại
// không được null nếu xuất hiện.
export type OperatorDriverSchedulePatch = {
  departureTime?: string;
  dayOfWeek?: number[];
  driverUserId?: string;
  assistantUserId?: string | null;
  vehicleId?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
};

export type DriverScheduleApplyTo = "FUTURE_ONLY" | "ALL_PENDING";

export type SubstituteVehicleRequest = {
  replacementVehicleId: string;
  estimatedRecoveryDepartureAt: string;
  reason?: string | null;
  notifyPassengers: boolean;
  replacementCrew: {
    driverId: string;
    assistantId?: string | null;
  };
};

export type TripDisruptionRequest = {
  reason: string;
};

export type TripOperationResult = {
  tripId?: string;
  substitutionId?: string;
  oldTripId?: string;
  oldTripStatus?: string | null;
  newTripId?: string;
  newTripStatus?: string | null;
  newTripDepartureDateTime?: string;
  transferStatus?: string | null;
  affectedBookingCount?: number;
  affectedPassengerCount?: number;
  pendingSeatAssignmentCount?: number;
  stopId?: string;
  status?: string;
  vehicleId?: string;
  actualArrivalTime?: string;
  message?: string;
};

export type ParcelAvailabilityParams = {
  tripId?: string;
  routeId?: string;
  fromStopId?: string;
  toStopId?: string;
  departureDate?: string;
  weightKg?: number;
  volumeM3?: number;
};

export type ParcelAvailability = {
  tripId: string;
  routeId?: string;
  isAvailable: boolean;
  remainingWeightKg?: number;
  remainingVolumeM3?: number;
  reason?: string;
};

export type CargoRemeasureRequest = {
  parcelId: string;
  weightKg: number;
  volumeM3: number;
  note?: string;
};

export type VerifyEmailRequest = {
  email: string;
  code: string;
  purpose: string;
};

export type ResendVerificationEmailRequest = Pick<
  VerifyEmailRequest,
  "email" | "purpose"
>;

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

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResult = {
  email: string;
  otpTtlMinutes: number;
};

export type ResetPasswordRequest = {
  email: string;
  code: string;
  newPassword: string;
};

export type ResetPasswordResult = {
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

export function resendVerificationEmail(
  request: ResendVerificationEmailRequest,
) {
  return apiRequest<unknown>("/v1/auth/resend-verification-email", {
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

export function requestForgotPassword(request: ForgotPasswordRequest) {
  return apiRequest<ForgotPasswordResult>("/v1/auth/forgot-password", {
    method: "POST",
    body: request,
    authenticated: false,
  });
}

export function resetPassword(request: ResetPasswordRequest) {
  return apiRequest<ResetPasswordResult>("/v1/auth/reset-password", {
    method: "POST",
    body: request,
    authenticated: false,
  });
}

export function getAdminOperatorDetail(operatorId: string) {
  return apiRequest<AdminOperatorDetail>(`/v1/admin/operators/${operatorId}`);
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

export function reactivateAdminOperator(operatorId: string) {
  return apiRequest<AdminOperatorActionResult>(`/v1/admin/operators/${operatorId}/reactivate`, {
    method: "POST",
  });
}

export function getAdminOperatorUsers(params: AdminUserParams = {}) {
  return apiRequest<PagedResult<AdminUser>>(
    `/v1/admin/operator-users${buildQuery(params)}`,
  );
}

export async function getAdminLocations(
  params: Omit<PageParams, "status"> & { isActive?: boolean } = {},
) {
  const response = await apiRequest<
    PagedResult<AdminLocation> | AdminLocation[]
  >(`/v1/admin/locations${buildQuery(params)}`);

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

export function createAdminLocation(request: AdminLocationRequest) {
  return apiRequest<AdminLocation>("/v1/admin/locations", {
    method: "POST",
    body: request,
  });
}

export function updateAdminLocation(
  id: string,
  request: UpdateAdminLocationRequest,
) {
  return apiRequest<AdminLocation>(`/v1/admin/locations/${id}`, {
    method: "PATCH",
    body: request,
  });
}

export function deleteAdminLocation(id: string) {
  return apiRequest<{ id?: string; deletedAt?: string; message?: string }>(
    `/v1/admin/locations/${id}`,
    { method: "DELETE" },
  );
}

export function createAdminUser(request: CreateAdminUserRequest) {
  return apiRequest<AdminUser>("/v1/admin/users", {
    method: "POST",
    body: request,
  });
}

type AdminUserApiItem = Omit<AdminUser, "userId"> & {
  id: string;
  userId?: string;
};

export async function getAdminUsers(params: AdminUserParams = {}) {
  const result = await apiRequest<PagedResult<AdminUserApiItem>>(
    `/v1/admin/users${buildQuery(params)}`,
  );

  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      userId: item.userId ?? item.id,
    })),
  } satisfies PagedResult<AdminUser>;
}

export function lockAdminUser(
  userId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<AdminUserActionResult>(`/v1/admin/users/${userId}/lock`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function unlockAdminUser(
  userId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<AdminUserActionResult>(`/v1/admin/users/${userId}/unlock`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getAdminActivityLogs(params: AdminActivityLogParams = {}) {
  return apiRequest<PagedResult<AdminActivityLog>>(
    `/v1/admin/activity-logs${buildQuery(params)}`,
  );
}

export function getAdminPlatformReport(params: AdminPlatformReportParams) {
  return apiRequest<AdminPlatformReport>(
    `/v1/admin/reports/platform${buildQuery(params)}`,
  );
}

export function getAdminOutboxDlq(params: AdminOutboxDlqParams = {}) {
  return apiRequest<AdminOutboxDlqPage>(
    `/v1/admin/outbox/dlq${buildQuery(params)}`,
  );
}

export function exportOperatorReport(
  reportType: OperatorReportExportType,
  params: OperatorReportExportParams = {},
) {
  return apiBlobRequest(
    `/v1/operator/reports/${reportType}/export${buildQuery(params)}`,
    {
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    },
  );
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

export async function getOperatorUsers(
  params: AdminUserParams = {},
  signal?: AbortSignal,
) {
  const response = await apiRequest<PagedResult<OperatorUser> | OperatorUser[]>(
    `/v1/operator/users${buildQuery(params)}`,
    { signal },
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

export function getOperatorSubscription() {
  return apiRequest<OperatorSubscriptionDetail>("/v1/operator/subscription", {
    cache: "no-store",
  });
}

export function getOperatorSubscriptionPlans() {
  return apiRequest<SubscriptionPlan[]>("/v1/operator/subscription-plans");
}

export function upgradeOperatorSubscription(
  request: SubscriptionUpgradeRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<SubscriptionUpgradeResult>(
    "/v1/operator/subscription/upgrade",
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function retryOperatorSubscriptionPayment(
  upgradeAttemptId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<SubscriptionRetryPaymentResult>(
    `/v1/operator/subscription/upgrade/${upgradeAttemptId}/retry-payment`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getOperatorWallet() {
  return apiRequest<OperatorWallet>("/v1/operator/wallet");
}

export function getOperatorWalletTransactions(
  params: WalletTransactionParams = {},
) {
  return apiRequest<PagedResult<WalletTransaction>>(
    `/v1/operator/wallet/transactions${buildQuery(params)}`,
  );
}

export function getOperatorTripSettlements(
  params: OperatorTripSettlementParams = {},
) {
  return apiRequest<PagedResult<TripSettlement>>(
    `/v1/operator/trip-settlements${buildQuery(params)}`,
  );
}

export function getOperatorLedger(params: OperatorLedgerParams = {}) {
  return apiRequest<PagedResult<OperatorLedgerEntry>>(
    `/v1/operator/ledger${buildQuery(params)}`,
  );
}

export function getOperatorInvoices(params: OperatorInvoiceParams = {}) {
  return apiRequest<PagedResult<OperatorInvoice>>(
    `/v1/operator/invoices${buildQuery(params)}`,
  );
}

export function getOperatorInvoice(invoiceId: string) {
  return apiRequest<OperatorInvoiceDetail>(
    `/v1/operator/invoices/${invoiceId}`,
  );
}

export function downloadOperatorInvoice(invoiceId: string) {
  return apiRequest<InvoiceDownload>(
    `/v1/operator/invoices/${invoiceId}/download`,
  );
}

export function getAdminTripSettlements(
  params: AdminTripSettlementParams = {},
) {
  return apiRequest<PagedResult<TripSettlement>>(
    `/v1/admin/trip-settlements${buildQuery(params)}`,
  );
}

export function settleAdminTripSettlement(
  settlementId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<TripSettlement>(
    `/v1/admin/trip-settlements/${settlementId}/settle`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getAdminPlatformWallet() {
  return apiRequest<PlatformWallet>("/v1/admin/platform-wallet");
}

export function getAdminPlatformWalletTransactions(
  params: WalletTransactionParams = {},
) {
  return apiRequest<PagedResult<WalletTransaction>>(
    `/v1/admin/platform-wallet/transactions${buildQuery(params)}`,
  );
}

export function adjustAdminPlatformWallet(
  request: WalletAdjustmentRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<WalletTransaction>("/v1/admin/platform-wallet/adjust", {
    method: "POST",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function adjustAdminOperatorWallet(
  operatorId: string,
  request: WalletAdjustmentRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<WalletTransaction>(
    `/v1/admin/operators/${operatorId}/wallet/adjust`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function retryAdminInvoice(
  invoiceId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<InvoiceRetryResult>(
    `/v1/admin/invoices/${invoiceId}/retry`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getAdminSubscriptionPlans(
  params: AdminSubscriptionPlanParams = {},
) {
  return apiRequest<SubscriptionPlan[]>(
    `/v1/admin/subscription-plans${buildQuery(params)}`,
  );
}

export function createAdminSubscriptionPlan(
  request: AdminSubscriptionPlanRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<SubscriptionPlan>("/v1/admin/subscription-plans", {
    method: "POST",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function updateAdminSubscriptionPlan(
  planId: string,
  request: AdminSubscriptionPlanRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<SubscriptionPlan>(
    `/v1/admin/subscription-plans/${planId}`,
    {
      method: "PATCH",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getInternalUser(userId: string) {
  return apiRequest<AdminUser>(`/internal/v1/users/${userId}`);
}

export function searchStations(params: StationSearchParams) {
  return apiRequest<Station[]>(`/v1/stations/search${buildQuery(params)}`);
}

export function getPublicLocations(params: StationSearchParams = {}) {
  return apiRequest<AdminLocation[]>(`/v1/locations${buildQuery(params)}`, {
    authenticated: false,
  });
}

export function getAdminStations(params: AdminStationParams = {}) {
  return apiRequest<PagedResult<AdminStation>>(
    `/v1/admin/stations${buildQuery(params)}`,
  );
}

export function getAdminStation(id: string) {
  return apiRequest<AdminStation>(`/v1/admin/stations/${id}`);
}

export function updateAdminStation(
  id: string,
  request: AdminStationRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<AdminStation>(`/v1/admin/stations/${id}`, {
    method: "PATCH",
    body: request,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function mergeAdminStations(
  primaryStationId: string,
  duplicateId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<AdminStationMergeResult>(
    `/v1/admin/stations/${primaryStationId}/merge`,
    {
      method: "POST",
      body: { duplicateId },
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function deleteAdminStation(
  id: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<{ id: string; deleted: boolean }>(
    `/v1/admin/stations/${id}`,
    {
      method: "DELETE",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function getAdminStops(params: AdminStopParams = {}) {
  return apiRequest<PagedResult<OperatorStop>>(
    `/v1/admin/stops${buildQuery(params)}`,
  );
}

export function getAdminStop(id: string) {
  return apiRequest<OperatorStop>(`/v1/admin/stops/${id}`);
}

export function updateAdminStop(
  id: string,
  request: AdminStopRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<OperatorStop>(`/v1/admin/stops/${id}`, {
    method: "PATCH",
    body: request,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function deleteAdminStop(
  id: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<{ id: string; deleted: boolean }>(`/v1/admin/stops/${id}`, {
    method: "DELETE",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function createOperatorStation(request: OperatorStationRequest) {
  return apiRequest<OperatorStation>("/v1/operator/stations", {
    method: "POST",
    body: request,
  });
}

export function getOperatorStations(params: PageParams = {}) {
  return apiRequest<PagedResult<OperatorStation>>(
    `/v1/operator/stations${buildQuery(params)}`,
  );
}

export function updateOperatorStation(
  id: string,
  request: OperatorStationRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<OperatorStation>(`/v1/operator/stations/${id}`, {
    method: "PATCH",
    body: request,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function deleteOperatorStation(
  id: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<{ id: string; deleted: boolean }>(
    `/v1/operator/stations/${id}`,
    {
      method: "DELETE",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
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

export function deleteOperatorStop(
  id: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<{ id: string; deleted: boolean }>(
    `/v1/operator/stops/${id}`,
    {
      method: "DELETE",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
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

export function updateOperatorRouteGeometry(
  routeId: string,
  request: RouteGeometryRequest,
) {
  return apiRequest<OperatorRoute>(`/v1/operator/routes/${routeId}/geometry`, {
    method: "PUT",
    body: request,
  });
}

export function createOperatorRouteFull(request: OperatorRouteFullRequest) {
  return apiRequest<OperatorRouteDetail>("/v1/operator/routes/full", {
    method: "POST",
    body: request,
  });
}

export function updateOperatorRouteFull(
  id: string,
  request: OperatorRouteFullRequest,
) {
  return apiRequest<OperatorRouteDetail>(`/v1/operator/routes/${id}/full`, {
    method: "PUT",
    body: request,
  });
}

export function getOperatorRouteStopMetrics(routeId: string) {
  return apiRequest<OperatorRouteStopMetric[]>(
    `/v1/operator/routes/${routeId}/stop-metrics`,
  );
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

export function getRouteFareTemplates(
  routeId: string,
  params: PageParams = {},
) {
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

export function getOperatorDriverSchedules(
  params: OperatorDriverScheduleParams = {},
) {
  return apiRequest<PagedResult<OperatorDriverSchedule>>(
    `/v1/operator/driver-schedules${buildQuery(params)}`,
  );
}

export function activateOperatorDriverSchedule(id: string) {
  return apiRequest<OperatorDriverSchedule>(
    `/v1/operator/driver-schedules/${id}/activate`,
    { method: "PATCH" },
  );
}

export function updateOperatorDriverSchedule(
  id: string,
  applyTo: DriverScheduleApplyTo,
  request: OperatorDriverSchedulePatch,
) {
  return apiRequest<OperatorDriverSchedule>(
    `/v1/operator/driver-schedules/${id}${buildQuery({ applyTo })}`,
    { method: "PATCH", body: request },
  );
}

// BE đánh dấu SkipIdempotency cho deactivate (mục 4.4 contract); path nằm trong
// exempt list của src/api/idempotency.ts nên không có Idempotency-Key.
export function deactivateOperatorDriverSchedule(id: string) {
  return apiRequest<OperatorDriverSchedule>(
    `/v1/operator/driver-schedules/${id}/deactivate`,
    { method: "PATCH" },
  );
}

export function deleteOperatorDriverSchedule(id: string) {
  return apiRequest<{ deleted: boolean }>(
    `/v1/operator/driver-schedules/${id}`,
    { method: "DELETE" },
  );
}

export function getDriverMeSchedule(params: PageParams = {}) {
  return apiRequest<PagedResult<DriverScheduleItem>>(
    `/v1/driver/me/schedule${buildQuery(params)}`,
  );
}

export function getOperatorBookings(params: OperatorBookingParams = {}) {
  return apiRequest<PagedResult<OperatorBookingListItem>>(
    `/v1/operator/bookings${buildQuery(params)}`,
  );
}

export function getOperatorBooking(id: string) {
  return apiRequest<OperatorBookingDetail>(`/v1/operator/bookings/${id}`);
}

export function getOperatorBookingStats(params: BookingStatsParams = {}) {
  return apiRequest<BookingStatsAggregate>(
    `/v1/operator/booking-stats${buildQuery(params)}`,
  );
}

export function getPromotions(service: VoucherService) {
  return apiRequest<PromotionVoucher[]>(
    `/v1/promotions${buildQuery({ service })}`,
    { authenticated: false },
  );
}

export function getAvailableVouchers(params: AvailableVoucherParams) {
  return apiRequest<AvailableVoucher[]>(
    `/v1/vouchers/available${buildQuery(params)}`,
  );
}

export function getParcelAvailableVouchers(
  params: Pick<
    AvailableVoucherParams,
    "tripId" | "paymentMethod" | "orderAmount"
  > & {
    sizeCategory: string;
  },
) {
  return apiRequest<AvailableVoucher[]>(
    `/v1/parcels/vouchers/available${buildQuery(params)}`,
  );
}

export function getParcelAvailableTrips(params: ParcelAvailableTripsParams) {
  return apiRequest<PagedResult<ParcelAvailableTrip>>(
    `/v1/parcels/available-trips${buildQuery(params)}`,
  );
}

export function createParcel(
  request: CreateParcelRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<CreateParcelResult>("/v1/parcels", {
    method: "POST",
    body: request,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function getReceivedParcels(params: PageParams = {}) {
  return apiRequest<PagedResult<ReceivedParcel>>(
    `/v1/parcels/received${buildQuery(params)}`,
  );
}

export function getParcelDetail(parcelId: string) {
  return apiRequest<ParcelDetail>(`/v1/parcels/${parcelId}`);
}

export function confirmParcelDeliveryByToken(
  request: ParcelDeliveryTokenRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>("/v1/parcels/delivery/confirm", {
    method: "POST",
    body: request,
    authenticated: false,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function rejectParcelDeliveryByToken(
  request: ParcelDeliveryRejectRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>("/v1/parcels/delivery/reject", {
    method: "POST",
    body: request,
    authenticated: false,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function undoRejectParcelDeliveryByToken(
  request: ParcelDeliveryTokenRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>("/v1/parcels/delivery/undo-reject", {
    method: "POST",
    body: request,
    authenticated: false,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function getOperatorParcelReportSummary(
  params: OperatorParcelReportParams = {},
) {
  return apiRequest<OperatorParcelReportSummary>(
    `/v1/operator/parcels/reports/summary${buildQuery(params)}`,
  );
}

export function getOperatorParcels(params: OperatorParcelListParams = {}) {
  return apiRequest<PagedResult<OperatorParcelListItem>>(
    `/v1/operator/parcels${buildQuery(params)}`,
  );
}
export function exportOperatorParcelReport(
  params: OperatorParcelReportExportParams = {},
) {
  return apiBlobRequest(
    `/v1/operator/parcels/reports/export${buildQuery({
      format: "csv",
      ...params,
    })}`,
    {
      headers: {
        Accept: "text/csv",
      },
    },
  );
}

export function reviewOperatorParcel(
  parcelId: string,
  request: OperatorParcelReviewRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/review`,
    {
      method: "PATCH",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function confirmOperatorParcelRefund(
  parcelId: string,
  request: OperatorParcelReasonRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/confirm-refund`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function overrideOperatorParcelCapacity(
  parcelId: string,
  request: OperatorParcelReasonRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/override-capacity`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function requestOperatorParcelTransfer(
  parcelId: string,
  request: OperatorParcelTransferRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/request-transfer`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function returnOperatorParcel(
  parcelId: string,
  request: OperatorParcelReturnRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/return`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function cancelOperatorParcel(
  parcelId: string,
  request: OperatorParcelCancelRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/cancel`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function confirmOperatorParcelDelivery(
  parcelId: string,
  request: OperatorParcelConfirmDeliveryRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/confirm-delivery`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function updateOperatorParcelStatus(
  parcelId: string,
  request: OperatorParcelStatusRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/operator/parcels/${parcelId}/status`,
    {
      method: "PATCH",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function createOperatorParcelRouteFare(
  request: CreateParcelRouteFareRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelRouteFare>("/v1/operator/parcel-route-fares", {
    method: "POST",
    body: request,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function getOperatorParcelRouteFares(
  params: ParcelRouteFareParams = {},
) {
  return apiRequest<PagedResult<ParcelRouteFare>>(
    `/v1/operator/parcel-route-fares${buildQuery(params)}`,
  );
}

export function updateOperatorParcelRouteFare(
  routeId: string,
  sizeCategory: ParcelSizeCategory,
  request: UpdateParcelRouteFareRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelRouteFare>(
    `/v1/operator/parcel-route-fares/${routeId}/${sizeCategory}`,
    {
      method: "PATCH",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function reweighAssistantParcel(
  parcelId: string,
  request: AssistantParcelReweighRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/assistant/parcels/${parcelId}/reweigh`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function confirmAssistantParcelDelivery(
  parcelId: string,
  request: OperatorParcelConfirmDeliveryRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/assistant/parcels/${parcelId}/confirm-delivery`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function unloadAssistantParcel(
  parcelId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelActionResult>(
    `/v1/assistant/parcels/${parcelId}/unload`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
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
    headers: {
      "Idempotency-Key": createIdempotencyKey(),
    },
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
  return apiRequest<OperatorVoucherActionResult>(
    `/v1/operator/vouchers/${id}`,
    {
      method: "DELETE",
    },
  );
}

export function activateOperatorVoucher(id: string) {
  return apiRequest<OperatorVoucherActionResult>(
    `/v1/operator/vouchers/${id}/activate`,
    {
      method: "POST",
    },
  );
}

export function deactivateOperatorVoucher(id: string) {
  return apiRequest<OperatorVoucherActionResult>(
    `/v1/operator/vouchers/${id}/deactivate`,
    {
      method: "POST",
    },
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
    {
      method: "POST",
      headers: {
        "Idempotency-Key": createIdempotencyKey(),
      },
    },
  );
}

export function rejectOperatorVoucherConsent(id: string, reason: string) {
  return apiRequest<{ id: string; status: string }>(
    `/v1/operator/voucher-consents/${id}/reject`,
    {
      method: "POST",
      body: { reason },
      headers: {
        "Idempotency-Key": createIdempotencyKey(),
      },
    },
  );
}

export function getAdminBookingStatsAggregate(params: BookingStatsParams = {}) {
  return apiRequest<BookingStatsAggregate>(
    `/v1/admin/booking-stats/aggregate${buildQuery(params)}`,
  );
}

export function getAdminVoucherConsents(voucherId: string) {
  return apiRequest<AdminVoucherConsentResult>(
    `/v1/admin/vouchers/${voucherId}/consents`,
  );
}

export async function getAdminVouchers(params: AdminVoucherParams = {}) {
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
    headers: {
      "Idempotency-Key": createIdempotencyKey(),
    },
  });
}

export function updateAdminVoucher(
  id: string,
  request: UpdateAdminVoucherRequest,
) {
  return apiRequest<AdminVoucher>(`/v1/admin/vouchers/${id}`, {
    method: "PATCH",
    body: request,
    headers: {
      "Idempotency-Key": createIdempotencyKey(),
    },
  });
}

export function deleteAdminVoucher(id: string) {
  return apiRequest<{ id: string; deletedAt: string }>(
    `/v1/admin/vouchers/${id}`,
    {
      method: "DELETE",
      headers: {
        "Idempotency-Key": createIdempotencyKey(),
      },
    },
  );
}

export function getAdminCampaigns() {
  return apiRequest<AdminCampaign[]>("/v1/admin/campaigns");
}

export function createAdminCampaign(request: AdminCampaignRequest) {
  return apiRequest<AdminCampaign>("/v1/admin/campaigns", {
    method: "POST",
    body: request,
    headers: {
      "Idempotency-Key": createIdempotencyKey(),
    },
  });
}

export function updateAdminCampaign(
  campaignId: string,
  request: AdminCampaignRequest,
) {
  return apiRequest<AdminCampaign>(`/v1/admin/campaigns/${campaignId}`, {
    method: "PATCH",
    body: request,
    headers: {
      "Idempotency-Key": createIdempotencyKey(),
    },
  });
}

export function activateAdminCampaign(campaignId: string) {
  return apiRequest<AdminCampaign>(
    `/v1/admin/campaigns/${campaignId}/activate`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": createIdempotencyKey(),
      },
    },
  );
}

export function deactivateAdminCampaign(campaignId: string) {
  return apiRequest<AdminCampaign>(
    `/v1/admin/campaigns/${campaignId}/deactivate`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": createIdempotencyKey(),
      },
    },
  );
}

export function getOperatorRouteChangeProposals(
  params: OperatorRouteChangeProposalParams = {},
) {
  return apiRequest<PagedResult<RouteChangeProposal>>(
    `/v1/operator/route-change-proposals${buildQuery(params)}`,
  );
}
export function getOperatorRouteChangeProposal(proposalId: string) {
  return apiRequest<RouteChangeProposal>(
    `/v1/operator/route-change-proposals/${proposalId}`,
  );
}
export function approveOperatorRouteChangeProposal(
  proposalId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<ApproveRouteChangeProposalResult>(
    `/v1/operator/route-change-proposals/${proposalId}/approve`,
    { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
  );
}
export function rejectOperatorRouteChangeProposal(
  proposalId: string,
  request: RejectRouteChangeProposalRequest = {},
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<RouteChangeProposal>(
    `/v1/operator/route-change-proposals/${proposalId}/reject`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}
export function changeOperatorTripRoute(
  tripId: string,
  request: DirectRouteChangeRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<RouteChangeResult>(
    `/v1/operator/trips/${tripId}/change-route`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}
export function getOperatorFareSurchargeSettings() {
  return apiRequest<FareSurchargeSetting>(
    "/v1/operator/fare-surcharges/settings",
  );
}
export function updateOperatorFareSurchargeSettings(
  request: FareSurchargeSetting,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<FareSurchargeSetting>(
    "/v1/operator/fare-surcharges/settings",
    {
      method: "PUT",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}
export function getOperatorFareSurchargePeriods(params: PageParams = {}) {
  return apiRequest<PagedResult<FareSurchargePeriod>>(
    `/v1/operator/fare-surcharges/periods${buildQuery(params)}`,
  );
}
export function createOperatorFareSurchargePeriod(
  request: FareSurchargePeriodRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<FareSurchargePeriod>(
    "/v1/operator/fare-surcharges/periods",
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}
export function updateOperatorFareSurchargePeriod(
  periodId: string,
  request: FareSurchargePeriodPatch,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<FareSurchargePeriod>(
    `/v1/operator/fare-surcharges/periods/${periodId}`,
    {
      method: "PATCH",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}
export function deleteOperatorFareSurchargePeriod(
  periodId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<void>(`/v1/operator/fare-surcharges/periods/${periodId}`, {
    method: "DELETE",
    headers: { "Idempotency-Key": idempotencyKey },
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

export function updateAlternativeRouteGeometry(
  alternativeRouteId: string,
  request: RouteGeometryRequest,
) {
  return apiRequest<AlternativeRoute>(
    `/v1/operator/alternative-routes/${alternativeRouteId}/geometry`,
    { method: "PUT", body: request },
  );
}

export function deleteAlternativeRoute(alternativeRouteId: string) {
  return apiRequest<{ message?: string }>(
    `/v1/operator/alternative-routes/${alternativeRouteId}`,
    { method: "DELETE" },
  );
}

export function getOperatorVehicles(
  params: PageParams & { searchIn?: string; vehicleTypeId?: string } = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<OperatorVehicle>>(
    `/v1/operator/vehicles${buildQuery(params)}`,
    { signal },
  );
}

export function getOperatorVehicle(id: string, signal?: AbortSignal) {
  return apiRequest<OperatorVehicle>(`/v1/operator/vehicles/${id}`, {
    signal,
  });
}

export function createOperatorVehicle(request: OperatorVehicleCreateRequest) {
  return apiRequest<OperatorVehicle>("/v1/operator/vehicles", {
    method: "POST",
    body: request,
  });
}

export function updateOperatorVehicle(
  id: string,
  request: OperatorVehicleUpdateRequest,
) {
  return apiRequest<OperatorVehicle>(`/v1/operator/vehicles/${id}`, {
    method: "PATCH",
    body: request,
  });
}

export function getFirebaseCustomToken(purpose: FirebaseUploadPurpose) {
  return apiRequest<FirebaseCustomToken>("/v1/firebase/custom-token", {
    method: "POST",
    body: { purpose },
  });
}

export function updateMyAvatar(avatarUrl: string | null) {
  return apiRequest<UserAvatarResult>("/v1/users/me/avatar", {
    method: "PATCH",
    body: { avatarUrl },
  });
}

export function getVehicleTypes(
  params: PageParams & { searchIn?: string; vehicleTypeId?: string } = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<VehicleType>>(
    `/v1/vehicle-types${buildQuery(params)}`,
    { signal },
  );
}

export function searchPublicTrips(params: PublicTripSearchParams) {
  return apiRequest<PagedResult<PublicTrip>>(
    `/v1/trips/search${buildQuery(params)}`,
  );
}

export function getPublicTrip(tripId: string) {
  return apiRequest<PublicTrip>(`/v1/trips/${tripId}`);
}

export function getPublicTripSeatMap(tripId: string) {
  return apiRequest<TripSeatMap>(`/v1/trips/${tripId}/seat-map`);
}

export type ServiceHealth = {
  status?: string;
  service?: string;
  timestamp?: string;
};

export function getTripHealth() {
  return apiRequest<ServiceHealth>("/v1/trip/health", {
    authenticated: false,
  });
}

export function getBookingHealth() {
  return apiRequest<ServiceHealth>("/v1/booking/health", {
    authenticated: false,
  });
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

export function cancelBooking(
  bookingId: string,
  request: CancelBookingRequest,
) {
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

export function chatWithRag(request: RagChatRequest) {
  return apiRequest<string>("/v1/rag/chat", {
    method: "POST",
    body: request,
    headers: {
      Accept: "text/event-stream",
    },
  });
}

export function streamRagChat(
  request: RagChatRequest,
  onEvent: (event: RagChatEvent) => void,
) {
  return apiSseRequest(
    "/v1/rag/chat",
    {
      method: "POST",
      body: request,
      headers: {
        Accept: "text/event-stream",
      },
    },
    ({ event, data }) => {
      if (typeof data !== "object" || data === null) {
        return;
      }
      const record = data as Record<string, unknown>;
      if (event === "token" && typeof record.content === "string") {
        onEvent({ type: "token", content: record.content });
        return;
      }
      if (
        event === "done" &&
        typeof record.conversationId === "string" &&
        typeof record.userMessageId === "string" &&
        typeof record.assistantMessageId === "string"
      ) {
        onEvent({
          type: "done",
          conversationId: record.conversationId,
          userMessageId: record.userMessageId,
          assistantMessageId: record.assistantMessageId,
          citedChunkIds: Array.isArray(record.citedChunkIds)
            ? record.citedChunkIds.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
        });
        return;
      }
      if (
        event === "error" &&
        typeof record.code === "string" &&
        typeof record.message === "string"
      ) {
        onEvent({ type: "error", code: record.code, message: record.message });
      }
    },
  );
}

export function createRagFeedback(
  messageId: string,
  request: RagFeedbackRequest,
) {
  return apiRequest<RagFeedback>(`/v1/rag/messages/${messageId}/feedback`, {
    method: "POST",
    body: request,
  });
}

export function getRagFeedback(params: PageParams = {}) {
  return apiRequest<PagedResult<RagFeedback>>(
    `/v1/rag/feedback${buildQuery(params)}`,
  );
}

export function getRagDocuments(params: RagDocumentParams = {}) {
  return apiRequest<PagedResult<RagDocument>>(
    `/v1/rag/documents${buildQuery(params)}`,
  );
}

export function uploadRagDocument(request: RagDocumentUploadRequest) {
  const form = new FormData();
  form.append("file", request.file);
  form.append("title", request.title);
  form.append("accessLevel", request.accessLevel);
  form.append("category", request.category);
  form.append("documentType", request.documentType);
  form.append("audienceRoles", JSON.stringify(request.audienceRoles ?? []));
  form.append("language", request.language ?? "vi");

  if (request.description) {
    form.append("description", request.description);
  }

  if (request.operatorId) {
    form.append("operatorId", request.operatorId);
  }

  return apiRequest<RagDocument>("/v1/rag/documents", {
    method: "POST",
    body: form,
  });
}

export function approveRagDocument(documentId: string) {
  return apiRequest<RagDocument>(`/v1/rag/documents/${documentId}/approve`, {
    method: "PUT",
  });
}

export function getRagRuntimeConfigs() {
  return apiRequest<RagRuntimeConfig[]>("/v1/admin/rag-config");
}

export function reloadRagRuntimeConfigs() {
  return apiRequest<RagRuntimeConfigReloadResult>(
    "/v1/admin/rag-config/reload",
    {
      method: "POST",
    },
  );
}

export function getRagRuntimeConfig(key: string) {
  return apiRequest<RagRuntimeConfig>(
    `/v1/admin/rag-config/${encodeURIComponent(key)}`,
  );
}

export function updateRagRuntimeConfig(
  key: string,
  request: RagRuntimeConfigUpdateRequest,
) {
  return apiRequest<RagRuntimeConfig>(
    `/v1/admin/rag-config/${encodeURIComponent(key)}`,
    { method: "PATCH", body: request },
  );
}

export function getRagRuntimeConfigHistory(
  key: string,
  params: PageParams = {},
) {
  return apiRequest<PagedResult<RagRuntimeConfigHistory>>(
    `/v1/admin/rag-config/${encodeURIComponent(key)}/history${buildQuery(params)}`,
  );
}

export function rollbackRagRuntimeConfig(key: string, historyId: string) {
  return apiRequest<RagRuntimeConfig>(
    `/v1/admin/rag-config/${encodeURIComponent(key)}/rollback`,
    { method: "POST", body: { historyId } },
  );
}

export function getTrackingTripLatest(tripId: string) {
  return apiRequest<TrackingLatestResponse>(
    `/v1/tracking/trips/${tripId}/latest`,
  );
}

export function getTrackingTripTrail(
  tripId: string,
  params: TrackingTrailParams = {},
) {
  return apiRequest<PagedResult<TrackingTrailPoint>>(
    `/v1/tracking/trips/${tripId}/trail${buildQuery(params)}`,
  );
}

// Không truyền stopId thì Tracking tự chọn stop kế tiếp theo sequence (mục 9.6).
export function getTrackingTripEta(tripId: string, stopId?: string) {
  return apiRequest<TrackingEtaResponse>(
    `/v1/tracking/trips/${tripId}/eta${buildQuery({ stopId })}`,
  );
}

export function getOperatorFleetLatest(params: FleetLatestParams = {}) {
  return apiRequest<FleetLatestResponse>(
    `/v1/tracking/operator/fleet-latest${buildQuery(params)}`,
  );
}

export function getTrackingTripRouteGeometry(tripId: string) {
  return apiRequest<TripRouteGeometry>(
    `/v1/tracking/trips/${tripId}/route-geometry`,
  );
}

export function getOperatorShuttleRequests(
  params: PageParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<ShuttleRequestGroup>>(
    `/v1/operator/shuttle-requests${buildQuery(params)}`,
    { signal },
  );
}

export function createOperatorShuttleTrip(
  request: CreateShuttleTripRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<CreateShuttleTripResult>("/v1/operator/shuttle-trips", {
    method: "POST",
    body: request,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function getShuttleTripLatest(shuttleTripId: string) {
  return apiRequest<ShuttleTrackingLatest | null>(
    `/v1/tracking/shuttle-trips/${shuttleTripId}/latest`,
  );
}

export function getShuttleTripEta(shuttleTripId: string) {
  return apiRequest<ShuttleTrackingEta | null>(
    `/v1/tracking/shuttle-trips/${shuttleTripId}/eta`,
  );
}

export function getInternalTrip(tripId: string) {
  return apiRequest<PublicTrip>(`/internal/v1/trips/${tripId}`);
}

export function getInternalTripParcelAvailability(
  params: ParcelAvailabilityParams = {},
) {
  return apiRequest<ParcelAvailability[]>(
    `/internal/v1/trips/parcel-availability${buildQuery(params)}`,
  );
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

export function lockInternalTripSeats(
  tripId: string,
  request: SeatLockRequest,
) {
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

export function bookInternalTripSeats(
  tripId: string,
  request: BookSeatsRequest,
) {
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

export function getInternalTripCargoCapacity(tripId: string) {
  return apiRequest<CargoCapacity>(
    `/internal/v1/trips/${tripId}/cargo/capacity`,
  );
}

export function remeasureInternalTripCargo(
  tripId: string,
  request: CargoRemeasureRequest,
) {
  return apiRequest<CargoReserveResult>(
    `/internal/v1/trips/${tripId}/cargo/remeasure`,
    { method: "POST", body: request },
  );
}

export function loadInternalTripCargo(
  tripId: string,
  request: CargoLoadRequest,
) {
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
      headers: idempotencyKey
        ? { "Idempotency-Key": idempotencyKey }
        : undefined,
    },
  );
}

export function getOperatorTripCargoCapacity(tripId: string) {
  return apiRequest<CargoCapacity>(
    `/v1/operator/trips/${tripId}/cargo-capacity`,
  );
}

export function substituteOperatorTripVehicle(
  tripId: string,
  request: SubstituteVehicleRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<TripOperationResult>(
    `/v1/operator/trips/${tripId}/substitute-vehicle`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function disruptOperatorTripNoSubstitution(
  tripId: string,
  request: TripDisruptionRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<TripOperationResult>(
    `/v1/operator/trips/${tripId}/disrupt-no-substitution`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getNotifications(params: NotificationParams = {}) {
  return apiRequest<PagedResult<NotificationItem>>(
    `/v1/notifications${buildQuery(params)}`,
  );
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<null>(`/v1/notifications/${notificationId}/read`, {
    method: "POST",
  });
}
export function sendOperatorNotification(
  request: SendOperatorNotificationRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<SendOperatorNotificationResult>(
    "/v1/operator/notifications",
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}
export function getAdminDashboardSummary(
  params: { from: string; to: string },
) {
  return apiRequest<AdminDashboardSummary>(
    `/v1/admin/dashboard/summary${buildQuery(params)}`,
  );
}

export function getAdminRevenueAnalytics(params: {
  from: string;
  to: string;
  groupBy: "month";
  top?: number;
}) {
  return apiRequest<AdminRevenueAnalytics>(
    `/v1/admin/revenue/analytics${buildQuery(params)}`,
  );
}

export type OperatorRevenueAnalyticsParams =
  | { month: string; year?: never; groupBy?: never }
  | { year: number; groupBy: "month"; month?: never };

export function getOperatorRevenueAnalytics(params: OperatorRevenueAnalyticsParams) {
  return apiRequest<OperatorRevenueAnalytics>(
    `/v1/operator/revenue/analytics${buildQuery(params)}`,
  );
}

export function getOperatorTrips(
  params: OperatorTripListParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<OperatorTripListItem>>(
    `/v1/operator/trips${buildQuery(params)}`,
    { signal },
  );
}

export function batchUpdateOperatorParcelRouteFares(
  routeId: string,
  request: BatchParcelRouteFareRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<BatchParcelRouteFareResult>(
    `/v1/operator/parcel-route-fares/${routeId}/batch`,
    {
      method: "PUT",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getOperatorParcelStats(params: OperatorParcelStatsParams) {
  return apiRequest<OperatorParcelStats>(
    `/v1/operator/parcel-stats${buildQuery(params)}`,
  );
}

function getPolicies(basePath: string, params: PolicyListParams = {}) {
  return apiRequest<PagedResult<PolicyItem>>(
    `${basePath}${buildQuery(params)}`,
  );
}

function getPolicy(basePath: string, policyId: string) {
  return apiRequest<PolicyItem>(`${basePath}/${policyId}`);
}

function createPolicy(
  basePath: string,
  request: CreatePolicyRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<PolicyItem>(basePath, {
    method: "POST",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

function updatePolicy(
  basePath: string,
  policyId: string,
  request: UpdatePolicyRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<PolicyItem>(`${basePath}/${policyId}`, {
    method: "PATCH",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

function deletePolicy(
  basePath: string,
  policyId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<void>(`${basePath}/${policyId}`, {
    method: "DELETE",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export const getAdminPolicies = (params: PolicyListParams = {}) =>
  getPolicies("/v1/admin/policies", params);
export const getAdminPolicy = (policyId: string) =>
  getPolicy("/v1/admin/policies", policyId);
export const createAdminPolicy = (request: CreatePolicyRequest) =>
  createPolicy("/v1/admin/policies", request);
export const updateAdminPolicy = (
  policyId: string,
  request: UpdatePolicyRequest,
) => updatePolicy("/v1/admin/policies", policyId, request);
export const deleteAdminPolicy = (policyId: string) =>
  deletePolicy("/v1/admin/policies", policyId);

export const getOperatorPolicies = (params: PolicyListParams = {}) =>
  getPolicies("/v1/operator/policies", params);
export const getOperatorPolicy = (policyId: string) =>
  getPolicy("/v1/operator/policies", policyId);
export const createOperatorPolicy = (request: CreatePolicyRequest) =>
  createPolicy("/v1/operator/policies", request);
export const updateOperatorPolicy = (
  policyId: string,
  request: UpdatePolicyRequest,
) => updatePolicy("/v1/operator/policies", policyId, request);
export const deleteOperatorPolicy = (policyId: string) =>
  deletePolicy("/v1/operator/policies", policyId);







