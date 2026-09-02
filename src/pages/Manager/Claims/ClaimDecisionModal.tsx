// Duyệt/từ chối một khiếu nại bồi thường (§7.3).
//
// Chỉ OPERATOR_ADMIN mở được modal này; phía gọi đã lọc theo vai trò lẫn
// `availableActions`. Ở đây tập trung vào việc người quyết định nhìn thấy hệ quả
// bằng tiền TRƯỚC khi bấm.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDollarSign } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import {
  decideOperatorParcelClaim,
  getOperatorParcelClaim,
  type ParcelClaimDetail,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import InlineAlert from "../../../components/InlineAlert";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { formatCurrency } from "../../../utils/currency";
import {
  claimErrorTranslationKey,
  parseClaimDecision,
  previewClaimCargoAward,
  type ClaimDecisionDraft,
} from "./claimHelpers";

type ClaimDecisionModalProps = {
  open: boolean;
  detail: ParcelClaimDetail | null;
  onClose: () => void;
  onDecided: (detail: ParcelClaimDetail, message: string) => void;
};

const emptyDraft: ClaimDecisionDraft = {
  decision: "APPROVE",
  provenDirectLossVnd: "",
  reason: "",
};

export default function ClaimDecisionModal({
  open,
  detail,
  onClose,
  onDecided,
}: ClaimDecisionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [draft, setDraft] = useState<ClaimDecisionDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Form phải trắng lại khi mở cho một claim khác — giữ id đang soạn ngay trong
  // state để không cần effect dọn (effect chạy sau render đầu, hở đúng 1 frame).
  const [draftClaimId, setDraftClaimId] = useState<string | null>(null);

  const claim = detail?.claim ?? null;
  if (claim && draftClaimId !== claim.claimId) {
    setDraftClaimId(claim.claimId);
    setDraft(emptyDraft);
    setError("");
  }

  if (!claim) return null;

  const lossText = draft.provenDirectLossVnd.trim();
  const preview =
    draft.decision === "APPROVE" && /^\d+$/.test(lossText)
      ? previewClaimCargoAward(
          Number(lossText),
          claim.declaredValueVnd,
          claim.compensationRatePercent,
          claim.policyCapVnd,
        )
      : null;

  async function handleSubmit() {
    if (!claim || isSubmitting) return;

    const parsed = parseClaimDecision(draft);
    if (!parsed.ok) {
      setError(t(`claims.decisionErrors.${parsed.error}`));
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const next = await decideOperatorParcelClaim(claim.claimId, parsed.value);
      onDecided(
        next,
        t(
          parsed.value.decision === "APPROVE"
            ? "claims.approveSuccess"
            : "claims.rejectSuccess",
        ),
      );
    } catch (err) {
      // §17: 409 nghĩa là claim đã đổi trạng thái (người khác quyết định trước,
      // hoặc BE đã đóng hồ sơ). KHÔNG gửi lại — thay màn bằng một detail GET
      // mới để bộ nút được dựng lại theo `availableActions` thật.
      if (err instanceof ApiRequestError && err.status === 409 && claim) {
        try {
          onDecided(
            await getOperatorParcelClaim(claim.claimId),
            t("claims.alreadyDecided"),
          );
          return;
        } catch {
          // Nạp lại cũng hỏng thì rơi xuống hiện lỗi gốc bên dưới
        }
      }

      setError(t(claimErrorTranslationKey(err, "claims.decisionFailed")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiDollarSign size={20} />}
      title={t("claims.decisionTitle")}
      subtitle={detail?.parcel?.parcelCode}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant={draft.decision === "APPROVE" ? "primary" : "danger"}
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {t(
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

        <fieldset>
          <legend className={labelClass}>{t("claims.decisionLabel")}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(["APPROVE", "REJECT"] as const).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${
                  draft.decision === value
                    ? "border-vr-300 bg-vr-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="claim-decision"
                  value={value}
                  checked={draft.decision === value}
                  onChange={() => {
                    setError("");
                    setDraft((prev) => ({ ...prev, decision: value }));
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {t(`claims.decision.${value}`)}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">
                    {t(`claims.decisionHint.${value}`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {draft.decision === "APPROVE" ? (
          <div>
            <label className={labelClass} htmlFor="claim-proven-loss">
              {t("claims.provenLossLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="claim-proven-loss"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={draft.provenDirectLossVnd}
                onChange={(event) => {
                  setError("");
                  setDraft((prev) => ({
                    ...prev,
                    provenDirectLossVnd: event.target.value,
                  }));
                }}
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-gray-500">đ</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {t("claims.provenLossHint", {
                multiplier: claim.policySnapshot?.noProofFallbackMultiplier ?? "—",
              })}
            </p>
          </div>
        ) : null}

        {/* Con số bằng tiền phải hiện TRƯỚC khi bấm duyệt, không phải sau. */}
        {preview ? (
          <div className="rounded-xl bg-vr-50 px-4 py-3">
            <p className="text-xs font-semibold text-vr-800">
              {t("claims.previewTitle")}
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-gray-700">
              <li>
                {t("claims.previewAssessed", {
                  amount: formatCurrency(preview.assessedLossVnd),
                  rate: claim.compensationRatePercent,
                })}
              </li>
              <li className="font-semibold text-gray-900">
                {t("claims.previewCargoAward", {
                  amount: formatCurrency(preview.cargoAwardVnd),
                })}
              </li>
              {preview.cappedByPolicy ? (
                <li className="text-amber-700">
                  {t("claims.previewCapped", {
                    cap: formatCurrency(claim.policyCapVnd),
                  })}
                </li>
              ) : null}
            </ul>
            <p className="mt-2 text-xs text-gray-600">
              {t("claims.previewFreightNote")}
            </p>
          </div>
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
            onChange={(event) => {
              setError("");
              setDraft((prev) => ({ ...prev, reason: event.target.value }));
            }}
            placeholder={t("claims.reasonPlaceholder")}
            className={inputClass}
          />
        </div>

        <InlineAlert tone="info">
          <p>{t("claims.payoutAsyncNote")}</p>
        </InlineAlert>
      </div>
    </Modal>
  );
}
