import { useTranslation } from "react-i18next";
import { FiLoader } from "react-icons/fi";

/** BE: `rejectionReason` bắt buộc và tối đa 500 ký tự (RejectDeliveryCommandHandler). */
export const REJECTION_REASON_MAX_LENGTH = 500;

type RejectDeliveryFormProps = {
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
};

export default function RejectDeliveryForm({
  reason,
  onReasonChange,
  onSubmit,
  onCancel,
  submitting,
  error,
}: RejectDeliveryFormProps) {
  const { t } = useTranslation("parcelDelivery");

  return (
    <form
      className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label
        className="mb-2 block text-sm font-semibold text-slate-800"
        htmlFor="parcel-delivery-rejection-reason"
      >
        {t("reject.label")} <span className="text-red-500">*</span>
      </label>
      <textarea
        id="parcel-delivery-rejection-reason"
        className="min-h-24 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
        maxLength={REJECTION_REASON_MAX_LENGTH}
        value={reason}
        disabled={submitting}
        placeholder={t("reject.placeholder")}
        onChange={(event) => onReasonChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "parcel-delivery-rejection-error" : undefined}
      />
      <p className="mt-1.5 text-right text-xs text-gray-500">
        {t("reject.counter", {
          current: reason.length,
          max: REJECTION_REASON_MAX_LENGTH,
        })}
      </p>

      {error ? (
        <p
          id="parcel-delivery-rejection-error"
          role="alert"
          className="mt-1 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
        >
          {submitting ? (
            <FiLoader className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : null}
          {submitting ? t("actions.rejecting") : t("reject.submit")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("actions.cancel")}
        </button>
      </div>
    </form>
  );
}
