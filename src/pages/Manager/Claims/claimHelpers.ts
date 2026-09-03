import type { BadgeTone } from "../../../components/ui/Badge";
import type { ParcelClaimAction } from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";

/**
 * `availableActions` của backend là NGUỒN QUYỀN DUY NHẤT cho nút quyết định
 * (§11.1 mục 3). Không suy từ `status`: BE cho quyết định ở cả `SUBMITTED` lẫn
 * `UNDER_REVIEW`, và luật đó có thể đổi mà FE không hay.
 */
export function hasClaimAction(
  actions: ParcelClaimAction[] | undefined | null,
  action: ParcelClaimAction,
) {
  return (actions ?? []).includes(action);
}

/**
 * Tone pill trạng thái khiếu nại. `REJECTED` mới là kết cục xấu; các bước trung
 * gian của luồng chi tiền để `info` chứ không nhuộm đỏ.
 */
export function claimStatusTone(status: string): BadgeTone {
  switch (status) {
    case "REJECTED":
      return "danger";
    case "APPEALED":
      return "warning";
    case "PAID":
      return "success";
    case "APPROVED":
    case "FUNDING_PENDING":
    case "UNDER_REVIEW":
      return "info";
    default:
      return "neutral";
  }
}

/** `fundingStatus` do BE suy từ status claim, không phải cột riêng. */
export function fundingStatusTone(status: string): BadgeTone {
  switch (status) {
    case "PAID":
      return "success";
    case "READY_FOR_PAYOUT":
      return "info";
    case "FUNDING_PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

/** Trả về khoá bản dịch dễ hiểu, không để message/mã lỗi thô rơi ra UI. */
export function claimErrorTranslationKey(
  error: unknown,
  fallbackKey: string,
) {
  if (!(error instanceof ApiRequestError)) return fallbackKey;

  switch (error.code) {
    case "PARCEL_CLAIM_ALREADY_DECIDED":
      return "claims.alreadyDecided";
    case "PARCEL_CLAIM_NOT_FOUND":
    case "PARCEL_NOT_FOUND":
      return "claims.errors.notFound";
    case "PARCEL_CLAIM_EVIDENCE_REQUIRED":
      return "claims.errors.reasonRequired";
    case "FORBIDDEN":
      return "claims.errors.noPermission";
    case "VALIDATION_ERROR":
    case "VALIDATION_FAILED":
      return "claims.errors.invalidDecision";
    default:
      break;
  }

  if (error.status === 403) return "claims.errors.noPermission";
  if (error.status === 404) return "claims.errors.notFound";
  if (error.status >= 500) return "claims.errors.systemUnavailable";
  return fallbackKey;
}

export type ClaimDecisionDraft = {
  decision: "APPROVE" | "REJECT";
  proofMode: "" | "WITH_PROOF" | "WITHOUT_PROOF";
  provenDirectLossVnd: string;
  reason: string;
};

export type ClaimDecisionParseError =
  | "reason-required"
  | "proof-required"
  | "loss-required"
  | "invalid-loss"
  | "negative-loss";

export type ClaimDecisionParseResult =
  | {
      ok: true;
      value: {
        decision: "APPROVE" | "REJECT";
        provenDirectLossVnd?: number;
        reason: string;
      };
    }
  | { ok: false; error: ClaimDecisionParseError };

/**
 * Kiểm trước khi gọi BE: `reason` blank trả `PARCEL_CLAIM_EVIDENCE_REQUIRED`,
 * tổn thất âm trả `VALIDATION_ERROR` — cả hai đều tốn một vòng mạng vô ích.
 *
 * `provenDirectLossVnd` chỉ đi kèm quyết định APPROVE; ở REJECT nó vô nghĩa nên
 * bị bỏ hẳn khỏi body thay vì gửi kèm rồi để BE lờ đi.
 */
export function parseClaimDecision(
  draft: ClaimDecisionDraft,
): ClaimDecisionParseResult {
  const reason = draft.reason.trim();
  if (!reason) {
    return { ok: false, error: "reason-required" };
  }

  if (draft.decision === "REJECT") {
    return { ok: true, value: { decision: "REJECT", reason } };
  }

  if (!draft.proofMode) {
    return { ok: false, error: "proof-required" };
  }
  if (draft.proofMode === "WITHOUT_PROOF") {
    return { ok: true, value: { decision: "APPROVE", reason } };
  }

  const lossText = draft.provenDirectLossVnd.trim();
  if (!lossText) {
    return { ok: false, error: "loss-required" };
  }

  if (!/^-?\d+$/.test(lossText)) {
    return { ok: false, error: "invalid-loss" };
  }

  const provenDirectLossVnd = Number(lossText);
  if (!Number.isSafeInteger(provenDirectLossVnd)) {
    return { ok: false, error: "invalid-loss" };
  }
  if (provenDirectLossVnd < 0) {
    return { ok: false, error: "negative-loss" };
  }

  return { ok: true, value: { decision: "APPROVE", provenDirectLossVnd, reason } };
}

export type ClaimCargoAwardPreview = {
  assessedLossVnd: number;
  cargoAwardVnd: number;
  /** True khi trần policy đã cắt bớt phần đền — lý do con số nhỏ hơn mong đợi. */
  cappedByPolicy: boolean;
};

export type ClaimAwardPreview = ClaimCargoAwardPreview & {
  proofMode: "WITH_PROOF" | "WITHOUT_PROOF";
  freightCollectedVnd: number;
  alreadyRefundedVnd: number;
  freightRefundVnd: number;
  totalAwardVnd: number;
};

/**
 * Ước tính phần đền TIỀN HÀNG theo đúng `ParcelCompensationCalculator` của BE:
 *
 *   assessedLoss = min(provenDirectLoss, declaredValue)   // nếu có khai giá trị
 *   cargoAward   = min(round(assessedLoss × rate / 100), cap)
 *
 * CHỈ tính được nhánh "có chứng từ". Nhánh không chứng từ và phần hoàn cước đều
 * cần `finalTotalPriceVnd`/`refundedAmountVnd` của Parcel, mà payload claim
 * không trả — nên màn phải nói rõ đây là ước tính phần tiền hàng, con số cuối
 * cùng do BE chốt.
 */
export function previewClaimCargoAward(
  provenDirectLossVnd: number | null,
  declaredValueVnd: number | null | undefined,
  compensationRatePercent: number,
  policyCapVnd: number,
): ClaimCargoAwardPreview | null {
  if (provenDirectLossVnd === null || provenDirectLossVnd < 0) {
    return null;
  }

  const assessedLossVnd =
    declaredValueVnd == null
      ? provenDirectLossVnd
      : Math.min(provenDirectLossVnd, declaredValueVnd);

  // BE dùng MidpointRounding.AwayFromZero; giá trị ở đây luôn >= 0 nên
  // Math.round (làm tròn nửa lên) cho cùng kết quả.
  const gross = Math.round((assessedLossVnd * compensationRatePercent) / 100);

  return {
    assessedLossVnd,
    cargoAwardVnd: Math.min(gross, policyCapVnd),
    cappedByPolicy: gross > policyCapVnd,
  };
}

export function previewClaimAward(
  proofMode: "" | "WITH_PROOF" | "WITHOUT_PROOF",
  provenDirectLossVnd: number | null,
  declaredValueVnd: number | null | undefined,
  freightCollectedVnd: number | null | undefined,
  alreadyRefundedVnd: number | null | undefined,
  compensationRatePercent: number,
  policyCapVnd: number,
  noProofFallbackMultiplier: number | null | undefined,
): ClaimAwardPreview | null {
  if (
    !proofMode ||
    freightCollectedVnd == null ||
    freightCollectedVnd < 0 ||
    alreadyRefundedVnd == null ||
    alreadyRefundedVnd < 0
  ) {
    return null;
  }

  const freightRefundVnd = Math.max(
    0,
    freightCollectedVnd - alreadyRefundedVnd,
  );
  if (proofMode === "WITHOUT_PROOF") {
    if (noProofFallbackMultiplier == null || noProofFallbackMultiplier <= 0) {
      return null;
    }
    const gross = freightCollectedVnd * noProofFallbackMultiplier;
    const cargoAwardVnd = Math.min(gross, policyCapVnd);
    return {
      proofMode,
      assessedLossVnd: 0,
      cargoAwardVnd,
      cappedByPolicy: gross > policyCapVnd,
      freightCollectedVnd,
      alreadyRefundedVnd,
      freightRefundVnd,
      totalAwardVnd: cargoAwardVnd + freightRefundVnd,
    };
  }

  const cargo = previewClaimCargoAward(
    provenDirectLossVnd,
    declaredValueVnd,
    compensationRatePercent,
    policyCapVnd,
  );
  if (!cargo) return null;
  return {
    ...cargo,
    proofMode,
    freightCollectedVnd,
    alreadyRefundedVnd,
    freightRefundVnd,
    totalAwardVnd: cargo.cargoAwardVnd + freightRefundVnd,
  };
}
