import { ApiRequestError } from "../../../api/client";
import type {
  DecideParcelClaimRequest,
  ParcelClaimAction,
  ParcelClaimProofStatus,
} from "../../../api/vietride";
import type { BadgeTone } from "../../../components/ui/Badge";

export function hasClaimAction(
  actions: ParcelClaimAction[] | undefined | null,
  action: ParcelClaimAction,
) {
  return (actions ?? []).includes(action);
}

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

export function claimErrorTranslationKey(
  error: unknown,
  fallbackKey: string,
) {
  if (!(error instanceof ApiRequestError)) return fallbackKey;

  switch (error.code) {
    case "PARCEL_CLAIM_ALREADY_DECIDED":
      return "claims.alreadyDecided";
    case "PARCEL_CLAIM_EVIDENCE_NOT_FOUND":
      return "claims.errors.evidenceStale";
    case "PARCEL_CLAIM_NOT_FOUND":
    case "PARCEL_NOT_FOUND":
      return "claims.errors.notFound";
    case "PARCEL_CLAIM_EVIDENCE_REQUIRED":
      return "claims.errors.proofInvalid";
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

export function proofStatusTranslationKey(
  proofStatus: ParcelClaimProofStatus | null | undefined,
  workflowStatus: string,
) {
  if (proofStatus) return "claims.proofStatus." + proofStatus;
  if (workflowStatus === "SUBMITTED" || workflowStatus === "UNDER_REVIEW") {
    return "claims.proofStatus.PENDING";
  }
  return "claims.proofStatus.LEGACY";
}

export type ProofAssessmentDraft = {
  proofStatus: "" | ParcelClaimProofStatus;
  lossVnd: string;
  acceptedEvidenceIds: string[];
};

export type ProofAssessmentParseError =
  | "proof-required"
  | "loss-required"
  | "invalid-loss"
  | "negative-loss"
  | "evidence-required";

export type ParsedProofAssessment = {
  proofStatus: ParcelClaimProofStatus;
  lossVnd: number | null;
  acceptedEvidenceIds: string[];
};

export function parseProofAssessment(
  draft: ProofAssessmentDraft,
):
  | { ok: true; value: ParsedProofAssessment }
  | { ok: false; error: ProofAssessmentParseError } {
  if (!draft.proofStatus) {
    return { ok: false, error: "proof-required" };
  }

  if (draft.proofStatus !== "VERIFIED") {
    return {
      ok: true,
      value: {
        proofStatus: draft.proofStatus,
        lossVnd: null,
        acceptedEvidenceIds: [],
      },
    };
  }

  const lossText = draft.lossVnd.trim();
  if (!lossText) return { ok: false, error: "loss-required" };
  if (!/^-?\d+$/.test(lossText)) {
    return { ok: false, error: "invalid-loss" };
  }

  const lossVnd = Number(lossText);
  if (!Number.isSafeInteger(lossVnd)) {
    return { ok: false, error: "invalid-loss" };
  }
  if (lossVnd < 0) return { ok: false, error: "negative-loss" };

  const acceptedEvidenceIds = Array.from(
    new Set(draft.acceptedEvidenceIds.filter(Boolean)),
  );
  if (acceptedEvidenceIds.length === 0) {
    return { ok: false, error: "evidence-required" };
  }

  return {
    ok: true,
    value: {
      proofStatus: "VERIFIED",
      lossVnd,
      acceptedEvidenceIds,
    },
  };
}

export type ClaimDecisionDraft = ProofAssessmentDraft & {
  decision: "APPROVE" | "REJECT";
  reason: string;
};

export type ClaimDecisionParseError =
  | "reason-required"
  | ProofAssessmentParseError;

export type ClaimDecisionParseResult =
  | { ok: true; value: DecideParcelClaimRequest }
  | { ok: false; error: ClaimDecisionParseError };

export function parseClaimDecision(
  draft: ClaimDecisionDraft,
): ClaimDecisionParseResult {
  const reason = draft.reason.trim();
  if (!reason) return { ok: false, error: "reason-required" };

  const proof = parseProofAssessment(draft);
  if (!proof.ok) return proof;

  return {
    ok: true,
    value: {
      decision: draft.decision,
      proofStatus: proof.value.proofStatus,
      provenDirectLossVnd: proof.value.lossVnd,
      acceptedEvidenceIds: proof.value.acceptedEvidenceIds,
      reason,
    },
  };
}
