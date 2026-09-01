import { useTranslation } from "react-i18next";
import { FiInfo, FiUserMinus } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import type { ShuttleTripPassengerGroup } from "../../../api/vietride";
import { displayBusinessCode } from "../../../utils/businessCode";

type UnassignShuttleBookingModalProps = {
  open: boolean;
  group: ShuttleTripPassengerGroup | null;
  reason: string;
  error: string;
  busy: boolean;
  locked: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const REASON_MAX_LENGTH = 500;

export default function UnassignShuttleBookingModal({
  open,
  group,
  reason,
  error,
  busy,
  locked,
  onReasonChange,
  onClose,
  onConfirm,
}: UnassignShuttleBookingModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const canConfirm =
    Boolean(group?.bookingId) &&
    reason.trim().length > 0 &&
    !busy &&
    !locked;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t("dispatch.unassignBookingTitle")}
      subtitle={
        group?.bookingCode
          ? displayBusinessCode(group.bookingCode)
          : undefined
      }
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <FiUserMinus aria-hidden="true" />
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
            className="min-h-11 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? t("dispatch.unassigningBooking")
              : t("dispatch.confirmUnassignBooking")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gray-700">
          {t("dispatch.unassignBookingConfirm", {
            count: group?.passengerCount ?? group?.passengers?.length ?? 0,
          })}
        </p>

        <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
          <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{t("dispatch.unassignBookingNotCancellation")}</p>
        </div>

        <div>
          <label
            htmlFor="dispatch-unassign-booking-reason"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            {t("dispatch.unassignBookingReason")}
          </label>
          <textarea
            id="dispatch-unassign-booking-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={busy}
            rows={3}
            maxLength={REASON_MAX_LENGTH}
            placeholder={t("dispatch.unassignBookingReasonPlaceholder")}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vr-500 disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("dispatch.unassignBookingReasonHint")}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
