// Modal duyệt yêu cầu gói riêng: admin chốt tên, mô tả, sáu hạn mức, ba module
// và HAI GIÁ ĐỘC LẬP. Form prefill nguyên từ yêu cầu — admin chỉnh chứ không gõ lại.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiCheck } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import type {
  ApproveCustomPlanRequestPayload,
  SubscriptionPlan,
} from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import {
  operatorLabel,
  type CustomPlanRequestView,
} from "../../../utils/customPlanRequest";
import {
  CurrencyField,
  NumberField,
  TextInput,
  Toggle,
} from "./planFormFields";
import type { CustomPlanFieldErrors } from "./useCustomPlanRequests";

// Nơi gọi render component này CÓ ĐIỀU KIỆN kèm key={requestId}: mở yêu cầu
// khác là remount, form tự dựng lại từ đúng yêu cầu đó. Reset bằng useEffect sẽ
// tạo một nhịp render thừa với dữ liệu của yêu cầu cũ.
type ApproveCustomPlanModalProps = {
  request: CustomPlanRequestView;
  // Gói tiêu chuẩn đang bán — mốc để admin đặt giá gói riêng cho cân đối.
  // Không có mốc nào thì admin phải bịa một con số từ hư không.
  standardPlans: SubscriptionPlan[];
  isSaving: boolean;
  // Lỗi theo từng ô từ `error.fields` (422 CUSTOM_PLAN_LIMIT_BELOW_CURRENT_USAGE)
  fieldErrors: CustomPlanFieldErrors;
  onClose: () => void;
  onSubmit: (payload: ApproveCustomPlanRequestPayload) => void;
};

// Sáu hạn mức, đúng thứ tự hiển thị trong form
const limitFields = [
  "maxVehicles",
  "maxRoutes",
  "maxDrivers",
  "maxAssistants",
  "maxOperatorUsers",
  "maxTripsPerMonth",
] as const;

function buildInitialForm(
  request: CustomPlanRequestView,
): ApproveCustomPlanRequestPayload {
  return {
    ...request.quota,
    // Gợi ý tên theo quy mô — nhà xe chỉ thấy tên + mô tả trong bảng giá của
    // họ, nên "Gói riêng 200 xe" đọc ra nghĩa ngay. Admin sửa được.
    name: `Gói riêng ${request.quota.maxVehicles} xe`,
    description: "",
    pricePerMonth: 0,
    pricePerYear: 0,
  };
}

export default function ApproveCustomPlanModal({
  request,
  standardPlans,
  isSaving,
  fieldErrors,
  onClose,
  onSubmit,
}: ApproveCustomPlanModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [form, setForm] = useState<ApproveCustomPlanRequestPayload>(() =>
    buildInitialForm(request),
  );
  const [localError, setLocalError] = useState("");

  function update<K extends keyof ApproveCustomPlanRequestPayload>(
    key: K,
    value: ApproveCustomPlanRequestPayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (!form.name.trim()) {
      setLocalError(t("customPlans.nameRequired"));
      return;
    }

    // Hai giá độc lập nhưng phải bán được ít nhất một kỳ — cả hai bằng 0 thì
    // gói dựng ra không ai mua nổi
    if (form.pricePerMonth <= 0 && form.pricePerYear <= 0) {
      setLocalError(t("customPlans.priceRequired"));
      return;
    }

    setLocalError("");
    onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() ?? "",
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      icon={<FiCheck size={20} />}
      title={t("customPlans.approveTitle", {
        operator: operatorLabel(request),
      })}
      subtitle={t("customPlans.approveSubtitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            data-testid="approve-custom-plan-submit"
            onClick={submit}
            disabled={isSaving}
          >
            {t("customPlans.approveAction")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {localError ? (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span>{localError}</span>
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold tracking-tight text-slate-900">
            {t("customPlans.planInfoTitle")}
          </h3>
          <div className="space-y-4">
            <TextInput
              label={t("packages.packageName")}
              value={form.name}
              onChange={(value) => update("name", value)}
            />
            <div>
              <label className={labelClass}>{tc("description")}</label>
              <textarea
                className={inputClass + " min-h-[80px] resize-y"}
                value={form.description ?? ""}
                onChange={(event) => update("description", event.target.value)}
                rows={2}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-vr-100 bg-vr-50/50 p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              {t("packages.pricingTitle")}
            </h3>
            {/* Kỳ nào để 0 thì gói chỉ bán kỳ còn lại — nhà xe sẽ không thấy
                nút chọn kỳ đó, nên đừng để 0 vì "chưa nghĩ ra giá". */}
            <p className="mt-1 text-sm text-slate-500">
              {t("customPlans.pricingHint")}
            </p>
          </div>
          {standardPlans.length > 0 ? (
            <div
              data-testid="standard-plan-reference"
              className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white"
            >
              <table className="w-full min-w-[420px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">
                      {t("customPlans.referencePlan")}
                    </th>
                    <th className="px-3 py-2">
                      {t("customPlans.referenceScale")}
                    </th>
                    <th className="px-3 py-2">{t("packages.monthlyPrice")}</th>
                    <th className="px-3 py-2">{t("packages.yearlyPrice")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {standardPlans.map((plan) => (
                    <tr key={plan.planId}>
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {plan.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {t("customPlans.referenceScaleValue", {
                          vehicles: plan.limits.maxVehicles,
                          routes: plan.limits.maxRoutes,
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatCurrency(plan.pricePerMonth)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatCurrency(plan.pricePerYear)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField
              label={t("packages.monthlyPrice")}
              value={form.pricePerMonth}
              onChange={(value) => update("pricePerMonth", value)}
            />
            <CurrencyField
              label={t("packages.yearlyPrice")}
              value={form.pricePerYear}
              onChange={(value) => update("pricePerYear", value)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              {t("packages.limitsTitle")}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {t("customPlans.limitsHint")}
            </p>
          </div>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {limitFields.map((key) => (
              <div key={key}>
                <NumberField
                  label={t(`customPlans.limitLabels.${key}`)}
                  value={form[key]}
                  onChange={(value) => update(key, value)}
                />
                {/* Sửa khác yêu cầu là quyền của admin, nhưng phải NHÌN THẤY
                    mình đã sửa gì — nhà xe nhận gói khác thứ họ xin mà không
                    ai chủ ý là tình huống tệ nhất ở đây. */}
                <p
                  className={`mt-1 text-xs ${
                    form[key] === request.quota[key]
                      ? "text-slate-500"
                      : "font-semibold text-amber-700"
                  }`}
                >
                  {t("customPlans.requestedValue", {
                    value: request.quota[key],
                  })}
                  {form[key] !== request.quota[key]
                    ? ` · ${t("customPlans.changedByAdmin")}`
                    : ""}
                </p>
                {/* Lỗi từ BE gắn đúng ô: "hạn mức này thấp hơn mức đang dùng" */}
                {fieldErrors[key] ? (
                  <p
                    data-testid={`approve-field-error-${key}`}
                    className="mt-1 text-xs font-semibold text-red-600"
                  >
                    {fieldErrors[key]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold tracking-tight text-slate-900">
            {t("packages.modulesTitle")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["enableParcel", "packages.parcelModule"],
                ["enableShuttle", "packages.shuttleModule"],
                ["enableRag", "packages.ragModule"],
              ] as const
            ).map(([key, labelKey]) => (
              <div key={key}>
                <Toggle
                  label={t(labelKey)}
                  description={t(`${labelKey}Hint`)}
                  checked={form[key]}
                  onChange={(value) => update(key, value)}
                />
                {/* Tắt một module nhà xe đã xin = họ mua gói rồi đi tìm tính
                    năng không có. Cảnh báo rõ hơn hẳn với hạn mức số. */}
                {request.quota[key] && !form[key] ? (
                  <p
                    data-testid={`module-denied-${key}`}
                    className="mt-1 text-xs font-semibold text-amber-700"
                  >
                    {t("customPlans.moduleDenied")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Gói riêng không sửa được sau khi tạo — nói trước khi bấm, không phải
            sau khi phát hiện không sửa được. */}
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("customPlans.immutableWarning")}
        </p>
      </div>
    </Modal>
  );
}
