import { useTranslation } from "react-i18next";
import Checkbox from "../../../components/form/Checkbox";
import { FiTag } from "react-icons/fi";
import type { AdminOperator, AdminVoucher } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import { Field } from "./formControls";
import OperatorSelector from "./OperatorSelector";
import type { VoucherForm } from "./types";
import { Button } from "../../../components/ui/Button";

type VoucherModalProps = {
  open: boolean;
  onClose: () => void;
  editingVoucher: AdminVoucher | null;
  operators: AdminOperator[];
  operatorsLoading: boolean;
  form: VoucherForm;
  updateForm: <K extends keyof VoucherForm>(key: K, value: VoucherForm[K]) => void;
  onSave: () => Promise<void>;
};

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="h-5 w-1 shrink-0 rounded-full bg-vr-500" />
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
    </div>
  );
}

function SelectField({
  label,
  value,
  disabled = false,
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <CustomSelect
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </CustomSelect>
    </div>
  );
}

export default function VoucherModal({
  open,
  onClose,
  editingVoucher,
  form,
  operators,
  operatorsLoading,
  updateForm,
  onSave,
}: VoucherModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiTag size={20} />}
      title={editingVoucher ? t("vouchers.editTitle") : t("vouchers.createTitle")}
      subtitle={
        editingVoucher
          ? t("vouchers.updateSubtitle")
          : t("vouchers.createBookingSubtitle")
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {tc("cancel")}
          </button>
          <Button variant="primary" onClick={onSave}>
            {t("vouchers.saveButton", {
              action: editingVoucher
                ? t("vouchers.saveActionUpdate")
                : t("vouchers.saveActionCreate"),
            })}
          </Button>
        </>
      }
    >
      <div className="space-y-0">
        <section className="border-b border-slate-100 py-5 first:pt-1">
          <SectionHeading title={t("vouchers.formBasics")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.voucherCode")}
              value={form.code}
              disabled={Boolean(editingVoucher)}
              onChange={(value) => updateForm("code", value)}
              placeholder={t("vouchers.codePlaceholder")}
              required
            />
            <Field
              label={t("vouchers.displayName")}
              value={form.name}
              onChange={(value) => updateForm("name", value)}
              required
            />
          </div>
          <div className="mt-4">
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={`${textareaClass} min-h-[88px] resize-y`}
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder={t("vouchers.bookingDescPlaceholder")}
              rows={3}
            />
          </div>
        </section>

        <section className="border-b border-slate-100 py-5">
          <SectionHeading title={t("vouchers.discountRules")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("vouchers.discountType")}
              value={form.discountType}
              disabled={Boolean(editingVoucher)}
              onChange={(value) => updateForm("discountType", value)}
            >
              <option value="PERCENT_OFF">
                {t("vouchers.percentDiscount")}
              </option>
              <option value="FIXED_AMOUNT">
                {t("vouchers.fixedDiscount")}
              </option>
            </SelectField>
            <Field
              label={
                form.discountType === "FIXED_AMOUNT"
                  ? t("vouchers.fixedDiscountValue")
                  : t("vouchers.discountValue")
              }
              value={form.discount}
              type="number"
              currency={form.discountType === "FIXED_AMOUNT"}
              onChange={(value) => updateForm("discount", value)}
              required
            />
            {form.discountType === "PERCENT_OFF" && (
              <Field
                label={t("vouchers.maxDiscountAmount")}
                value={form.maxDiscountAmount}
                type="number"
                currency
                onChange={(value) => updateForm("maxDiscountAmount", value)}
                required
              />
            )}
            <SelectField
              label={t("vouchers.applicable")}
              value={form.applicableTo}
              onChange={(value) => updateForm("applicableTo", value)}
            >
              <option value="all">{t("vouchers.allServicesFull")}</option>
              <option value="rides">{t("vouchers.ridesOnlyFull")}</option>
              <option value="parcels">{t("vouchers.parcelsOnly")}</option>
            </SelectField>
          </div>
        </section>

        <section className="border-b border-slate-100 py-5">
          <SectionHeading title={t("vouchers.scopeRules")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("vouchers.operatorScope")}
              value={form.operatorScope}
              disabled={Boolean(editingVoucher)}
              onChange={(value) =>
                updateForm(
                  "operatorScope",
                  value as VoucherForm["operatorScope"],
                )
              }
            >
              <option value="ALL">{t("vouchers.allOperators")}</option>
              <option value="SELECTED">{t("vouchers.selectedOperators")}</option>
            </SelectField>
            <div className="rounded-xl border border-vr-100 bg-vr-50 px-4 py-3">
              <p className="text-sm font-bold text-vr-900">
                {t("vouchers.vietrideFunded")}
              </p>
              <p className="mt-1 text-xs leading-5 text-vr-800">
                {t("vouchers.vietrideFundingNotice")}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t("vouchers.operatorScopeHint")}
          </p>
          {form.operatorScope === "SELECTED" &&
            (operatorsLoading ? (
              <p className="mt-4 text-sm text-gray-500">
                {t("vouchers.loadingOperators")}
              </p>
            ) : editingVoucher ? (
              <p className="mt-4 text-sm text-gray-500">
                {t("vouchers.operatorScopeImmutable", {
                  count: form.selectedOperatorIds.length,
                })}
              </p>
            ) : (
              <OperatorSelector
                operators={operators}
                selectedOperatorIds={form.selectedOperatorIds}
                onChange={(operatorIds) =>
                  updateForm("selectedOperatorIds", operatorIds)
                }
              />
            ))}
        </section>

        <section className="border-b border-slate-100 py-5">
          <SectionHeading title={t("vouchers.usageRules")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.minOrder")}
              value={form.minOrderValue}
              type="number"
              currency
              onChange={(value) => updateForm("minOrderValue", value)}
            />
            <Field
              label={t("vouchers.maxUsagePerUser")}
              value={form.maxUsagePerUser}
              type="number"
              onChange={(value) => updateForm("maxUsagePerUser", value)}
            />
          </div>
        </section>

        <section className="border-b border-slate-100 py-5">
          <SectionHeading title={t("vouchers.issuanceRules")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.quantity")}
              value={form.quantity}
              type="number"
              onChange={(value) => updateForm("quantity", value)}
              required
            />
            <Field
              label={t("vouchers.expiryDate")}
              value={form.expiryDate}
              type="datetime-local"
              placeholder="dd/mm/yyyy"
              onChange={(value) => updateForm("expiryDate", value)}
              required
            />
          </div>
        </section>

        <label className="mt-5 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
          <Checkbox
            className="mt-0.5"
            checked={form.active}
            onChange={(checked) => updateForm("active", checked)}
          />
          <span>
            <span className="block text-sm font-bold text-gray-900">
              {t("vouchers.activateOnCreateTitle")}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {t("vouchers.activateOnCreateHint")}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
