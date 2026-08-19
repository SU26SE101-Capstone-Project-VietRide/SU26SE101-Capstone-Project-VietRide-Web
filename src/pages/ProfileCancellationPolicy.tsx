import { FiPlus, FiTrash2 } from "react-icons/fi";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import InlineAlert from "../components/InlineAlert";
import { inputClass } from "../components/form/formClasses";
import {
  buildCancellationWindows,
  parseCancellationPolicyDrafts,
  previewFeePercent,
  type CancellationPolicyDraft,
  type CancellationWindow,
} from "../utils/operatorCancellationPolicy";

type ProfileCancellationPolicyProps = {
  drafts: CancellationPolicyDraft[];
  isEditing: boolean;
  error: string;
  onAdd: () => void;
  onApplyTemplate: () => void;
  onChange: (
    id: string,
    field: "hoursBeforeDeparture" | "feePercent",
    value: string,
  ) => void;
  onRemove: (id: string) => void;
};

function windowTitle(window: CancellationWindow, t: TFunction) {
  if (window.toInclusive === null && window.fromExclusive === null) {
    return t("profilePage.cancellationAlwaysFullRefund");
  }
  if (window.toInclusive === null) {
    return t("profilePage.cancellationWindowAfter", { hours: window.fromExclusive ?? 0 });
  }
  if (window.fromExclusive === null) {
    return t("profilePage.cancellationWindowWithin", { hours: window.toInclusive });
  }
  return t("profilePage.cancellationWindowBetween", {
    from: window.fromExclusive,
    to: window.toInclusive,
  });
}

function refundLabel(feePercent: number, t: TFunction) {
  if (feePercent >= 100) return t("profilePage.cancellationRefundNone");
  if (feePercent <= 0) return t("profilePage.cancellationRefundFull");
  return t("profilePage.cancellationRefundAmount", { refund: 100 - feePercent });
}

export function ProfileCancellationPolicy({
  drafts,
  isEditing,
  error,
  onAdd,
  onApplyTemplate,
  onChange,
  onRemove,
}: ProfileCancellationPolicyProps) {
  const { t } = useTranslation("common");
  const parsed = parseCancellationPolicyDrafts(drafts);
  const windows = parsed.ok
    ? buildCancellationWindows(parsed.value)
    : [];

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-gray-900">
            {t("profilePage.cancellationPolicy")}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {t("profilePage.cancellationPolicyHint")}
          </p>
        </div>
        {isEditing ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {drafts.length === 0 ? (
              <button
                type="button"
                onClick={onApplyTemplate}
                className="inline-flex items-center rounded-xl border border-vr-200 bg-vr-50 px-3 py-2 text-sm font-semibold text-vr-800 hover:bg-vr-100"
              >
                {t("profilePage.cancellationUseTemplate")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-vr-800 px-3 py-2 text-sm font-semibold text-white hover:bg-vr-900"
            >
              <FiPlus size={14} />
              {t("profilePage.cancellationAddTier")}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3">
          <InlineAlert tone="error">
            <p>{error}</p>
          </InlineAlert>
        </div>
      ) : null}

      {isEditing ? (
        drafts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5">
            <p className="text-sm font-medium text-gray-800">
              {t("profilePage.cancellationPolicyEmpty")}
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {t("profilePage.cancellationTemplateHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((rule, index) => {
              const feePercent = previewFeePercent(rule);
              return (
                <div
                  key={rule.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">
                      {t("profilePage.cancellationIfWithin")}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRemove(rule.id)}
                      aria-label={`${t("profilePage.cancellationRemoveTier")} ${index + 1}`}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">
                        {t("profilePage.cancellationHours")}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={rule.hoursBeforeDeparture}
                          onChange={(event) =>
                            onChange(rule.id, "hoursBeforeDeparture", event.target.value)
                          }
                          aria-label={`${t("profilePage.cancellationHours")} ${index + 1}`}
                          className={inputClass}
                        />
                        <span className="shrink-0 text-sm text-gray-500">
                          {t("profilePage.cancellationHoursUnit")}
                        </span>
                      </div>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">
                        {t("profilePage.cancellationOperatorKeeps")}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={1}
                          value={rule.feePercent}
                          onChange={(event) =>
                            onChange(rule.id, "feePercent", event.target.value)
                          }
                          aria-label={`${t("profilePage.cancellationFee")} ${index + 1}`}
                          className={inputClass}
                        />
                        <span className="shrink-0 text-sm text-gray-500">%</span>
                      </div>
                    </label>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    {feePercent === null
                      ? t("profilePage.cancellationPreviewPending")
                      : refundLabel(feePercent, t)}
                  </p>
                </div>
              );
            })}
            {parsed.ok && parsed.value ? (
              <div className="rounded-xl bg-vr-50 px-4 py-3">
                <p className="text-xs font-semibold text-vr-800">
                  {t("profilePage.cancellationSummaryTitle")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {windows.map((window) => (
                    <li
                      key={`${window.fromExclusive}-${window.toInclusive}-${window.feePercent}`}
                      className="text-sm leading-6 text-gray-700"
                    >
                      {windowTitle(window, t)}
                      {": "}
                      {refundLabel(window.feePercent, t)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      ) : drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5">
          <p className="text-sm font-medium text-gray-800">
            {t("profilePage.cancellationPolicyEmpty")}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {windows.map((window) => (
            <li
              key={`${window.fromExclusive}-${window.toInclusive}-${window.feePercent}`}
              className={`rounded-xl px-4 py-3 ${
                window.isDefaultFullRefund
                  ? "border border-dashed border-gray-200 bg-gray-50"
                  : "border border-gray-200 bg-white"
              }`}
            >
              <p className="text-sm font-medium text-gray-900">
                {windowTitle(window, t)}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {t("profilePage.cancellationKeepAmount", { fee: window.feePercent })}
                {" · "}
                {refundLabel(window.feePercent, t)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
