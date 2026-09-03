import { ApiRequestError } from "../../../api/client";
import type {
  DecideParcelClaimAppealRequest,
  ParcelClaimAppealAction,
} from "../../../api/vietride";
import type { BadgeTone } from "../../../components/ui/Badge";
import {
  parseProofAssessment,
  type ProofAssessmentDraft,
  type ProofAssessmentParseError,
} from "../Claims/claimHelpers";

export function appealErrorTranslationKey(
  error: unknown,
  fallbackKey: string,
) {
  if (!(error instanceof ApiRequestError)) return fallbackKey;

  switch (error.code) {
    case "PARCEL_CLAIM_APPEAL_ADJUSTMENT_REQUIRED":
      return "claimAppeals.errors.adjustmentRequired";
    case "PARCEL_CLAIM_EVIDENCE_NOT_FOUND":
      return "claimAppeals.errors.evidenceStale";
    case "PARCEL_CLAIM_EVIDENCE_REQUIRED":
      return "claimAppeals.errors.proofInvalid";
    default:
      break;
  }

  if (error.status === 403) return "claimAppeals.errors.noPermission";
  if (error.status === 404) return "claimAppeals.errors.notFound";
  if (error.status >= 500) return "claimAppeals.errors.systemUnavailable";
  return fallbackKey;
}

export function hasAppealAction(
  actions: ParcelClaimAppealAction[] | undefined | null,
  action: ParcelClaimAppealAction,
) {
  return (actions ?? []).includes(action);
}

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

export type AppealDecisionDraft = ProofAssessmentDraft & {
  decision: "UPHOLD" | "APPROVE_ADJUSTMENT";
  reason: string;
};

export type AppealDecisionParseError =
  | "reason-required"
  | "reason-too-long"
  | ProofAssessmentParseError;

export type AppealDecisionParseResult =
  | { ok: true; value: DecideParcelClaimAppealRequest }
  | { ok: false; error: AppealDecisionParseError };

export const APPEAL_REASON_MAX_LENGTH = 2000;

export function parseAppealDecision(
  draft: AppealDecisionDraft,
): AppealDecisionParseResult {
  const reason = draft.reason.trim();
  if (!reason) return { ok: false, error: "reason-required" };
  if (reason.length > APPEAL_REASON_MAX_LENGTH) {
    return { ok: false, error: "reason-too-long" };
  }

  const proof = parseProofAssessment(draft);
  if (!proof.ok) return proof;

  return {
    ok: true,
    value: {
      decision: draft.decision,
      proofStatus: proof.value.proofStatus,
      revisedProvenDirectLossVnd: proof.value.lossVnd,
      acceptedEvidenceIds: proof.value.acceptedEvidenceIds,
      reason,
    },
  };
}
