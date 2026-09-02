import type { BadgeTone } from "../../../components/ui/Badge";
import { ApiRequestError } from "../../../api/client";

/** Trả về khóa dịch an toàn, không để message/mã lỗi kỹ thuật rơi ra UI. */
export function departureErrorTranslationKey(
  error: unknown,
  fallbackKey: string,
) {
  if (!(error instanceof ApiRequestError)) return fallbackKey;

  if (error.status === 403) {
    return "stopDepartureApprovals.errors.noPermission";
  }
  if (error.status === 404) return "stopDepartureApprovals.errors.notFound";
  if (error.status >= 500) {
    return "stopDepartureApprovals.errors.systemUnavailable";
  }
  return fallbackKey;
}

/**
 * Tone pill trạng thái yêu cầu rời bến (§9).
 *
 * `REJECTED` ở đây KHÔNG phải sự cố xấu về hàng hoá — nó chỉ có nghĩa chuyến
 * chưa được rời điểm dừng, nên để `warning` chứ không nhuộm đỏ như một kết cục
 * mất hàng.
 */
export function departureApprovalTone(status: string): BadgeTone {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING_APPROVAL":
    case "REJECTED":
      return "warning";
    default:
      return "neutral";
  }
}
