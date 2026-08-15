/**
 * Capability token của link xác nhận giao hàng gửi qua email người nhận.
 *
 * Luật bảo mật (token này đủ quyền xác nhận/từ chối một kiện hàng):
 * - KHÔNG ghi token vào localStorage, sessionStorage, cookie, log hay analytics.
 * - Đọc xong thì xoá khỏi thanh địa chỉ để không đọng lại trong lịch sử trình
 *   duyệt, ảnh chụp màn hình hay Referer khi người dùng bấm link khác.
 * - BE parse token thành `Guid` (contract `POST /v1/parcels/delivery/confirm`),
 *   nên token sai định dạng thì kết luận "link không hợp lệ" tại FE, không gọi API
 *   (tránh đốt quota rate limit 5 lần/giờ của BE cho một link vô nghĩa).
 */

/** UUID chuẩn 8-4-4-4-12 — BE phát hành UUID v4 và tự chuẩn hoá hoa/thường. */
export const PARCEL_DELIVERY_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isParcelDeliveryToken(value: string): boolean {
  return PARCEL_DELIVERY_TOKEN_PATTERN.test(value.trim());
}

/**
 * Parse `?token=<uuid>` từ query string (có hoặc không có dấu `?`).
 * Trả null nếu thiếu, sai định dạng, hoặc bị lặp `token` (link mập mờ).
 */
export function parseParcelDeliveryToken(search: string): string | null {
  if (!search) {
    return null;
  }

  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) {
    return null;
  }

  const values = new URLSearchParams(raw).getAll("token");
  if (values.length !== 1) {
    return null;
  }

  const token = values[0].trim();
  return isParcelDeliveryToken(token) ? token : null;
}

/** Đọc token từ URL hiện tại của trình duyệt. */
export function readParcelDeliveryTokenFromWindow(
  locationLike: Pick<Location, "search"> = window.location,
): string | null {
  return parseParcelDeliveryToken(locationLike.search);
}

/**
 * Xoá `token` khỏi URL sau khi đã đọc vào bộ nhớ, giữ nguyên path và các query
 * còn lại. Dùng `replaceState` để không thêm entry vào lịch sử.
 */
export function stripParcelDeliveryTokenFromUrl(
  historyLike: Pick<History, "replaceState"> = window.history,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
): void {
  const params = new URLSearchParams(locationLike.search);
  if (!params.has("token")) {
    return;
  }

  params.delete("token");
  const query = params.toString();
  historyLike.replaceState(
    null,
    "",
    `${locationLike.pathname}${query ? `?${query}` : ""}${locationLike.hash}`,
  );
}

/** Che token cho mọi payload log/analytics lỡ đi qua đây. */
export function redactParcelDeliveryToken(value: string): string {
  if (!value) return "";
  return isParcelDeliveryToken(value) ? "[delivery-token]" : "[invalid-token]";
}
