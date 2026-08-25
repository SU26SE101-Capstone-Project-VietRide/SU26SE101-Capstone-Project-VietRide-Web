import type { BusinessCode, TripSettlement } from "../api/vietride";

/** Ký tự hiển thị khi mã chưa có — dùng thống nhất mọi bảng, đừng đổi thành "" */
export const BUSINESS_CODE_PLACEHOLDER = "-";

/**
 * Mã tuyến sau chuẩn hoá: bắt đầu bằng chữ/số, 2–20 ký tự, chỉ chữ Latin hoa,
 * chữ số và dấu `-`. Giống hệt regex BE dùng để validate.
 */
export const ROUTE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

export const ROUTE_CODE_MAX_LENGTH = 20;

/**
 * Hiển thị mã nghiệp vụ. Dữ liệu legacy chưa backfill trả `null`, môi trường
 * chưa deploy thì thiếu hẳn field — cả hai đều ra `-` chứ KHÔNG dựng mã giả từ
 * UUID: 8 ký tự đầu UUID viết hoa trông như mã nghiệp vụ nhưng không tra cứu
 * được ở đâu.
 */
export function displayBusinessCode(
  code: BusinessCode | undefined,
  placeholder: string = BUSINESS_CODE_PLACEHOLDER,
): string {
  return code?.trim() || placeholder;
}

/**
 * Chuẩn hoá mã tuyến trước khi gửi lên BE: trim + uppercase. BE cũng tự
 * `Trim().ToUpperInvariant()`, nhưng làm ở FE để ô input và thông báo lỗi khớp
 * đúng chuỗi thật sự được lưu.
 */
export function normalizeRouteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidRouteCode(raw: string): boolean {
  return ROUTE_CODE_PATTERN.test(normalizeRouteCode(raw));
}

/**
 * Ghép `code` vào request tạo/sửa Route.
 *
 * Bỏ trống ô mã = "không đổi mã", nên field bị **bỏ hẳn** khỏi request. Gửi
 * `""` hoặc `null` là ý định xoá mã — BE không hỗ trợ và trả `422`.
 */
export function routeCodePayload(raw: string): { code?: string } {
  const code = normalizeRouteCode(raw);
  return code ? { code } : {};
}

/**
 * Lấy mã chuyến của một settlement bất kể đang ở bản admin hay operator.
 *
 * Bản admin (`GET /v1/admin/trip-settlements`) trả top-level `tripCode`; bản
 * operator (`GET /v1/operator/trip-settlements`) chỉ có trong snapshot `trip`,
 * và `trip` có thể `null` khi enrichment fail-soft — lúc đó settlement vẫn hợp
 * lệ, chỉ là không có mã chuyến để hiện.
 */
export function pickSettlementTripCode(
  settlement: Pick<TripSettlement, "tripCode" | "trip">,
): BusinessCode | undefined {
  return settlement.tripCode ?? settlement.trip?.tripCode;
}
