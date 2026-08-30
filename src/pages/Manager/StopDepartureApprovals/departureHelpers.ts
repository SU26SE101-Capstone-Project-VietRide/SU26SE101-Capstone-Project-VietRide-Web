import type { BadgeTone } from "../../../components/ui/Badge";

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
