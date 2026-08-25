// Helper dùng chung cho cả ba màn thuộc nhóm Reliability của Parcel: Sự cố,
// Khiếu nại và Kiện chưa định danh. Trước đây nằm trong
// `pages/Manager/ParcelIncidents/incidentHelpers.ts`; chuyển ra đây khi màn
// Khiếu nại cần đúng các hàm này, thay vì để hai bản sao lệch nhau.
import type { BadgeTone } from "../components/ui/Badge";
import type { ReliabilityLocation } from "../api/vietride";

/**
 * Tone của pill SLA. `BREACHED` là trạng thái xấu thật sự nên mới dùng `danger`;
 * `DUE_SOON` chỉ là cảnh báo.
 */
export function slaTone(state: string | null | undefined): BadgeTone {
  switch (state) {
    case "BREACHED":
      return "danger";
    case "DUE_SOON":
      return "warning";
    case "ON_TRACK":
      return "success";
    case "CLOSED":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * `remainingMinutes` của BE có thể âm khi đã quá hạn — trả về cả dấu để màn
 * chọn câu chữ "còn" hay "quá hạn", không tự ý `Math.abs` ở đây.
 */
export function splitRemainingMinutes(minutes: number) {
  const overdue = minutes < 0;
  const total = Math.abs(Math.trunc(minutes));

  return {
    overdue,
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

/**
 * Nhãn địa điểm: ưu tiên tên do upstream trả, thiếu thì lùi về loại địa điểm,
 * cuối cùng mới tới nhãn chung. KHÔNG bao giờ hiện UUID cho điều độ viên.
 */
export function locationLabel(
  location: ReliabilityLocation | null | undefined,
  fallback: string,
  typeLabel?: (type: string) => string,
) {
  const name = location?.name?.trim();
  if (name) return name;

  const type = location?.type?.trim();
  if (type) return typeLabel ? typeLabel(type) : type;

  return fallback;
}

/**
 * `actualLocationId` bắt buộc với mọi loại trừ `VEHICLE` (§6.5). Sai chỗ này BE
 * trả `422 PARCEL_CUSTODY_LOCATION_REQUIRED`.
 */
export function requiresLocationId(locationType: string) {
  return locationType !== "VEHICLE";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Chặn UUID rỗng/sai định dạng NGAY Ở FE.
 *
 * §6.3 cảnh báo `assign` chưa có guard application-level cho `Guid.Empty`:
 * Domain ném exception không coded và người dùng nhận `500 INTERNAL_ERROR`
 * thay vì một thông báo đọc được.
 */
export function isUsableUuid(value: string) {
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) && normalized !== EMPTY_UUID;
}
