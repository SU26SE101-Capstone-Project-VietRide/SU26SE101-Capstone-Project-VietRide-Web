// Lý do đổi trạng thái / ghi chú mốc bàn giao của kiện hàng.
//
// Phần lớn giá trị BE trả về là mã enum (`TRIP_CANCELLED`, `CHECK_IN_TIMEOUT`…)
// hoặc chữ nhân sự tự nhập. Nhưng vài handler đối soát bên dịch vụ Parcel ghi
// thẳng một câu tiếng Anh vào cột reason, và câu đó hiện nguyên văn trên UI
// tiếng Việt nếu không quy về mã trước khi tra i18n.

const backendReasonCodes: Record<string, string> = {
  "Destination arrived without confirmed terminal unload.":
    "DESTINATION_ARRIVED_WITHOUT_CONFIRMED_TERMINAL_UNLOAD",
  "Expected stop departed with an unresolved handoff reconciliation.":
    "EXPECTED_STOP_DEPARTED_WITH_UNRESOLVED_HANDOFF_RECONCILIATION",
  "Expected stop departed without confirmed parcel unload.":
    "EXPECTED_STOP_DEPARTED_WITHOUT_CONFIRMED_PARCEL_UNLOAD",
  "Parcel was unresolved during destination reconciliation.":
    "PARCEL_UNRESOLVED_DURING_DESTINATION_RECONCILIATION",
  "Parcel was unresolved during stop close reconciliation.":
    "PARCEL_UNRESOLVED_DURING_STOP_CLOSE_RECONCILIATION",
};

type TranslateReason = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * Nhãn hiển thị của một lý do, dùng namespace `manager`.
 *
 * Chỉ những giá trị DO MÁY SINH mới đi qua i18n: mã enum của BE
 * (`TRIP_CANCELLED`…) và các câu tiếng Anh trong bảng trên. Ghi chú nhân sự tự
 * nhập trả về nguyên văn, không đụng tới `t` — dựa vào `defaultValue` là hỏng:
 * một câu tiếng Việt có dấu chấm vẫn bị đem đi ghép thành khoá i18n.
 */
export function parcelReasonLabel(t: TranslateReason, reason?: string | null) {
  const trimmed = reason?.trim();
  if (!trimmed) return "";

  const code = backendReasonCodes[trimmed] ?? trimmed;
  if (!/^[A-Z0-9_]+$/.test(code)) return trimmed;

  return t(`parcels.statusHistoryReasons.${code}`, { defaultValue: trimmed });
}
