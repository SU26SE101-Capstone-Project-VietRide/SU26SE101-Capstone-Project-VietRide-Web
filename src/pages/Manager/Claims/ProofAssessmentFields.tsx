import { useTranslation } from "react-i18next";
import {
  PARCEL_CLAIM_PROOF_STATUSES,
  type ParcelClaimEvidence,
  type ParcelClaimProofStatus,
} from "../../../api/vietride";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import type { ProofAssessmentDraft } from "./claimHelpers";

type ProofAssessmentFieldsProps = {
  draft: ProofAssessmentDraft;
  evidence: ParcelClaimEvidence[];
  lossLabel: string;
  lossHint: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (draft: ProofAssessmentDraft) => void;
};

export default function ProofAssessmentFields({
  draft,
  evidence,
  lossLabel,
  lossHint,
  invalid = false,
  disabled = false,
  onChange,
}: ProofAssessmentFieldsProps) {
  const { t } = useTranslation("manager");

  function selectProofStatus(proofStatus: ParcelClaimProofStatus) {
    onChange({
      proofStatus,
      lossVnd: proofStatus === "VERIFIED" ? draft.lossVnd : "",
      acceptedEvidenceIds:
        proofStatus === "VERIFIED" ? draft.acceptedEvidenceIds : [],
    });
  }

  function toggleEvidence(evidenceId: string) {
    const isSelected = draft.acceptedEvidenceIds.includes(evidenceId);
    onChange({
      ...draft,
      acceptedEvidenceIds: isSelected
        ? draft.acceptedEvidenceIds.filter((id) => id !== evidenceId)
        : [...draft.acceptedEvidenceIds, evidenceId],
    });
  }

  return (
    <div
      className={
        invalid
          ? "space-y-4 rounded-xl border border-rose-300 bg-rose-50/40 p-3"
          : "space-y-4"
      }
    >
      <fieldset disabled={disabled}>
        <legend className={labelClass}>{t("claims.proofLabel")}</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {PARCEL_CLAIM_PROOF_STATUSES.map((value) => (
            <label
              key={value}
              className={
                "flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm " +
                (draft.proofStatus === value
                  ? "border-vr-300 bg-vr-50"
                  : "border-gray-200 bg-white")
              }
            >
              <input
                type="radio"
                name="proof-status"
                value={value}
                checked={draft.proofStatus === value}
                onChange={() => selectProofStatus(value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold text-gray-900">
                  {t("claims.proofStatus." + value)}
                </span>
                <span className="mt-0.5 block text-xs text-gray-600">
                  {t("claims.proofHint." + value)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.proofStatus === "VERIFIED" ? (
        <>
          <div>
            <label className={labelClass} htmlFor="proof-loss-vnd">
              {lossLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="proof-loss-vnd"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={draft.lossVnd}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...draft, lossVnd: event.target.value })
                }
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-gray-500">đ</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">{lossHint}</p>
          </div>

          <fieldset disabled={disabled}>
            <legend className={labelClass}>
              {t("claims.acceptedEvidenceLabel")}
              <span className="text-rose-700"> *</span>
            </legend>
            <p className="mt-1 text-xs text-gray-600">
              {t("claims.acceptedEvidenceHint")}
            </p>
            {evidence.length === 0 ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t("claims.evidenceEmptyForDecision")}
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {evidence.map((item) => (
                  <label
                    key={item.evidenceId}
                    className={
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm " +
                      (draft.acceptedEvidenceIds.includes(item.evidenceId)
                        ? "border-vr-300 bg-vr-50"
                        : "border-gray-200 bg-white")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={draft.acceptedEvidenceIds.includes(
                        item.evidenceId,
                      )}
                      onChange={() => toggleEvidence(item.evidenceId)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-gray-900">
                        {t("claims.evidenceType." + item.evidenceType, {
                          defaultValue: t("claims.evidenceType.OTHER"),
                        })}
                      </span>
                      {item.note?.trim() ? (
                        <span className="mt-0.5 block text-xs text-gray-600">
                          {item.note}
                        </span>
                      ) : null}
                      <a
                        href={item.reference}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 block truncate text-xs font-semibold text-vr-800 underline"
                      >
                        {t("claims.openEvidence")}
                      </a>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </>
      ) : null}
    </div>
  );
}
