import i18n from "../i18n";

const vietnameseMessages: Record<string, string> = {
  AUTH_TOKEN_INVALID: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
  UNAUTHORIZED: "Bạn chưa được xác thực để thực hiện thao tác này.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  AUTH_PHONE_REQUIRED: "Vui lòng cập nhật số điện thoại trước khi tiếp tục.",
  VALIDATION_ERROR: "Dữ liệu gửi lên chưa hợp lệ.",
  RESOURCE_NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  ROUTE_NOT_FOUND: "Không tìm thấy tuyến đường.",
  STATION_NOT_FOUND: "Không tìm thấy bến.",
  STOP_NOT_FOUND: "Không tìm thấy điểm dừng.",
  LOCATION_NOT_FOUND: "Không tìm thấy địa điểm.",
  VEHICLE_NOT_FOUND: "Không tìm thấy phương tiện.",
  VEHICLE_TYPE_NOT_FOUND: "Không tìm thấy loại phương tiện.",
  TRIP_NOT_FOUND: "Không tìm thấy chuyến đi.",
  TRIP_STOP_NOT_FOUND: "Không tìm thấy điểm dừng của chuyến.",
  ROUTE_DUPLICATED: "Tuyến đường đã tồn tại.",
  LOCATION_CODE_CONFLICT: "Mã địa điểm đã tồn tại.",
  TRIP_DRIVER_CONFLICT: "Tài xế đã có lịch chạy bị trùng.",
  BOOKING_TRIP_NOT_BOOKABLE: "Chuyến này hiện không thể đặt vé.",
  BOOKING_SEAT_UNAVAILABLE: "Một hoặc nhiều ghế không còn trống.",
  TRIP_CARGO_CAPACITY_EXCEEDED: "Hàng hóa vượt quá sức chứa của chuyến.",
  INVALID_TRIP_STATUS: "Trạng thái chuyến hiện không cho phép thao tác này.",
  TRIP_STOP_ALREADY_FINALIZED: "Điểm dừng này đã được hoàn tất trước đó.",
  IDEMPOTENCY_REQUEST_PENDING: "Yêu cầu trước đó vẫn đang được xử lý.",
  IDEMPOTENCY_KEY_MISMATCH: "Yêu cầu bị trùng khóa nhưng dữ liệu không giống nhau.",
  IDEMPOTENCY_KEY_REQUIRED: "Thiếu khóa xác thực cho thao tác này.",
  SCHEDULE_HAS_TRIPS: "Không thể xóa lịch vì đã có chuyến được tạo.",
  DRIVER_SCHEDULE_EDIT_TOO_LATE: "Không thể sửa lịch vì đã quá thời hạn.",
  ALTERNATIVE_ROUTE_LIMIT_EXCEEDED: "Đã đạt số lượng tuyến thay thế tối đa.",
  ROUTE_STOP_FLAGS_INVALID: "Cấu hình điểm dừng không hợp lệ.",
  ROUTE_STOP_ORDER_CONFLICT: "Thứ tự điểm dừng không hợp lệ.",
  ROUTE_GEOMETRY_TOO_LARGE: "Dữ liệu hình học tuyến đường vượt quá giới hạn.",
  ROUTE_GEOMETRY_INVALID: "Dữ liệu hình học tuyến đường không hợp lệ.",
  ROUTE_GEOMETRY_STOP_MISMATCH: "Hình học tuyến đường không khớp với các điểm dừng.",
  USER_INVALID_STATUS_TRANSITION: "Chuyển trạng thái người dùng không hợp lệ.",
  STATION_MERGE_CONFLICT: "Không thể gộp bến vì dữ liệu đang có xung đột.",
  REPORT_RANGE_INVALID: "Khoảng thời gian báo cáo không hợp lệ.",
  REPORT_VALUE_OVERFLOW: "Giá trị báo cáo vượt quá giới hạn cho phép.",
  UPSTREAM_UNAVAILABLE: "Dịch vụ liên quan hiện không khả dụng.",
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.",
};

const vietnameseFieldMessages: Record<string, string> = {
  "License plate is required.": "Biển số là bắt buộc.",
  "Vehicle type is required.": "Loại xe là bắt buộc.",
  "Route name is required.": "Tên tuyến là bắt buộc.",
  "Departure time is required.": "Giờ khởi hành là bắt buộc.",
  "The field is required.": "Trường này là bắt buộc.",
};

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
