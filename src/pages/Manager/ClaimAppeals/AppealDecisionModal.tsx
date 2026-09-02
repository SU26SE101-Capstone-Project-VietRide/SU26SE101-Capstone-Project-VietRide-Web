// Giữ nguyên / điều chỉnh một khiếu nại lại (§12 playbook Reliability v2).
//
// Bốn luật của tài liệu quyết định toàn bộ file này:
// - `decision` chỉ `UPHOLD` hoặc `APPROVE_ADJUSTMENT`. Không có "từ chối":
//   giữ nguyên quyết định cũ CHÍNH LÀ kết cục bất lợi cho khách.
// - Người quyết định lấy từ JWT — form không có ô UUID reviewer/supervisor.
// - FE KHÔNG gửi `revisedTotalAwardVnd`/`supplementaryAwardVnd`: BE tính lại
//   theo policy snapshot rồi mới chốt. Ở đây chỉ nêu điều kiện, không tính hộ.
// - Một thao tác nghiệp vụ = một `Idempotency-Key`; retry vì timeout phải DÙNG
//   LẠI key cũ, đổi quyết định/số tiền mới sinh key mới (§17).
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRotateCcw } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  decideOperatorParcelClaimAppeal,
  getOperatorParcelClaimAppeal,
  type ParcelClaimAppeal,
} from "../../../api/vietride";
import InlineAlert from "../../../components/InlineAlert";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { formatCurrency } from "../../../utils/currency";
import {
  APPEAL_REASON_MAX_LENGTH,
  appealErrorTranslationKey,
  parseAppealDecision,
  type AppealDecisionDraft,
} from "./appealHelpers";

type AppealDecisionModalProps = {
  open: boolean;
  appeal: ParcelClaimAppeal | null;
  onClose: () => void;
  onDecided: (appeal: ParcelClaimAppeal, message: string) => void;
};

const emptyDraft: AppealDecisionDraft = {
  decision: "UPHOLD",
  revisedProvenDirectLossVnd: "",
  reason: "",
};

/** Quyết định của người khác đã ghi trước — nạp lại chứ không gửi lại. */
const STALE_CODES = [
  "PARCEL_CLAIM_APPEAL_ALREADY_DECIDED",
  "PARCEL_CLAIM_APPEAL_INVALID_STATUS",
  "INVALID_STATUS",
];

export default function AppealDecisionModal({
  open,
  appeal,
  onClose,
  onDecided,
}: AppealDecisionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [draft, setDraft] = useState<AppealDecisionDraft>(emptyDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Khoá dedupe của thao tác đang chờ. Giữ nguyên nội dung đã gửi để phân biệt
  // "bấm lại vì mạng lỗi" (dùng lại key) với "sửa rồi gửi lại" (key mới).
  const pendingRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  if (!open || !appeal) return null;

  const isAdjustment = draft.decision === "APPROVE_ADJUSTMENT";

  function takeIdempotencyKey(signature: string) {
    const pending = pendingRef.current;
    if (pending && pending.signature === signature) {
      return pending.idempotencyKey;
    }

    const idempotencyKey = createIdempotencyKey();
    pendingRef.current = { signature, idempotencyKey };
    return idempotencyKey;
  }

  async function handleSubmit() {
    if (!appeal || isSubmitting) return;

    const parsed = parseAppealDecision(draft);
    if (!parsed.ok) {
      setError(t(`claimAppeals.decisionErrors.${parsed.error}`));
      return;
    }

    setIsSubmitting(true);
    setError("");

    const idempotencyKey = takeIdempotencyKey(JSON.stringify(parsed.value));

    try {
      const next = await decideOperatorParcelClaimAppeal(
        appeal.appealId,
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
    } catch (err) {
      await handleFailure(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFailure(err: unknown) {
    const code = err instanceof ApiRequestError ? err.code : undefined;
    // §17: 409 nghĩa là state đã đổi — thay màn bằng một GET mới, bất kể mã lỗi
    // cụ thể là gì. Danh sách mã ở trên chỉ bắt thêm các trường hợp BE trả 422.
    const isStale =
      (err instanceof ApiRequestError && err.status === 409) ||
      (code !== undefined && STALE_CODES.includes(code));

    // Người khác đã quyết định trước: KHÔNG replay bằng key khác, chỉ nạp lại
    // để hiện quyết định đã lưu.
    if (isStale && appeal) {
      pendingRef.current = null;
      try {
        const fresh = await getOperatorParcelClaimAppeal(appeal.appealId);
        onDecided(fresh, t("claimAppeals.alreadyDecided"));
        return;
      } catch {
        // Nạp lại cũng hỏng thì rơi xuống hiện lỗi gốc bên dưới
      }
    }

    setError(
      t(appealErrorTranslationKey(err, "claimAppeals.decisionFailed")),
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiRotateCcw size={20} />}
      title={t("claimAppeals.decisionTitle")}
      subtitle={t("claimAppeals.requestLabel")}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
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

        <fieldset>
          <legend className={labelClass}>
            {t("claimAppeals.decisionLabel")}
          </legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(["UPHOLD", "APPROVE_ADJUSTMENT"] as const).map((value) => (
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
                  name="appeal-decision"
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
                    {t(`claimAppeals.decision.${value}`)}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-600">
                    {t(`claimAppeals.decisionHint.${value}`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {isAdjustment ? (
          <>
            <div>
              <label className={labelClass} htmlFor="appeal-revised-loss">
                {t("claimAppeals.revisedProvenLossLabel")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="appeal-revised-loss"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={draft.revisedProvenDirectLossVnd}
                  onChange={(event) => {
                    setError("");
                    setDraft((prev) => ({
                      ...prev,
                      revisedProvenDirectLossVnd: event.target.value,
                    }));
                  }}
                  className={inputClass}
                />
                <span className="shrink-0 text-sm text-gray-500">đ</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {t("claimAppeals.revisedProvenLossHint")}
              </p>
            </div>

            {/* Điều kiện của BE, nói bằng lời chứ không tính hộ: mức đền tính
                lại phải LỚN HƠN mức cũ, nếu không endpoint trả validation
                error. Con số cuối cùng do BE chốt theo policy snapshot. */}
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
            <p>{t("claimAppeals.upholdNote")}</p>
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
            onChange={(event) => {
              setError("");
              setDraft((prev) => ({ ...prev, reason: event.target.value }));
            }}
            placeholder={t("claimAppeals.reasonPlaceholder")}
            className={inputClass}
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
