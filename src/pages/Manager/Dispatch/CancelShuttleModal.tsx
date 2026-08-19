// Modal nhập lý do huỷ cho cả hai luồng: huỷ một yêu cầu chờ điều phối và huỷ
// một chuyến trung chuyển đã tạo. BE bắt `reason` non-blank ở cả hai endpoint
// nên nút xác nhận chỉ mở khi đã có lý do.
import { useTranslation } from "react-i18next";
import { FiAlertTriangle } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";

type CancelShuttleModalProps = {
  open: boolean;
  title: string;
  message: string;
  reason: string;
  error: string;
  busy: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const REASON_MAX_LENGTH = 500;

export default function CancelShuttleModal({
  open,
  title,
  message,
  reason,
  error,
  busy,
  onReasonChange,
  onClose,
  onConfirm,
}: CancelShuttleModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const canConfirm = reason.trim().length > 0 && !busy;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <FiAlertTriangle aria-hidden="true" />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {tc("close")}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="min-h-11 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t("dispatch.cancelling") : t("dispatch.confirmCancel")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gray-700">{message}</p>

        <div>
          <label
            htmlFor="dispatch-cancel-reason"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            {t("dispatch.cancelReason")}
          </label>
          <textarea
            id="dispatch-cancel-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={busy}
            rows={3}
            maxLength={REASON_MAX_LENGTH}
            placeholder={t("dispatch.cancelReasonPlaceholder")}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vr-500 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("dispatch.cancelReasonHint")}
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
