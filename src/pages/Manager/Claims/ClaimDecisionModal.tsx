import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDollarSign } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  decideOperatorParcelClaim,
  getOperatorParcelClaim,
  previewOperatorParcelClaimAward,
  type ParcelClaimAwardPreview,
  type ParcelClaimDetail,
} from "../../../api/vietride";
import { textareaClass, labelClass } from "../../../components/form/formClasses";
import InlineAlert from "../../../components/InlineAlert";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import AwardPreviewPanel from "./AwardPreviewPanel";
import {
  claimErrorTranslationKey,
  parseClaimDecision,
  parseProofAssessment,
  type ClaimDecisionDraft,
  type ProofAssessmentDraft,
} from "./claimHelpers";
import ProofAssessmentFields from "./ProofAssessmentFields";

type ClaimDecisionModalProps = {
  open: boolean;
  detail: ParcelClaimDetail | null;
  onClose: () => void;
  onDecided: (detail: ParcelClaimDetail, message: string) => void;
};

const emptyDraft: ClaimDecisionDraft = {
  decision: "APPROVE",
  proofStatus: "",
  lossVnd: "",
  acceptedEvidenceIds: [],
  reason: "",
};

type PreviewState = {
  signature: string;
  value: ParcelClaimAwardPreview | null;
  error: string;
  loading: boolean;
};

export default function ClaimDecisionModal({
  open,
  detail,
  onClose,
  onDecided,
}: ClaimDecisionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const claim = detail?.claim ?? null;

  const [draft, setDraft] = useState<ClaimDecisionDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [proofInvalid, setProofInvalid] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);
  const handlePreviewEvidenceStale = useEffectEvent(
    (fresh: ParcelClaimDetail) => {
      onDecided(fresh, t("claims.errors.evidenceStale"));
    },
  );
  const translatePreviewError = useEffectEvent((caught: unknown) =>
    t(claimErrorTranslationKey(caught, "claims.previewFailed")),
  );

  const parsedPreview = parseProofAssessment({
    proofStatus: draft.proofStatus,
    lossVnd: draft.lossVnd,
    acceptedEvidenceIds: draft.acceptedEvidenceIds,
  });
  const previewSignature =
    open && claim && parsedPreview.ok
      ? JSON.stringify({ claimId: claim.claimId, ...parsedPreview.value })
      : null;
  const visiblePreviewState =
    previewState?.signature === previewSignature ? previewState : null;
  const preview = visiblePreviewState?.value ?? null;
  const previewError = visiblePreviewState?.error ?? "";
  const isPreviewLoading =
    previewSignature !== null && (visiblePreviewState?.loading ?? true);
  const isZeroAwardApproval =
    draft.decision === "APPROVE" && preview?.totalAwardVnd === 0;
  const hasBlockingPreviewError = Boolean(previewSignature && previewError);

  useEffect(() => {
    if (!open || !claim || !previewSignature) return;

    const parsed = parseProofAssessment({
      proofStatus: draft.proofStatus,
      lossVnd: draft.lossVnd,
      acceptedEvidenceIds: draft.acceptedEvidenceIds,
    });
    if (!parsed.ok) return;

    const controller = new AbortController();
    let active = true;

    const timer = window.setTimeout(async () => {
      setPreviewState({
        signature: previewSignature,
        value: null,
        error: "",
        loading: true,
      });
      try {
        const next = await previewOperatorParcelClaimAward(
          claim.claimId,
          {
            proofStatus: parsed.value.proofStatus,
            provenDirectLossVnd: parsed.value.lossVnd,
            acceptedEvidenceIds: parsed.value.acceptedEvidenceIds,
          },
          controller.signal,
        );
        if (active) {
          setPreviewState({
            signature: previewSignature,
            value: next,
            error: "",
            loading: false,
          });
        }
      } catch (caught) {
        if (!active || isAbortError(caught)) return;

        if (
          caught instanceof ApiRequestError &&
          caught.code === "PARCEL_CLAIM_EVIDENCE_NOT_FOUND"
        ) {
          try {
            const fresh = await getOperatorParcelClaim(claim.claimId);
            if (active) {
              handlePreviewEvidenceStale(fresh);
            }
            return;
          } catch {
            // Fall through to the original evidence error.
          }
        }

        if (active) {
          if (
            caught instanceof ApiRequestError &&
            caught.code === "PARCEL_CLAIM_EVIDENCE_REQUIRED"
          ) {
            setProofInvalid(true);
            setPreviewState({
              signature: previewSignature,
              value: null,
              error: caught.message,
              loading: false,
            });
          } else {
            setPreviewState({
              signature: previewSignature,
              value: null,
              error: translatePreviewError(caught),
              loading: false,
            });
          }
        }
      } finally {
        if (active) {
          setPreviewState((current) =>
            current?.signature === previewSignature
              ? { ...current, loading: false }
              : current,
          );
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    claim,
    draft.acceptedEvidenceIds,
    draft.lossVnd,
    draft.proofStatus,
    open,
    previewSignature,
  ]);

  if (!claim || !detail) return null;
  const activeClaimId = claim.claimId;

  function updateProof(next: ProofAssessmentDraft) {
    setError("");
    setProofInvalid(false);
    setDraft((current) => ({ ...current, ...next }));
  }

  function handleClose() {
    pendingRef.current = null;
    setDraft(emptyDraft);
    setError("");
    setProofInvalid(false);
    setPreviewState(null);
    onClose();
  }

  function takeIdempotencyKey(signature: string) {
    if (pendingRef.current?.signature === signature) {
      return pendingRef.current.idempotencyKey;
    }
    const idempotencyKey = createIdempotencyKey();
    pendingRef.current = { signature, idempotencyKey };
    return idempotencyKey;
  }

  async function handleSubmit() {
    if (isSubmitting || isPreviewLoading) return;

    const parsed = parseClaimDecision(draft);
    if (!parsed.ok) {
      setProofInvalid(parsed.error !== "reason-required");
      setError(t("claims.decisionErrors." + parsed.error));
      return;
    }

    setIsSubmitting(true);
    setError("");
    setProofInvalid(false);
    const signature = JSON.stringify(parsed.value);

    try {
      const idempotencyKey = takeIdempotencyKey(signature);
      const next = await decideOperatorParcelClaim(
        activeClaimId,
        parsed.value,
        idempotencyKey,
      );
      pendingRef.current = null;
      onDecided(
        next,
        t(
          parsed.value.decision === "APPROVE"
            ? "claims.approveSuccess"
            : "claims.rejectSuccess",
        ),
      );
    } catch (caught) {
      if (
        caught instanceof ApiRequestError &&
        (caught.status === 409 ||
          caught.code === "PARCEL_CLAIM_ALREADY_DECIDED")
      ) {
        pendingRef.current = null;
        try {
          onDecided(
            await getOperatorParcelClaim(activeClaimId),
            t("claims.alreadyDecided"),
          );
          return;
        } catch {
          // Fall through to the original stale error.
        }
      }

      if (
        caught instanceof ApiRequestError &&
        caught.code === "PARCEL_CLAIM_EVIDENCE_NOT_FOUND"
      ) {
        pendingRef.current = null;
        try {
          onDecided(
            await getOperatorParcelClaim(activeClaimId),
            t("claims.errors.evidenceStale"),
          );
          return;
        } catch {
          // Fall through to the original evidence error.
        }
      }

      // Chỉ reuse key khi request không có response xác định (timeout/network)
      // hoặc lỗi server. Một response 4xx là thao tác đã kết thúc; lần bấm tiếp
      // theo là thao tác người dùng mới và phải có UUID mới.
      if (caught instanceof ApiRequestError && caught.status < 500) {
        pendingRef.current = null;
      }

      if (
        caught instanceof ApiRequestError &&
        caught.code === "PARCEL_CLAIM_EVIDENCE_REQUIRED"
      ) {
        setProofInvalid(true);
        setError(caught.message);
      } else {
        setError(t(claimErrorTranslationKey(caught, "claims.decisionFailed")));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      icon={<FiDollarSign size={20} />}
      title={t("claims.decisionTitle")}
      subtitle={detail.parcel?.parcelCode}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant={draft.decision === "APPROVE" ? "primary" : "danger"}
            onClick={() => void handleSubmit()}
            disabled={
              isSubmitting ||
              isPreviewLoading ||
              isZeroAwardApproval ||
              hasBlockingPreviewError
            }
          >
            {isSubmitting
              ? tc("processing")
              : t(
                  draft.decision === "APPROVE"
                    ? "claims.confirmApprove"
                    : "claims.confirmReject",
                )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <InlineAlert tone="error">
            <p>{error}</p>
          </InlineAlert>
        ) : null}

        <fieldset disabled={isSubmitting}>
          <legend className={labelClass}>{t("claims.decisionLabel")}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(["APPROVE", "REJECT"] as const).map((value) => (
              <label
                key={value}
                className={
                  "flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm " +
                  (draft.decision === value
                    ? "border-vr-300 bg-vr-50"
                    : "border-gray-200 bg-white")
                }
              >
                <input
                  type="radio"
                  name="claim-decision"
                  value={value}
                  checked={draft.decision === value}
                  onChange={() => {
                    setError("");
                    setDraft((current) => ({
                      ...current,
                      decision: value,
                    }));
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {t("claims.decision." + value)}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">
                    {t("claims.decisionHint." + value)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <ProofAssessmentFields
          draft={draft}
          evidence={claim.evidence}
          lossLabel={t("claims.provenLossLabel")}
          lossHint={t("claims.provenLossHint")}
          invalid={proofInvalid}
          disabled={isSubmitting}
          onChange={updateProof}
        />

        <AwardPreviewPanel
          preview={preview}
          isLoading={isPreviewLoading}
          error={previewError}
        />

        {isZeroAwardApproval ? (
          <InlineAlert tone="warning">
            <p>{t("claims.zeroAwardCannotApprove")}</p>
          </InlineAlert>
        ) : null}

        <div>
          <label className={labelClass} htmlFor="claim-reason">
            {t("claims.reasonLabel")}
            <span className="text-rose-700"> *</span>
          </label>
          <textarea
            id="claim-reason"
            rows={3}
            value={draft.reason}
            disabled={isSubmitting}
            onChange={(event) => {
              setError("");
              setDraft((current) => ({
                ...current,
                reason: event.target.value,
              }));
            }}
            placeholder={t("claims.reasonPlaceholder")}
            className={textareaClass}
          />
        </div>

        {draft.decision === "REJECT" ? (
          <InlineAlert tone="warning">
            <p>{t("claims.rejectProofAuditNote")}</p>
          </InlineAlert>
        ) : null}
        <InlineAlert tone="info">
          <p>{t("claims.payoutAsyncNote")}</p>
        </InlineAlert>
      </div>
    </Modal>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
