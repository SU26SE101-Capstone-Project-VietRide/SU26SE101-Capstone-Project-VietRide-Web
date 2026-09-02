// Helper cho hàng đợi khiếu nại lại (§12 playbook Parcel Reliability v2).
import type { BadgeTone } from "../../../components/ui/Badge";
import type { ParcelClaimAppealAction } from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";

/** Trả về khóa dịch an toàn, không để message/mã lỗi kỹ thuật rơi ra UI. */
export function appealErrorTranslationKey(
  error: unknown,
  fallbackKey: string,
) {
  if (!(error instanceof ApiRequestError)) return fallbackKey;

  if (error.status === 403) return "claimAppeals.errors.noPermission";
  if (error.status === 404) return "claimAppeals.errors.notFound";
  if (error.status >= 500) return "claimAppeals.errors.systemUnavailable";
  return fallbackKey;
}

/**
 * `availableActions` của BE là NGUỒN QUYỀN DUY NHẤT cho nút quyết định. BE chỉ
 * gắn `DECIDE_APPEAL` khi appeal còn `SUBMITTED`; đừng suy từ `status` vì luật
 * đó có thể đổi mà FE không hay.
 */
export function hasAppealAction(
  actions: ParcelClaimAppealAction[] | undefined | null,
  action: ParcelClaimAppealAction,
) {
  return (actions ?? []).includes(action);
}

/**
 * Tone pill trạng thái appeal.
 *
 * KHÔNG có trạng thái "xấu" kiểu REJECTED ở đây: `UPHELD` nghĩa là giữ nguyên
 * quyết định cũ, một kết cục hợp lệ chứ không phải lỗi — nhuộm đỏ nó là nói sai
 * nghiệp vụ. `SUBMITTED` mới là thứ cần người xử lý.
 */
export function appealStatusTone(status: string): BadgeTone {
  switch (status) {
    case "PAID":
      return "success";
    case "SUBMITTED":
    case "FUNDING_PENDING":
      return "warning";
    case "UNDER_REVIEW":
    case "ADJUSTMENT_APPROVED":
      return "info";
    default:
      return "neutral";
  }
}

export type AppealDecisionDraft = {
  decision: "UPHOLD" | "APPROVE_ADJUSTMENT";
  /** Để trống = không điều chỉnh mức tổn thất, BE giữ nguyên số cũ. */
  revisedProvenDirectLossVnd: string;
  reason: string;
};

export type AppealDecisionParseError =
  | "reason-required"
  | "reason-too-long"
  | "invalid-loss"
  | "negative-loss";

export type AppealDecisionParseResult =
  | {
      ok: true;
      value: {
        decision: "UPHOLD" | "APPROVE_ADJUSTMENT";
        revisedProvenDirectLossVnd?: number;
        reason: string;
      };
    }
  | { ok: false; error: AppealDecisionParseError };

/** BE: `Reason` NotEmpty + MaximumLength(2000) */
export const APPEAL_REASON_MAX_LENGTH = 2000;

/**
 * Kiểm trước khi gọi BE (validator `DecideParcelClaimAppealCommandValidator`):
 * `reason` blank hoặc > 2000, và `revisedProvenDirectLossVnd < 0` đều là 422 —
 * cả ba đều tốn một vòng mạng vô ích.
 *
 * `revisedProvenDirectLossVnd` chỉ có nghĩa khi ĐIỀU CHỈNH; ở `UPHOLD` nó bị
 * bỏ hẳn khỏi body thay vì gửi kèm rồi để BE lờ đi.
 *
 * FE KHÔNG tự tính `revisedTotalAwardVnd`: BE tính lại theo policy snapshot của
 * Parcel rồi mới so với `originalTotalAwardVnd`. Luật "điều chỉnh phải lớn hơn
 * mức cũ" vì thế chỉ được cảnh báo ở UI, không chặn tại chỗ.
 */
export function parseAppealDecision(
  draft: AppealDecisionDraft,
): AppealDecisionParseResult {
  const reason = draft.reason.trim();
  if (!reason) {
    return { ok: false, error: "reason-required" };
  }
  if (reason.length > APPEAL_REASON_MAX_LENGTH) {
    return { ok: false, error: "reason-too-long" };
  }

  if (draft.decision === "UPHOLD") {
    return { ok: true, value: { decision: "UPHOLD", reason } };
  }

  const lossText = draft.revisedProvenDirectLossVnd.trim();
  if (!lossText) {
    return { ok: true, value: { decision: "APPROVE_ADJUSTMENT", reason } };
  }

  if (!/^-?\d+$/.test(lossText)) {
    return { ok: false, error: "invalid-loss" };
  }

  const revisedProvenDirectLossVnd = Number(lossText);
  if (!Number.isSafeInteger(revisedProvenDirectLossVnd)) {
    return { ok: false, error: "invalid-loss" };
  }
  if (revisedProvenDirectLossVnd < 0) {
    return { ok: false, error: "negative-loss" };
  }

  return {
    ok: true,
    value: {
      decision: "APPROVE_ADJUSTMENT",
      revisedProvenDirectLossVnd,
      reason,
    },
  };
}
