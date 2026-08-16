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
  ACCESS_DENIED: "Bạn không có quyền truy cập dữ liệu này.",
  INSUFFICIENT_ROLE: "Vai trò của bạn không đủ quyền cho thao tác này.",
  VALIDATION_ERROR: "Dữ liệu gửi lên chưa hợp lệ.",
  VALIDATION_FAILED: "Dữ liệu gửi lên chưa hợp lệ.",
  RESOURCE_NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  RESOURCE_TRAVEL_TIME_UNAVAILABLE:
    "Không tính được thời gian di chuyển để kiểm tra lịch trống.",
  MOBILE_APP_UPDATE_REQUIRED: "Vui lòng cập nhật ứng dụng lên phiên bản mới nhất.",
  RESOURCE_CONFLICT: "Dữ liệu đang xung đột, vui lòng tải lại và thử lại.",
  UPSTREAM_UNAVAILABLE: "Dịch vụ liên quan hiện không khả dụng.",
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.",
  IDEMPOTENCY_REQUEST_PENDING: "Yêu cầu trước đó vẫn đang được xử lý.",
  IDEMPOTENCY_REQUEST_IN_PROGRESS: "Yêu cầu trước đó vẫn đang được xử lý.",
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
  INVALID_FILTER: "Bộ lọc không hợp lệ.",
  RACE_LOST: "Dữ liệu vừa được thay đổi bởi thao tác khác, vui lòng tải lại và thử lại.",
  USER_INACTIVE: "Tài khoản này hiện không hoạt động.",
  USER_NOT_PASSENGER: "Chỉ tài khoản hành khách mới thực hiện được thao tác này.",

  // Auth / tài khoản
  AUTH_ACCOUNT_LOCKED: "Tài khoản đã bị khoá.",
  AUTH_EMAIL_ALREADY_REGISTERED: "Email này đã được đăng ký.",
  AUTH_EMAIL_ALREADY_VERIFIED: "Email này đã được xác thực trước đó.",
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
  OPERATOR_NOT_FOUND: "Không tìm thấy nhà xe.",
  OPERATOR_LOOKUP_UNAVAILABLE: "Không tra cứu được thông tin nhà xe, vui lòng thử lại.",
  OPERATOR_DUPLICATE_TAX_CODE: "Mã số thuế đã được đăng ký bởi nhà xe khác.",

  // Hàng hóa / kiện hàng
  PARCEL_ADDITIONAL_PAYMENT_REQUIRED: "Cần thanh toán thêm cho kiện hàng này.",
  PARCEL_CAPACITY_EXCEEDED: "Kiện hàng vượt quá sức chứa cho phép.",
  PARCEL_CHECK_IN_CLOSED: "Đã quá hạn nhận kiện hàng cho chuyến này.",
  PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED:
    "Đã quá thời hạn hoàn tác việc từ chối nhận hàng.",
  PARCEL_NOT_DELIVERY_REJECTED:
    "Kiện hàng không ở trạng thái bị từ chối nhận nên không thể hoàn tác.",
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
  BALANCE_ALREADY_PAID: "Kiện hàng này đã thanh toán đủ.",
  INVALID_CARGO_ACTION: "Thao tác với hàng hoá không hợp lệ.",
  INVALID_DECISION: "Quyết định duyệt không hợp lệ, chỉ nhận APPROVED hoặc REJECTED.",
  INVALID_REFUND_AMOUNT: "Kiện hàng này không có khoản hoàn tiền nào để xác nhận.",
  INVALID_SIZE_CATEGORY: "Nhóm kích thước kiện hàng không hợp lệ.",
  PARCEL_REVIEW_TIMEOUT: "Đã quá thời hạn kiểm tra kiện hàng.",

  // Thanh toán / ví
  PAYMENT_ALREADY_PROCESSED: "Giao dịch này đã được xử lý trước đó.",
  PAYMENT_ALREADY_STARTED: "Giao dịch thanh toán đã được khởi tạo trước đó.",
  PAYMENT_AMOUNT_INVALID: "Số tiền giao dịch không hợp lệ.",
  PAYMENT_DEADLINE_PASSED: "Đã quá hạn thanh toán.",
  PAYMENT_INSUFFICIENT_WALLET: "Số dư ví không đủ để thanh toán.",
  PAYMENT_NOT_FOUND: "Không tìm thấy giao dịch thanh toán.",
  PAYMENT_SIGNATURE_INVALID: "Chữ ký giao dịch không hợp lệ.",
  PAYMENT_TIMEOUT: "Giao dịch thanh toán đã hết thời gian chờ.",
  PAYMENT_CONTEXT_INVALID: "Thông tin ngữ cảnh thanh toán không hợp lệ.",
  PAYMENT_VNPAY_ERROR: "Cổng thanh toán VNPay gặp lỗi, vui lòng thử lại.",
  INSUFFICIENT_FUNDS: "Số dư không đủ để thực hiện giao dịch.",
  VNPAY_MOBILE_SDK_DISABLED:
    "Kênh thanh toán VNPay trên ứng dụng di động đang tạm khoá.",
  VNPAY_WEB_DISABLED:
    "Kênh thanh toán VNPay trên web đang tạm khoá, vui lòng thử lại sau.",
  TRIP_SETTLEMENT_NOT_ELIGIBLE:
    "Chuyến chưa hết thời gian tạm giữ nên chưa thể đối soát.",
  PLATFORM_WALLET_INSUFFICIENT_BALANCE: "Số dư ví hệ thống không đủ để thực hiện giao dịch.",
  WALLET_CONCURRENT_UPDATE:
    "Ví vừa được cập nhật bởi giao dịch khác, vui lòng thử lại.",
  WALLET_INSUFFICIENT_BALANCE: "Số dư ví không đủ.",
  WALLET_TOP_UP_AMOUNT_TOO_LOW: "Số tiền nạp thấp hơn mức tối thiểu.",
  WALLET_TOP_UP_FAILED: "Nạp tiền vào ví thất bại.",

  // Chính sách
  POLICY_NOT_FOUND: "Không tìm thấy chính sách.",
  POLICY_VERSION_CONFLICT: "Chính sách vừa được cập nhật bởi người khác, vui lòng tải lại.",

  // RAG (trợ lý AI)
  RAG_ACCESS_DENIED_FOR_ROLE: "Vai trò của bạn không có quyền truy cập tính năng này.",
  RAG_ADMIN_REQUIRED: "Chỉ Quản trị hệ thống mới thực hiện được thao tác này.",
  RAG_CONVERSATION_FORBIDDEN: "Bạn không có quyền truy cập cuộc hội thoại này.",
  RAG_CONVERSATION_NOT_FOUND: "Không tìm thấy cuộc hội thoại.",
  RAG_CONVERSATION_SCOPE_MISMATCH:
    "Cuộc hội thoại không thuộc phạm vi truy cập của bạn.",
  RAG_DEPENDENCY_UNAVAILABLE: "Dịch vụ trợ lý AI hiện không khả dụng.",
  RAG_DOCUMENT_EMPTY_CONTENT: "Tài liệu không có nội dung để xử lý.",
  RAG_DOCUMENT_FILE_INVALID_SIZE: "Dung lượng file tài liệu không hợp lệ.",
  RAG_DOCUMENT_FILE_INVALID_TYPE: "Định dạng file tài liệu không hợp lệ.",
  RAG_DOCUMENT_FILE_REQUIRED: "Vui lòng chọn file tài liệu.",
  RAG_DOCUMENT_FILE_UNSUPPORTED: "Hệ thống không hỗ trợ loại file tài liệu này.",
  RAG_DOCUMENT_NOT_APPROVED: "Tài liệu chưa được duyệt.",
  RAG_DOCUMENT_NOT_FOUND: "Không tìm thấy tài liệu.",
  RAG_DOCUMENT_STATUS_CONFLICT: "Trạng thái tài liệu không cho phép thao tác này.",
  RAG_DOCUMENT_TAXONOMY_INVALID: "Phân loại tài liệu không hợp lệ.",
  RAG_EMBEDDING_DIMENSION_MISMATCH:
    "Dữ liệu vector của tài liệu không khớp cấu hình hiện tại.",
  RAG_EMBEDDING_INVALID: "Không tạo được dữ liệu vector cho tài liệu.",
  RAG_FEEDBACK_ASSISTANT_ONLY: "Chỉ có thể đánh giá câu trả lời của trợ lý.",
  RAG_FEEDBACK_FORBIDDEN: "Bạn không có quyền đánh giá tin nhắn này.",
  RAG_MESSAGE_NOT_FOUND: "Không tìm thấy tin nhắn.",
  RAG_MESSAGE_TOO_LONG: "Nội dung tin nhắn vượt quá độ dài cho phép.",
  RAG_OPERATOR_SCOPE_FORBIDDEN: "Bạn không có quyền truy cập dữ liệu nhà xe này.",
  RAG_OPERATOR_SCOPE_REQUIRED: "Thiếu thông tin nhà xe cho yêu cầu này.",
  RAG_PROVIDER_CIRCUIT_OPEN:
    "Dịch vụ AI đang tạm ngắt do lỗi liên tiếp, vui lòng thử lại sau.",
  RAG_PROVIDER_INVALID_RESPONSE: "Dịch vụ AI trả về dữ liệu không hợp lệ.",
  RAG_PROVIDER_RATE_LIMITED:
    "Dịch vụ AI đang quá tải, vui lòng thử lại sau ít phút.",
  RAG_PROVIDER_UNAVAILABLE: "Dịch vụ AI hiện không khả dụng.",
  RAG_RATE_LIMIT_EXCEEDED:
    "Bạn đã gửi quá nhiều yêu cầu tới trợ lý, vui lòng thử lại sau.",
  RAG_STORAGE_CONFIG_UNAVAILABLE: "Chưa cấu hình kho lưu trữ tài liệu.",
  RAG_STORAGE_INVALID_RESPONSE: "Kho lưu trữ tài liệu trả về dữ liệu không hợp lệ.",
  RAG_STORAGE_UNAVAILABLE: "Kho lưu trữ tài liệu hiện không khả dụng.",

  // Cấu hình runtime (màn Admin RAG config)
  RUNTIME_CONFIG_HISTORY_NOT_FOUND: "Không tìm thấy lịch sử thay đổi cấu hình.",
  RUNTIME_CONFIG_INVALID_VALUE: "Giá trị cấu hình không hợp lệ.",
  RUNTIME_CONFIG_NOT_FOUND: "Không tìm thấy khóa cấu hình.",
  RUNTIME_CONFIG_READONLY: "Khóa cấu hình này chỉ đọc, không thể chỉnh sửa.",

  // Thông báo
  NOTIFICATION_DEPENDENCY_UNAVAILABLE: "Dịch vụ thông báo hiện không khả dụng.",
  NOTIFICATION_NOT_FOUND: "Không tìm thấy thông báo.",
  NOTIFICATION_RECIPIENTS_NOT_FOUND:
    "Không tìm thấy người nhận nào phù hợp cho thông báo này.",

  // Tuyến đường / điểm dừng / bến
  ALTERNATIVE_ROUTE_LIMIT_EXCEEDED: "Đã đạt số lượng tuyến thay thế tối đa.",
  LOCATION_CODE_CONFLICT: "Mã địa điểm đã tồn tại.",
  LOCATION_NOT_FOUND: "Không tìm thấy địa điểm.",
  ROUTE_CHANGE_PROPOSAL_NOT_FOUND: "Không tìm thấy đề xuất đổi tuyến.",
  ROUTE_CHANGE_PROPOSAL_NOT_PENDING: "Đề xuất đổi tuyến không còn ở trạng thái chờ duyệt.",
  ROUTE_CHANGE_PROPOSAL_STALE: "Đề xuất đổi tuyến đã cũ, vui lòng tải lại.",
  ROUTE_DUPLICATED: "Tuyến đường đã tồn tại.",
  ROUTE_GEOMETRY_INVALID:
    "Đường đi của tuyến không hợp lệ (phải có từ 2 đến 10.000 điểm). Hãy vẽ lại đường đi rồi lưu lại.",
  ROUTE_GEOMETRY_STOP_MISMATCH:
    "Có điểm dừng nằm cách đường đi quá 500 m. Hãy kéo điểm dừng lại gần tuyến hoặc vẽ lại đường đi qua điểm đó.",
  ROUTE_GEOMETRY_TOO_LARGE:
    "Đường đi của tuyến vượt quá 100 KB. Hãy vẽ lại với ít điểm trung gian hơn.",
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
  SHUTTLE_MANIFEST_INCONSISTENT_STATUS:
    "Trạng thái danh sách đón của chuyến trung chuyển đang không nhất quán.",
  SHUTTLE_PICKUP_LOCKED: "Điểm đón trung chuyển đã bị khoá, không thể đổi.",
  SHUTTLE_PICKUP_NOT_FOUND: "Không tìm thấy điểm đón trung chuyển.",
  SHUTTLE_PICKUP_NOT_PENDING: "Điểm đón này không còn ở trạng thái chờ đón.",
  SHUTTLE_REQUEST_CUTOFF_PASSED: "Đã quá thời hạn đặt xe trung chuyển.",
  SHUTTLE_REQUEST_NOT_CANCELLABLE: "Yêu cầu trung chuyển này không thể huỷ.",
  SHUTTLE_STATION_NOT_FOUND: "Không tìm thấy bến trung chuyển.",
  SHUTTLE_TRIP_TERMINAL:
    "Chuyến trung chuyển đã kết thúc, không cập nhật được điểm đón.",
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
  SUBSCRIPTION_PLAN_INACTIVE: "Gói cước đang chọn hiện không còn hoạt động.",
  SUBSCRIPTION_PLAN_NOT_PAYABLE: "Gói cước này chưa có giá để thanh toán.",
  SUBSCRIPTION_UPGRADE_FORBIDDEN:
    "Yêu cầu nâng cấp này không thuộc nhà xe của bạn.",
  SUBSCRIPTION_UPGRADE_NOT_PENDING:
    "Yêu cầu nâng cấp không còn ở trạng thái chờ thanh toán.",
  STARTER_PLAN_REQUIRED: "Không thể tắt gói Starter — đây là gói mặc định bắt buộc.",
  SUBSCRIPTION_UPGRADE_EXPIRED: "Yêu cầu nâng cấp gói cước đã hết hạn.",

  // Lịch chạy
  DRIVER_SCHEDULE_EDIT_TOO_LATE: "Không thể sửa lịch vì đã quá thời hạn.",
  DRIVER_SCHEDULE_NOT_FOUND: "Không tìm thấy lịch chạy này.",
  SCHEDULE_HAS_TRIPS: "Không thể xóa lịch vì đã có chuyến được tạo.",

  // Chuyến đi / theo dõi
  TRACKING_ACCESS_DENIED: "Bạn không có quyền theo dõi vị trí chuyến này.",
  TRACKING_AUTH_UNAVAILABLE:
    "Không xác thực được quyền theo dõi, vui lòng thử lại.",
  TRACKING_CONTEXT_UNAVAILABLE: "Không lấy được dữ liệu theo dõi của chuyến.",
  TRACKING_DEPENDENCY_UNAVAILABLE: "Dịch vụ theo dõi hành trình hiện không khả dụng.",
  TRACKING_ROUTE_CONTEXT_UNAVAILABLE: "Không lấy được dữ liệu tuyến để theo dõi.",
  TRACKING_SHARE_LINK_UNAVAILABLE: "Không tạo được link chia sẻ hành trình.",
  TRACKING_SHARE_RATE_LIMIT_UNAVAILABLE:
    "Không kiểm tra được giới hạn chia sẻ, vui lòng thử lại.",
  TRACKING_SHARE_TOKEN_INVALID: "Link chia sẻ hành trình không hợp lệ hoặc đã hết hạn.",
  TRACKING_TRIP_NOT_ACTIVE: "Chuyến đi hiện không hoạt động để theo dõi.",
  TRACKING_TRIP_UNAVAILABLE: "Không lấy được thông tin chuyến để theo dõi.",
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
  // Precheck exact-time cũ của substitute-vehicle, tách khỏi engine interval
  // (handoff API-driver-resource-availability mục 9.3).
  TRIP_CREW_CONFLICT: "Tài xế hoặc phụ xe đã có lịch bị trùng.",
  TRIP_VEHICLE_SWAP_HELD_SEAT_CONFLICT: "Không thể đổi xe vì có ghế đang được giữ.",
  TRIP_VEHICLE_SWAP_TOO_LATE: "Đã quá thời hạn đổi xe cho chuyến này.",

  // Phương tiện
  VEHICLE_NOT_ACTIVE: "Phương tiện hiện không hoạt động.",
  VEHICLE_NOT_FOUND: "Không tìm thấy phương tiện.",
  VEHICLE_TYPE_NOT_FOUND: "Không tìm thấy loại phương tiện.",

  // Voucher
  CAMPAIGN_NOT_FOUND: "Không tìm thấy chiến dịch khuyến mãi.",
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
// Thông điệp validation BE gắn tay bằng .WithMessage(...) — chuỗi cố định nên
// khớp nguyên văn được.
const vietnameseFieldMessages: Record<string, string> = {
  "SortDir must be 'asc' or 'desc'.":
    "Chiều sắp xếp chỉ nhận 'asc' hoặc 'desc'.",
  "SortBy is not supported.": "Trường sắp xếp không được hỗ trợ.",
  "Status is not supported.": "Trạng thái không được hỗ trợ.",
  "Phone number must be a Vietnamese number in +84xxxxxxxxx or 0xxxxxxxxx format.":
    "Số điện thoại phải là số Việt Nam, dạng +84xxxxxxxxx hoặc 0xxxxxxxxx.",
  "value must be greater than 0.": "Giá trị phải lớn hơn 0.",
  "validUntil must be after validFrom.":
    "Ngày kết thúc phải sau ngày bắt đầu.",
  "totalUsageLimit must be greater than 0 when supplied.":
    "Tổng lượt sử dụng phải lớn hơn 0.",
  "perUserLimit must be greater than 0 when supplied.":
    "Giới hạn mỗi người dùng phải lớn hơn 0.",
  "minOrderAmount cannot be negative.":
    "Giá trị đơn tối thiểu không được âm.",
  "maxDiscountAmount must be greater than 0 when supplied.":
    "Mức giảm tối đa phải lớn hơn 0.",
  "from must be an RFC 3339 timestamp.":
    "Thời điểm bắt đầu không đúng định dạng.",
  "to must be an RFC 3339 timestamp.":
    "Thời điểm kết thúc không đúng định dạng.",
  "from must be earlier than to.":
    "Thời điểm bắt đầu phải trước thời điểm kết thúc.",
  "To must be on or after From.":
    "Ngày kết thúc phải từ ngày bắt đầu trở về sau.",
  "To is outside the supported date range.":
    "Ngày kết thúc nằm ngoài khoảng thời gian được hỗ trợ.",
  "applicableServices must contain only BOOKING or PARCEL.":
    "Dịch vụ áp dụng chỉ được chọn Đặt vé hoặc Gửi hàng.",
  "applicableServices must contain at least one service when supplied.":
    "Vui lòng chọn ít nhất một dịch vụ áp dụng.",
  "Exactly one of pickupStationId or pickupStopId must be provided.":
    "Chỉ được chọn một trong hai: bến đón hoặc điểm đón.",
  "Provide exactly one of locationId or locationCode.":
    "Chỉ được cung cấp một trong hai: mã địa điểm hoặc ID địa điểm.",
  "tripId is required and must be a non-empty UUID.":
    "Thiếu mã chuyến hợp lệ.",
  "Caller operator id must not be empty.":
    "Thiếu thông tin nhà xe của người thực hiện.",
  "code must not exceed 50 characters.":
    "Mã không được vượt quá 50 ký tự.",
  "Type must be PROVINCE, MUNICIPALITY, WARD, COMMUNE, or SPECIAL_ZONE.":
    "Loại địa danh phải là Tỉnh, Thành phố, Phường, Xã hoặc Đặc khu.",
  "Seat numbers must be unique.": "Số ghế không được trùng nhau.",
  "PaymentMethod must be WALLET or VNPAY.":
    "Phương thức thanh toán chỉ nhận Ví hoặc VNPay.",
  "PhotoUrls must be owned Firebase Parcel evidence URLs.":
    "Ảnh minh chứng phải được tải lên từ hệ thống.",
};

// Tên field trong message của FluentValidation là PascalCase đã tách khoảng
// trắng ("DayOfWeek" -> "Day Of Week"). Chuẩn hoá về không dấu cách, chữ
// thường để tra bảng.
function normalizeFieldKey(name: string) {
  return name.replace(/\s+/g, "").toLowerCase();
}

const vietnameseFieldNames: Record<string, string> = {
  amount: "số tiền",
  assistantuserid: "phụ xe",
  basefare: "giá vé",
  billingperiod: "kỳ thanh toán",
  code: "mã",
  dayofweek: "các thứ trong tuần",
  departuredate: "ngày khởi hành",
  departuretime: "giờ khởi hành",
  description: "mô tả",
  displayname: "tên hiển thị",
  driveruserid: "tài xế",
  email: "email",
  from: "thời điểm bắt đầu",
  licenseplate: "biển số xe",
  name: "tên",
  page: "trang",
  pagesize: "số dòng mỗi trang",
  password: "mật khẩu",
  paymentmethod: "phương thức thanh toán",
  phone: "số điện thoại",
  planid: "gói cước",
  reason: "lý do",
  routeid: "tuyến",
  status: "trạng thái",
  to: "thời điểm kết thúc",
  totalseats: "tổng số ghế",
  validfrom: "ngày bắt đầu",
  validuntil: "ngày kết thúc",
  vehicleid: "phương tiện",
};

function fieldLabel(rawName: string) {
  return vietnameseFieldNames[normalizeFieldKey(rawName)] ?? rawName;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Thông điệp mặc định của FluentValidation nhúng tên field nên không khớp
// nguyên văn được — phải dịch theo cấu trúc câu.
const fluentValidationRules: Array<{
  pattern: RegExp;
  translate: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /^'(.+?)' must not be (?:empty|null)\.$/,
    translate: (m) => `Vui lòng nhập ${fieldLabel(m[1])}.`,
  },
  {
    pattern: /^'(.+?)' must be empty\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} phải để trống.`),
  },
  {
    pattern: /^'(.+?)' is not a valid email address\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} không đúng định dạng email.`),
  },
  {
    pattern: /^'(.+?)' is not in the correct format\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} không đúng định dạng.`),
  },
  {
    pattern: /^'(.+?)' must be between (.+?) and (.+?)\.$/,
    translate: (m) =>
      capitalize(`${fieldLabel(m[1])} phải nằm trong khoảng ${m[2]} đến ${m[3]}.`),
  },
  {
    pattern: /^'(.+?)' must be greater than or equal to '(.+?)'\.$/,
    translate: (m) =>
      capitalize(`${fieldLabel(m[1])} phải lớn hơn hoặc bằng ${m[2]}.`),
  },
  {
    pattern: /^'(.+?)' must be less than or equal to '(.+?)'\.$/,
    translate: (m) =>
      capitalize(`${fieldLabel(m[1])} phải nhỏ hơn hoặc bằng ${m[2]}.`),
  },
  {
    pattern: /^'(.+?)' must be greater than '(.+?)'\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} phải lớn hơn ${m[2]}.`),
  },
  {
    pattern: /^'(.+?)' must be less than '(.+?)'\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} phải nhỏ hơn ${m[2]}.`),
  },
  {
    pattern: /^'(.+?)' must not be equal to '(.+?)'\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} không được bằng ${m[2]}.`),
  },
  {
    pattern: /^'(.+?)' must be equal to '(.+?)'\.$/,
    translate: (m) => capitalize(`${fieldLabel(m[1])} phải bằng ${m[2]}.`),
  },
  {
    // "You entered N characters" là phần thừa với người dùng cuối — bỏ đi.
    pattern:
      /^The length of '(.+?)' must be at least (\d+) characters\..*$/,
    translate: (m) =>
      capitalize(`${fieldLabel(m[1])} phải có ít nhất ${m[2]} ký tự.`),
  },
  {
    pattern:
      /^The length of '(.+?)' must be (\d+) characters or fewer\..*$/,
    translate: (m) =>
      capitalize(`${fieldLabel(m[1])} không được vượt quá ${m[2]} ký tự.`),
  },
  {
    pattern: /^'(.+?)' is not a valid (.+?)\.$/,
    translate: (m) => `Giá trị "${m[1]}" không hợp lệ.`,
  },
];

function translateFieldMessage(message: string) {
  const exact = vietnameseFieldMessages[message];
  if (exact) return exact;

  for (const rule of fluentValidationRules) {
    const match = message.match(rule.pattern);
    if (match) return rule.translate(match);
  }

  return undefined;
}

export function translateApiErrorMessage(code: string | undefined, fallback: string, status?: number): string {
  if (!i18n.language?.startsWith("vi")) return fallback;
  if (code && vietnameseMessages[code]) return vietnameseMessages[code];
  const fieldMessage = translateFieldMessage(fallback.trim());
  if (fieldMessage) return fieldMessage;
  if (status === 401) return vietnameseMessages.AUTH_TOKEN_INVALID;
  if (status === 403) return vietnameseMessages.FORBIDDEN;
  if (status !== undefined && status >= 500) return vietnameseMessages.INTERNAL_ERROR;
  return fallback;
}
