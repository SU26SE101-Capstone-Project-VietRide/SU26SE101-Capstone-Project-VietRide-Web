import { useTranslation } from "react-i18next";
import { FiHome } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { type CreateAdminOperatorRequest } from "../../../api/vietride";
import { inputClass, labelClass } from "../../../components/form/formClasses";

type OperatorOnboardModalProps = {
  open: boolean;
  onClose: () => void;
  form: CreateAdminOperatorRequest;
  onChange: (key: keyof CreateAdminOperatorRequest, value: string) => void;
  onSubmit: () => void | Promise<void>;
};

export default function OperatorOnboardModal({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
}: OperatorOnboardModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  const field = (key: keyof CreateAdminOperatorRequest) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiHome size={20} />}
      title={t("operators.onboardTitle")}
      subtitle={t("operators.onboardSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="cursor-pointer rounded-xl bg-vr-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/30"
          >
            {t("operators.createOperator")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold tracking-tight text-slate-900">{t("operators.businessInfo")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("operators.onboardSubtitle")}</p>
          </div>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("operators.brandName")} <span className="text-red-500">*</span></label>
              <input className={inputClass} {...field("name")} placeholder={t("operators.brandPlaceholder")} />
            </div>
            <div>
              <label className={labelClass}>{t("operators.businessRegistrationNumber")} <span className="text-red-500">*</span></label>
              <input className={inputClass} {...field("businessRegistrationNumber")} placeholder={t("operators.businessRegPlaceholder")} />
            </div>
            <div>
              <label className={labelClass}>{t("operators.taxId")} <span className="text-red-500">*</span></label>
              <input className={inputClass} {...field("taxCode")} placeholder={t("operators.taxCodePlaceholder")} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("operators.headquartersAddress")}</label>
              <input className={inputClass} {...field("addressStreet")} placeholder={t("operators.addressPlaceholder")} />
            </div>
            <div>
              <label className={labelClass}>{t("operators.ward")}</label>
              <input className={inputClass} {...field("addressWard")} />
            </div>
            <div>
              <label className={labelClass}>{t("operators.province")}</label>
              <input className={inputClass} {...field("addressProvince")} />
            </div>
            <div>
              <label className={labelClass}>{tc("phone")}</label>
              <input className={inputClass} {...field("contactPhone")} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold tracking-tight text-slate-900">{t("operators.mainContact")}</h3>
            <p className="mt-1 text-sm text-slate-500">{t("operators.representativeInfo")}</p>
          </div>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("operators.representative")} <span className="text-red-500">*</span></label>
              <input className={inputClass} {...field("representativeName")} placeholder={t("operators.representativePlaceholder")} />
            </div>
            <div>
              <label className={labelClass}>{tc("email")} <span className="text-red-500">*</span></label>
              <input className={inputClass} {...field("contactEmail")} placeholder={t("operators.contactEmailPlaceholder")} />
            </div>
            <div>
              <label className={labelClass}>{tc("phone")} <span className="text-red-500">*</span></label>
              <input className={inputClass} {...field("representativePhone")} placeholder={t("operators.contactPhonePlaceholder")} />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
