/**
 * Báo cho các màn read-model đang mở tải lại dữ liệu canonical sau notification,
 * socket reconnect hoặc thao tác refresh thủ công. Event chỉ sống trong tab
 * hiện tại; mỗi màn tự quyết định endpoint detail/list cần gọi lại.
 */
export const CANONICAL_DATA_REFRESH_EVENT =
  "vietride:canonical-data-refresh";

export function notifyCanonicalDataRefresh() {
  window.dispatchEvent(new Event(CANONICAL_DATA_REFRESH_EVENT));
}
