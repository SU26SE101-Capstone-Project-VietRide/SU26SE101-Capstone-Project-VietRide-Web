import i18n from "../i18n";

// Bản dịch tiếng Việt theo error.code BE trả về (BACKEND_SOURCE_OF_TRUTH.md
// §5.9 "Canonical Error Code Registry" là nguồn tham chiếu đầy đủ). Code nào
// không có trong bảng này thì message gốc (thường là tiếng Anh) sẽ lọt qua
// nguyên văn — xem translateApiErrorMessage() bên dưới. Rà soát 2026-08-10:
// đối chiếu toàn bộ registry với bảng này, bổ sung ~155 code còn thiếu.
const vietnameseMessages: Record<string, string> = {
  // Chung / hạ tầng
  AUTH_TOKEN_INVALID: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
  UNAUTHORIZED: "Bạn chưa được xác thực để thực hiện thao tác này.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  VALIDATION_ERROR: "Dữ liệu gửi lên chưa hợp lệ.",
  RESOURCE_NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  RESOURCE_CONFLICT: "Dữ liệu đang xung đột, vui lòng tải lại và thử lại.",
  UPSTREAM_UNAVAILABLE: "Dịch vụ liên quan hiện không khả dụng.",
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.",
  IDEMPOTENCY_REQUEST_PENDING: "Yêu cầu trước đó vẫn đang được xử lý.",
  IDEMPOTENCY_KEY_MISMATCH: "Yêu cầu bị trùng khóa nhưng dữ liệu không giống nhau.",
  IDEMPOTENCY_KEY_REQUIRED: "Thiếu khóa xác thực cho thao tác này.",
  INVALID_SORT_FIELD: "Trường sắp xếp không hợp lệ.",
  INVALID_STATUS: "Trạng thái không hợp lệ.",
  RATE_LIMITED: "Bạn đang thao tác quá nhanh, vui lòng thử lại sau.",
  RATE_LIMIT_EXCEEDED: "Bạn đã vượt quá giới hạn số lần thao tác, vui lòng thử lại sau.",
  // NestJS fallback theo status khi service không gắn errorCode riêng
  BAD_REQUEST: "Yêu cầu không hợp lệ.",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  CONFLICT: "Dữ liệu đang xung đột.",
  UNPROCESSABLE_ENTITY: "Dữ liệu gửi lên chưa hợp lệ.",
  SERVICE_UNAVAILABLE: "Dịch vụ hiện không khả dụng.",
  ERROR: "Đã xảy ra lỗi. Vui lòng thử lại.",

  // Auth / tài khoản
  AUTH_ACCOUNT_LOCKED: "Tài khoản đã bị khoá.",
  AUTH_EMAIL_ALREADY_REGISTERED: "Email này đã được đăng ký.",
  AUTH_EMAIL_NOT_VERIFIED: "Email chưa được xác thực.",
  AUTH_GOOGLE_TOKEN_INVALID: "Không xác thực được tài khoản Google.",
  AUTH_INITIAL_PASSWORD_TOKEN_EXPIRED: "Link đặt mật khẩu đã hết hạn.",
  AUTH_INITIAL_PASSWORD_TOKEN_INVALID: "Link đặt mật khẩu không hợp lệ.",
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  AUTH_OTP_EXPIRED: "Mã OTP đã hết hạn.",
  AUTH_OTP_INVALID: "Mã OTP không đúng.",
  AUTH_OTP_RATE_LIMIT_EXCEEDED: "Bạn đã yêu cầu OTP quá nhiều lần, vui lòng thử lại sau.",
  AUTH_PENDING_INITIAL_PASSWORD: "Tài khoản chưa đặt mật khẩu lần đầu.",
  AUTH_PHONE_ALREADY_REGISTERED: "Số điện thoại này đã được đăng ký.",
  AUTH_PHONE_INVALID_FORMAT: "Số điện thoại không đúng định dạng.",
  AUTH_PHONE_REQUIRED: "Vui lòng cập nhật số điện thoại trước khi tiếp tục.",
  AUTH_TOKEN_EXPIRED: "Phiên đăng nhập đã hết hạn.",
  USER_INVALID_STATUS_TRANSITION: "Chuyển trạng thái người dùng không hợp lệ.",

  // Booking / vé
  BOOKING_CUTOFF_EXCEEDED: "Đã quá thời hạn cho phép thao tác với vé này.",
  BOOKING_EDIT_PICKUP_PRICE_CHANGED: "Giá vé đã thay đổi sau khi đổi điểm đón, vui lòng thử lại.",
  BOOKING_MAX_SEATS_EXCEEDED: "Một lượt đặt không được vượt quá số ghế tối đa cho phép.",
  BOOKING_NOT_CANCELLABLE: "Vé này hiện không thể huỷ.",
  BOOKING_NOT_FOR_THIS_TRIP: "Vé này không thuộc chuyến đi đang chọn.",
  BOOKING_NOT_FOUND: "Không tìm thấy vé.",
  BOOKING_PASSENGER_ALREADY_BOARDED: "Hành khách đã lên xe trước đó.",
  BOOKING_PENDING_ACTION_ALREADY_RESOLVED: "Yêu cầu này đã được xử lý trước đó.",
  BOOKING_PENDING_ACTION_EXPIRED: "Yêu cầu đã hết hạn xử lý.",
  BOOKING_PENDING_ACTION_NOT_FOUND: "Không tìm thấy yêu cầu cần xử lý.",
  BOOKING_PENDING_ACTION_NOT_RESOLVABLE: "Yêu cầu này hiện không thể xử lý.",
  BOOKING_PENDING_ACTION_SUPERSEDED: "Yêu cầu đã bị thay thế bởi một yêu cầu khác.",
  BOOKING_ROUND_TRIP_INVALID: "Thông tin vé khứ hồi không hợp lệ.",
  BOOKING_SEAT_UNAVAILABLE: "Một hoặc nhiều ghế không còn trống.",
  BOOKING_TRANSFER_NOT_FOUND: "Không tìm thấy yêu cầu chuyển vé.",
  BOOKING_TRANSFER_SEAT_PENDING: "Ghế đang chờ xác nhận chuyển, vui lòng thử lại sau.",
  BOOKING_TRIP_NOT_BOOKABLE: "Chuyến này hiện không thể đặt vé.",

  // Đồng ý / consent
  CONSENT_ALREADY_REJECTED: "Yêu cầu này đã bị từ chối trước đó.",
  CONSENT_NOT_PENDING: "Yêu cầu này không còn ở trạng thái chờ xác nhận.",

  // Điểm đón/trả
  DESTINATION_TERMINAL_NOT_ARRIVED: "Xe chưa đến bến cuối.",
  DRIVER_NOT_FOUND: "Không tìm thấy tài xế.",
  DROP_OFF_STOP_NOT_ALLOWED: "Điểm dừng này không cho phép trả khách.",
  DROP_OFF_STOP_NOT_ARRIVED: "Xe chưa đến điểm trả khách.",
  DROP_OFF_STOP_NOT_FOUND: "Không tìm thấy điểm trả khách.",

  // Phụ thu
  FARE_SURCHARGE_PERIOD_NOT_FOUND: "Không tìm thấy đợt phụ thu.",
  FARE_SURCHARGE_PERIOD_OVERLAP: "Đợt phụ thu bị trùng thời gian với đợt khác.",

  // Sự cố / hoàn tiền / hóa đơn
  INCIDENT_NOT_FOUND: "Không tìm thấy sự cố.",
  INVALID_REFUND_CHOICE: "Lựa chọn hoàn tiền không hợp lệ.",
  INVOICE_NOT_FOUND: "Không tìm thấy hóa đơn.",
  INVOICE_NUMBER_EXHAUSTED: "Đã hết số hóa đơn khả dụng, vui lòng liên hệ hỗ trợ.",
  INVOICE_PDF_GENERATION_FAILED: "Không tạo được file PDF hóa đơn.",
  INVOICE_RETRY_ALREADY_PENDING: "Yêu cầu tạo lại hóa đơn đang được xử lý.",
  INVOICE_RETRY_NOT_ALLOWED: "Không thể tạo lại hóa đơn này.",
  REFUND_FAILURE_PERSISTED: "Hoàn tiền thất bại, hệ thống đã ghi nhận để xử lý lại.",
  REFUND_RETRY_EXHAUSTED: "Đã thử hoàn tiền tối đa số lần cho phép.",

  // Nhà xe (operator)
  OPERATOR_DUPLICATE_REGISTRATION: "Nhà xe này đã đăng ký trước đó.",
  OPERATOR_DUPLICATE_TAX_CODE: "Mã số thuế đã được đăng ký bởi nhà xe khác.",

  // Hàng hóa / kiện hàng
  PARCEL_ADDITIONAL_PAYMENT_REQUIRED: "Cần thanh toán thêm cho kiện hàng này.",
  PARCEL_CAPACITY_EXCEEDED: "Kiện hàng vượt quá sức chứa cho phép.",
  PARCEL_CARGO_NOT_FOUND: "Không tìm thấy kiện hàng.",
  PARCEL_CARGO_RECOVERY_IN_PROGRESS: "Kiện hàng đang trong quá trình xử lý khôi phục.",
  PARCEL_DELIVERY_TOKEN_EXPIRED: "Mã giao hàng đã hết hạn.",
  PARCEL_DELIVERY_TOKEN_INVALID: "Mã giao hàng không hợp lệ.",
  PARCEL_DELIVERY_TOKEN_REVOKED: "Mã giao hàng đã bị thu hồi.",
  PARCEL_NOT_FOUND: "Không tìm thấy kiện hàng.",
  PARCEL_NOT_PENDING_CONFIRM: "Kiện hàng không ở trạng thái chờ xác nhận.",
  PARCEL_NOT_TRANSFERABLE: "Kiện hàng này không thể chuyển tiếp.",
  PARCEL_PRICING_NOT_CONFIGURED: "Chưa cấu hình bảng giá hàng hóa cho tuyến này.",
  PARCEL_RECIPIENT_EMAIL_REQUIRED: "Cần có email người nhận.",
  PARCEL_REVIEW_TIMEOUT: "Đã quá thời hạn kiểm tra kiện hàng.",

  // Thanh toán / ví
  PAYMENT_ALREADY_PROCESSED: "Giao dịch này đã được xử lý trước đó.",
  PAYMENT_DEADLINE_PASSED: "Đã quá hạn thanh toán.",
  PAYMENT_INSUFFICIENT_WALLET: "Số dư ví không đủ để thanh toán.",
  PAYMENT_SIGNATURE_INVALID: "Chữ ký giao dịch không hợp lệ.",
  PAYMENT_TIMEOUT: "Giao dịch thanh toán đã hết thời gian chờ.",
  PAYMENT_VNPAY_ERROR: "Cổng thanh toán VNPay gặp lỗi, vui lòng thử lại.",
  PLATFORM_WALLET_INSUFFICIENT_BALANCE: "Số dư ví hệ thống không đủ để thực hiện giao dịch.",
  WALLET_INSUFFICIENT_BALANCE: "Số dư ví không đủ.",
  WALLET_TOP_UP_AMOUNT_TOO_LOW: "Số tiền nạp thấp hơn mức tối thiểu.",
  WALLET_TOP_UP_FAILED: "Nạp tiền vào ví thất bại.",

  // Chính sách
  POLICY_NOT_FOUND: "Không tìm thấy chính sách.",
  POLICY_VERSION_CONFLICT: "Chính sách vừa được cập nhật bởi người khác, vui lòng tải lại.",

  // RAG (trợ lý AI)
  RAG_ACCESS_DENIED_FOR_ROLE: "Vai trò của bạn không có quyền truy cập tính năng này.",
  RAG_DOCUMENT_NOT_APPROVED: "Tài liệu chưa được duyệt.",

  // Tuyến đường / điểm dừng / bến
  ALTERNATIVE_ROUTE_LIMIT_EXCEEDED: "Đã đạt số lượng tuyến thay thế tối đa.",
  LOCATION_CODE_CONFLICT: "Mã địa điểm đã tồn tại.",
  LOCATION_NOT_FOUND: "Không tìm thấy địa điểm.",
  ROUTE_CHANGE_PROPOSAL_NOT_FOUND: "Không tìm thấy đề xuất đổi tuyến.",
  ROUTE_CHANGE_PROPOSAL_NOT_PENDING: "Đề xuất đổi tuyến không còn ở trạng thái chờ duyệt.",
  ROUTE_CHANGE_PROPOSAL_STALE: "Đề xuất đổi tuyến đã cũ, vui lòng tải lại.",
  ROUTE_DUPLICATED: "Tuyến đường đã tồn tại.",
  ROUTE_GEOMETRY_INVALID: "Dữ liệu hình học tuyến đường không hợp lệ.",
  ROUTE_GEOMETRY_STOP_MISMATCH: "Hình học tuyến đường không khớp với các điểm dừng.",
  ROUTE_GEOMETRY_TOO_LARGE: "Dữ liệu hình học tuyến đường vượt quá giới hạn.",
  ROUTE_NOT_FOUND: "Không tìm thấy tuyến đường.",
  ROUTE_RETURN_NOT_CONFIGURED: "Tuyến này chưa được cấu hình chiều về.",
  ROUTE_STATION_IMMUTABLE: "Bến đi/bến đến không thể đổi sau khi tạo tuyến.",
  ROUTE_STATION_INVALID: "Bến của tuyến không hợp lệ.",
  ROUTE_STOP_DUPLICATED: "Điểm dừng đã có trong tuyến.",
  ROUTE_STOP_FLAGS_INVALID: "Cấu hình điểm dừng không hợp lệ.",
  ROUTE_STOP_ORDER_CONFLICT: "Thứ tự điểm dừng không hợp lệ.",
  ROUTE_STOP_ORDER_INVALID: "Thứ tự điểm dừng không hợp lệ.",
  STATION_DUPLICATE_NEARBY: "Đã có bến khác ở vị trí gần đây.",
  STATION_MERGE_CONFLICT: "Không thể gộp bến vì dữ liệu đang có xung đột.",
  STATION_NOT_FOUND: "Không tìm thấy bến.",
  STOP_ALREADY_DISABLED: "Điểm dừng này đã bị vô hiệu hoá.",
  STOP_DISABLED_BOOKING_AFFECTED: "Vô hiệu hoá điểm dừng sẽ ảnh hưởng tới các vé đã đặt.",
  STOP_NOT_DROPOFF_ALLOWED: "Điểm dừng này không cho phép trả khách.",
  STOP_NOT_FOUND: "Không tìm thấy điểm dừng.",
  STOP_NOT_PICKUP_ALLOWED: "Điểm dừng này không cho phép đón khách.",
  STOP_REPLACEMENT_CYCLE: "Không thể thay thế điểm dừng vì tạo thành vòng lặp.",
  STOP_REPLACEMENT_DIFFERENT_OPERATOR: "Không thể thay thế điểm dừng của nhà xe khác.",
  STOP_REPLACEMENT_INVALID: "Thao tác thay thế điểm dừng không hợp lệ.",

  // Báo cáo
  REPORT_RANGE_INVALID: "Khoảng thời gian báo cáo không hợp lệ.",
  REPORT_VALUE_OVERFLOW: "Giá trị báo cáo vượt quá giới hạn cho phép.",

  // Xe trung chuyển (shuttle)
  SHUTTLE_CAPACITY_EXCEEDED: "Xe trung chuyển đã hết chỗ.",
  SHUTTLE_DISTANCE_EXCEEDED: "Khoảng cách vượt quá phạm vi trung chuyển cho phép.",
  SHUTTLE_DISTANCE_UNAVAILABLE: "Không tính được khoảng cách trung chuyển.",
  SHUTTLE_DRIVER_CONFLICT: "Tài xế xe trung chuyển đã có lịch bị trùng.",
  SHUTTLE_PASSENGERS_INCOMPLETE: "Danh sách hành khách trung chuyển chưa đầy đủ.",
  SHUTTLE_PASSENGER_INVALID_STATE: "Trạng thái hành khách trung chuyển không hợp lệ.",
  SHUTTLE_PASSENGER_NOT_FOUND: "Không tìm thấy hành khách trung chuyển.",
  SHUTTLE_PICKUP_LOCKED: "Điểm đón trung chuyển đã bị khoá, không thể đổi.",
  SHUTTLE_REQUEST_CUTOFF_PASSED: "Đã quá thời hạn đặt xe trung chuyển.",
  SHUTTLE_REQUEST_NOT_CANCELLABLE: "Yêu cầu trung chuyển này không thể huỷ.",
  SHUTTLE_REQUEST_SET_CHANGED: "Danh sách yêu cầu trung chuyển đã thay đổi, vui lòng tải lại.",
  SHUTTLE_STATION_NOT_SUPPORTED: "Bến này không hỗ trợ trung chuyển.",
  SHUTTLE_TRIP_INVALID_STATE: "Trạng thái chuyến trung chuyển không hợp lệ.",
  SHUTTLE_TRIP_NOT_FOUND: "Không tìm thấy chuyến trung chuyển.",
  SHUTTLE_VEHICLE_CONFLICT: "Xe trung chuyển đã có lịch bị trùng.",

  // Gói cước
  SUBSCRIPTION_EXPIRED: "Gói cước đã hết hạn.",
  SUBSCRIPTION_LIMIT_EXCEEDED: "Đã vượt quá giới hạn của gói cước hiện tại.",
  SUBSCRIPTION_MODULE_DISABLED: "Tính năng này không nằm trong gói cước hiện tại.",
  SUBSCRIPTION_PAYMENT_NOT_RETRYABLE: "Không thể thanh toán lại cho gói cước này.",
  SUBSCRIPTION_PAYMENT_PENDING: "Thanh toán gói cước đang chờ xử lý.",
  SUBSCRIPTION_UPGRADE_EXPIRED: "Yêu cầu nâng cấp gói cước đã hết hạn.",

  // Lịch chạy
  DRIVER_SCHEDULE_EDIT_TOO_LATE: "Không thể sửa lịch vì đã quá thời hạn.",
  SCHEDULE_HAS_TRIPS: "Không thể xóa lịch vì đã có chuyến được tạo.",

  // Chuyến đi / theo dõi
  TRACKING_ACCESS_DENIED: "Bạn không có quyền theo dõi vị trí chuyến này.",
  TRACKING_TRIP_NOT_ACTIVE: "Chuyến đi hiện không hoạt động để theo dõi.",
  TRIP_ALREADY_TERMINAL: "Chuyến đi đã kết thúc.",
  TRIP_CARGO_CAPACITY_EXCEEDED: "Hàng hóa vượt quá sức chứa của chuyến.",
  TRIP_CARGO_TRANSFER_CONFLICT: "Việc chuyển hàng hóa giữa các chuyến bị xung đột.",
  TRIP_DESTINATION_ALREADY_ARRIVED: "Chuyến đã đến điểm cuối.",
  TRIP_DRIVER_CONFLICT: "Tài xế đã có lịch chạy bị trùng.",
  TRIP_INVALID_TRANSITION: "Trạng thái chuyến hiện không cho phép thao tác này.",
  INVALID_TRIP_STATUS: "Trạng thái chuyến hiện không cho phép thao tác này.",
  TRIP_NOT_ACCEPTING_PARCEL: "Chuyến này hiện không nhận thêm hàng hóa.",
  TRIP_NOT_EDITABLE: "Chuyến đi này hiện không thể chỉnh sửa.",
  TRIP_NOT_FOUND: "Không tìm thấy chuyến đi.",
  TRIP_NOT_IN_PROGRESS: "Chuyến đi hiện chưa bắt đầu.",
  TRIP_NOT_SUBSTITUTABLE: "Không thể thay thế xe/tài xế cho chuyến này.",
  TRIP_ROUTE_CHANGE_BOOKINGS_EXIST: "Không thể đổi tuyến vì chuyến đã có vé đặt.",
  TRIP_SEAT_IN_USE: "Ghế đang được sử dụng.",
  TRIP_SEAT_NOT_FOUND: "Không tìm thấy ghế.",
  TRIP_SEAT_STATE_CONFLICT: "Trạng thái ghế bị xung đột, vui lòng tải lại.",
  TRIP_SERVICE_UNAVAILABLE: "Dịch vụ chuyến đi hiện không khả dụng.",
  TRIP_SETTLEMENT_ALREADY_SETTLED: "Chuyến này đã được quyết toán.",
  TRIP_SETTLEMENT_NOT_FOUND: "Không tìm thấy dữ liệu quyết toán.",
  TRIP_STOP_ALREADY_DEPARTED: "Xe đã rời điểm dừng này.",
  TRIP_STOP_ALREADY_FINALIZED: "Điểm dừng này đã được hoàn tất trước đó.",
  TRIP_STOP_NOT_ARRIVED: "Xe chưa đến điểm dừng này.",
  TRIP_STOP_NOT_FOUND: "Không tìm thấy điểm dừng của chuyến.",
  TRIP_VEHICLE_CONFLICT: "Xe đã có lịch chạy bị trùng.",
  TRIP_VEHICLE_SWAP_HELD_SEAT_CONFLICT: "Không thể đổi xe vì có ghế đang được giữ.",
  TRIP_VEHICLE_SWAP_TOO_LATE: "Đã quá thời hạn đổi xe cho chuyến này.",

  // Phương tiện
  VEHICLE_NOT_ACTIVE: "Phương tiện hiện không hoạt động.",
  VEHICLE_NOT_FOUND: "Không tìm thấy phương tiện.",
  VEHICLE_TYPE_NOT_FOUND: "Không tìm thấy loại phương tiện.",

  // Voucher
  VOUCHER_CODE_CONFLICT: "Mã voucher đã tồn tại.",
  VOUCHER_EXPIRED: "Voucher đã hết hạn.",
  VOUCHER_FORBIDDEN_FUNDING: "Nguồn tài trợ voucher không hợp lệ.",
  VOUCHER_LOCKED: "Voucher đã bị khoá.",
  VOUCHER_MIN_ORDER_NOT_MET: "Đơn hàng chưa đạt giá trị tối thiểu để áp dụng voucher.",
  VOUCHER_NOT_APPLICABLE: "Voucher không áp dụng được cho đơn này.",
  VOUCHER_NOT_FOUND: "Không tìm thấy voucher.",
  VOUCHER_USAGE_LIMIT_REACHED: "Voucher đã đạt giới hạn số lần sử dụng.",
  VOUCHER_USER_LIMIT_REACHED: "Bạn đã dùng voucher này đủ số lần cho phép.",
};

// Message tiếng Anh cụ thể (từ FluentValidation .WithMessage() phía BE) chưa
// có bản dịch — map theo NGUYÊN VĂN message top-level khi không tra được theo
// code. Trống vì rà soát 2026-08-10 phát hiện 4/5 chuỗi cũ không còn khớp
// message thật nào ở BE (đã đổi wording) và chuỗi còn lại chỉ ném từ code nội
// bộ, không lên tới HTTP — xem lại BE trước khi thêm mới vào đây.
const vietnameseFieldMessages: Record<string, string> = {};

export function translateApiErrorMessage(code: string | undefined, fallback: string, status?: number): string {
  if (!i18n.language?.startsWith("vi")) return fallback;
  if (code && vietnameseMessages[code]) return vietnameseMessages[code];
  const fieldMessage = vietnameseFieldMessages[fallback.trim()];
  if (fieldMessage) return fieldMessage;
  if (status === 401) return vietnameseMessages.AUTH_TOKEN_INVALID;
  if (status === 403) return vietnameseMessages.FORBIDDEN;
  if (status !== undefined && status >= 500) return vietnameseMessages.INTERNAL_ERROR;
  return fallback;
}
