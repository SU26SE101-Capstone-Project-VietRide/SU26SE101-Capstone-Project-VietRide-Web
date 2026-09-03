import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRotateCcw } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  decideOperatorParcelClaimAppeal,
  getOperatorParcelClaim,
  getOperatorParcelClaimAppeal,
  previewOperatorParcelClaimAppealAdjustment,
  type ParcelClaimAppeal,
  type ParcelClaimAwardPreview,
  type ParcelClaimDetail,
} from "../../../api/vietride";
import { labelClass, textareaClass } from "../../../components/form/formClasses";
import InlineAlert from "../../../components/InlineAlert";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { formatCurrency } from "../../../utils/currency";
import AwardPreviewPanel from "../Claims/AwardPreviewPanel";
import {
  parseProofAssessment,
  type ProofAssessmentDraft,
} from "../Claims/claimHelpers";
import ProofAssessmentFields from "../Claims/ProofAssessmentFields";
import {
  APPEAL_REASON_MAX_LENGTH,
  appealErrorTranslationKey,
  parseAppealDecision,
  type AppealDecisionDraft,
} from "./appealHelpers";

type AppealDecisionModalProps = {
  open: boolean;
  appeal: ParcelClaimAppeal | null;
  claimDetail: ParcelClaimDetail | null;
  onClose: () => void;
  onDecided: (appeal: ParcelClaimAppeal, message: string) => void;
  onEvidenceStale: (detail: ParcelClaimDetail, message: string) => void;
};

function decisionDraftFromAppeal(
  appeal: ParcelClaimAppeal | null,
): AppealDecisionDraft {
  return {
    decision: "UPHOLD",
    proofStatus: appeal?.proofStatus ?? "",
    lossVnd:
      appeal?.revisedProvenDirectLossVnd == null
        ? ""
        : String(appeal.revisedProvenDirectLossVnd),
    acceptedEvidenceIds: [...(appeal?.acceptedEvidenceIds ?? [])],
    reason: "",
  };
}

type PreviewState = {
  signature: string;
  value: ParcelClaimAwardPreview | null;
  error: string;
  loading: boolean;
};

export default function AppealDecisionModal({
  open,
  appeal,
  claimDetail,
  onClose,
  onDecided,
  onEvidenceStale,
}: AppealDecisionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [draft, setDraft] = useState<AppealDecisionDraft>(() =>
    decisionDraftFromAppeal(appeal),
  );
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
      onEvidenceStale(fresh, t("claimAppeals.errors.evidenceStale"));
    },
  );
  const translatePreviewError = useEffectEvent((caught: unknown) =>
    t(appealErrorTranslationKey(caught, "claimAppeals.previewFailed")),
  );

  const isAdjustment = draft.decision === "APPROVE_ADJUSTMENT";
  const parsedPreview = parseProofAssessment({
    proofStatus: draft.proofStatus,
    lossVnd: draft.lossVnd,
    acceptedEvidenceIds: draft.acceptedEvidenceIds,
  });
  const previewSignature =
    open && appeal && isAdjustment && parsedPreview.ok
      ? JSON.stringify({ appealId: appeal.appealId, ...parsedPreview.value })
      : null;
  const visiblePreviewState =
    previewState?.signature === previewSignature ? previewState : null;
  const preview = visiblePreviewState?.value ?? null;
  const previewError = visiblePreviewState?.error ?? "";
  const isPreviewLoading =
    previewSignature !== null && (visiblePreviewState?.loading ?? true);
  const hasNonPositiveAdjustment =
    isAdjustment &&
    preview !== null &&
    (preview.supplementaryAwardVnd ?? 0) <= 0;
  const hasBlockingPreviewError = Boolean(previewSignature && previewError);

  useEffect(() => {
    if (!open || !appeal || !isAdjustment || !previewSignature) return;

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
        const next = await previewOperatorParcelClaimAppealAdjustment(
          appeal.appealId,
          {
            proofStatus: parsed.value.proofStatus,
            revisedProvenDirectLossVnd: parsed.value.lossVnd,
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
            const fresh = await getOperatorParcelClaim(appeal.claimId);
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
    appeal,
    draft.acceptedEvidenceIds,
    draft.lossVnd,
    draft.proofStatus,
    isAdjustment,
    open,
    previewSignature,
  ]);

  if (!open || !appeal || !claimDetail) return null;
  const activeAppealId = appeal.appealId;
  const activeClaimId = appeal.claimId;

  function updateProof(next: ProofAssessmentDraft) {
    setError("");
    setProofInvalid(false);
    setDraft((current) => ({ ...current, ...next }));
  }

  function handleClose() {
    pendingRef.current = null;
    setDraft(decisionDraftFromAppeal(appeal));
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

    const parsed = parseAppealDecision(draft);
    if (!parsed.ok) {
      setProofInvalid(
        parsed.error !== "reason-required" &&
          parsed.error !== "reason-too-long",
      );
      setError(t("claimAppeals.decisionErrors." + parsed.error));
      return;
    }

    setIsSubmitting(true);
    setError("");
    setProofInvalid(false);
    const signature = JSON.stringify(parsed.value);

    try {
      const idempotencyKey = takeIdempotencyKey(signature);
      const next = await decideOperatorParcelClaimAppeal(
        activeAppealId,
        parsed.value,
        idempotencyKey,
      );
      pendingRef.current = null;
      onDecided(
        next,
        t(
          parsed.value.decision === "UPHOLD"
            ? "claimAppeals.upholdSuccess"
            : "claimAppeals.adjustmentSuccess",
        ),
      );
    } catch (caught) {
      const code = caught instanceof ApiRequestError ? caught.code : undefined;
      if (
        caught instanceof ApiRequestError &&
        (caught.status === 409 ||
          code === "PARCEL_CLAIM_APPEAL_ALREADY_DECIDED")
      ) {
        pendingRef.current = null;
        try {
          onDecided(
            await getOperatorParcelClaimAppeal(activeAppealId),
            t("claimAppeals.alreadyDecided"),
          );
          return;
        } catch {
          // Fall through to the original stale error.
        }
      }

      if (
        caught instanceof ApiRequestError &&
        code === "PARCEL_CLAIM_EVIDENCE_NOT_FOUND"
      ) {
        pendingRef.current = null;
        try {
          onEvidenceStale(
            await getOperatorParcelClaim(activeClaimId),
            t("claimAppeals.errors.evidenceStale"),
          );
          return;
        } catch {
          // Fall through to the original evidence error.
        }
      }

      // 4xx là kết quả dứt khoát của thao tác hiện tại. Chỉ giữ UUID để người
      // dùng retry đúng thao tác sau timeout/network hoặc lỗi server.
      if (caught instanceof ApiRequestError && caught.status < 500) {
        pendingRef.current = null;
      }

      if (
        caught instanceof ApiRequestError &&
        (code === "PARCEL_CLAIM_EVIDENCE_REQUIRED" ||
          code === "PARCEL_CLAIM_APPEAL_ADJUSTMENT_REQUIRED")
      ) {
        setProofInvalid(code === "PARCEL_CLAIM_EVIDENCE_REQUIRED");
        setError(caught.message);
      } else {
        setError(
          t(
            appealErrorTranslationKey(
              caught,
              "claimAppeals.decisionFailed",
            ),
          ),
        );
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
      icon={<FiRotateCcw size={20} />}
      title={t("claimAppeals.decisionTitle")}
      subtitle={t("claimAppeals.requestLabel")}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={
              isSubmitting ||
              isPreviewLoading ||
              hasNonPositiveAdjustment ||
              hasBlockingPreviewError
            }
          >
            {isSubmitting
              ? tc("processing")
              : t(
                  isAdjustment
                    ? "claimAppeals.confirmAdjustment"
                    : "claimAppeals.confirmUphold",
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

        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <p>
            {t("claimAppeals.currentAward", {
              amount: formatCurrency(appeal.originalTotalAwardVnd),
            })}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-600">
            {t("claimAppeals.customerReason", { reason: appeal.reason })}
          </p>
        </div>

        <fieldset disabled={isSubmitting}>
          <legend className={labelClass}>
            {t("claimAppeals.decisionLabel")}
          </legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(["UPHOLD", "APPROVE_ADJUSTMENT"] as const).map((value) => (
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
                  name="appeal-decision"
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
                    {t("claimAppeals.decision." + value)}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">
                    {t("claimAppeals.decisionHint." + value)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <ProofAssessmentFields
          draft={draft}
          evidence={claimDetail.claim.evidence}
          lossLabel={t("claimAppeals.revisedProvenLossLabel")}
          lossHint={t("claimAppeals.revisedProvenLossHint")}
          invalid={proofInvalid}
          disabled={isSubmitting}
          onChange={updateProof}
        />

        {isAdjustment ? (
          <>
            <AwardPreviewPanel
              preview={preview}
              isLoading={isPreviewLoading}
              error={previewError}
            />
            {hasNonPositiveAdjustment ? (
              <InlineAlert tone="warning">
                <p>{t("claimAppeals.errors.adjustmentRequired")}</p>
              </InlineAlert>
            ) : null}
            <InlineAlert tone="warning">
              <p>
                {t("claimAppeals.adjustmentRule", {
                  amount: formatCurrency(appeal.originalTotalAwardVnd),
                })}
              </p>
            </InlineAlert>
          </>
        ) : (
          <InlineAlert tone="info">
            <p>{t("claimAppeals.upholdProofAuditNote")}</p>
          </InlineAlert>
        )}

        <div>
          <label className={labelClass} htmlFor="appeal-reason">
            {t("claimAppeals.reasonLabel")}
            <span className="text-rose-700"> *</span>
          </label>
          <textarea
            id="appeal-reason"
            rows={3}
            maxLength={APPEAL_REASON_MAX_LENGTH}
            value={draft.reason}
            disabled={isSubmitting}
            onChange={(event) => {
              setError("");
              setDraft((current) => ({
                ...current,
                reason: event.target.value,
              }));
            }}
            placeholder={t("claimAppeals.reasonPlaceholder")}
            className={textareaClass}
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("claimAppeals.reasonHint", { max: APPEAL_REASON_MAX_LENGTH })}
          </p>
        </div>

        <InlineAlert tone="info">
          <p>{t("claimAppeals.payoutAsyncNote")}</p>
        </InlineAlert>
      </div>
    </Modal>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
