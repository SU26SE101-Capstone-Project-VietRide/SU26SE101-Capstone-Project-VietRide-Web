import { useTranslation } from "react-i18next";
import { FiTag } from "react-icons/fi";
import type { OperatorRoute } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import Field from "./Field";
import {
  routeIdsToValue,
  toRouteIds,
  type VoucherForm,
  type VoucherServiceTab,
} from "./voucherHelpers";

type VoucherModalProps = {
  open: boolean;
  form: VoucherForm;
  isEditing: boolean;
  routes: OperatorRoute[];
  onChange: (key: keyof VoucherForm, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function VoucherModal({
  open,
  form,
  isEditing,
  routes,
  onChange,
  onClose,
  onSubmit,
}: VoucherModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const selectedRouteIds = toRouteIds(form.applicableRouteIds);

  function toggleRoute(routeId: string) {
    const nextRouteIds = selectedRouteIds.includes(routeId)
      ? selectedRouteIds.filter((id) => id !== routeId)
      : [...selectedRouteIds, routeId];

    onChange("applicableRouteIds", routeIdsToValue(nextRouteIds));
  }

  function handleFieldChange(key: keyof VoucherForm, value: string) {
    if (key === "type") {
      onChange("type", value);
      if (value === "FIXED_AMOUNT") onChange("maxDiscountAmount", form.value);
      return;
    }
    if (key === "value" && form.type === "FIXED_AMOUNT") {
      onChange("value", value);
      onChange("maxDiscountAmount", value);
      return;
    }
    onChange(key, value);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiTag size={20} />}
      title={isEditing ? t("vouchers.updateVoucher") : t("vouchers.create")}
      subtitle={t("vouchers.operatorModalSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-xl bg-vr-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-vr-700"
          >
            {isEditing ? t("vouchers.update") : t("vouchers.create")}
          </button>
        </>
      }
    >
      <div className="space-y-1">
        <section className="border-b border-slate-100 py-5 first:pt-1 last:border-b-0"><div className="mb-4 flex items-center gap-3"><span className="h-5 w-1 rounded-full bg-vr-500"></span><div><h3 className="font-bold text-gray-900">{t("vouchers.formBasics")}</h3></div></div><div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vouchers.voucherCode")}
            value={form.code}
            disabled={isEditing}
            onChange={(value) => onChange("code", value)}
            placeholder="OP-SUMMER"
          />
          <Field
            label={t("vouchers.voucherName")}
            value={form.name}
            onChange={(value) => onChange("name", value)}
            placeholder={t("vouchers.nameSummerPlaceholder")}
            maxLength={30}
          />
        </div></section>

        <section className="border-b border-slate-100 py-5 first:pt-1 last:border-b-0"><div className="mb-4 flex items-center gap-3"><span className="h-5 w-1 rounded-full bg-vr-500"></span><div><h3 className="font-bold text-gray-900">{t("vouchers.discountRules")}</h3></div></div><div className={form.type === "FIXED_AMOUNT" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
          <div>
            <label className={labelClass}>{t("vouchers.discountType")}</label>
            <CustomSelect
              className={inputClass}
              value={form.type}
              disabled={isEditing}
              onChange={(event) => handleFieldChange("type", event.target.value)}
            >
              <option value="PERCENT_OFF">
                {t("vouchers.discountTypePercent")}
              </option>
              <option value="FIXED_AMOUNT">
                {t("vouchers.discountTypeFixed")}
              </option>
            </CustomSelect>
          </div>
          <Field
            label={form.type === "FIXED_AMOUNT" ? t("vouchers.discountAmount") : t("vouchers.discountPercent")}
            type="number"
            value={form.value}
            currency={form.type === "FIXED_AMOUNT"}
            onChange={(value) => handleFieldChange("value", value)}
          />
          {form.type === "PERCENT_OFF" && (
            <Field
              label={t("vouchers.maxDiscount")}
              type="number"
              value={form.maxDiscountAmount}
              currency
              onChange={(value) => onChange("maxDiscountAmount", value)}
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t("vouchers.minOrder")}
            type="number"
            value={form.minOrderAmount}
            currency
            onChange={(value) => onChange("minOrderAmount", value)}
          />
          <Field
            label={t("vouchers.totalUsageLimit")}
            type="number"
            value={form.totalUsageLimit}
            onChange={(value) => onChange("totalUsageLimit", value)}
          />
          <Field
            label={t("vouchers.perUser")}
            type="number"
            value={form.perUserLimit}
            onChange={(value) => onChange("perUserLimit", value)}
          />
        </div></section>

        <section className="border-b border-slate-100 py-5 first:pt-1 last:border-b-0"><div className="mb-4 flex items-center gap-3"><span className="h-5 w-1 rounded-full bg-vr-500"></span><div><h3 className="font-bold text-gray-900">{t("vouchers.validityRules")}</h3></div></div><div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vouchers.validFrom")}
            type="datetime-local"
            value={form.validFrom}
            onChange={(value) => onChange("validFrom", value)}
          />
          <Field
            label={t("vouchers.validTo")}
            type="datetime-local"
            value={form.validUntil}
            onChange={(value) => onChange("validUntil", value)}
          />
        </div></section>

        <section className="border-b border-slate-100 py-5 first:pt-1 last:border-b-0"><div className="mb-4 flex items-center gap-3"><span className="h-5 w-1 rounded-full bg-vr-500"></span><div><h3 className="font-bold text-gray-900">{t("vouchers.scopeRules")}</h3></div></div><div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>
              {t("vouchers.applicableRoutes")}
            </label>
            <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
              {routes.length > 0 ? (
                <div className="space-y-1">
                  {routes.map((route) => {
                    const checked = selectedRouteIds.includes(route.id);

                    return (
                      <label
                        key={route.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                          checked
                            ? "bg-vr-50 text-vr-800"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRoute(route.id)}
                          className="h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {route.name}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500">
                  {t("vouchers.noRoutesAvailable")}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {selectedRouteIds.length > 0
                ? t("vouchers.selectedRoutes", {
                    count: selectedRouteIds.length,
                  })
                : t("vouchers.allRoutesHint")}
            </p>
          </div>
          <div>
            <label className={labelClass}>{t("vouchers.applicableTo")}</label>
            <CustomSelect
              className={inputClass}
              value={form.applicableService}
              disabled={isEditing}
              onChange={(event) =>
                onChange(
                  "applicableService",
                  event.target.value as VoucherServiceTab,
                )
              }
            >
              <option value="BOOKING">{t("vouchers.applicableRides")}</option>
              <option value="PARCEL">{t("vouchers.applicableParcels")}</option>
            </CustomSelect>
          </div>
          <div>
            <label className={labelClass}>{t("vouchers.fundingType")}</label>
            <CustomSelect
              className={inputClass}
              value={form.fundingType}
              disabled={isEditing}
              onChange={(event) => onChange("fundingType", event.target.value)}
            >
              <option value="OPERATOR_FUNDED">{t("vouchers.fundingTypes.OPERATOR_FUNDED")}</option>
              <option value="VIETRIDE_FUNDED">{t("vouchers.fundingTypes.VIETRIDE_FUNDED")}</option>
            </CustomSelect>
          </div>
        </div>
      </section>
      </div>
    </Modal>
  );
}
