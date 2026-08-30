// Xác nhận duyệt / từ chối cho chuyến rời điểm dừng (§9 playbook Reliability v2).
//
// Ba luật của tài liệu quyết định file này:
// - Body strict: đúng `decision` + `note`. Người duyệt lấy từ JWT, form KHÔNG
//   có ô reviewer ID.
// - Một thao tác nghiệp vụ = một `Idempotency-Key`; retry vì timeout DÙNG LẠI
//   key cũ, đổi APPROVE↔REJECT hoặc sửa ghi chú mới sinh key mới (§17).
// - Duyệt chỉ cho chuyến đi tiếp theo clearance. Không kết luận kiện mất và
//   không được tạo claim từ đây.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  decideParcelStopDepartureApproval,
  getParcelStopDepartureApproval,
  type ParcelStopDepartureApproval,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";

type DepartureDecisionModalProps = {
  /** `null` = đóng. Đổi giá trị = thao tác nghiệp vụ khác → key mới. */
  decision: "APPROVE" | "REJECT" | null;
  approval: ParcelStopDepartureApproval | null;
  onClose: () => void;
  onDecided: (approval: ParcelStopDepartureApproval, message: string) => void;
};

/** Cùng trần với các endpoint decision khác của nhóm Reliability. */
const NOTE_MAX_LENGTH = 2000;

/** Người khác đã quyết định trước — nạp lại chứ không gửi lại (§17, 409). */
const STALE_CODES = [
  "PARCEL_STOP_DEPARTURE_APPROVAL_ALREADY_DECIDED",
  "PARCEL_STOP_DEPARTURE_APPROVAL_INVALID_STATUS",
  "INVALID_STATUS",
];

export default function DepartureDecisionModal({
  decision,
  approval,
  onClose,
  onDecided,
}: DepartureDecisionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [traceId, setTraceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingRef = useRef<{
    decision: "APPROVE" | "REJECT";
    note: string | null;
    idempotencyKey: string;
  } | null>(null);

  if (!decision || !approval) return null;

  const isApprove = decision === "APPROVE";
  const trimmedNote = note.trim();
  const notePayload = trimmedNote ? trimmedNote : null;

  function takeIdempotencyKey(
    current: "APPROVE" | "REJECT",
    currentNote: string | null,
  ) {
    const pending = pendingRef.current;
    if (pending && pending.decision === current && pending.note === currentNote) {
      return pending.idempotencyKey;
    }

    const idempotencyKey = createIdempotencyKey();
    pendingRef.current = {
      decision: current,
      note: currentNote,
      idempotencyKey,
    };
    return idempotencyKey;
  }

  async function submit() {
    if (!decision || !approval || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setTraceId("");

    const idempotencyKey = takeIdempotencyKey(decision, notePayload);

    try {
      const next = await decideParcelStopDepartureApproval(
        approval.requestId,
        { decision, note: notePayload },
        idempotencyKey,
      );
      pendingRef.current = null;
      onDecided(
        next,
        t(
          isApprove
            ? "stopDepartureApprovals.approveSuccess"
            : "stopDepartureApprovals.rejectSuccess",
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
    // §17: 409 = state đã đổi, thay màn bằng một GET mới bất kể mã lỗi cụ thể.
    const isStale =
      (err instanceof ApiRequestError && err.status === 409) ||
      (code !== undefined && STALE_CODES.includes(code));

    if (isStale && approval) {
      pendingRef.current = null;
      try {
        const fresh = await getParcelStopDepartureApproval(approval.requestId);
        onDecided(fresh, t("stopDepartureApprovals.alreadyDecided"));
        return;
      } catch {
        // Nạp lại cũng hỏng thì rơi xuống hiện lỗi gốc bên dưới
      }
    }

    setError(
      err instanceof Error
        ? err.message
        : t("stopDepartureApprovals.decisionFailed"),
    );
    setTraceId(err instanceof ApiRequestError ? (err.traceId ?? "") : "");
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={isApprove ? <FiCheckCircle size={20} /> : <FiXCircle size={20} />}
      title={t(
        isApprove
          ? "stopDepartureApprovals.approveTitle"
          : "stopDepartureApprovals.rejectTitle",
      )}
      subtitle={t("stopDepartureApprovals.requestRef", {
        ref: approval.requestId.slice(0, 8).toUpperCase(),
      })}
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant={isApprove ? "primary" : "danger"}
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? tc("processing")
              : t(
                  isApprove
                    ? "stopDepartureApprovals.approve"
                    : "stopDepartureApprovals.reject",
                )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            isApprove
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {t(
            isApprove
              ? "stopDepartureApprovals.approveWarning"
              : "stopDepartureApprovals.rejectWarning",
            { count: approval.unresolvedParcelIds.length },
          )}
        </p>

        <label className="block">
          <span className={labelClass}>
            {t("stopDepartureApprovals.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={NOTE_MAX_LENGTH}
            disabled={isSubmitting}
            placeholder={t(
              isApprove
                ? "stopDepartureApprovals.approveNotePlaceholder"
                : "stopDepartureApprovals.rejectNotePlaceholder",
            )}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-gray-500">
            {t("stopDepartureApprovals.noteHint", { max: NOTE_MAX_LENGTH })}
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{error}</p>
            {traceId && (
              <p className="mt-1 break-all font-mono text-xs text-red-600">
                {t("stopDepartureApprovals.traceId", { traceId })}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
