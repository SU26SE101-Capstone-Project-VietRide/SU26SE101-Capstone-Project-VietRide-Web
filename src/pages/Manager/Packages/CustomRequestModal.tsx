// Form nhà xe xin gói riêng: sáu hạn mức, ba module, kỳ mong muốn, ghi chú.
//
// Đây KHÔNG phải "sửa hạn mức gói đang dùng" — gói riêng là một gói mới, và nó
// bất biến sau khi tạo. Chữ trong form tránh mọi cách nói gợi ý điều chỉnh gói
// hiện tại.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiSend } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import Checkbox from "../../../components/form/Checkbox";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import { toNumber } from "../../../utils/number";
import type {
  CreateCustomPlanRequestPayload,
  OperatorSubscriptionDetail,
  SubscriptionBillingPeriod,
  SubscriptionPlan,
} from "../../../api/vietride";
import { suggestedCustomPlanQuota } from "../../../utils/subscription";
import { formatNumber } from "./subscriptionHelpers";

// Sáu hạn mức kèm key usage tương ứng để hiện dòng "Đang dùng: N"
const quotaFields = [
  { key: "maxVehicles", usageKey: "currentVehicles" },
  { key: "maxRoutes", usageKey: "currentRoutes" },
  { key: "maxDrivers", usageKey: "currentDrivers" },
  { key: "maxAssistants", usageKey: "currentAssistants" },
  { key: "maxOperatorUsers", usageKey: "currentOperatorUsers" },
  { key: "maxTripsPerMonth", usageKey: "currentTripsThisMonth" },
] as const;

const moduleFields = ["enableParcel", "enableShuttle", "enableRag"] as const;

type CustomRequestModalProps = {
  // Component được render CÓ ĐIỀU KIỆN nên form dựng một lần từ gói + usage
  currentPlan: SubscriptionPlan;
  usage: OperatorSubscriptionDetail["usage"];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCustomPlanRequestPayload) => void;
};

export default function CustomRequestModal({
  currentPlan,
  usage,
  isSubmitting,
  onClose,
  onSubmit,
}: CustomRequestModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [form, setForm] = useState<CreateCustomPlanRequestPayload>(() => ({
    ...suggestedCustomPlanQuota(currentPlan, usage),
    enableParcel: currentPlan.modules.enableParcel,
    enableShuttle: currentPlan.modules.enableShuttle,
    enableRag: currentPlan.modules.enableRag,
    preferredBillingPeriod: "MONTHLY",
    note: "",
  }));

  function update<K extends keyof CreateCustomPlanRequestPayload>(
    key: K,
    value: CreateCustomPlanRequestPayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      icon={<FiSend size={20} />}
      title={t("packages.customRequestTitle")}
      subtitle={t("packages.customRequestSubtitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            data-testid="custom-request-submit"
            onClick={() => onSubmit({ ...form, note: form.note?.trim() })}
            disabled={isSubmitting}
          >
            {t("packages.customRequestSend")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="text-base font-bold text-gray-900">
            {t("packages.customRequestQuotaTitle")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t("packages.customRequestQuotaHint")}
          </p>
          <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {quotaFields.map(({ key, usageKey }) => {
              const used = usage[usageKey] ?? 0;
              // Cảnh báo MỀM: xin thấp hơn mức đang chạy thì admin sẽ bị BE
              // chặn ở bước duyệt — nói trước đỡ mất một vòng chờ.
              const belowUsage = form[key] < used;

              return (
                <div key={key}>
                  <label className={labelClass} htmlFor={`custom-${key}`}>
                    {t(`packages.limitLabels.${key}`)}
                  </label>
                  <input
                    id={`custom-${key}`}
                    data-testid={`custom-request-${key}`}
                    className={inputClass}
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(event) =>
                      update(key, toNumber(event.target.value))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t("packages.currentlyUsing", { used: formatNumber(used) })}
                  </p>
                  {belowUsage ? (
                    <p
                      data-testid={`custom-request-warning-${key}`}
                      className="mt-1 flex items-start gap-1 text-xs font-semibold text-amber-700"
                    >
                      <FiAlertTriangle className="mt-0.5 shrink-0" size={12} />
                      <span>{t("packages.customRequestBelowUsage")}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-gray-200 pt-5">
          <h3 className="text-base font-bold text-gray-900">
            {t("packages.features")}
          </h3>
          <div className="mt-4 flex flex-wrap gap-4">
            {moduleFields.map((key) => (
              <Checkbox
                key={key}
                checked={form[key]}
                onChange={(value) => update(key, value)}
                label={t(`packages.${key.replace("enable", "").toLowerCase()}Module`)}
              />
            ))}
          </div>
        </section>

        <section className="border-t border-gray-200 pt-5">
          <h3 className="text-base font-bold text-gray-900">
            {t("packages.preferredBillingPeriod")}
          </h3>
          {/* Chỉ là gợi ý để admin đặt giá — lúc mua vẫn chọn kỳ tự do */}
          <p className="mt-1 text-sm text-gray-500">
            {t("packages.preferredBillingPeriodHint")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["MONTHLY", "YEARLY"] as const).map((period) => (
              <button
                key={period}
                type="button"
                data-testid={`custom-request-period-${period}`}
                aria-pressed={form.preferredBillingPeriod === period}
                onClick={() =>
                  update(
                    "preferredBillingPeriod",
                    period as SubscriptionBillingPeriod,
                  )
                }
                className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                  form.preferredBillingPeriod === period
                    ? "border-vr-400 bg-vr-50 text-vr-900"
                    : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60"
                }`}
              >
                {t(`packages.billing.${period}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-200 pt-5">
          <label className={labelClass} htmlFor="custom-request-note">
            {t("packages.customRequestNote")}
          </label>
          <textarea
            id="custom-request-note"
            data-testid="custom-request-note"
            className={textareaClass + " min-h-[90px] resize-y"}
            value={form.note ?? ""}
            placeholder={t("packages.customRequestNotePlaceholder")}
            onChange={(event) => update("note", event.target.value)}
            rows={3}
          />
        </section>
      </div>
    </Modal>
  );
}
