// Xác nhận duyệt / từ chối báo cáo sự cố custody exception (§7, §9, §10 của
// `FE-Operator-Web-Parcel-Custody-Exception-Integration-Guide.md`).
//
// Bốn luật của tài liệu quyết định toàn bộ file này:
// - Body CHỈ có `decision` và `note`. Backend dùng strict JSON contract nên
//   thêm bất kỳ field nào (kể cả `requestId`) là 422 (§7).
// - Người duyệt lấy từ JWT — form không có ô UUID người duyệt (§2).
// - Một thao tác nghiệp vụ = một `Idempotency-Key`; retry cùng thao tác phải
//   DÙNG LẠI key cũ, không sinh key mới (§10).
// - `PARCEL_CUSTODY_EXCEPTION_ALREADY_DECIDED` là "người khác duyệt trước",
//   không phải lỗi cần thử lại: refetch để hiện quyết định thật (§9, §10).
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import {
  decideOperatorParcelIncidentCustodyException,
  getOperatorParcelIncident,
  type ParcelCustodyExceptionApproval,
  type ParcelIncidentDetail,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { formatDateTime } from "../../../utils/date";
import { parcelReasonLabel } from "../../../utils/parcelReason";
import { classifyIncidentError } from "./incidentHelpers";

type CustodyDecisionModalProps = {
  /** `null` = đóng. Đổi giá trị = thao tác nghiệp vụ khác → key mới. */
  decision: "APPROVE" | "REJECT" | null;
  incidentId: string;
  approval: ParcelCustodyExceptionApproval | null;
  onClose: () => void;
  /** Quyết định đã được ghi nhận (của mình hoặc của người khác) + detail mới */
  onDecided: (detail: ParcelIncidentDetail, message: string) => void;
  /** Sự cố không còn tồn tại/không thuộc tenant → đóng chi tiết, làm mới queue */
  onIncidentGone: (message: string) => void;
};

/** BE cho tối đa 2000 ký tự cho `note` (§7) */
const NOTE_MAX_LENGTH = 2000;

export default function CustodyDecisionModal({
  decision,
  incidentId,
  approval,
  onClose,
  onDecided,
  onIncidentGone,
}: CustodyDecisionModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [traceId, setTraceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Khoá dedupe của thao tác đang chờ. Giữ cả `decision` và `note` đã gửi để
  // phân biệt "bấm lại vì mạng lỗi" (dùng lại key) với "sửa ghi chú rồi gửi
  // lại" (thao tác mới, key mới).
  const pendingRef = useRef<{
    decision: "APPROVE" | "REJECT";
    note: string | null;
    idempotencyKey: string;
  } | null>(null);

  if (!decision) return null;

  const isApprove = decision === "APPROVE";
  const trimmedNote = note.trim();
  const notePayload = trimmedNote ? trimmedNote : null;

  function takeIdempotencyKey(
    current: "APPROVE" | "REJECT",
    currentNote: string | null,
  ) {
    const pending = pendingRef.current;

    if (
      pending &&
      pending.decision === current &&
      pending.note === currentNote
    ) {
      return pending.idempotencyKey;
    }

    const idempotencyKey = createIdempotencyKey();
    pendingRef.current = { decision: current, note: currentNote, idempotencyKey };
    return idempotencyKey;
  }

  /**
   * Nạp lại detail sau khi quyết định. BẮT BUỘC với approve: response của
   * endpoint decision không mang `searchTasks[]`, mà backend vừa tạo hai task
   * mặc định (`MANIFEST_RECONCILIATION`, `VEHICLE_SWEEP`) — không refetch thì
   * màn hiện "chưa có nhiệm vụ nào" ngay sau khi duyệt (§7).
   */
  async function refetchDetail() {
    return getOperatorParcelIncident(incidentId);
  }

  async function submit() {
    if (isSubmitting || !decision) return;

    setIsSubmitting(true);
    setError("");
    setTraceId("");

    const idempotencyKey = takeIdempotencyKey(decision, notePayload);

    try {
      await decideOperatorParcelIncidentCustodyException(
        incidentId,
        // Strict contract: đúng hai field này, không hơn.
        { decision, note: notePayload },
        idempotencyKey,
      );

      const fresh = await refetchDetail();
      pendingRef.current = null;
      onDecided(
        fresh,
        isApprove
          ? t("parcelIncidents.approval.approveSuccess")
          : t("parcelIncidents.approval.rejectSuccess"),
      );
    } catch (err) {
      await handleFailure(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFailure(err: unknown) {
    const code = err instanceof ApiRequestError ? err.code : undefined;
    const outcome = classifyIncidentError(err);

    // Sự cố biến mất khỏi tenant: giữ modal lại cũng vô nghĩa.
    if (outcome === "GONE") {
      pendingRef.current = null;
      onIncidentGone(
        err instanceof Error
          ? err.message
          : t("parcelIncidents.approval.incidentGone"),
      );
      return;
    }

    if (outcome === "STALE") {
      // Người khác đã quyết định trước: không replay bằng key khác, chỉ nạp
      // lại để hiện reviewer/quyết định đã lưu.
      pendingRef.current = null;

      try {
        const fresh = await refetchDetail();
        onDecided(
          fresh,
          code === "PARCEL_CUSTODY_EXCEPTION_ALREADY_DECIDED"
            ? t("parcelIncidents.approval.alreadyDecided")
            : t("parcelIncidents.approval.stateChanged"),
        );
        return;
      } catch {
        // Refetch cũng hỏng thì rơi xuống hiện lỗi gốc bên dưới
      }
    }

    setError(
      err instanceof Error
        ? err.message
        : t("parcelIncidents.approval.decisionFailed"),
    );
    setTraceId(err instanceof ApiRequestError ? (err.traceId ?? "") : "");
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={
        isApprove ? <FiCheckCircle size={20} /> : <FiXCircle size={20} />
      }
      title={
        isApprove
          ? t("parcelIncidents.approval.approveTitle")
          : t("parcelIncidents.approval.rejectTitle")
      }
      subtitle={approval?.locationSnapshot?.trim() || undefined}
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
              : isApprove
                ? t("parcelIncidents.approval.approve")
                : t("parcelIncidents.approval.reject")}
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
          {isApprove
            ? t("parcelIncidents.approval.approveWarning")
            : t("parcelIncidents.approval.rejectWarning")}
        </p>

        {approval && (
          <dl className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
            <div>
              <dt className="text-xs text-gray-500">
                {t("parcelIncidents.approval.reasonLabel")}
              </dt>
              <dd className="mt-0.5 font-semibold text-gray-800">
                {parcelReasonLabel(t, approval.reason) ||
                  t("parcelIncidents.approval.noReason")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">
                {t("parcelIncidents.approval.reportedBy")}
              </dt>
              <dd className="mt-0.5 text-gray-700">
                {t("parcelIncidents.approval.reportedMeta", {
                  role: t(
                    `parcelIncidents.actorRoles.${approval.reportedByRole}`,
                    { defaultValue: approval.reportedByRole },
                  ),
                  at: formatDateTime(approval.reportedAt),
                })}
              </dd>
            </div>
          </dl>
        )}

        {/* BE cho phép `note` rỗng, nhưng hồ sơ duyệt không có lý do thì về sau
            không ai tra được vì sao (§15) — nên khuyến khích nhập, không chặn. */}
        <label className="block">
          <span className={labelClass}>
            {t("parcelIncidents.approval.noteLabel")}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={NOTE_MAX_LENGTH}
            disabled={isSubmitting}
            placeholder={
              isApprove
                ? t("parcelIncidents.approval.approveNotePlaceholder")
                : t("parcelIncidents.approval.rejectNotePlaceholder")
            }
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-gray-500">
            {t("parcelIncidents.approval.noteHint", {
              max: NOTE_MAX_LENGTH,
            })}
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{error}</p>
            {/* traceId chỉ để gửi cho support, không phải nội dung thông báo */}
            {traceId && (
              <p className="mt-1 break-all font-mono text-xs text-red-600">
                {t("parcelIncidents.approval.traceId", { traceId })}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
