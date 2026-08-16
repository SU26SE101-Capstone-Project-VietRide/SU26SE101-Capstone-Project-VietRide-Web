/**
 * Thay mã enum còn sót trong tiêu đề/nội dung thông báo bằng nhãn đã dịch.
 *
 * Backend dựng sẵn câu thông báo nhưng nhúng thẳng mã enum vào ("Chuyến xe vừa
 * ghi nhận sự cố: VEHICLE_BREAKDOWN.", "Trung chuyển: COMPLETED"), nên FE không
 * dịch được bằng cách tra một khoá duy nhất — phải quét trong câu.
 *
 * Chỉ thay khi `translateCode` trả về nhãn thật: mã lạ (BE thêm enum mới, mã
 * tham chiếu, ...) được giữ NGUYÊN, thà hiện mã còn hơn nuốt mất thông tin.
 */

// Ứng viên: token viết hoa toàn phần, có thể kèm số và gạch dưới. Chặn dưới 4 ký
// tự để không đụng vào các từ viết tắt thường gặp trong câu (GPS, ETA, VN...).
const CODE_PATTERN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b/g;
const MIN_CODE_LENGTH = 4;

export function localizeNotificationText(
  text: string | null | undefined,
  translateCode: (code: string) => string | null,
) {
  if (!text) return text ?? "";

  return text.replace(CODE_PATTERN, (code) => {
    if (code.length < MIN_CODE_LENGTH) return code;
    return translateCode(code) || code;
  });
}
