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

/** Kiểu giảm giá của voucher — dùng cho query `type` của list voucher */
export type VoucherDiscountType = "PERCENT_OFF" | "FIXED_AMOUNT";

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

export type NotificationAction =
  | { type: "OPEN_BOOKING_DETAIL"; params: { bookingId: string } }
  | {
      type: "OPEN_CREW_TRIP_BOOKING";
      params: { tripId: string; bookingId: string };
    }
  | { type: "OPEN_TRIP_DETAIL"; params: { tripId: string } }
  | { type: "OPEN_TRIP_TRACKING"; params: { tripId: string } }
  | { type: "OPEN_PARCEL_DETAIL"; params: { parcelId: string } }
  | { type: "OPEN_WALLET"; params: Record<string, never> }
  | { type: "OPEN_SUBSCRIPTION"; params: Record<string, never> }
  | { type: "OPEN_INVOICE"; params: { invoiceId: string } }
  | { type: "OPEN_OPERATOR_STATUS"; params: Record<string, never> }
  /**
   * `bookingId`/`pickupOrder` là additive (BE 2026-08-22): notification cũ và
   * notification chung cho nhà xe chỉ có `shuttleTripId`, còn notification gắn
   * với một nhóm khách cụ thể thì có đủ ba field. Đừng bắt buộc hai field sau.
   */
  | {
      type: "OPEN_SHUTTLE_TRACKING";
      params: {
        shuttleTripId: string;
        bookingId?: string;
        pickupOrder?: number;
      };
    }
  // Màn Báo cáo sự cố không có route riêng cho từng sự cố mà mở modal theo
  // `?incidentId=`, và luôn cần `tripId` để lọc sẵn danh sách phía sau modal —
  // nên `tripId` bắt buộc, `incidentId` chỉ là bonus khi payload có mang theo.
  | { type: "OPEN_INCIDENT"; params: { tripId: string; incidentId?: string } }
  | { type: "NONE"; params: Record<string, never> };

export type NotificationItem = {
  id: string;
  // REST inbox trả `userId`; payload realtime `notification:created` thì không
  // (room đã khoá theo user nên BE bỏ field này).
  userId?: string;
  type: string;
  title: string;
  body: string;
  data: unknown | null;
  action?: NotificationAction | null;
  actionType?: string;
  actionParams?: string | Record<string, unknown>;
  notificationType?: string;
  deepLink?: string | null;
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
    province?: string;
  };
  addressStreet?: string;
  addressWard?: string;
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
  /** `YYYY-MM-DD`, inclusive theo `createdAt` */
  from?: string;
  to?: string;
};

export type AdminUserActionResult = {
  userId: string;
  status: string;
  statusChanged: boolean;
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

export type SubscriptionBillingPeriod = "MONTHLY" | "YEARLY";

// WALLET = trừ thẳng ví nhà xe (200 = xong ngay, 402 = thiếu tiền);
// VNPAY = tạo redirect và chờ IPN.
export type SubscriptionPaymentMethod = "VNPAY" | "WALLET";

// STANDARD = gói bán cho mọi nhà xe. CUSTOM = gói riêng admin dựng theo yêu cầu
// của MỘT nhà xe; plan list chỉ trả gói riêng thuộc nhà xe đang đăng nhập.
export type SubscriptionPlanType = "STANDARD" | "CUSTOM";

export type SubscriptionPlan = {
  planId: string;
  name: string;
  description?: string;
  // Optional: response cũ chưa có field này, thiếu thì coi như STANDARD.
  planType?: SubscriptionPlanType;
  // Chỉ có giá trị với gói CUSTOM. KHÔNG hiển thị ở UI và KHÔNG cho nhập —
  // gói riêng của nhà xe khác không bao giờ về tới FE (UUID hợp lệ vẫn 404).
  ownerOperatorId?: string | null;
  // Hai giá ĐỘC LẬP — không suy giá năm từ giá tháng nhân hệ số. Gói riêng chỉ
  // cần một trong hai lớn hơn 0, nên giá bằng 0 nghĩa là kỳ đó không bán.
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
  // Quyền lợi có đang được cấp hay không — do BE tính, FE KHÔNG tự suy từ
  // status hay đồng hồ client. Optional để fixture/response cũ không gãy;
  // đọc qua `isSubscriptionEntitled` (subscriptionHelpers) để có fallback.
  entitlementActive?: boolean;
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

// returnUrl đã bị bỏ: Backend tự chọn mode OPERATOR_WEB và dùng
// VNPAY_WEB_RETURN_URL phía server (VNPAY_WEB_MOBILE_SDK_HANDOFF.md §2.1, §4).
// FE không được hardcode URL return nữa.
//
// LEGACY: luồng "bấm mua là ra VNPAY" một nhịp. Luồng mới là quote → payment
// (xem createSubscriptionUpgradeQuote). Giữ lại tới khi màn Packages chuyển hẳn.
export type SubscriptionUpgradeRequest = {
  planId: string;
  billingPeriod: SubscriptionBillingPeriod;
  paymentMethod: SubscriptionPaymentMethod;
};

// ---------------------------------------------------------------------------
// Nâng cấp theo proration: báo giá trước, thanh toán sau
// ---------------------------------------------------------------------------

export type SubscriptionUpgradeQuoteRequest = {
  planId: string;
  billingPeriod: SubscriptionBillingPeriod;
  // Nằm TRONG quote — đổi phương thức thanh toán bắt buộc phải quote lại
  paymentMethod: SubscriptionPaymentMethod;
};

export type SubscriptionUpgradeQuote = {
  upgradeAttemptId: string;
  sourcePlanId: string;
  targetPlanId: string;
  billingPeriod: SubscriptionBillingPeriod;
  paymentMethod: SubscriptionPaymentMethod;
  // false = báo giá full-price (trial hoặc subscription đã hết hạn → mở chu kỳ
  // mới). true = có khấu trừ gói cũ và giữ nguyên ngày hết hạn hiện tại.
  prorationApplied: boolean;
  currentCyclePrice: number;
  targetCyclePrice: number;
  // Giá trị gói cũ còn lại được trừ đi
  unusedCredit: number;
  // Giá gói mới tính cho phần thời gian còn lại
  proratedTargetAmount: number;
  // Số phải trả. FE hiển thị NGUYÊN số này — không tự cộng trừ lại từ các field
  // bên trên (làm tròn của BE mới là số đúng).
  amountDue: number;
  periodFrom: string;
  periodTo: string;
  quotedAt: string;
  // Hết hạn báo giá — quá hạn phải quote lại, không confirm được nữa
  dueAt: string;
  currency: string;
  status: string;
};

// apiRequest chỉ trả phần `data`, không lộ HTTP status — nên FE phân biệt hai
// nhánh kết quả bằng paymentRedirectUrl: CÓ url = VNPAY (202, phải chuyển
// hướng); KHÔNG có = ví đã trừ xong (200, chỉ cần refresh subscription).
// 402 WALLET_INSUFFICIENT_BALANCE ném ApiRequestError, chưa trừ tiền.
export type SubscriptionUpgradePaymentResult = {
  upgradeAttemptId: string;
  status: string;
  paymentId?: string;
  paymentRedirectUrl?: string | null;
  dueAt?: string | null;
};

// ---------------------------------------------------------------------------
// Custom Plan: nhà xe xin gói riêng, admin duyệt
// ---------------------------------------------------------------------------
// LƯU Ý: FE-RESPONSE-2026-08-21 chỉ nêu rõ body của POST create, các trạng thái,
// `approvedPlanId` và `rejectionReason`. Tên các field còn lại dưới đây
// (requestId, createdAt, reviewedAt, operatorName) là SUY RA từ URL path và
// nhu cầu hiển thị — đối chiếu lại với BE khi có response mẫu thật.

export type CustomPlanRequestStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

// Sáu quota + ba module — dùng chung cho cả lúc nhà xe xin lẫn lúc admin duyệt
export type CustomPlanQuota = {
  maxVehicles: number;
  maxDrivers: number;
  maxAssistants: number;
  maxOperatorUsers: number;
  maxRoutes: number;
  maxTripsPerMonth: number;
  enableParcel: boolean;
  enableShuttle: boolean;
  enableRag: boolean;
};

export type CreateCustomPlanRequestPayload = CustomPlanQuota & {
  // Chỉ là gợi ý để admin đặt giá — lúc mua nhà xe vẫn chọn kỳ tự do
  preferredBillingPeriod: SubscriptionBillingPeriod;
  note?: string;
};

// Response của custom-request — shape đã xác nhận từ bản chạy thật.
//
// Hạn mức và module nằm trong `requestedLimits` / `requestedModules`, không
// phẳng ở gốc như payload lúc gửi đi.
export type OperatorCustomPlanRequest = {
  requestId: string;
  status: CustomPlanRequestStatus;
  preferredBillingPeriod: SubscriptionBillingPeriod;
  note?: string | null;
  requestedLimits: {
    maxVehicles: number;
    maxDrivers: number;
    maxAssistants: number;
    maxOperatorUsers: number;
    maxRoutes: number;
    maxTripsPerMonth: number;
  };
  requestedModules: {
    enableParcel: boolean;
    enableShuttle: boolean;
    enableRag: boolean;
  };
  // Chỉ có khi APPROVED — id gói riêng vừa dựng. Duyệt xong KHÔNG có nghĩa là
  // đã lên gói: nhà xe vẫn phải đi luồng quote → payment như gói thường.
  approvedPlanId?: string | null;
  // Chỉ có khi REJECTED
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  // Id admin đã xử lý — BE không trả tên nên FE chưa hiển thị
  reviewedBy?: string | null;
};

export type AdminCustomPlanRequest = OperatorCustomPlanRequest & {
  operatorId: string;
  // Hai API GET admin trả kèm tên nhà xe, LUÔN có giá trị kể cả khi nhà xe đã
  // soft-delete (handoff §7). Admin FE render thẳng field này, không gọi thêm
  // /admin/operators/{id} cho từng dòng.
  operatorName: string;
};

export type ApproveCustomPlanRequestPayload = CustomPlanQuota & {
  name: string;
  description?: string;
  // Hai giá độc lập, BE yêu cầu ít nhất một giá > 0. Kỳ nào giá = 0 thì FE
  // phải khoá kỳ đó khi bán gói này.
  pricePerMonth: number;
  pricePerYear: number;
};

export type RejectCustomPlanRequestPayload = {
  reason: string;
};

export type SubscriptionUpgradeResult = {
  upgradeAttemptId: string;
  status: string;
  paymentId: string;
  paymentRedirectUrl: string | null;
  dueAt: string | null;
  // Các field dưới đây không có trong response mẫu 202 của handoff doc —
  // để optional để FE không crash nếu Backend đã lược bớt.
  subscriptionId?: string;
  amount?: number;
  billingPeriod?: SubscriptionBillingPeriod;
  activePlan?: SubscriptionPlanReference;
  pendingTargetPlan?: SubscriptionPlanReference;
};

// Trạng thái đọc-only của VNPay web return. Chỉ IPN mới đổi được trạng thái
// thanh toán; endpoint này chỉ để FE hiển thị (handoff §2.2).
export type VnPayReturnStatus = {
  vnPayTxnRef: string;
  paymentId: string;
  referenceType: string;
  referenceId: string;
  status: string;
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
  // Chuỗi tìm kiếm chung (2..100 ký tự sau trim) — xem
  // FE-REQUEST-operator-wallet-transparency-RESPONSE.md §10. UUID hợp lệ thì
  // exact-match theo ID hỗ trợ; chuỗi thường match referenceCode/note theo
  // exact/prefix không phân biệt hoa/thường (Backend tự escape).
  search?: string;
};

export type WalletTransactionType = "CREDIT" | "DEBIT";

// Ghi rõ metadata đối soát của MỘT movement có đủ để hiển thị hay không —
// dữ liệu lịch sử trước khi có contract mới vẫn hợp lệ về tiền (canonical
// amount luôn dùng được) nhưng có thể thiếu vài field mô tả nguồn gốc.
export type FinancialDataCompleteness = "COMPLETE" | "PARTIAL";

/**
 * Mã nghiệp vụ người đọc được: `TRIP-yyyyMMdd-XXXXXXXX`, `STL-…`, `OWT-…`,
 * `PWT-…` do BE sinh, hoặc mã tuyến do nhà xe tự đặt (`SG-DL-01`).
 *
 * `null` với dữ liệu legacy chưa backfill (Release A của BE vẫn để nullable);
 * field vắng hẳn khi môi trường chưa deploy commit thêm mã — nên type là
 * optional + nullable, và KHÔNG được ép non-null cho tới khi BE chốt Release B.
 *
 * Luật dùng: hiển thị qua `displayBusinessCode()`, không tự chế mã từ UUID, và
 * không parse ngày / loại bản ghi / quan hệ nghiệp vụ ra khỏi chuỗi mã. UUID
 * vẫn là định danh kỹ thuật cho URL và mutation.
 */
export type BusinessCode = string | null;

export type OperatorWalletLastSettlement = {
  settlementId: string;
  /** Mã phiên tất toán (`STL-…`) — xem {@link BusinessCode}. */
  settlementCode?: BusinessCode;
  /** Mã chuyến của phiên tất toán này — xem {@link BusinessCode}. */
  tripCode?: BusinessCode;
  amount: number;
  method: "AUTO_WEEKLY" | "ADMIN_MANUAL" | string;
  settledAt: string;
};

export type OperatorWallet = {
  operatorId: string;
  // Tiền ĐÃ được credit vào ví sau khi đối soát — không đồng nghĩa rút được
  // ra ngân hàng (xem withdrawalSupported). Không cộng các field bên dưới
  // vào balance để ra "tổng tài sản" — mỗi field mô tả một giai đoạn khác
  // nhau trong vòng đời đối soát.
  balance: number;
  currency?: string;
  // Quyền lợi đã ghi nhận ở ledger nhưng chuyến CHƯA có settlement marker
  awaitingTripCompletionAmount?: number;
  awaitingTripCompletionCount?: number;
  // Tiền của settlement đang trong 7 ngày giữ để đối soát (hold window)
  pendingHoldAmount: number;
  pendingHoldCount?: number;
  // Đã qua hold, đủ điều kiện đối soát — CHƯA chắc đã chuyển tiền ngay
  eligibleAmount: number;
  eligibleCount?: number;
  nextEligibleAt?: string | null;
  // Lần xử lý đối soát tự động dự kiến tiếp theo — luôn là LỊCH DỰ KIẾN,
  // không phải cam kết tiền chắc chắn chuyển đúng giờ đó.
  nextScheduledSettlementAttemptAt?: string | null;
  // Metric lịch sử (tổng đã đối soát từ trước tới nay) — không phải số dư
  // còn lại, không được dùng để suy ra balance.
  lifetimeSettledAmount?: number;
  lastSettlement?: OperatorWalletLastSettlement | null;
  // false ở V1: không có luồng rút tiền ra ngân hàng — FE phải ẩn/disable
  // mọi hành động rút tiền khi field này false.
  withdrawalSupported?: boolean;
  // Chỉ đổi khi balance đổi
  updatedAt: string;
  // Thời điểm Backend tính các aggregate hiện tại (awaiting/hold/eligible...)
  calculatedAt?: string;
};

export type WalletRelatedSettlement = {
  settlementId: string;
  /** Mã phiên tất toán (`STL-…`) — xem {@link BusinessCode}. */
  settlementCode?: BusinessCode;
  tripId: string;
  /** Mã chuyến (`TRIP-…`) — xem {@link BusinessCode}. */
  tripCode?: BusinessCode;
  method: "AUTO_WEEKLY" | "ADMIN_MANUAL" | string;
};

export type WalletTransaction = {
  transactionId: string;
  /**
   * Mã giao dịch ví: `OWT-…` cho ví nhà xe, `PWT-…` cho ví nền tảng — cùng type
   * này phục vụ cả hai endpoint. Xem {@link BusinessCode}.
   */
  transactionCode?: BusinessCode;
  type: WalletTransactionType;
  // Luôn dương — giữ lại để tương thích client cũ, KHÔNG dùng để suy dấu.
  amount: number;
  // Dùng field này để hiển thị +/-: CREDIT dương, DEBIT âm.
  signedAmount?: number;
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
  // Có khi movement đến từ settlement — cho phép đối chiếu sang tab đối soát
  relatedSettlement?: WalletRelatedSettlement | null;
  adjustmentReason?: string | null;
  dataCompleteness?: FinancialDataCompleteness;
  missingFields?: string[];
};

export type WalletTransactionParams = FinancialListParams & {
  type?: WalletTransactionType;
  referenceType?: string;
  dateField?: "createdAt";
};

export type TripSettlementStatus =
  | "PENDING_HOLD"
  | "ELIGIBLE"
  | "SETTLED"
  | "CANCELLED";

// Trạng thái xử lý chi tiết hơn status — ưu tiên field này cho chip/copy giải
// thích người dùng (status cũ vẫn còn để tương thích ngược).
export type TripSettlementProcessingState =
  | "ON_HOLD"
  | "READY_FOR_SETTLEMENT"
  | "RETRY_SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

// [CẦN BE XÁC NHẬN] Field nội bộ của object `trip` enrichment chưa được tài
// liệu hoá field-by-field trong response mẫu — chỉ biết nó có thể null khi
// enrichment fail-soft (dataCompleteness=PARTIAL). Giữ optional/unknown-safe,
// không giả định tên field cụ thể ngoài tripId đã có sẵn ở top-level.
export type TripSettlementTripSummary = {
  tripId?: string;
  /** Mã chuyến snapshot — xem {@link BusinessCode}. */
  tripCode?: BusinessCode;
  routeName?: string;
  departureTime?: string;
} | null;

export type TripSettlement = {
  settlementId: string;
  /** Mã phiên tất toán (`STL-…`) — xem {@link BusinessCode}. */
  settlementCode?: BusinessCode;
  tripId: string;
  /**
   * CHỈ có ở bản admin (`GET /v1/admin/trip-settlements`, response settle thủ
   * công). Bản operator KHÔNG có field này — đọc `trip?.tripCode` thay thế.
   * `pickSettlementTripCode()` bọc đúng thứ tự ưu tiên đó.
   */
  tripCode?: BusinessCode;
  operatorId?: string;
  status: TripSettlementStatus;
  processingState?: TripSettlementProcessingState;
  eligibleAt: string | null;
  // netAmount giữ nguyên tên cũ để tương thích; netEntitlementAmount là field
  // canonical mới theo contract — ưu tiên hiển thị field này khi có.
  netAmount: number;
  netEntitlementAmount?: number;
  grossSalesAmount?: number;
  passengerPaidAmount?: number;
  vietRideFundedAmount?: number;
  operatorFundedDiscountAmount?: number;
  refundAmount?: number;
  recognizedAdjustmentAmount?: number;
  settlementMethod: "AUTO_WEEKLY" | "ADMIN_MANUAL" | null;
  settledAt: string | null;
  createdAt: string;
  failureCount?: number;
  attemptCount?: number;
  activeFailureCode?: string | null;
  // Lý do trung tính khi đang RETRY_SCHEDULED — ví dụ SYSTEM_PROCESSING_DELAY.
  // KHÔNG hiển thị nguyên văn reason nội bộ kiểu "nền tảng không đủ tiền".
  delayReason?: string | null;
  lastAttemptAt?: string | null;
  nextRetryAt?: string | null;
  cancelReason?: string | null;
  severity?: "HIGH" | "WARNING" | null;
  // Có khi processingState=COMPLETED — cho phép đối chiếu sang tab biến động ví
  walletTransactionId?: string | null;
  trip?: TripSettlementTripSummary;
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
  dateField?: "createdAt" | "tripTerminalAt" | "eligibleAt" | "settledAt";
};

/**
 * Allow-list BE: page, pageSize, operatorId, status, tripId, stuckOnly,
 * severity, from, to, sortBy, sortDir, search.
 *
 * KHÔNG kế thừa `OperatorTripSettlementParams` vì bản operator có `dateField`
 * còn bản admin thì không — gửi nhầm là 422.
 *
 * `search`: UUID thì exact-match settlement ID hoặc trip ID; chuỗi thường khớp
 * mã trip/reference theo prefix, và tên nhà xe / active failure code theo
 * contains.
 */
export type AdminTripSettlementParams = FinancialListParams & {
  status?: TripSettlementStatus;
  tripId?: string;
  operatorId?: string;
  stuckOnly?: boolean;
  severity?: "HIGH" | "WARNING";
};

/**
 * Allow-list BE cho `/v1/admin/platform-wallet/transactions`: page, pageSize,
 * type, referenceType, from, to, sortBy, sortDir, search. Bản operator có thêm
 * `dateField`, bản admin thì không.
 *
 * `search`: UUID thì exact-match transaction ID hoặc reference ID; chuỗi thường
 * khớp note hoặc tên người thao tác theo contains; enum như
 * `MANUAL_ADJUSTMENT` khớp chính xác reference type.
 */
export type AdminWalletTransactionParams = FinancialListParams & {
  type?: WalletTransactionType;
  referenceType?: string;
};

// BUSINESS_EVENT: occurredAt là thời điểm nghiệp vụ thật. FALLBACK: chưa có
// timestamp thật, occurredAt đang dùng tạm createdAt của ledger.
export type LedgerOccurredAtSource =
  | "BUSINESS_EVENT"
  | "LEDGER_CREATED_AT_FALLBACK"
  | string;

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
  // Mã Booking/Parcel để người dùng đối chiếu — null trên row lịch sử cũ,
  // KHÔNG tự chế mã thay thế.
  referenceCode?: string | null;
  note?: string | null;
  createdAt: string;
  occurredAt?: string;
  occurredAtSource?: LedgerOccurredAtSource;
  // Số voucher nhà xe tài trợ trên audit row — audit row amount luôn = 0,
  // không trừ operatorFundedVoucherAmount thêm lần nữa vào net.
  operatorFundedVoucherAmount?: number;
  adjustmentReason?: string | null;
  affectsRevenue?: boolean;
  affectsSettlement?: boolean;
  /**
   * Snapshot phiên tất toán của chuyến, đúng theo `LedgerSettlementDto` của BE
   * (`GET /v1/operator/ledger`): chỉ có 7 field, KHÔNG có `processingState` —
   * field đó chỉ tồn tại trên `SettlementDto` của `/v1/operator/trip-settlements`.
   *
   * Bảng Lịch sử doanh thu hiện KHÔNG hiển thị field này: cột Trạng thái từng
   * render badge theo `processingState` nên trống với mọi row, còn hai mã
   * STL-/TRIP- thì không đủ chỗ trong cột hẹp. Trạng thái đối soát xem ở tab
   * Doanh thu hàng tuần (`getOperatorTripSettlements`). Type vẫn giữ để soi
   * đúng response — đừng dựng lại UI từ nó nếu BE chưa bổ sung `processingState`.
   */
  settlement?: {
    settlementId: string;
    /** Mã phiên tất toán (`STL-…`) — xem {@link BusinessCode}. */
    settlementCode?: BusinessCode;
    /** Mã chuyến của phiên tất toán — xem {@link BusinessCode}. */
    tripCode?: BusinessCode;
    status: TripSettlementStatus;
  } | null;
};

export type OperatorLedgerParams = FinancialListParams & {
  tripId?: string;
  entryType?: string;
  referenceType?: string;
  dateField?: "createdAt" | "occurredAt";
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
    /** Hoá đơn phát hành trước khi BE bỏ district vẫn còn trường này */
    addressDistrict?: string | null;
    addressProvince: string;
  };
  invoiceWebUrl: string;
  downloadApiUrl: string;
};

/**
 * Allow-list BE: page, pageSize, status, from, to, sortBy, sortDir, search.
 * `search`: contains không phân biệt hoa thường trên `invoiceNumber`; nếu chuỗi
 * parse được thành UUID thì OR-match chính xác `paymentId`.
 * `sortBy`: issuedAt | createdAt | amount | invoiceNumber.
 */
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
  /**
   * Mã hành chính đúng 2 chữ số (root: lấy cả station gắn thẳng root lẫn station
   * thuộc leaf active) hoặc đúng 5 chữ số (leaf chính xác). Không được gửi kèm
   * `locationId`; mã không tồn tại/đã tắt/sai độ dài đều là `422 VALIDATION_ERROR`.
   */
  locationScopeCode?: string;
};

/**
 * Allow-list BE: page, pageSize, search, isActive, supportsShuttle, sortBy,
 * sortDir. `search` khớp unaccent trên name/city/ward/addressStreet/slug.
 * `sortBy` chỉ nhận name|createdAt|updatedAt (mặc định name asc).
 */
export type AdminStationParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  supportsShuttle?: boolean;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
};

/** `GET /v1/admin/stations/summary` — đếm trên toàn bộ bến, không nhận query */
export type AdminStationSummary = {
  total: number;
  active: number;
  inactive: number;
  supportsShuttle: number;
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

/**
 * Nhật ký hoạt động của quản trị viên hệ thống (`GET /v1/admin/activity-logs`).
 *
 * OpenAPI KHÔNG công bố ràng buộc cho các query param này (spec 2026-08-25 ghi
 * TODO cho cả sáu), nên FE gửi đúng những gì BE nhận và không tự đặt giá trị
 * mặc định cứng ngoài `page`/`pageSize`.
 */
export type AdminActivityLogParams = {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type AdminActivityLogActor = {
  id?: string;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
};

export type AdminActivityLogItem = {
  id: string;
  actor?: AdminActivityLogActor | null;
  action?: string | null;
  /** BE khai `any` — payload tự do theo từng loại hành động, FE chỉ hiển thị. */
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string;
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

/** Cấp tỉnh/thành — code đúng 2 chữ số, không có parent */
export const LOCATION_TOP_LEVEL_TYPES = ["PROVINCE", "MUNICIPALITY"] as const;
/** Cấp phường/xã/đặc khu — code đúng 5 chữ số, bắt buộc có parent active */
export const LOCATION_LEAF_TYPES = [
  "WARD",
  "COMMUNE",
  "SPECIAL_ZONE",
] as const;

export type LocationTopLevelType = (typeof LOCATION_TOP_LEVEL_TYPES)[number];
export type LocationLeafType = (typeof LOCATION_LEAF_TYPES)[number];
export type LocationType = LocationTopLevelType | LocationLeafType;

export function isLeafLocationType(type: string): type is LocationLeafType {
  return (LOCATION_LEAF_TYPES as readonly string[]).includes(type);
}

export type AdminLocation = {
  id: string;
  code: string;
  name: string;
  type: LocationType | string;
  /** Null với cấp tỉnh/thành */
  parentId?: string | null;
  parentCode?: string | null;
  parentName?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminLocationRequest = {
  code: string;
  name: string;
  type: LocationType;
  sortOrder?: number;
  isActive?: boolean;
  /** Bắt buộc với leaf; bỏ qua với top-level */
  parentCode?: string;
};

export type UpdateAdminLocationRequest = Partial<AdminLocationRequest>;

/**
 * Query của `GET /v1/admin/locations`. Khai tường minh thay vì mở rộng
 * `PageParams` vì `PageParams` có `status`/`sortBy`/`sortDir` — không nằm trong
 * allow-list của endpoint này nên gửi lên là 422.
 */
export type AdminLocationParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  type?: LocationType;
  /** Mã của location cấp trên cùng; trả về con trực tiếp của nó */
  parentCode?: string;
};

/** Query của `GET /v1/locations` — KHÁC hẳn StationSearchParams */
export type PublicLocationParams = {
  /** Bỏ trống: chỉ trả top-level. Có: chỉ trả children active trực thuộc */
  parentCode?: string;
  /** unaccent + ILIKE trên code hoặc name, trong scope hiện tại */
  search?: string;
  /**
   * Lọc theo cấp hành chính; kết hợp AND với parentCode và search
   * (handoff API-location-filter-authen mục 10.1). Lưu ý: gửi type cấp lá mà
   * KHÔNG kèm parentCode thì BE trả `200 []` vì cấp lá không phải top-level.
   */
  type?: LocationType;
};

export type OperatorStationRequest = {
  stationId?: string;
  displayNameOverride?: string;
  counterLocation?: string;
  contactPhone?: string;
  instructions?: string;
  name?: string;
  // Create mới: name + latitude/longitude + đúng một trong locationId/locationCode.
  // KHÔNG gửi city/ward: handler BE suy ra từ Location hierarchy và bỏ qua hai
  // field này nếu client gửi lên.
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

/**
 * `OperatorStationDto` — mapping Operator–Station. Mọi thuộc tính của bến nằm
 * trong `station`, không phẳng ở cấp ngoài.
 *
 * Riêng response của POST có thêm nhánh cảnh báo: khi đã tồn tại Station active
 * trong bán kính 100 m, BE trả `200` nhưng **không tạo và không link**, đồng
 * thời omit `operatorId`/`stationId`/`isActive`. Vì vậy `stationId` phải là
 * optional và caller bắt buộc kiểm tra `warning` trước khi coi là thành công.
 */
export type OperatorStation = {
  id?: string;
  operatorId?: string;
  stationId?: string;
  station?: Station;
  displayNameOverride?: string | null;
  counterLocation?: string | null;
  contactPhone?: string | null;
  instructions?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  warning?: { code: string; message: string } | null;
  nearbyStations?: Station[];
};

export const STATION_DUPLICATE_NEARBY = "STATION_DUPLICATE_NEARBY";

/** True khi BE từ chối tạo vì đã có bến active trong bán kính 100 m */
export function isNearbyStationWarning(result: OperatorStation): boolean {
  return result.warning?.code === STATION_DUPLICATE_NEARBY;
}

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
  /** Tên tỉnh/thành parent, BE suy ra từ Location hierarchy */
  city?: string | null;
  /** Tên phường/xã/đặc khu leaf */
  ward?: string | null;
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
  /**
   * Mã tuyến do nhà xe tự đặt (`SG-DL-01`). Unique trong phạm vi từng nhà xe
   * với Route chưa soft-delete; hai nhà xe khác nhau được trùng mã. Tuyến
   * legacy vẫn `null` kể cả sau Release B. Xem {@link BusinessCode}.
   */
  code?: BusinessCode;
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
  /**
   * Mã tuyến đã chuẩn hoá (trim + uppercase) — dùng `normalizeRouteCode()`.
   * BỎ HẲN field khi không đổi mã; KHÔNG gửi `""` hay `null` để xoá mã, BE
   * không hỗ trợ và sẽ trả `422`.
   */
  code?: string;
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
  /** Xem {@link OperatorRouteRequest.code} — cùng luật chuẩn hoá và cùng lỗi. */
  code?: string;
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

/**
 * Một dòng `statusHistory` của operator parcel detail. Thứ tự BE trả là
 * `occurredAt` tăng dần, rồi tới id trong DB — giữ nguyên, không sort lại.
 */
export type OperatorParcelStatusHistoryItem = {
  status: string;
  occurredAt: string;
  actorType: string;
  actorId?: string | null;
  source: string;
  reason?: string | null;
};

/**
 * `GET /v1/operator/parcels/{parcelId}` — chi tiết đã scope theo tenant trong
 * JWT, là superset của `ParcelDetail` (endpoint passenger `/v1/parcels/{id}`):
 * thêm `statusHistory`, ảnh bằng chứng của crew và các mốc audit
 * review/transfer/return.
 */
export type OperatorParcelDetail = ParcelDetail & {
  senderEmail?: string | null;
  recipientEmail?: string | null;
  checkInPhotoUrls?: string[] | null;
  deliveryPhotoUrls?: string[] | null;
  estimatedLengthCm?: number | null;
  estimatedWidthCm?: number | null;
  estimatedHeightCm?: number | null;
  actualLengthCm?: number | null;
  actualWidthCm?: number | null;
  actualHeightCm?: number | null;
  estimatedDimWeightKg?: number | null;
  actualDimWeightKg?: number | null;
  estimatedGrossPriceVnd?: number | null;
  finalGrossPriceVnd?: number | null;
  discountAmountVnd?: number | null;
  depositPercent?: number | null;
  depositPaymentId?: string | null;
  balancePaymentId?: string | null;
  pricePerKgVnd?: number | null;
  minimumPriceVnd?: number | null;
  dimWeightFactor?: number | null;
  settlementPolicyVersion?: number | null;
  checkedInAt?: string | null;
  checkedInByUserId?: string | null;
  reweighedAt?: string | null;
  reweighedByUserId?: string | null;
  loadedByUserId?: string | null;
  confirmedByUserId?: string | null;
  /** Trạng thái sẽ quay lại sau khi operator xử lý xong pending action */
  pendingActionResumeStatus?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  reviewDecision?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  transferTargetTripId?: string | null;
  transferRequestedAt?: string | null;
  transferConfirmedAt?: string | null;
  transferConfirmedByUserId?: string | null;
  returnReason?: string | null;
  returnedAt?: string | null;
  returnedByUserId?: string | null;
  statusHistory?: OperatorParcelStatusHistoryItem[] | null;
};

export type ParcelResendDeliveryEmailResult = {
  parcelId: string;
  status: string;
  /** Hạn của link xác nhận vừa phát lại */
  expiresAt: string;
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

/**
 * Allow-list BE: status, tripId, pendingActionType, page, pageSize, search,
 * from, to, dateField, sizeCategory, routeId, sortBy, sortDir.
 */
export type OperatorParcelListParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  tripId?: string;
  pendingActionType?: string;
  /**
   * OR-match (contains, có unaccent cho tên và mã nội địa): mã đơn, tên/SĐT
   * người gửi, tên/SĐT người nhận.
   *
   * KHÔNG khớp mã chuyến — Parcel không có trip code canonical, muốn lọc theo
   * chuyến thì dùng `tripId`, theo tuyến thì dùng `routeId`.
   *
   * Từ khoá quá chung có thể nhận `422 SEARCH_TOO_BROAD`; đó KHÔNG phải kết quả
   * rỗng, phải yêu cầu người dùng nhập cụ thể hơn.
   */
  search?: string;
  /** `YYYY-MM-DD`, inclusive theo giờ Việt Nam. Không gửi timestamp UTC. */
  from?: string;
  to?: string;
  /** Mặc định `createdAt` khi có khoảng ngày */
  dateField?: "createdAt" | "finalPaymentDeadline";
  sizeCategory?: ParcelSizeCategory;
  /**
   * Lọc theo `tripSnapshotRouteId`. Đơn cũ có snapshot null sẽ KHÔNG khớp, kể
   * cả khi chuyến hiện tại đang thuộc tuyến đó.
   */
  routeId?: string;
  sortBy?: "createdAt" | "finalPaymentDeadline";
  sortDir?: "asc" | "desc";
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

/**
 * Bản ghi cước phẳng — vẫn là shape của create/patch response.
 * API LIST không còn trả shape này, xem `ParcelRouteFareGroup`.
 */
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

/** Một mức giá bên trong `fares[]` của API list gom theo tuyến. */
export type ParcelRouteFareEntry = {
  sizeCategory: ParcelSizeCategory;
  priceVnd: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

/**
 * Item của `GET /v1/operator/parcel-route-fares` sau khi BE gom theo tuyến
 * (commit BE `9e1488a2`): mỗi tuyến MỘT item, các mức giá nằm trong `fares[]`
 * theo thứ tự SMALL → MEDIUM → LARGE → EXTRA_LARGE.
 *
 * `fares[]` chỉ chứa cỡ ĐÃ lưu trong DB — BE không sinh mức giả, nên tuyến mới
 * cấu hình 2/4 cỡ sẽ chỉ có 2 phần tử. `totalItems` đếm số TUYẾN, không phải số
 * bản ghi cước. BE không tách các mức của cùng một tuyến sang hai trang.
 *
 * List KHÔNG trả tên tuyến — vẫn phải map `routeId` sang tên như trước.
 */
export type ParcelRouteFareGroup = {
  routeId: string;
  fares: ParcelRouteFareEntry[];
};

/**
 * Allow-list BE: routeId, sizeCategory, page, pageSize, search.
 * `search` khớp tên tuyến hoặc tên bến đi/bến đến trong đúng tenant.
 */
/** Trạng thái hiệu lực của một khung giá, neo theo `effectiveAt` */
export type ParcelRouteFareStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED";

export type ParcelRouteFareParams = {
  page?: number;
  pageSize?: number;
  routeId?: string;
  sizeCategory?: ParcelSizeCategory;
  search?: string;
  sortBy?: "priceVnd" | "effectiveFrom";
  sortDir?: "asc" | "desc";
  /**
   * `YYYY-MM-DD` — ngày neo để phân loại hiệu lực. Chỉ gửi `effectiveAt` thì
   * mặc định lấy `ACTIVE` của ngày đó; gửi `status` mà không có `effectiveAt`
   * thì BE neo vào hôm nay.
   */
  effectiveAt?: string;
  /** Window không có `effectiveUntil` không bao giờ bị coi là EXPIRED */
  status?: ParcelRouteFareStatus;
};

/**
 * `GET /v1/operator/parcel-route-fares/summary` — không nhận query,
 * tenant-scoped. Thay cho việc tải toàn bộ fare rồi tự group ở client.
 */
export type ParcelRouteFareSummaryItem = {
  routeId: string;
  /** Không trùng lặp, theo thứ tự enum SMALL → MEDIUM → LARGE → EXTRA_LARGE */
  configuredSizeCategories: ParcelSizeCategory[];
  hasActiveWindow: boolean;
  hasScheduledWindow: boolean;
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

// BE chỉ nhận `rating` (CreateFeedbackSchema là z.object({ rating })) và zod
// strip key lạ trong im lặng — đừng thêm field mới ở đây trước khi BE mở.
export type RagFeedbackRequest = {
  rating: -1 | 1;
};

export type RagFeedbackMessage = {
  id: string;
  role?: RagRole;
  content?: string | null;
  citedChunkIds?: string[];
  queryRewritten?: string | null;
  responseLength?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RagFeedbackConversation = {
  id: string;
  userId?: string | null;
  operatorId?: string | null;
  role?: RagRole;
};

export type RagFeedback = {
  id: string;
  messageId: string;
  conversationId?: string;
  rating: number;
  userId?: string;
  role?: RagRole;
  createdAt: string;
  updatedAt?: string;
  chunkIds?: string[];
  citedChunkIds?: string[];
  responseLength?: number | null;
  message?: RagFeedbackMessage;
  conversation?: RagFeedbackConversation;
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

/**
 * Query của `GET /v1/rag/documents` (ListDocumentsQuerySchema bên service RAG).
 *
 * Lưu ý: từ khoá tìm kiếm ở endpoint này tên là `q`, không phải `search`.
 * `getRagDocuments` tự đổi tên nên page cứ truyền `search` như mọi màn khác.
 *
 * Schema không `.strict()` → key lạ bị Zod strip im lặng, không báo lỗi. Vì vậy
 * type này phải khai đúng allow-list, sai tên là bộ lọc chết mà không ai biết.
 */
export type RagDocumentParams = {
  page?: number;
  pageSize?: number;
  /** createdAt | updatedAt | title | status | ingestStatus */
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: RagDocumentStatus;
  ingestStatus?: RagIngestStatus;
  accessLevel?: RagDocumentAccessLevel;
  category?: RagDocumentCategory;
  documentType?: RagDocumentType;
  operatorId?: string;
  /** Gửi lên BE dưới tên `q`; khớp title / fileName / description */
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

/**
 * Chất lượng phép tính ETA mà BE công bố ra client (Day 51 — migration routing
 * provider sang Goong):
 *
 * - `TRAFFIC_AWARE`: kết quả có tính tình hình giao thông (dữ liệu Trip lịch sử
 *   đã tính trước Day 51).
 * - `ROUTE_BASED`: tính theo quãng đường thực của tuyến, KHÔNG có traffic.
 * - `FALLBACK`: route baseline hoặc tính cục bộ từ GPS speed + khoảng cách.
 *
 * BE nói rõ đây là enum **additive**: còn có thể thêm giá trị mới mà không đổi
 * shape payload, nên union để mở bằng `(string & {})`. UI phải có nhánh mặc
 * định trung tính — gặp giá trị lạ thì hiển thị nhãn chung chứ không được crash
 * hay ẩn cả khối ETA. Xem `describeEtaQuality` trong `src/utils/etaQuality.ts`.
 *
 * Enum là phân loại CHẤT LƯỢNG, không phải tên nhà cung cấp: không được suy ra
 * provider từ giá trị này và không hiển thị tên provider cho người dùng.
 */
export type TrackingEstimateQuality =
  | "TRAFFIC_AWARE"
  | "ROUTE_BASED"
  | "FALLBACK"
  | (string & {});

type TrackingEtaTargetCommon = {
  tripId: string;
  stopName?: string | null;
  etaMinutes: number;
  estimatedArrivalTime: string;
  distanceMeters: number;
  updatedAt: string;
  estimateQuality: TrackingEstimateQuality;
};

export type TrackingStopEta = TrackingEtaTargetCommon & {
  targetKind: "STOP";
  stopId: string;
  stationId?: never;
  sequence?: number;
};

export type TrackingStationEta = TrackingEtaTargetCommon & {
  targetKind: "STATION";
  stationId: string;
  stopId?: never;
  sequence?: never;
};

export type TrackingEtaTarget = TrackingStopEta | TrackingStationEta;

type TrackingEtaDelay = {
  delayed: boolean | null;
  delayStatus: TrackingDelayStatus;
  delayMinutes: number | null;
};

export type TrackingEtaBatchItem = TrackingEtaTarget & TrackingEtaDelay;

export type TrackingEtaBatchResponse = {
  etas: TrackingEtaBatchItem[];
};

export type TrackingEtaBatchUpdate = {
  tripId: string;
  etas: TrackingEtaTarget[];
  updatedAt: string;
};

type TrackingLegacyStopEta = Omit<
  TrackingStopEta,
  "targetKind" | "estimateQuality"
> & {
  targetKind?: "STOP";
  estimateQuality?: TrackingEstimateQuality;
};

export type TrackingEta = (
  | TrackingEtaTarget
  | TrackingLegacyStopEta
) &
  TrackingEtaDelay;

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
  /**
   * Opt-in xe trung chuyển. `"shuttle"` là giá trị DUY NHẤT được hỗ trợ; giá
   * trị khác BE trả `400 VALIDATION_FAILED`. Shuttle chỉ được ghép vào khi
   * `status` bỏ trống hoặc bằng `IN_PROGRESS`.
   */
  include?: "shuttle";
};

// speedKmh/headingDeg bị omit khỏi payload khi nguồn GPS không có.
export type TripFleetLatestItem = {
  /**
   * Optional vì `kind` là field additive BE mới thêm: môi trường chưa deploy
   * commit Gap B vẫn trả item main Trip không có field này. Đừng bắt buộc, nếu
   * không FE lên trước BE là vỡ.
   */
  kind?: "TRIP";
  tripId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDeg?: number;
  recordedAt: string;
  status: OperatorTripStatus;
};

/**
 * GPS gốc của shuttle dùng field `heading`; fleet response đã chuẩn hoá thành
 * `headingDeg` nên hai nhánh dùng chung tên field.
 */
export type ShuttleFleetLatestItem = {
  kind: "SHUTTLE";
  shuttleTripId: string;
  mainTripId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDeg?: number;
  recordedAt: string;
  status: "IN_PROGRESS";
};

/**
 * Discriminated union theo `kind` — KHÔNG đọc `tripId` trên item SHUTTLE và
 * ngược lại. Khoá marker phải prefix (`trip:` / `shuttle:`) vì hai loại id là
 * hai không gian UUID khác nhau, dùng chung khoá trần sẽ đụng nhau.
 */
export type FleetLatestItem = TripFleetLatestItem | ShuttleFleetLatestItem;

export type FleetLatestResponse = {
  items: FleetLatestItem[];
  generatedAt: string;
};

// Hai type guard `isTripFleetItem` / `isShuttleFleetItem` nằm ở
// `components/fleetMapPoint.ts`: chúng là hàm thuần, để ở đây thì mọi page test
// (vốn `vi.mock` cả module API này) đều phải stub lại chúng.

// BE trả kèm hồ sơ hành khách của từng lượt đặt (ShuttlePassengerProfile).
// Chỉ displayName/phone có thể null khi Identity không tìm được hồ sơ —
// `passengers` luôn là mảng (BE khoá contract 2026-08-11).
export type ShuttlePassengerProfile = {
  passengerUserId: string | null;
  displayName: string | null;
  phone: string | null;
  ticketIds: string[];
};

export type ShuttleBookingGroup = {
  bookingId: string;
  passengerCount: number;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  distanceToStationMeters: number | null;
  roadDistanceMeters: number | null;
  requestedAt: string;
  passengers: ShuttlePassengerProfile[];
};

export type ShuttleDirection = "INBOUND_TO_STATION" | "OUTBOUND_FROM_STATION";

export type ShuttleRequestGroup = {
  mainTripId: string;
  // Nhãn tuyến của chuyến chính. `mainTripId` chỉ dùng làm khoá kỹ thuật khi
  // gửi request, không hiển thị UUID cho điều độ viên.
  routeName: string;
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

// Kết quả một thao tác lifecycle Shuttle (cancel request / cancel trip).
// Cancel request chưa assign chưa có ShuttleTrip nên `shuttleTripId` là empty
// UUID; cancel idempotent no-op có thể trả `transitionedAt = null`.
export type ShuttleLifecycleResult = {
  shuttleTripId: string;
  status: string;
  changedPassengerCount: number;
  transitionedAt: string | null;
};

export type CancelShuttleRequest = {
  reason: string;
};

/**
 * Đổi phân công chuyến trung chuyển. Bỏ trống field nào thì BE giữ nguyên giá
 * trị hiện tại của field đó — nhưng phải gửi ít nhất một trong hai.
 */
export type ReassignShuttleTripRequest = {
  driverUserId?: string;
  vehicleId?: string;
  /** Bắt buộc, không được rỗng — lý do đi thẳng vào thông báo cho hành khách */
  reason: string;
};

export type ReassignShuttleTripResult = {
  shuttleTripId: string;
  driverUserId: string;
  vehicleId: string;
};

// ==== Resource availability (driver / assistant / vehicle) ====
// Rule BE: next.start >= previous.end + 30 phút + thời gian chạy xe sang địa
// điểm kế tiếp (handoff mục 4).

export type ResourceRole = "DRIVER" | "ASSISTANT" | "VEHICLE";

export type ResourceConflictReason =
  | "TIME_OVERLAP"
  | "TURNAROUND_REQUIRED"
  | "REPOSITION_REQUIRED"
  | "RESOURCE_ACTIVE";

export type ResourceAssignmentSourceType =
  | "DRIVER_SCHEDULE"
  | "TRIP"
  | "SHUTTLE_TRIP";

export type ResourceConflict = {
  resourceRole: ResourceRole;
  resourceId: string;
  reason: ResourceConflictReason;
  conflictingSourceType: ResourceAssignmentSourceType;
  conflictingSourceId: string;
  sampleRequestedStartAt: string;
  blockingUntil: string;
  // null nghĩa là dời lịch cũng không chen được trước assignment kế tiếp.
  earliestFeasibleStartAt: string | null;
  requiredTravelMinutes: number | null;
  turnaroundMinutes: number;
};

export type ResourceAvailabilityResult = {
  available: boolean;
  turnaroundMinutes: number;
  // Tối đa 100 item; hasMore=true nghĩa là còn conflict chưa trả về.
  conflicts: ResourceConflict[];
  hasMore: boolean;
};

export type DriverScheduleAvailabilityRequest = {
  routeId: string;
  vehicleId?: string | null;
  driverUserId: string;
  assistantUserId?: string | null;
  dayOfWeek: number[];
  departureTime: string;
  validFrom: string;
  validUntil?: string | null;
};

export type ShuttleTripAvailabilityRequest = {
  mainTripId: string;
  direction: ShuttleDirection;
  driverUserId: string;
  vehicleId: string;
  scheduledDepartureTime: string;
  scheduledEndTime: string;
  orderedBookingIds: string[];
};

export const INCIDENT_CATEGORIES = [
  "TRAFFIC_JAM",
  "VEHICLE_BREAKDOWN",
  "ACCIDENT",
  "WEATHER",
  "OTHER",
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatus = "OPEN" | "RESOLVED";

export type OperatorIncident = {
  incidentId: string;
  category: IncidentCategory | string;
  description: string | null;
  /** BE trả null khi tài xế không đính kèm ảnh. */
  photoUrls: string[] | null;
  latitude: number | null;
  longitude: number | null;
  reportedAt: string;
  status: IncidentStatus | string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
  trip: {
    tripId: string;
    status: string;
    departureDateTime: string;
    route: {
      routeId: string;
      name: string;
      originStation: { stationId: string; name: string };
      destinationStation: { stationId: string; name: string };
    };
  };
  /** displayName/role có thể null khi Identity batch lookup thiếu hồ sơ */
  reporter: {
    userId: string;
    displayName: string | null;
    role: string | null;
  };
};

export type ResolveIncidentRequest = {
  /** BE trim rồi bắt buộc còn 1..1000 ký tự */
  resolutionNote: string;
};

/**
 * Allow-list BE: tripId, category, status, from, to, page, pageSize, search,
 * reportedByUserId, sortBy, sortDir.
 */
export type OperatorIncidentParams = {
  page?: number;
  pageSize?: number;
  tripId?: string;
  category?: IncidentCategory;
  /** Chỉ OPEN hoặc RESOLVED */
  status?: string;
  /** `YYYY-MM-DD`, inclusive */
  from?: string;
  to?: string;
  /**
   * OR-match mô tả sự cố và tên người báo (BE hỏi Identity).
   * Identity chết thì trả `503 UPSTREAM_UNAVAILABLE` — đó KHÔNG phải "không có
   * sự cố nào", không được hiển thị thành danh sách rỗng.
   */
  search?: string;
  reportedByUserId?: string;
  sortBy?: "reportedAt" | "resolvedAt";
  sortDir?: "asc" | "desc";
};

export type OperatorShuttleTripStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Chỉ có hai giá trị; BE không sinh action nào khác. */
export type ShuttleAssignmentAction = "INITIAL_ASSIGNED" | "REASSIGNED";

export type ShuttleAssignmentActor = {
  userId: string;
  displayName: string | null;
  role: string | null;
};

/**
 * Lần gán/đổi xe-tài xế GẦN NHẤT của chuyến trung chuyển.
 *
 * `null` với chuyến cũ chưa có bản ghi audit. Khi đó phải hiện "Chưa có dữ liệu
 * người gán" — TUYỆT ĐỐI không lấy `createdBy` thay thế: đó là người tạo chuyến,
 * không chứng minh được ai đã gán xe/tài xế hiện tại.
 */
export type ShuttleLatestAssignment = {
  action: ShuttleAssignmentAction;
  assignedAt: string;
  assignedBy: ShuttleAssignmentActor;
  reason: string | null;
};

export type OperatorShuttleTripListItem = {
  shuttleTripId: string;
  mainTripId: string;
  direction: ShuttleDirection;
  status: OperatorShuttleTripStatus;
  scheduledDepartureTime: string;
  scheduledEndTime: string;
  actualDepartureTime: string | null;
  completedAt: string | null;
  createdBy?: string | null;
  vehicle: { id: string; licensePlate: string };
  driver: { id: string; displayName: string | null; phone: string | null };
  passengerCount: number;
  stopCount: number;
  latestAssignment?: ShuttleLatestAssignment | null;
};

/**
 * Một dòng lịch sử điều phối. Snapshot before/after là dữ liệu CỐ ĐỊNH tại thời
 * điểm thao tác — BE không lookup lại, nên lịch sử không bị sửa ngược.
 *
 * `INITIAL_ASSIGNED`: `previousDriver`/`previousVehicle` là `null`, `reason`
 * thường `null`. `REASSIGNED`: `reason` luôn có giá trị.
 */
export type ShuttleAssignmentHistoryItem = {
  id: string;
  action: ShuttleAssignmentAction;
  assignedAt: string;
  assignedBy: ShuttleAssignmentActor;
  reason: string | null;
  previousDriver: { id: string; displayName: string | null } | null;
  currentDriver: { id: string; displayName: string | null } | null;
  previousVehicle: { id: string; licensePlate: string } | null;
  currentVehicle: { id: string; licensePlate: string } | null;
};

// `status` nhận nhiều giá trị ngăn cách bởi dấu phẩy (BE tự split).
export type OperatorShuttleTripsParams = PageParams & {
  from?: string;
  to?: string;
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
  /**
   * Handoff Day 51 xếp ETA Shuttle chung ô `estimateQuality` với stop/station,
   * nhưng payload Shuttle hiện tại của Tracking CHƯA kèm field này. Để optional
   * để bật lên bên BE là FE hiển thị được ngay, chưa có thì badge tự ẩn.
   */
  estimateQuality?: TrackingEstimateQuality;
};

/**
 * BE khoá 5 giá trị nhưng để mở kiểu string phòng khi thêm trạng thái mới —
 * xem FE-REQUEST-shuttle-operator-tracking-RESPONSE.md §1.
 */
export type ShuttleStopStatus =
  | "PENDING"
  | "PICKED_UP"
  | "DELIVERED"
  | "NO_SHOW"
  | "CANCELLED"
  | (string & {});

export type OperatorShuttleTrackingStop = {
  /** Thứ tự nghiệp vụ, KHÔNG phải index mảng — đối chiếu ETA bằng field này */
  pickupOrder: number;
  bookingId: string | null;
  latitude: number;
  longitude: number;
  status: ShuttleStopStatus;
  /** true = bến xe, không phải điểm đón nhà khách */
  isStation: boolean;
  serviceAddress?: string;
  serviceOrder?: number;
  roadDistanceMeters?: number;
};

export type OperatorShuttleStation = {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
  pickupOrder: number;
};

/**
 * Context đầy đủ điểm đón + bến của một chuyến trung chuyển, dành riêng cho
 * nhà xe (`OPERATOR_ADMIN` / `OPERATOR_STAFF` cùng `operatorId`). BE cố tình
 * KHÔNG trả tên/SĐT hành khách — màn tracking không cần và không được lộ.
 *
 * `station` có thể null: phải chịu được, đừng để vỡ bản đồ.
 */
export type OperatorShuttleContext = {
  shuttleTripId: string;
  mainTripId: string;
  direction: ShuttleDirection;
  status: OperatorShuttleTripStatus | (string & {});
  stops: OperatorShuttleTrackingStop[];
  station: OperatorShuttleStation | null;
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
  newUserOnly?: boolean;
  applicablePaymentMethods?: PaymentMethod[];
  applicableServices: VoucherService[];
  applicableRouteIds?: string[] | null;
  applicableOperatorIds: string[] | null;
  fundingType: string;
};

export type UpdateAdminVoucherRequest = Partial<
  Omit<
    CreateAdminVoucherRequest,
    "code" | "type" | "fundingType" | "applicableOperatorIds"
  >
>;

/**
 * Allow-list BE: fundingType, isActive, search, service, page, pageSize,
 * sortBy, sortDir. Endpoint chỉ trả voucher nền tảng (ownerOperatorId = null)
 * nên KHÔNG còn nhận `ownerOperatorId`.
 */
export type VoucherSortBy =
  | "createdAt"
  | "validFrom"
  | "validUntil"
  | "code"
  | "name"
  | "isActive"
  | "usedCount";

export type AdminVoucherParams = {
  page?: number;
  pageSize?: number;
  sortBy?: VoucherSortBy;
  sortDir?: "asc" | "desc";
  fundingType?: string;
  isActive?: boolean;
  /** contains, case-insensitive trên `code` HOẶC `name` */
  search?: string;
  /** Khớp phần tử trong `applicableServices` */
  service?: VoucherService;
  type?: VoucherDiscountType;
  /**
   * `YYYY-MM-DD`. KHÁC `isActive`: `isActive` là cờ bật/tắt, còn `validAt` hỏi
   * cửa sổ `validFrom..validUntil` có giao với ngày đó không. Voucher đã hết hạn
   * vẫn có thể `isActive=true`.
   */
  validAt?: string;
};

/**
 * Allow-list BE: isActive, search, service, type, validAt, page, pageSize,
 * sortBy, sortDir. Owner lấy từ JWT — không gửi `ownerOperatorId` hay
 * `fundingType`.
 */
export type OperatorVoucherParams = {
  page?: number;
  pageSize?: number;
  sortBy?: VoucherSortBy;
  sortDir?: "asc" | "desc";
  isActive?: boolean;
  search?: string;
  service?: VoucherService;
  type?: VoucherDiscountType;
  validAt?: string;
};

/**
 * `GET /v1/{admin|operator}/vouchers/summary` — không nhận query, đếm trên toàn
 * bộ voucher trong phạm vi (platform hoặc tenant), không đổi theo filter list.
 */
export type VoucherSummary = {
  total: number;
  /** Đếm cờ `isActive`, KHÔNG đồng nghĩa đang trong cửa sổ hiệu lực */
  active: number;
  /** `booking` và `parcel` có thể chồng lắp nếu voucher áp dụng cả hai */
  booking: number;
  parcel: number;
  /** Đang bật, đã bắt đầu, và hết hạn trong 7 ngày tới */
  expiringIn7Days: number;
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
  /** Filter exact: resolve chính xác passenger qua Identity */
  passengerPhone?: string;
  /** Filter exact, không phân biệt hoa thường */
  bookingCode?: string;
  /**
   * Ô tìm kiếm tổng quát. OR-match: mã đặt vé, tên người đặt, và số điện thoại
   * người đặt nếu chuỗi normalize được về E.164 Việt Nam.
   *
   * BE không index tên từng hành khách (PII) — tìm theo tên hành khách trên vé
   * sẽ không ra kết quả, chỉ tên NGƯỜI ĐẶT mới khớp.
   */
  search?: string;
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
  /** Số **booking** no-show */
  totalNoShows?: number;
  /** Số **hành khách** no-show — khác `totalNoShows`, đừng dùng lẫn */
  noShowPassengerCount?: number;
  totalPartialNoShows?: number;
  totalCompleted?: number;
};

export type BookingStatsAggregate = {
  items: BookingStatsItem[];
  totalBookings?: number;
  totalCancellations?: number;
  /** Số **booking** no-show */
  totalNoShows?: number;
  /** Số **hành khách** no-show — thay cho việc tải hết booking NO_SHOW để cộng */
  noShowPassengerCount?: number;
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
  /**
   * Mã chuyến người đọc được (`TRIP-20260824-M5Q7WV3D`). Xem
   * {@link BusinessCode}: hiển thị `-` khi thiếu, KHÔNG dựng mã từ `tripId`.
   */
  tripCode?: BusinessCode;
  status: string;
  route: {
    routeId: string;
    /** Mã tuyến (`SG-DL-01`) — xem {@link BusinessCode}. */
    code?: BusinessCode;
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

/**
 * Sửa thông tin chuyến đã sinh (`PATCH /v1/operator/trips/{tripId}`). Chỉ gửi
 * field thật sự đổi — BE nhận partial và bỏ qua field vắng mặt.
 */
export type UpdateOperatorTripRequest = {
  baseFare?: number | null;
  notes?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
};

/** Trạm đầu/cuối rút gọn trong chi tiết chuyến của nhà xe. */
export type OperatorTripStationRef = {
  id: string;
  name: string | null;
};

export type OperatorTripDetail = {
  tripId: string;
  operatorId?: string;
  routeId?: string;
  vehicleId?: string;
  status?: string | null;
  departureDateTime?: string;
  estimatedArrivalTime?: string;
  destinationArrivedAt?: string | null;
  baseFare?: number;
  originStation?: OperatorTripStationRef | null;
  destinationStation?: OperatorTripStationRef | null;
  seatSummary?: { totalSeats: number; availableSeats: number } | null;
  returnRouteId?: string | null;
  alternativeRouteId?: string | null;
  tripCode?: BusinessCode;
  routeCode?: BusinessCode;
  notes?: string | null;
  plannedEtaQuality?: string | null;
  surchargePercent?: number;
  surchargeAmount?: number;
  effectiveFare?: number;
  surchargePeriodId?: string | null;
  surchargePeriodName?: string | null;
};

/**
 * Ước tính thiệt hại trước khi huỷ chuyến
 * (`POST /v1/operator/trips/{tripId}/cancel/preview`). Endpoint này KHÔNG đổi
 * dữ liệu — gọi trước để nhà xe thấy tổng tiền phải hoàn rồi mới quyết định.
 */
export type OperatorTripCancelPreview = {
  tripId: string;
  status?: string | null;
  affectedBookingIds?: string[] | null;
  refundTotalBooking?: number;
  affectedParcelIds?: string[] | null;
  refundTotalParcel?: number;
  grandTotal?: number;
};

export type OperatorTripCancelResult = {
  tripId: string;
  status?: string | null;
};

export type AddRouteStopRequest = {
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number;
  distanceFromOriginKm?: number | null;
  allowPickup?: boolean | null;
  allowDropoff?: boolean | null;
};

export type RouteStopLink = {
  routeId: string;
  stopId: string;
  orderIndex: number;
  estimatedDurationFromOriginMinutes: number;
  distanceFromOriginKm?: number | null;
  allowPickup?: boolean;
  allowDropoff?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Một hành khách trong nhóm đón của chuyến trung chuyển. */
export type ShuttleTripPassenger = {
  passengerUserId?: string | null;
  displayName?: string | null;
  phone?: string | null;
  ticketIds?: string[] | null;
};

/**
 * Nhóm khách theo từng điểm đón của chuyến trung chuyển — mỗi nhóm là một
 * booking, `pickupOrder` khớp với thứ tự điểm đón mà tài xế đi.
 */
export type ShuttleTripPassengerGroup = {
  pickupOrder: number;
  bookingId?: string | null;
  bookingCode?: BusinessCode;
  pickupAddress?: string | null;
  passengerCount?: number;
  passengers?: ShuttleTripPassenger[] | null;
};

export type ShuttleTripPassengerList = {
  shuttleTripId: string;
  groups?: ShuttleTripPassengerGroup[] | null;
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

/**
 * Query của `GET /v1/admin/policies` và bản operator tương ứng.
 *
 * Schema Zod bên service RAG khai `.strict()` — KHÁC với `/v1/rag/documents`.
 * Gửi key ngoài danh sách này trả **400**, không phải bị strip im lặng. Vì vậy
 * không mở rộng `PageParams` (nó có `status` không thuộc allow-list).
 *
 * Cũng lưu ý: cờ bật/tắt ở đây tên là `active`, không phải `isActive`.
 */
export type PolicyListParams = {
  page?: number;
  pageSize?: number;
  policyType?: PolicyAudience;
  category?: string;
  active?: boolean;
  search?: string;
  sortBy?: "updatedAt" | "createdAt" | "title" | "version";
  sortDir?: "asc" | "desc";
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
  usablePassengerCapacity?: number;
  // Projection assignment của xe (mục 9.6). currentAssignment chỉ là reservation
  // đã chuyển ACTIVE — reservation tới giờ nhưng còn RESERVED vẫn nằm ở
  // nextAssignment, đừng suy ra từ đồng hồ.
  currentAssignment?: VehicleAssignment | null;
  nextAssignment?: VehicleAssignment | null;
};

// tripId và shuttleTripId loại trừ nhau theo sourceType. driverUserId là driver
// của đúng assignment đó, KHÔNG phải driver cố định của xe.
export type VehicleAssignment = {
  sourceType: "TRIP" | "SHUTTLE_TRIP";
  tripId: string | null;
  shuttleTripId: string | null;
  driverUserId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  status: "RESERVED" | "ACTIVE";
  startStationId: string | null;
  endStationId: string | null;
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
  aisles?: Array<{ afterCol: number }>;
};

export type FirebaseUploadPurpose =
  | "VEHICLE_IMAGE"
  | "OPERATOR_LOGO"
  /** Ảnh khách tự chụp lúc gửi hàng — lưu ở `parcels/{userId}/`. */
  | "PARCEL_PHOTO"
  /** Ảnh phía vận hành — lưu ở `parcel-ops/{operatorId}/{userId}/`. */
  | "PARCEL_EVIDENCE_PHOTO"
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

export type TripSearchPointType = "STATION" | "STOP";

/** Một điểm đón hoặc trả hợp lệ trong kết quả Trip Search */
export type TripSearchPoint = {
  type: TripSearchPointType;
  stationId: string | null;
  stopId: string | null;
  name: string;
  address: string | null;
  orderIndex: number;
  estimatedTime: string | null;
  allowPickup: boolean;
  allowDropoff: boolean;
};

/**
 * Hai mode loại trừ nhau. Có đủ cặp Station ID thì mode Station thắng và mọi
 * province/ward code gửi kèm đều bị bỏ qua.
 *
 * `originLocationCode`/`destinationLocationCode` của contract cũ đã bị BE gỡ:
 * gửi lên chỉ bị ASP.NET bỏ qua rồi trả 422 vì thiếu cặp hợp lệ.
 */
export type PublicTripSearchParams = {
  originStationId?: string;
  destinationStationId?: string;
  /** Đúng 2 chữ số, top-level active */
  originProvinceCode?: string;
  /** Đúng 5 chữ số, leaf active thuộc originProvinceCode */
  originWardCode?: string;
  destinationProvinceCode?: string;
  destinationWardCode?: string;
  departureDate: string;
  passengerCount: number;
  /** @deprecated BE vẫn bind để tương thích nhưng handler không dùng */
  allowAlongRoutePickup?: boolean;
};

export type PublicTrip = {
  tripId: string;
  /** Mã chuyến top-level của `GET /v1/trips/{id}` — xem {@link BusinessCode}. */
  tripCode?: BusinessCode;
  operatorId: string;
  operatorName?: string;
  routeId: string;
  /**
   * Mã tuyến, trả **top-level** ở Trip detail (không nằm trong object `route`
   * như bên Trip list). Xem {@link BusinessCode}.
   */
  routeCode?: BusinessCode;
  vehicleId?: string;
  status: string;
  departureTime: string;
  estimatedArrivalTime: string;
  destinationArrivedAt?: string | null;
  plannedEtaQuality?: TrackingEstimateQuality;
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
  /** Terminal của Route — KHÔNG mặc định là điểm khách chọn khi đi qua Stop */
  originStation: Pick<Station, "id" | "name">;
  destinationStation: Pick<Station, "id" | "name">;
  /** Điểm đón hợp lệ; chỉ có trong response của /v1/trips/search */
  pickupPoints?: TripSearchPoint[];
  /** Điểm trả hợp lệ; pickup.orderIndex phải nhỏ hơn dropoff.orderIndex */
  dropoffPoints?: TripSearchPoint[];
  stops: Array<{
    stopId: string;
    name?: string;
    orderIndex: number;
    allowPickup: boolean;
    allowDropoff: boolean;
    status?: string;
    estimatedArrivalTime: string;
    distanceFromOriginKm: number;
    fareFromThisStop: number;
  }>;
};

export type TripRouteGeometryPoint = {
  latitude: number;
  longitude: number;
  orderIndex?: number;
};

// Bến đầu/cuối kèm theo lộ trình — dùng vẽ marker và làm waypoint tính đường
export type TripRouteGeometryStation = {
  stationId: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type TripRouteGeometryStop = {
  stopId: string;
  name: string;
  sequence: number;
  latitude: number;
  longitude: number;
};

export type TripRouteGeometry = {
  tripId: string;
  tripStatus?: string;
  // Shape theo contract hiện hành: polyline THẬT của tuyến nằm trong
  // `geometry.points`; `geometry: null` nghĩa là tuyến chưa lưu polyline —
  // client KHÔNG được nối các marker bên dưới thành tuyến giả (đường chim bay).
  geometry?: {
    source: "ROUTE_POLYLINE";
    points: TripRouteGeometryPoint[];
  } | null;
  originStation?: TripRouteGeometryStation | null;
  intermediateStops?: TripRouteGeometryStop[];
  destinationStation?: TripRouteGeometryStation | null;
  // Shape phẳng cũ (BE trước contract mới) — vẫn đọc được để không vỡ khi rolling deploy
  encodedPolyline?: string;
  geoJson?: unknown;
  points?: TripRouteGeometryPoint[];
  // Nguồn hình học ở shape phẳng: "STOPS_ONLY" nghĩa là `points` CHỈ là toạ độ
  // điểm dừng, không phải polyline bám đường — client không được vẽ nó thành tuyến.
  geometrySource?: "ROUTE_POLYLINE" | "STOPS_ONLY";
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

export type OperatorDriverSchedule = {
  id: string;
  operatorId: string;
  routeId: string;
  vehicleId: string;
  driverId?: string;
  driverUserId?: string;
  assistantId?: string | null;
  assistantUserId?: string | null;
  baseFare: number | null;
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
  // Luôn "Asia/Ho_Chi_Minh" theo contract hiện tại — departureTime/validFrom
  // luôn hiểu theo timezone này dù field vắng mặt trên response cũ.
  timeZone?: string;
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
  baseFare?: number | null;
  departureTime: string;
  validFrom: string;
  validUntil?: string | null;
  dayOfWeek: number[];
  isActive: boolean;
};

/**
 * Allow-list BE: page, pageSize, routeId, driverUserId, isActive, search,
 * vehicleTypeId. Không có `isOneTime` — domain chỉ có lịch lặp theo tuần, BE đã
 * chốt bỏ hẳn khái niệm này. Cũng không có sortBy/sortDir.
 */
export type OperatorDriverScheduleParams = {
  page?: number;
  pageSize?: number;
  routeId?: string;
  driverUserId?: string;
  assistantUserId?: string;
  isActive?: boolean;
  /** OR-match: tên tuyến, biển số xe, tên tài xế, tên phụ xe */
  search?: string;
  vehicleTypeId?: string;
  /** 1 = Thứ Hai … 7 = Chủ Nhật */
  dayOfWeek?: number;
  /**
   * `HH:mm`, inclusive. KHÔNG hỗ trợ ca qua nửa đêm — gửi
   * `departureFrom=22:00&departureTo=02:00` sẽ nhận 422, phải tách hai request.
   */
  departureFrom?: string;
  departureTo?: string;
  /** `YYYY-MM-DD` nằm trong `validFrom..validUntil`; độc lập với `isActive` */
  effectiveAt?: string;
  sortBy?: "departureTime" | "effectiveFrom";
  sortDir?: "asc" | "desc";
};

// GET /v1/driver/me/schedule — query không filter status nên trips có thể ở mọi
// trạng thái kể cả CANCELLED/DISRUPTED (mục 10.1).
export type DriverMeScheduleParams = {
  from?: string;
  to?: string;
};

export type DriverMeScheduleTrip = {
  tripId: string;
  operatorId: string;
  routeId: string;
  vehicleId: string;
  departureDateTime: string;
  estimatedArrivalTime: string;
  status: string;
  assignmentRole: "DRIVER" | "ASSISTANT";
};

export type DriverMeSchedule = {
  from: string;
  to: string;
  trips: DriverMeScheduleTrip[];
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
  baseFare?: number | null;
  validUntil?: string | null;
  isActive?: boolean;
};

export type DriverScheduleApplyTo = "FUTURE_ONLY" | "ALL_PENDING";

/**
 * Thay xe cho chuyến ĐANG CHẠY (handoff Web Operator "đổi xe do sự cố",
 * 2026-08-30 — bản này THAY THẾ handoff B1-B7 ngày 2026-08-25).
 *
 * Chỉ `OPERATOR_ADMIN` gọi được; `OPERATOR_STAFF` nhận `403 FORBIDDEN`.
 *
 * - `incidentId` BẮT BUỘC và phải là sự cố thuộc đúng chuyến/operator; sai
 *   chuyến là `422 VALIDATION_ERROR`.
 * - `replacementCrew` BẮT BUỘC, và cả `driverId` lẫn `assistantId` đều bắt
 *   buộc. Handoff nói rõ KHÔNG được gửi `null` cho ba field này — nên type
 *   không còn cho phép `null` nữa (khác bản 2026-08-25 cho phụ xe optional).
 * - Xe/tài xế/phụ xe mới không được trùng của chuyến cũ (`409
 *   TRIP_VEHICLE_SAME_AS_OLD` / `409 TRIP_CREW_SAME_AS_OLD`).
 * - `reason` BẮT BUỘC: BE trim rồi kiểm không rỗng, tối đa 500 ký tự.
 * - `estimatedRecoveryDepartureAt` phải là mốc tuyệt đối offset UTC = 0 (gửi
 *   `toISOString()`, hậu tố `Z`) và phải SAU thời điểm gián đoạn.
 * - `acknowledgeInsufficientSeats`: BE CHẶN CỨNG khi xe thay thiếu ghế
 *   (`409 REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS`). Chỉ gửi `true` sau khi
 *   người vận hành đã thấy con số thiếu ghế của BE và xác nhận — và phải dùng
 *   Idempotency-Key MỚI vì body đã đổi.
 * - BE từ chối field lạ (`422 VALIDATION_ERROR`), đừng gửi thừa.
 */
export type SubstituteVehicleRequest = {
  replacementVehicleId: string;
  /** Sự cố của CHÍNH chuyến này — không có thì BE trả `422 VALIDATION_ERROR`. */
  incidentId: string;
  estimatedRecoveryDepartureAt: string;
  reason: string;
  notifyPassengers?: boolean;
  /** Không optional và không nhận `null`: cả kíp mới phải chọn đủ. */
  replacementCrew: {
    driverId: string;
    assistantId: string;
  };
  acknowledgeInsufficientSeats?: boolean;
};

/**
 * Ba con số BE trả kèm `409 REPLACEMENT_VEHICLE_INSUFFICIENT_SEATS`, đọc từ
 * `error.fields[]` (BE gửi dưới dạng CHUỖI). Đọc theo TÊN field, không theo thứ
 * tự — handoff nói rõ thứ tự không phải hợp đồng.
 */
export type ReplacementSeatShortage = {
  usableSeats: number | null;
  passengersToTransfer: number | null;
  missingSeats: number | null;
};

export type TripDisruptionRequest = {
  reason: string;
};

export type TripOperationResult = {
  tripId?: string;
  substitutionId?: string;
  oldTripId?: string;
  /** Sau khi thay xe thành công: `DISRUPTED`. */
  oldTripStatus?: string | null;
  newTripId?: string;
  /** Sau khi thay xe thành công: `BOARDING`. */
  newTripStatus?: string | null;
  newTripDepartureDateTime?: string;
  /**
   * `QUEUED` = luồng chuyển hàng ĐANG CHỜ crew xác nhận. Tuyệt đối KHÔNG hiển
   * thị là hàng đã sang xe mới cho tới khi có confirm thành công (handoff
   * 2026-08-30 mục "API đổi xe").
   */
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

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordResult = {
  userId: string;
  sessionsRevoked: boolean;
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

export function requestForgotPassword(
  request: ForgotPasswordRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ForgotPasswordResult>("/v1/auth/forgot-password", {
    method: "POST",
    body: request,
    authenticated: false,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function resetPassword(
  request: ResetPasswordRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ResetPasswordResult>("/v1/auth/reset-password", {
    method: "POST",
    body: request,
    authenticated: false,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function changePassword(
  request: ChangePasswordRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ChangePasswordResult>("/v1/auth/change-password", {
    method: "POST",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getAdminOperatorDetail(operatorId: string) {
  return apiRequest<AdminOperatorDetail>(`/v1/admin/operators/${operatorId}`);
}

/**
 * Allow-list BE: page, pageSize, search, sortBy, sortDir, status, isActive,
 * from, to, dateField.
 *
 * `status` (registrationStatus) và `isActive` là HAI khái niệm riêng: nhà xe đã
 * duyệt vẫn có thể bị tắt. Không gộp chúng thành một dropdown.
 */
export type AdminOperatorParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";
  isActive?: boolean;
  /** `YYYY-MM-DD`, inclusive */
  from?: string;
  to?: string;
  /** Mặc định `createdAt` khi có khoảng ngày */
  dateField?: "createdAt" | "approvedAt";
  sortBy?:
    | "name"
    | "contactEmail"
    | "contactPhone"
    | "businessRegistrationNumber"
    | "taxCode"
    | "registrationStatus"
    | "isActive"
    | "createdAt"
    | "approvedAt"
    | "suspendedAt";
  sortDir?: "asc" | "desc";
};

/** Bộ lọc dùng chung cho list và export; export KHÔNG nhận page/pageSize */
export type AdminOperatorExportParams = Omit<
  AdminOperatorParams,
  "page" | "pageSize"
>;

/**
 * `GET /v1/admin/operators/summary` — không nhận query, đếm trên toàn platform
 * và KHÔNG đổi theo filter của list.
 */
export type AdminOperatorSummary = {
  total: number;
  pending: number;
  approved: number;
  suspended: number;
  rejected: number;
  active: number;
};

export function getAdminOperators(params: AdminOperatorParams = {}) {
  return apiRequest<PagedResult<AdminOperator>>(
    `/v1/admin/operators${buildQuery(params)}`,
  );
}

export function getAdminOperatorSummary() {
  return apiRequest<AdminOperatorSummary>("/v1/admin/operators/summary");
}

/**
 * Tải CSV do BE dựng: UTF-8 BOM (Excel đọc đúng tiếng Việt), escape RFC 4180,
 * và xuất **toàn bộ** dòng khớp filter chứ không chỉ trang hiện tại.
 * Không parse CSV rồi dựng lại ở browser.
 */
export function exportAdminOperators(params: AdminOperatorExportParams = {}) {
  return apiBlobRequest(`/v1/admin/operators/export${buildQuery(params)}`, {
    headers: { Accept: "text/csv" },
  });
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

/**
 * Allow-list BE (`AdminLocationsController`): page, pageSize, search, isActive,
 * type, parentCode. Key ngoài danh sách này trả 422 VALIDATION_ERROR chứ không
 * còn bị bỏ qua im lặng như trước — đừng spread `PageParams` vào đây.
 *
 * `parentCode` chỉ nhận mã của location cấp trên cùng; truyền mã không tồn tại
 * hoặc không phải top-level thì BE trả 422 tại field `parentCode`.
 */
export async function getAdminLocations(params: AdminLocationParams = {}) {
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

export async function getAdminUsers(
  params: AdminUserParams = {},
): Promise<PagedResult<AdminUser>> {
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

export function getAdminPlatformReport(params: AdminPlatformReportParams) {
  return apiRequest<AdminPlatformReport>(
    `/v1/admin/reports/platform${buildQuery(params)}`,
  );
}

/**
 * Nhật ký hoạt động toàn hệ thống cho SYSTEM_ADMIN.
 *
 * `data.items` có thể là `null` (BE trả null thay vì mảng rỗng cho trang trống)
 * — mọi caller phải chịu được, xem cách màn Nhật ký chuẩn hoá về `[]`.
 */
export function getAdminActivityLogs(params: AdminActivityLogParams = {}) {
  return apiRequest<PagedResult<AdminActivityLogItem>>(
    `/v1/admin/activity-logs${buildQuery(params)}`,
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

// Nhận NGUYÊN chuỗi query VNPay (window.location.search) và chuyển thẳng lên
// Backend — không parse/lọc/đổi tên/sắp lại thứ tự param vì chữ ký vnp_SecureHash
// được tính trên đúng chuỗi đó (handoff §2.2). Endpoint public: chính chữ ký
// trong query xác thực request, nên không gắn Authorization.
export function getVnPayReturnStatus(rawQuery: string) {
  const query = rawQuery.startsWith("?") ? rawQuery : `?${rawQuery}`;
  return apiRequest<VnPayReturnStatus>(
    `/v1/payments/vnpay-return-status${query}`,
    { authenticated: false },
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

// Bước 1 của nâng cấp: xin báo giá. Chưa tạo Payment, chưa trừ tiền — chỉ mở
// một upgrade attempt kèm breakdown và hạn `dueAt`.
export function createSubscriptionUpgradeQuote(
  request: SubscriptionUpgradeQuoteRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<SubscriptionUpgradeQuote>(
    "/v1/operator/subscription/upgrade/quote",
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

// Bước 2: chốt thanh toán cho attempt đã báo giá. KHÔNG có request body.
//
// Mỗi lần bấm phải truyền một Idempotency-Key MỚI. Dùng lại key đã nhận
// 402 WALLET_INSUFFICIENT_BALANCE sẽ được replay đúng response 402 cũ trong
// 24 giờ — nạp tiền xong rồi confirm lại bằng key đó vẫn hỏng.
export function confirmSubscriptionUpgradePayment(
  upgradeAttemptId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<SubscriptionUpgradePaymentResult>(
    `/v1/operator/subscription/upgrade/${upgradeAttemptId}/payment`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

// Nhà xe xin gói riêng. Mỗi nhà xe chỉ được một yêu cầu PENDING_REVIEW —
// gửi thêm sẽ nhận 409 CUSTOM_REQUEST_ALREADY_PENDING.
export function createOperatorCustomPlanRequest(
  request: CreateCustomPlanRequestPayload,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<OperatorCustomPlanRequest>(
    "/v1/operator/subscription/custom-requests",
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function getOperatorCustomPlanRequests() {
  return apiRequest<OperatorCustomPlanRequest[]>(
    "/v1/operator/subscription/custom-requests",
  );
}

export function getOperatorCustomPlanRequest(requestId: string) {
  return apiRequest<OperatorCustomPlanRequest>(
    `/v1/operator/subscription/custom-requests/${requestId}`,
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
  params: AdminWalletTransactionParams = {},
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

export function getAdminCustomPlanRequests() {
  return apiRequest<AdminCustomPlanRequest[]>(
    "/v1/admin/subscription-plans/custom-requests",
  );
}

export function getAdminCustomPlanRequest(requestId: string) {
  return apiRequest<AdminCustomPlanRequest>(
    `/v1/admin/subscription-plans/custom-requests/${requestId}`,
  );
}

// Duyệt: admin chốt tên, mô tả, sáu quota, ba module và hai giá. Quota duyệt
// thấp hơn usage hiện tại của nhà xe → 422 CUSTOM_PLAN_LIMIT_BELOW_CURRENT_USAGE
// kèm `error.fields` chỉ đúng ô nào sai (đọc qua ApiRequestError.fields).
export function approveAdminCustomPlanRequest(
  requestId: string,
  request: ApproveCustomPlanRequestPayload,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<AdminCustomPlanRequest>(
    `/v1/admin/subscription-plans/custom-requests/${requestId}/approve`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function rejectAdminCustomPlanRequest(
  requestId: string,
  request: RejectCustomPlanRequestPayload,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<AdminCustomPlanRequest>(
    `/v1/admin/subscription-plans/custom-requests/${requestId}/reject`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

export function searchStations(params: StationSearchParams) {
  return apiRequest<Station[]>(`/v1/stations/search${buildQuery(params)}`);
}

// `data` là array phẳng, không phải paged payload.
// Không truyền parentCode -> chỉ tỉnh/thành; có parentCode -> chỉ phường/xã trực thuộc.
export function getPublicLocations(params: PublicLocationParams = {}) {
  return apiRequest<AdminLocation[]>(`/v1/locations${buildQuery(params)}`, {
    authenticated: false,
  });
}

export function getAdminStations(params: AdminStationParams = {}) {
  return apiRequest<PagedResult<AdminStation>>(
    `/v1/admin/stations${buildQuery(params)}`,
  );
}

export function getAdminStationSummary() {
  return apiRequest<AdminStationSummary>("/v1/admin/stations/summary");
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

export function attachOperatorStation(stationId: string) {
  return createOperatorStation({ stationId });
}

/**
 * Allow-list BE: page, pageSize, search, isActive, supportsShuttle, sortBy,
 * sortDir.
 *
 * Hai cờ boolean là HAI khái niệm khác nhau, không được gộp thành một trạng
 * thái: `isActive` là cờ của liên kết OperatorStation (nhà xe có dùng bến này
 * không), còn `supportsShuttle` là cờ canonical của chính cái bến.
 */
export type OperatorStationParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  supportsShuttle?: boolean;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortDir?: "asc" | "desc";
};

export function getOperatorStations(params: OperatorStationParams = {}) {
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

/**
 * Allow-list BE: page, pageSize, search, isActive, routeId.
 * `routeId` lọc membership qua bảng route-stop ngay trong SQL, trước count và
 * paging — không cần tải hết stop rồi tự đối chiếu.
 */
export type OperatorStopParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  routeId?: string;
};

export function getOperatorStops(params: OperatorStopParams = {}) {
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

/**
 * Allow-list BE: page, pageSize, search, isActive. Endpoint này KHÔNG nhận
 * `status` (gửi lên là 422) — dropdown trạng thái map sang boolean `isActive`.
 */
export type OperatorRouteParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  originStationId?: string;
  destinationStationId?: string;
  sortBy?: "name" | "totalDistanceKm" | "estimatedDurationMinutes";
  sortDir?: "asc" | "desc";
};

export function getOperatorRoutes(params: OperatorRouteParams = {}) {
  return apiRequest<PagedResult<OperatorRoute>>(
    `/v1/operator/routes${buildQuery(params)}`,
  );
}

export function getOperatorRoute(id: string) {
  return apiRequest<OperatorRoute>(`/v1/operator/routes/${id}`);
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

// Preview conflict trước khi tạo/sửa lịch lặp. Preview KHÔNG validate tồn tại/
// role/status/tenant của vehicle và user — chỉ create/mutation mới validate
// (mục 7.2 + 14.1). Đừng dùng available=true như cam kết cho lần create sau.
export function checkDriverScheduleAvailability(
  request: DriverScheduleAvailabilityRequest,
  signal?: AbortSignal,
) {
  return apiRequest<ResourceAvailabilityResult>(
    "/v1/operator/driver-schedules/availability-check",
    { method: "POST", body: request, signal },
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

// Alias của update với applyTo=ALL_PENDING (mục 7.5) — kéo theo toàn bộ behavior
// và error của ALL_PENDING, và yêu cầu schedule đã có effective vehicleId.
export function updateOperatorDriverScheduleCrew(
  id: string,
  request: { driverUserId: string; assistantUserId?: string | null },
) {
  return apiRequest<OperatorDriverSchedule>(
    `/v1/operator/driver-schedules/${id}/crew`,
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

// Không phải PagedResult và không nhận page/pageSize: BE trả { from, to, trips }
// và lọc theo khoảng ngày (mục 10.1). from/to phải truyền theo cặp.
export function getDriverMeSchedule(params: DriverMeScheduleParams = {}) {
  return apiRequest<DriverMeSchedule>(
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

// Repository đã scope theo operator trong JWT nên bưu kiện của nhà xe khác cũng
// trả 404 PARCEL_NOT_FOUND như bản ghi không tồn tại.
export function getOperatorParcel(parcelId: string) {
  return apiRequest<OperatorParcelDetail>(
    `/v1/operator/parcels/${parcelId}`,
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

// Phát lại email xác nhận giao cho người nhận. Chỉ hợp lệ khi parcel còn ở
// DELIVERED_PENDING_CONFIRM và người nhận có email — thiếu email là
// 422 PARCEL_RECIPIENT_EMAIL_REQUIRED, sai trạng thái là
// 400 PARCEL_NOT_PENDING_CONFIRM.
export function resendOperatorParcelDeliveryEmail(
  parcelId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelResendDeliveryEmailResult>(
    `/v1/operator/parcels/${parcelId}/resend-delivery-email`,
    {
      method: "POST",
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

export function getOperatorParcelRouteFareSummary() {
  return apiRequest<ParcelRouteFareSummaryItem[]>(
    "/v1/operator/parcel-route-fares/summary",
  );
}

export function getOperatorParcelRouteFares(
  params: ParcelRouteFareParams = {},
) {
  return apiRequest<PagedResult<ParcelRouteFareGroup>>(
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

export function getOperatorVoucherSummary() {
  return apiRequest<VoucherSummary>("/v1/operator/vouchers/summary");
}

export function getOperatorVouchers(params: OperatorVoucherParams = {}) {
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

export function getAdminVoucherSummary() {
  return apiRequest<VoucherSummary>("/v1/admin/vouchers/summary");
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

/**
 * XOÁ MỀM: BE chạy DeactivateAlternativeRouteCommand — bản ghi vẫn còn, chỉ
 * `isActive=false`, và luôn trả về trong GET .../alternative-routes (BE sort
 * active trước). Đừng gỡ item khỏi danh sách trên UI: khôi phục bằng
 * `setAlternativeRouteActive(id, true)`.
 */
export function deleteAlternativeRoute(alternativeRouteId: string) {
  return apiRequest<{ isActive: boolean }>(
    `/v1/operator/alternative-routes/${alternativeRouteId}`,
    { method: "DELETE" },
  );
}

/**
 * Bật/tắt tuyến thay thế qua PATCH partial. BE (UpdateAlternativeRouteRequest)
 * chỉ đọc field CÓ MẶT trong body — gửi mỗi `isActive` là giữ nguyên tên/bến
 * đến/km/phút/điểm dừng/polyline đã lưu. Đây là đường khôi phục sau khi DELETE.
 */
export function setAlternativeRouteActive(
  alternativeRouteId: string,
  isActive: boolean,
) {
  return apiRequest<AlternativeRoute>(
    `/v1/operator/alternative-routes/${alternativeRouteId}`,
    { method: "PATCH", body: { isActive } },
  );
}

/**
 * Allow-list BE: page, pageSize, search, searchIn, sortBy, sortDir,
 * vehicleTypeId, status, isActive.
 *
 * `status` là trạng thái vận hành, enum KHÔNG có `INACTIVE`. `isActive` là cờ
 * bật/tắt xe khỏi danh mục, độc lập với `status` — "xe đã tắt" phải hỏi bằng
 * `isActive=false`, không phải `status=INACTIVE` (gửi lên là 422).
 */
export type OperatorVehicleParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  searchIn?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  vehicleTypeId?: string;
  status?: VehicleStatus;
  isActive?: boolean;
};

export function getOperatorVehicles(
  params: OperatorVehicleParams = {},
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
  // Endpoint này nhận từ khoá qua `q`, không phải `search` như các list khác.
  // Zod schema của service RAG strip key lạ nên gửi `search` không lỗi — nó chỉ
  // bị bỏ qua, ô tìm kiếm trông như hỏng. Đổi tên ngay tại tầng API để page
  // vẫn dùng chung tên `search` với phần còn lại của app.
  const { search, ...rest } = params;
  return apiRequest<PagedResult<RagDocument>>(
    `/v1/rag/documents${buildQuery({ ...rest, ...(search ? { q: search } : {}) })}`,
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

/**
 * Ba mode hợp lệ của `GET .../eta`; mọi tổ hợp khác bị Zod chặn bằng
 * `400 VALIDATION_ERROR` (ví dụ `targetKind=STATION` đi kèm `stopId`, hoặc gửi
 * cả `stopId` lẫn `stationId`).
 */
export type TrackingEtaTargetQuery =
  | { targetKind: "STOP"; stopId: string }
  | { targetKind: "STATION"; stationId: string };

/**
 * Không truyền target thì Tracking tự chọn target đầu tiên còn cache theo chain:
 * các STOP chưa qua theo `sequence`, rồi tới STATION đích. Truyền chuỗi là mode
 * legacy `?stopId=`, BE vẫn nhận.
 *
 * Cache rỗng hoặc target không thuộc tuyến vẫn là `200` với `{ eta: null }` —
 * không phải lỗi.
 */
export function getTrackingTripEta(
  tripId: string,
  target?: string | TrackingEtaTargetQuery,
) {
  const query =
    typeof target === "string"
      ? { stopId: target }
      : target === undefined
        ? {}
        : target.targetKind === "STATION"
          ? { targetKind: target.targetKind, stationId: target.stationId }
          : { targetKind: target.targetKind, stopId: target.stopId };

  return apiRequest<TrackingEtaResponse>(
    `/v1/tracking/trips/${tripId}/eta${buildQuery(query)}`,
  );
}

export function getTrackingTripEtas(tripId: string) {
  return apiRequest<TrackingEtaBatchResponse>(
    `/v1/tracking/trips/${tripId}/etas`,
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

/**
 * Allow-list BE: page, pageSize, from, to, mainTripId, search.
 *
 * Endpoint này **tự thân đã là hàng đợi pending/unassigned** — không có
 * `status` và không có `unassignedOnly`. Muốn xem lịch sử đã gán/đã huỷ thì
 * dùng `getOperatorShuttleTrips`.
 */
export type ShuttleRequestParams = {
  page?: number;
  pageSize?: number;
  /** `YYYY-MM-DD` theo `requestedAt`, inclusive */
  from?: string;
  to?: string;
  mainTripId?: string;
  /** Địa chỉ đón hoặc tên/SĐT hành khách */
  search?: string;
};

export function getOperatorShuttleRequests(
  params: ShuttleRequestParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<ShuttleRequestGroup>>(
    `/v1/operator/shuttle-requests${buildQuery(params)}`,
    { signal },
  );
}

// `direction` là query bắt buộc và phải lấy từ đúng nhóm pending đang mở: sai
// chiều vẫn bind được nhưng không match manifest và trả
// SHUTTLE_REQUEST_NOT_CANCELLABLE.
export function cancelOperatorShuttleRequest(
  mainTripId: string,
  bookingId: string,
  direction: ShuttleDirection,
  request: CancelShuttleRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ShuttleLifecycleResult>(
    `/v1/operator/shuttle-requests/${mainTripId}/${bookingId}/cancel${buildQuery(
      { direction },
    )}`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

// Tenant lấy từ JWT — không có query operatorId. Sort cố định reportedAt DESC.
export function getOperatorIncidents(
  params: OperatorIncidentParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<OperatorIncident>>(
    `/v1/operator/incidents${buildQuery(params)}`,
    { signal },
  );
}

// Không tồn tại và khác tenant đều trả 404 INCIDENT_NOT_FOUND — không phân biệt trên UI.
export function getOperatorIncident(incidentId: string) {
  return apiRequest<OperatorIncident>(`/v1/operator/incidents/${incidentId}`);
}

// Chỉ OPERATOR_ADMIN; OPERATOR_STAFF gọi vào là 403 FORBIDDEN.
// BE lấy `resolvedAt` từ server clock, `resolvedByUserId` từ claim `sub`, trim
// `resolutionNote` rồi trả lại incident detail đã cập nhật — không tự dựng
// timestamp hay tự gán RESOLVED ở client.
export function resolveOperatorIncident(
  incidentId: string,
  request: ResolveIncidentRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<OperatorIncident>(
    `/v1/operator/incidents/${incidentId}/resolve`,
    {
      method: "PATCH",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

export function getOperatorShuttleTrips(
  params: OperatorShuttleTripsParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<PagedResult<OperatorShuttleTripListItem>>(
    `/v1/operator/shuttle-trips${buildQuery(params)}`,
    { signal },
  );
}

// Preview conflict trước khi tạo ShuttleTrip. Advisory: không reserve, không
// giữ lock — create vẫn có thể trả 409 nếu request khác thắng race (mục 8.2).
export function checkShuttleTripAvailability(
  request: ShuttleTripAvailabilityRequest,
  signal?: AbortSignal,
) {
  return apiRequest<ResourceAvailabilityResult>(
    "/v1/operator/shuttle-trips/availability-check",
    { method: "POST", body: request, signal },
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

// Cancel giải phóng driver/vehicle cho assignment khác — sau khi gọi phải
// refetch cả pending requests và danh sách ShuttleTrip.
export function cancelOperatorShuttleTrip(
  shuttleTripId: string,
  request: CancelShuttleRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ShuttleLifecycleResult>(
    `/v1/operator/shuttle-trips/${shuttleTripId}/cancel`,
    {
      method: "POST",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

/**
 * Đổi xe và/hoặc tài xế của một chuyến trung chuyển ĐÃ LÊN LỊCH.
 *
 * Luật của BE (`ShuttleDispatchService.ReassignAsync`):
 * - Phải có ít nhất một trong `driverUserId`/`vehicleId`, và `reason` bắt buộc
 *   không rỗng — thiếu là `422 VALIDATION_ERROR`.
 * - Chỉ chuyến `SCHEDULED`; đang chạy/đã xong trả `409 SHUTTLE_TRIP_INVALID_STATE`.
 * - Xe mới phải đủ chỗ cho số khách đang gán (`409 SHUTTLE_CAPACITY_EXCEEDED`)
 *   và không trùng lịch (`409 SHUTTLE_VEHICLE_CONFLICT` / `SHUTTLE_DRIVER_CONFLICT`).
 * - Gửi đúng xe/tài xế cũ vẫn trả 200 nhưng BE KHÔNG phát thông báo — không có
 *   thông báo giả cho hành khách.
 */
/**
 * Lịch sử điều phối của một chuyến trung chuyển, mới nhất trước
 * (`assignedAt DESC`). `pageSize` tối đa 100. Chuyến không tồn tại hoặc khác
 * tenant đều trả `404 SHUTTLE_TRIP_NOT_FOUND`.
 */
export function getOperatorShuttleAssignmentHistory(
  shuttleTripId: string,
  params: PageParams = {},
) {
  return apiRequest<PagedResult<ShuttleAssignmentHistoryItem>>(
    `/v1/operator/shuttle-trips/${shuttleTripId}/assignment-history${buildQuery(params)}`,
  );
}

export function reassignOperatorShuttleTrip(
  shuttleTripId: string,
  request: ReassignShuttleTripRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ReassignShuttleTripResult>(
    `/v1/operator/shuttle-trips/${shuttleTripId}/assignment`,
    {
      method: "PATCH",
      body: request,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
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

/**
 * Toàn bộ điểm đón + bến của một chuyến trung chuyển, cho nhà xe sở hữu chuyến.
 * Đây là source of truth để vẽ marker; đừng ghép lại từ danh sách yêu cầu
 * pending. Hành khách dùng endpoint riêng `.../passenger-context`.
 *
 * Lỗi thường gặp: `403 TRACKING_ACCESS_DENIED` (khác nhà xe hoặc sai role),
 * `404 SHUTTLE_TRIP_NOT_FOUND`, `503 TRACKING_CONTEXT_UNAVAILABLE`.
 */
export function getOperatorShuttleContext(shuttleTripId: string) {
  return apiRequest<OperatorShuttleContext>(
    `/v1/tracking/shuttle-trips/${shuttleTripId}/operator-context`,
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

/**
 * Kết quả mở boarding thủ công. Trip đã ở `BOARDING` sẵn thì BE vẫn trả `200`
 * cùng payload này (no-op, không phát event/audit lần hai) — FE coi mọi `200`
 * là thành công, bất kể transition do API này hay `AutoBoardingJob` làm trước.
 */
export type TripBoardingResult = {
  tripId: string;
  status: "BOARDING" | string;
};

/**
 * Nhà xe mở boarding thủ công trước giờ khởi hành (handoff Manual boarding §4.2).
 *
 * Request BODYLESS: gửi kèm `{}` là BE trả `422 VALIDATION_ERROR`, nên tuyệt đối
 * không truyền `body` — `apiRequest` chỉ gắn `Content-Type: application/json`
 * khi có body nên bỏ trống là đủ.
 *
 * Nhận `idempotencyKey` từ caller để giữ nguyên key khi retry sau timeout/5xx
 * (§8). Key này KHÔNG được dùng lại cho `/start`: BE trả `422
 * IDEMPOTENCY_KEY_MISMATCH`.
 *
 * Lỗi thường gặp: `409 TRIP_BOARDING_TOO_EARLY` (còn ngoài cửa sổ T-180 phút),
 * `409 TRIP_INVALID_TRANSITION` (chuyến đã rời `SCHEDULED/BOARDING`),
 * `404 TRIP_NOT_FOUND` (chuyến của nhà xe khác cũng bị mask thành 404).
 */
export function openOperatorTripBoarding(
  tripId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<TripBoardingResult>(
    `/v1/operator/trips/${tripId}/boarding`,
    {
      method: "POST",
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

/**
 * Sửa chuyến đã sinh: giá vé gốc, ghi chú, xe, tuyến.
 *
 * Gửi PARTIAL — chỉ đưa vào `request` những field thực sự đổi; field vắng mặt
 * được BE giữ nguyên. Đổi `vehicleId`/`routeId` có thể bị chặn bằng `409` khi
 * chuyến đã có vé hoặc xe trùng lịch, nên đừng coi 200 là chắc chắn.
 */
export function updateOperatorTrip(
  tripId: string,
  request: UpdateOperatorTripRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<OperatorTripDetail>(`/v1/operator/trips/${tripId}`, {
    method: "PATCH",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

/**
 * Xem trước hậu quả huỷ chuyến. KHÔNG đổi dữ liệu nên không cần idempotency,
 * và BE cũng không yêu cầu body — gọi được nhiều lần thoải mái.
 */
export function previewOperatorTripCancel(tripId: string) {
  return apiRequest<OperatorTripCancelPreview>(
    `/v1/operator/trips/${tripId}/cancel/preview`,
    { method: "POST" },
  );
}

/**
 * Huỷ chuyến. Nhận `idempotencyKey` từ caller để giữ NGUYÊN key khi retry sau
 * timeout/5xx — huỷ hai lần bằng hai key khác nhau là hai lệnh khác nhau với BE.
 */
export function cancelOperatorTrip(
  tripId: string,
  reason?: string | null,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<OperatorTripCancelResult>(
    `/v1/operator/trips/${tripId}/cancel`,
    {
      method: "POST",
      body: { reason: reason ?? null },
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

/**
 * Khoá một ghế của chuyến (hỏng ghế, để hàng, giữ cho nhân viên...).
 *
 * Trả về SƠ ĐỒ GHẾ mới của chuyến chứ không phải một ghế — dùng thẳng response
 * để vẽ lại, đừng tự sửa ghế trong state rồi đoán phần còn lại.
 *
 * Ghế đang có khách trả `409 TRIP_SEAT_IN_USE`; ghế không thuộc sơ đồ trả
 * `404 TRIP_SEAT_NOT_FOUND`.
 */
export function disableOperatorTripSeat(
  tripId: string,
  seatNumber: string,
  reason?: string | null,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<TripSeatMap>(
    `/v1/operator/trips/${tripId}/seats/${encodeURIComponent(seatNumber)}/disable`,
    {
      method: "POST",
      body: { reason: reason ?? null },
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

/**
 * Mở lại ghế đã khoá. Request BODYLESS — spec không khai body, nên không truyền
 * `body` để `apiRequest` khỏi gắn `Content-Type`.
 */
export function enableOperatorTripSeat(
  tripId: string,
  seatNumber: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<TripSeatMap>(
    `/v1/operator/trips/${tripId}/seats/${encodeURIComponent(seatNumber)}/enable`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

/**
 * Thêm MỘT điểm dừng vào tuyến sẵn có.
 *
 * Khác `PUT /v1/operator/routes/{id}/full` (thay toàn bộ tuyến + danh sách điểm
 * dừng, dùng cho màn thiết kế tuyến trên bản đồ): endpoint này chỉ chèn một
 * điểm nên rẻ hơn và không đụng vào geometry đã nắn.
 */
export function addOperatorRouteStop(
  routeId: string,
  request: AddRouteStopRequest,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<RouteStopLink>(`/v1/operator/routes/${routeId}/stops`, {
    method: "POST",
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

/** Gỡ một điểm dừng khỏi tuyến. BE trả `data: null`. */
export function removeOperatorRouteStop(
  routeId: string,
  stopId: string,
  idempotencyKey: string = createIdempotencyKey(),
) {
  return apiRequest<null>(
    `/v1/operator/routes/${routeId}/stops/${stopId}`,
    {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

/**
 * Danh sách khách của chuyến trung chuyển, gom theo điểm đón.
 *
 * Đây là nguồn duy nhất có TÊN + SỐ ĐIỆN THOẠI từng khách; `GET
 * /v1/operator/shuttle-requests` chỉ có yêu cầu chưa xếp xe, còn
 * `operator-context` của Tracking chỉ có toạ độ điểm đón. Trả `503` khi Trip
 * service không lấy được snapshot booking — coi như "chưa có dữ liệu", không
 * phải lỗi cấu hình.
 */
export function getOperatorShuttleTripPassengers(shuttleTripId: string) {
  return apiRequest<ShuttleTripPassengerList>(
    `/v1/operator/shuttle-trips/${shuttleTripId}/passengers`,
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







// ===========================================================================
// Parcel Reliability — sự cố kiện hàng (§6 API-Parcel-Operator-2026-08-21.md)
//
// LƯU Ý DEPLOY: production spec chưa có nhóm route này (§1 của tài liệu). Toàn
// nhóm này lên production sau phần Parcel cơ bản.
// ===========================================================================

export const PARCEL_INCIDENT_TYPES = [
  "MISSING",
  "WRONG_STOP",
  "DELIVERY_NOT_RECEIVED",
  "PARTIAL_LOSS",
  "DAMAGED",
  "SCAN_IDENTITY_MISMATCH",
  "PACKAGE_IDENTITY_MISMATCH",
  "UNSCANNED_HANDOFF",
  "MISSING_AFTER_DEPARTURE",
] as const;

export type ParcelIncidentType = (typeof PARCEL_INCIDENT_TYPES)[number];

export const PARCEL_INCIDENT_STATUSES = [
  "OPEN",
  "SEARCHING",
  "FOUND",
  "FORWARDING",
  "RESOLVED",
  "CLOSED",
  "ESCALATED",
  "SEARCH_EXPIRED",
  "LOST_CONFIRMED",
] as const;

export type ParcelIncidentStatus = (typeof PARCEL_INCIDENT_STATUSES)[number];

/**
 * `SlaState` KHÔNG phải C# enum — handler kiểm chuỗi trực tiếp (§3.3), nên nới
 * bằng `| string` để giá trị mới của BE không làm vỡ màn.
 */
export const SLA_STATES = [
  "ON_TRACK",
  "DUE_SOON",
  "BREACHED",
  "CLOSED",
] as const;

export type SlaState = (typeof SLA_STATES)[number] | (string & {});

export const PARCEL_CUSTODY_LOCATION_TYPES = [
  "ORIGIN_STATION",
  "DESTINATION_STATION",
  "ROUTE_STOP",
  "VEHICLE",
  "WAREHOUSE",
] as const;

export type ParcelCustodyLocationType =
  (typeof PARCEL_CUSTODY_LOCATION_TYPES)[number];

/**
 * Hành động backend cho phép trên một incident. FE CHỈ được hiện mutation theo
 * danh sách này (§11.1) — không tự dựng lại state machine ở client.
 */
export type ParcelIncidentAction =
  | "ASSIGN"
  | "RECORD_SEARCH"
  | "MARK_FOUND"
  | "FORWARD"
  | "RESOLVE"
  | "DECLARE_LOST"
  // Báo cáo sự cố của phụ xe chờ duyệt (FE-Operator-Web-Parcel-Custody-Exception
  // §2): khi có APPROVE/REJECT thì đây là hai hành động DUY NHẤT được phép —
  // chưa duyệt thì search/mark-found/forward/declare-lost đều bị BE chặn.
  | "APPROVE"
  | "REJECT"
  // Sau khi duyệt, BE trả action này thay cho danh sách thao tác tìm kiếm ở
  // response của endpoint decision. Nó chỉ nói "mở tiếp workflow" — danh sách
  // thao tác thật lấy từ detail refetch.
  | "CONTINUE_SEARCH"
  | (string & {});

export type ReliabilityParcelSummary = {
  parcelId: string;
  parcelCode: string;
  status: string;
  description?: string | null;
  photoUrl?: string | null;
  quantity: number;
  declaredValueVnd?: number | null;
};

export type ReliabilityLocation = {
  type?: string | null;
  id?: string | null;
  name?: string | null;
  orderIndex?: number | null;
  eta?: string | null;
};

export type ReliabilityVehicle = {
  vehicleId: string;
  licensePlate: string;
  status?: string | null;
};

export type ReliabilityRoute = {
  routeId: string;
  name: string;
  origin: ReliabilityLocation;
  destination: ReliabilityLocation;
};

export type ReliabilityTripStop = {
  stopId: string;
  name: string;
  orderIndex: number;
  estimatedArrivalAt: string;
  status: string;
  actualArrivalAt?: string | null;
  actualDepartureAt?: string | null;
};

export type ReliabilityTrip = {
  tripId: string;
  status?: string | null;
  departureAt?: string | null;
  eta?: string | null;
  route?: ReliabilityRoute | null;
  vehicle?: ReliabilityVehicle | null;
  stops: ReliabilityTripStop[];
};

/** Shape ở LIST — `lastConfirmedLocation` là object lồng, khác detail. */
export type ReliabilityCustodySummary = {
  lastEventType: string;
  lastConfirmedLocation?: ReliabilityLocation | null;
  lastConfirmedAt?: string | null;
  currentTripId?: string | null;
  currentVehicleId?: string | null;
  trackingConfidence: string;
  hasTrackingGap: boolean;
};

export type OperatorUserSummary = {
  userId?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  source?: string | null;
};

export type ReliabilityClaimSummary = {
  claimId: string;
  status: string;
  totalAwardVnd: number;
  decisionDeadline?: string | null;
  payoutDeadline?: string | null;
  slaState?: SlaState | null;
};

export type ParcelIncidentTaskSummary = {
  completed: number;
  total: number;
  assignees: OperatorUserSummary[];
};

export type ParcelIncidentSla = {
  deadline?: string | null;
  remainingMinutes?: number | null;
  state: SlaState;
};

/**
 * Một dòng của hàng đợi sự cố. Endpoint đã enrich sẵn Parcel/trip/custody/SLA
 * nên màn KHÔNG được gọi detail cho từng dòng (§11.4).
 *
 * Mọi field enrichment đều nullable: Trip/Identity batch lookup hỏng thì BE vẫn
 * trả 200 kèm field rỗng chứ không fail cả trang.
 */
export type ParcelIncidentListItem = {
  incidentId: string;
  parcelId: string;
  operatorId: string;
  type: ParcelIncidentType | (string & {});
  status: ParcelIncidentStatus | (string & {});
  tripId?: string | null;
  lastKnownLocation?: string | null;
  searchDeadline?: string | null;
  createdAt: string;
  operatorProcessBreach: boolean;
  parcel?: ReliabilityParcelSummary | null;
  trip?: ReliabilityTrip | null;
  expectedDropoff?: ReliabilityLocation | null;
  lastCustody?: ReliabilityCustodySummary | null;
  reporter?: OperatorUserSummary | null;
  taskSummary?: ParcelIncidentTaskSummary | null;
  claimSummary?: ReliabilityClaimSummary | null;
  sla?: ParcelIncidentSla | null;
  availableActions: ParcelIncidentAction[];
};

export type ParcelIncidentSearchTask = {
  taskId: string;
  incidentId: string;
  taskType: string;
  status: string;
  assigneeId?: string | null;
  location?: string | null;
  deadline?: string | null;
  result?: string | null;
  completedAt?: string | null;
  assignee?: OperatorUserSummary | null;
};

/** Shape ở DETAIL — phẳng, khác `ReliabilityCustodySummary` của list. */
export type ParcelIncidentCurrentCustody = {
  lastEventType: string;
  lastLocationType?: string | null;
  lastLocationId?: string | null;
  lastLocationSnapshot?: string | null;
  lastConfirmedAt?: string | null;
  currentTripId?: string | null;
  currentVehicleId?: string | null;
  trackingConfidence: string;
};

export type ParcelCustodyEvent = {
  eventId: string;
  eventType: string;
  legId?: string | null;
  tripId?: string | null;
  expectedLocationType?: string | null;
  expectedLocationId?: string | null;
  actualLocationType?: string | null;
  actualLocationId?: string | null;
  locationSnapshot?: string | null;
  vehicleId?: string | null;
  actorId?: string | null;
  actorRole: string;
  occurredAt: string;
  recordedAt: string;
  source: string;
  evidenceReferences: string[];
  reason?: string | null;
  /** Cursor phân trang: gửi `beforeSequence` = sequence NHỎ NHẤT đang có */
  sequence: number;
};

export type ParcelCustodyTimeline = {
  items: ParcelCustodyEvent[];
  nextCursor?: number | null;
};

export type ParcelForwardingLeg = {
  legId: string;
  tripId: string;
  sequence: number;
  status: string;
  expectedOriginId?: string | null;
  expectedOriginName?: string | null;
  expectedDestinationId?: string | null;
  expectedDestinationName?: string | null;
  vehicleId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

export type ParcelForwardingOperation = {
  targetTrip?: ReliabilityTrip | null;
  newLeg?: ParcelForwardingLeg | null;
  cargoTransferStatus?: string | null;
  nextHandoffAction?: string | null;
};

export const CUSTODY_EXCEPTION_APPROVAL_STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

export type CustodyExceptionApprovalStatus =
  (typeof CUSTODY_EXCEPTION_APPROVAL_STATUSES)[number];

/**
 * Báo cáo sự cố kiện hàng do phụ xe/tài xế gửi lên, đang chờ Operator duyệt
 * (`FE-Operator-Web-Parcel-Custody-Exception-Integration-Guide.md` §6, §11).
 *
 * ĐÂY là nguồn dữ liệu DUY NHẤT của panel duyệt: dòng trong hàng đợi không
 * kèm evidence/lý do/vị trí báo cáo, chỉ có `availableActions`.
 *
 * `actualLocationId` là UUID ĐỊA ĐIỂM. Không bao giờ dùng nó làm id người báo
 * hay người duyệt (§6) — người duyệt do BE lấy từ JWT.
 */
export type ParcelCustodyExceptionApproval = {
  requestId: string;
  parcelId: string;
  incidentId: string;
  incidentType: ParcelIncidentType | (string & {});
  incidentStatus: ParcelIncidentStatus | (string & {});
  status: CustodyExceptionApprovalStatus | (string & {});
  actualLocationType: ParcelCustodyLocationType | (string & {});
  actualLocationId?: string | null;
  locationSnapshot?: string | null;
  temporaryExceptionTag?: string | null;
  description?: string | null;
  observedWeightKg?: number | null;
  evidenceReferences: string[];
  reason: string;
  reportedByUserId: string;
  reportedByRole: string;
  reportedAt: string;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  reviewedByRole?: string | null;
  reviewNote?: string | null;
  approvedCustodyEventId?: string | null;
  searchDeadline?: string | null;
  availableActions: ParcelIncidentAction[];
};

/**
 * Response của endpoint decision — KHÔNG phải detail đầy đủ và cũng không phải
 * bản `ParcelCustodyExceptionApproval` đủ field (§7): BE chỉ trả phần quyết
 * định. Vì thế mọi field nhận diện báo cáo được khai optional, và màn phải
 * refetch detail sau khi duyệt để lấy hai search task backend vừa tạo.
 */
export type ParcelCustodyExceptionDecisionResult = Partial<
  Omit<ParcelCustodyExceptionApproval, "status" | "availableActions">
> & {
  status: CustodyExceptionApprovalStatus | (string & {});
  incidentStatus: ParcelIncidentStatus | (string & {});
  availableActions: ParcelIncidentAction[];
};

/**
 * Body strict — field lạ bị BE từ chối (§7). TUYỆT ĐỐI không thêm
 * `reviewerUserId` / `reviewedByUserId` / `supervisorApprovalUserId` /
 * `operatorId` / `requestId`: người duyệt được lấy từ JWT.
 */
export type DecideCustodyExceptionBody = {
  decision: "APPROVE" | "REJECT";
  /** Tối đa 2000 ký tự; `null` là hợp lệ */
  note: string | null;
};

export type ParcelIncidentDetail = {
  incident: ParcelIncidentListItem;
  searchTasks: ParcelIncidentSearchTask[];
  expectedLocation?: ReliabilityLocation | null;
  resolutionCode?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  currentCustody?: ParcelIncidentCurrentCustody | null;
  custodyTimeline: ParcelCustodyTimeline;
  /** Shape đầy đủ khai ở module Khiếu nại (§7) — chưa dựng nên để `unknown` */
  claim?: unknown;
  parcel?: ReliabilityParcelSummary | null;
  sender?: OperatorUserSummary | null;
  recipient?: OperatorUserSummary | null;
  trip?: ReliabilityTrip | null;
  expectedDropoff?: ReliabilityLocation | null;
  reporter?: OperatorUserSummary | null;
  forwardingSummary?: unknown;
  availableActions: ParcelIncidentAction[];
  forwardingOperation?: ParcelForwardingOperation | null;
  /** `null` khi sự cố không đến từ báo cáo cần duyệt (§6) */
  custodyExceptionApproval?: ParcelCustodyExceptionApproval | null;
};

export type ParcelForwardingOption = {
  trip?: ReliabilityTrip | null;
  route?: ReliabilityRoute | null;
  vehicle?: ReliabilityVehicle | null;
  pickupLocation?: ReliabilityLocation | null;
  targetDropoff?: ReliabilityLocation | null;
  departureAt?: string | null;
  eta?: string | null;
  canReserve: boolean;
  unavailableReason?: string | null;
};

/**
 * Allow-list BE: status, type, search, tripId, assigneeId, slaState, from, to,
 * page, pageSize. `from`/`to` là datetime (không phải date như list Parcel).
 */
export type ParcelIncidentListParams = {
  page?: number;
  pageSize?: number;
  status?: ParcelIncidentStatus;
  type?: ParcelIncidentType;
  /** Tối đa 100 ký tự; quá chung nhận `422 SEARCH_TOO_BROAD` chứ không phải rỗng */
  search?: string;
  tripId?: string;
  assigneeId?: string;
  slaState?: SlaState;
  from?: string;
  to?: string;
};

export type ParcelIncidentDetailParams = {
  /** Sequence nhỏ nhất đang hiển thị — lấy custody event CŨ HƠN mốc này */
  beforeSequence?: number;
  /** Default 50, tối đa 100 */
  limit?: number;
};

export type AssignParcelIncidentRequest = {
  assigneeUserId: string;
};

export type ParcelIncidentSearchScanRequest = {
  taskId: string;
  found: boolean;
  /** Bắt buộc nonblank: chuỗi rỗng đi qua Domain exception thành 500 */
  result: string;
  evidenceReferences?: string[];
};

export type MarkParcelIncidentFoundRequest = {
  actualLocationType: ParcelCustodyLocationType;
  /** Bắt buộc trừ khi `actualLocationType = VEHICLE` */
  actualLocationId?: string | null;
  locationSnapshot?: string | null;
  evidenceReferences?: string[];
  note?: string | null;
};

export type ForwardParcelIncidentRequest = {
  targetTripId: string;
};

export type ResolveParcelIncidentRequest = {
  note?: string | null;
  /** Blank/null bị handler từ chối — luôn gửi mã cụ thể */
  resolutionCode?: string;
};

/** `declare-lost` dùng chung request record nhưng handler chỉ đọc `note` */
export type DeclareParcelIncidentLostRequest = {
  note?: string | null;
};

export function getOperatorParcelIncidents(
  params: ParcelIncidentListParams = {},
) {
  return apiRequest<PagedResult<ParcelIncidentListItem>>(
    `/v1/operator/parcel-incidents${buildQuery(params)}`,
  );
}

export function getOperatorParcelIncident(
  incidentId: string,
  params: ParcelIncidentDetailParams = {},
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}${buildQuery(params)}`,
  );
}

/**
 * Duyệt hoặc từ chối báo cáo sự cố của phụ xe (§7 của guide custody exception).
 *
 * NGOẠI LỆ so với các mutation bên dưới: endpoint này KHÔNG trả detail đầy đủ —
 * chỉ trả phần quyết định. Sau khi gọi, màn phải refetch detail để lấy hai
 * search task backend vừa tạo (`MANIFEST_RECONCILIATION`, `VEHICLE_SWEEP`).
 *
 * `idempotencyKey` nhận từ ngoài vì §10 quy định: retry cùng một thao tác do
 * timeout/mất mạng phải DÙNG LẠI key cũ, đổi APPROVE↔REJECT mới sinh key mới.
 * Để `addIdempotencyHeader` tự sinh thì mỗi lần retry là một key khác, đúng
 * thứ FE bị cấm làm.
 */
export function decideOperatorParcelIncidentCustodyException(
  incidentId: string,
  request: DecideCustodyExceptionBody,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelCustodyExceptionDecisionResult>(
    `/v1/operator/parcel-incidents/${incidentId}/custody-exception-decision`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

// Mọi mutation dưới đây trả về DETAIL đã cập nhật — thay thẳng vào cache, không
// refetch (§11.1 mục 4).
export function assignOperatorParcelIncident(
  incidentId: string,
  request: AssignParcelIncidentRequest,
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}/assign`,
    { method: "POST", body: request },
  );
}

export function recordOperatorParcelIncidentSearch(
  incidentId: string,
  request: ParcelIncidentSearchScanRequest,
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}/search-scan`,
    { method: "POST", body: request },
  );
}

export function markOperatorParcelIncidentFound(
  incidentId: string,
  request: MarkParcelIncidentFoundRequest,
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}/mark-found`,
    { method: "POST", body: request },
  );
}

export function getOperatorParcelIncidentForwardingOptions(
  incidentId: string,
  params: { limit?: number } = {},
) {
  return apiRequest<ParcelForwardingOption[]>(
    `/v1/operator/parcel-incidents/${incidentId}/forwarding-options${buildQuery(params)}`,
  );
}

export function forwardOperatorParcelIncident(
  incidentId: string,
  request: ForwardParcelIncidentRequest,
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}/forward`,
    { method: "POST", body: request },
  );
}

export function resolveOperatorParcelIncident(
  incidentId: string,
  request: ResolveParcelIncidentRequest,
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}/resolve`,
    { method: "POST", body: request },
  );
}

export function declareOperatorParcelIncidentLost(
  incidentId: string,
  request: DeclareParcelIncidentLostRequest,
) {
  return apiRequest<ParcelIncidentDetail>(
    `/v1/operator/parcel-incidents/${incidentId}/declare-lost`,
    { method: "POST", body: request },
  );
}

/**
 * Chính sách bồi thường kiện hàng (`/v1/operator/policies/parcel-compensation`).
 *
 * Thuộc nhóm Reliability của Parcel. Policy
 * được BE CHỤP ẢNH vào từng Parcel lúc tạo đơn — sửa ở đây chỉ áp cho đơn mới,
 * không hồi tố đơn đang tranh chấp (`effectiveForNewParcelsOnly`).
 */
export type ParcelCompensationPolicyDefaults = {
  compensationRatePercent: number;
  maxCompensationVnd: number;
  noProofFallbackMultiplier: number;
  claimWindowDays: number;
  searchSlaHours: number;
  decisionSlaBusinessDays: number;
  payoutSlaBusinessDays: number;
};

export type ParcelCompensationPolicy = ParcelCompensationPolicyDefaults & {
  operatorId: string;
  version: number;
  belowDefaultAcknowledged: boolean;
  platformDefaultPolicy: ParcelCompensationPolicyDefaults;
  isBelowPlatformDefault: boolean;
  effectiveForNewParcelsOnly: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * `belowDefaultAcknowledged` PHẢI là true khi rate < 50 hoặc cap < 30.000.000,
 * nếu không BE trả `422 POLICY_BELOW_DEFAULT_ACK_REQUIRED`.
 */
export type UpdateParcelCompensationPolicyRequest =
  ParcelCompensationPolicyDefaults & {
    belowDefaultAcknowledged: boolean;
  };

export function getParcelCompensationPolicy() {
  return apiRequest<ParcelCompensationPolicy>(
    "/v1/operator/policies/parcel-compensation",
  );
}

export function updateParcelCompensationPolicy(
  request: UpdateParcelCompensationPolicyRequest,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<ParcelCompensationPolicy>(
    "/v1/operator/policies/parcel-compensation",
    {
      method: "PUT",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
}

/* ── Khiếu nại bồi thường kiện hàng (§7 API-Parcel-Operator) ───────────────
 *
 * Thuộc nhóm Reliability của Parcel.
 */

export const PARCEL_CLAIM_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "FUNDING_PENDING",
  "PAID",
  "REJECTED",
  "CANCELLED",
  "APPEALED",
] as const;

export type ParcelClaimStatus = (typeof PARCEL_CLAIM_STATUSES)[number];

/**
 * BE suy từ `claim.Status`, không phải cột riêng — xem
 * `ListOperatorParcelClaimsQueryHandler.FundingStatus`.
 */
export type ParcelClaimFundingStatus =
  | "FUNDING_PENDING"
  | "READY_FOR_PAYOUT"
  | "PAID"
  | "NOT_APPLICABLE"
  | (string & {});

/** Chỉ `DECIDE_CLAIM`; FE không tự dựng lại state machine (§11.1). */
export type ParcelClaimAction = "DECIDE_CLAIM" | (string & {});

export type ReliabilityIncidentSummary = {
  incidentId: string;
  type: string;
  status: string;
  searchDeadline?: string | null;
  nextUpdateAt?: string | null;
  slaState?: SlaState | null;
  operatorProcessBreach: boolean;
};

export type ParcelClaimEvidence = {
  evidenceId: string;
  evidenceType: string;
  reference: string;
  note?: string | null;
  uploadedByUserId: string;
  createdAt: string;
};

/**
 * Mức đền được CHỤP ẢNH vào Parcel lúc tạo đơn — đọc từ chính claim này, đừng
 * lấy policy hiện hành ở `/v1/operator/policies/parcel-compensation`.
 */
export type ParcelCompensationPolicySnapshot = {
  version: number;
  compensationRatePercent: number;
  maxCompensationVnd: number;
  noProofFallbackMultiplier: number;
  claimWindowDays: number;
  searchSlaHours: number;
  decisionSlaBusinessDays: number;
  payoutSlaBusinessDays: number;
};

export type ParcelClaim = {
  claimId: string;
  parcelId: string;
  incidentId: string;
  status: ParcelClaimStatus | (string & {});
  declaredValueVnd?: number | null;
  provenDirectLossVnd?: number | null;
  compensationRatePercent: number;
  policyCapVnd: number;
  cargoAwardVnd: number;
  freightRefundVnd: number;
  totalAwardVnd: number;
  policyVersion: number;
  beneficiaryUserId: string;
  decisionReason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  payoutReferenceId?: string | null;
  paidAt?: string | null;
  appealReason?: string | null;
  appealedByUserId?: string | null;
  appealedAt?: string | null;
  evidence: ParcelClaimEvidence[];
  parcelSummary?: ReliabilityParcelSummary | null;
  incidentSummary?: ReliabilityIncidentSummary | null;
  policySnapshot?: ParcelCompensationPolicySnapshot | null;
  decisionDeadline?: string | null;
  payoutDeadline?: string | null;
  availableActions?: ParcelClaimAction[] | null;
};

/** Dòng hàng đợi đã enrich sẵn — KHÔNG gọi detail cho từng dòng. */
export type ParcelClaimListItem = {
  claimId: string;
  status: ParcelClaimStatus | (string & {});
  parcel: ReliabilityParcelSummary;
  sender: OperatorUserSummary;
  incident?: ReliabilityIncidentSummary | null;
  evidenceCount: number;
  policySnapshot: ParcelCompensationPolicySnapshot;
  cargoAwardVnd: number;
  freightRefundVnd: number;
  totalAwardVnd: number;
  deadline?: string | null;
  slaState?: SlaState | null;
  fundingStatus: ParcelClaimFundingStatus;
  trip?: ReliabilityTrip | null;
  availableActions: ParcelClaimAction[];
};

export type ParcelClaimDetail = {
  claim: ParcelClaim;
  parcel: ReliabilityParcelSummary;
  incident?: ReliabilityIncidentSummary | null;
  currentCustody?: ReliabilityCustodySummary | null;
  trip?: ReliabilityTrip | null;
  expectedDropoff?: ReliabilityLocation | null;
  beneficiary: OperatorUserSummary;
  fundingStatus: ParcelClaimFundingStatus;
  availableActions: ParcelClaimAction[];
};

/** Allow-list BE: status, search, slaState, from, to, page, pageSize. */
export type ParcelClaimListParams = {
  page?: number;
  pageSize?: number;
  status?: ParcelClaimStatus;
  /** Tối đa 100 ký tự; quá chung nhận `422 SEARCH_TOO_BROAD` */
  search?: string;
  slaState?: SlaState;
  from?: string;
  to?: string;
};

export type DecideParcelClaimRequest = {
  decision: "APPROVE" | "REJECT";
  /** Chỉ dùng khi approve; bỏ trống là BE rơi vào công thức "không chứng từ" */
  provenDirectLossVnd?: number | null;
  /** Bắt buộc nonblank — blank trả `PARCEL_CLAIM_EVIDENCE_REQUIRED` */
  reason: string;
};

export function getOperatorParcelClaims(params: ParcelClaimListParams = {}) {
  return apiRequest<PagedResult<ParcelClaimListItem>>(
    `/v1/operator/claims${buildQuery(params)}`,
  );
}

export function getOperatorParcelClaim(claimId: string) {
  return apiRequest<ParcelClaimDetail>(`/v1/operator/claims/${claimId}`);
}

/**
 * Chỉ `OPERATOR_ADMIN`, và chỉ claim còn `DECIDE_CLAIM` trong `availableActions`.
 * Trả về DETAIL đã cập nhật — thay thẳng vào state, không refetch.
 *
 * Approve chỉ phát event; payout/funding do Payment cập nhật bất đồng bộ, đừng
 * giả định response đã là `PAID`.
 */
export function decideOperatorParcelClaim(
  claimId: string,
  request: DecideParcelClaimRequest,
) {
  return apiRequest<ParcelClaimDetail>(
    `/v1/operator/claims/${claimId}/decision`,
    { method: "POST", body: request },
  );
}

/* ── Kiện chưa định danh và bàn giao tại bến (§10) ───────────────────────── */

export const UNIDENTIFIED_PACKAGE_STATUSES = [
  "UNIDENTIFIED",
  "MATCHED",
  "FORWARDED",
  "RETURNED",
] as const;

export type UnidentifiedPackageStatus =
  (typeof UNIDENTIFIED_PACKAGE_STATUSES)[number];

export type UnidentifiedPackageAction =
  | "VIEW_MATCH_CANDIDATES"
  | "MATCH"
  | (string & {});

export type UnidentifiedPackage = {
  packageId: string;
  temporaryExceptionTag: string;
  operatorId: string;
  status: UnidentifiedPackageStatus | (string & {});
  locationType: ParcelCustodyLocationType | (string & {});
  locationId: string;
  matchedParcelId?: string | null;
  createdAt: string;
  tripId?: string | null;
  locationSnapshot?: string | null;
  description?: string | null;
  observedWeightKg?: number | null;
  evidenceReferences?: string[] | null;
  createdByUserId?: string | null;
  matchedAt?: string | null;
  matchedByUserId?: string | null;
  trip?: ReliabilityTrip | null;
  matchedParcel?: ReliabilityParcelSummary | null;
  /** Rỗng ngay sau mutation match — mapper chưa enrich lại (§10.5) */
  availableActions?: UnidentifiedPackageAction[] | null;
};

export type UnidentifiedPackageMatchCandidate = {
  parcelId: string;
  parcelCode: string;
  trip: ReliabilityTrip;
  photoUrl?: string | null;
  description?: string | null;
  weightKg: number;
  expectedDropoff: ReliabilityLocation;
  matchReasons: string[];
};

export type UnidentifiedPackageListParams = {
  page?: number;
  pageSize?: number;
  status?: UnidentifiedPackageStatus;
  search?: string;
  tripId?: string;
};

export type RegisterUnidentifiedPackageRequest = {
  temporaryExceptionTag: string;
  tripId?: string | null;
  locationType: ParcelCustodyLocationType;
  /** Bắt buộc non-empty kể cả khi `locationType = VEHICLE` (khác custody scan) */
  locationId: string;
  locationSnapshot?: string | null;
  description: string;
  observedWeightKg?: number | null;
  /** Domain đòi ít nhất 1 phần tử dù DTO khai nullable */
  evidenceReferences: string[];
};

export type MatchUnidentifiedPackageRequest = {
  parcelId: string;
};

export type ParcelStationHandoffRequest = {
  parcelCode: string;
  /** Controller chỉ nhận hai giá trị này */
  eventType: "HANDOFF" | "RETURNED_TO_STATION";
  actualLocationType: ParcelCustodyLocationType;
  /** Bắt buộc trừ khi `actualLocationType = VEHICLE` */
  actualLocationId?: string | null;
  locationSnapshot?: string | null;
  evidenceReferences?: string[];
  reason?: string | null;
};

export type ParcelCustodyScanResult = {
  custodyEventId: string;
  parcelId: string;
  eventType: string;
  actualLocationType?: string | null;
  actualLocationId?: string | null;
  occurredAt: string;
  sequence: number;
};

export function getUnidentifiedPackages(
  params: UnidentifiedPackageListParams = {},
) {
  return apiRequest<PagedResult<UnidentifiedPackage>>(
    `/v1/operator/unidentified-packages${buildQuery(params)}`,
  );
}

export function getUnidentifiedPackage(packageId: string) {
  return apiRequest<UnidentifiedPackage>(
    `/v1/operator/unidentified-packages/${packageId}`,
  );
}

/** Package không còn `UNIDENTIFIED` trả mảng rỗng chứ không lỗi. `limit` 1–50. */
export function getUnidentifiedPackageMatchCandidates(
  packageId: string,
  params: { limit?: number } = {},
) {
  return apiRequest<UnidentifiedPackageMatchCandidate[]>(
    `/v1/operator/unidentified-packages/${packageId}/match-candidates${buildQuery(params)}`,
  );
}

export function registerUnidentifiedPackage(
  request: RegisterUnidentifiedPackageRequest,
) {
  return apiRequest<UnidentifiedPackage>("/v1/stations/parcels/unidentified", {
    method: "POST",
    body: request,
  });
}

/**
 * Match lại package không còn `UNIDENTIFIED` làm BE ném raw exception thành 500
 * (§10.5). Caller PHẢI ẩn action theo `availableActions`/status và chống double
 * submit thay vì trông chờ lỗi trả về.
 */
export function matchUnidentifiedPackage(
  packageId: string,
  request: MatchUnidentifiedPackageRequest,
) {
  return apiRequest<UnidentifiedPackage>(
    `/v1/stations/parcels/unidentified/${packageId}/match`,
    { method: "POST", body: request },
  );
}

export function recordParcelStationHandoff(
  parcelId: string,
  request: ParcelStationHandoffRequest,
) {
  return apiRequest<ParcelCustodyScanResult>(
    `/v1/stations/parcels/${parcelId}/handoff`,
    { method: "POST", body: request },
  );
}
