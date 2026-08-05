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

// Modal onboard nhà xe mới — form giữ state ở page cha, modal chỉ render + báo sự kiện
export default function OperatorOnboardModal({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
}: OperatorOnboardModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

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
            className="rounded-lg border cursor-pointer border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 hover:text-white"
          >
            {t("operators.createOperator")}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-bold text-gray-900">
            {t("operators.businessInfo")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>
                {t("operators.brandName")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => onChange("name", e.target.value)}
                placeholder={t("operators.brandPlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>
                Business Registration No.{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.businessRegistrationNumber}
                onChange={(e) =>
                  onChange("businessRegistrationNumber", e.target.value)
                }
                placeholder={t("operators.businessRegPlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("operators.taxId")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.taxCode}
                onChange={(e) => onChange("taxCode", e.target.value)}
                placeholder={t("operators.taxCodePlaceholder")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                {t("operators.headquartersAddress")}
              </label>
              <input
                className={inputClass}
                value={form.addressStreet}
                onChange={(e) => onChange("addressStreet", e.target.value)}
                placeholder={t("operators.addressPlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>{t("operators.ward")}</label>
              <input
                className={inputClass}
                value={form.addressWard}
                onChange={(e) => onChange("addressWard", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>{t("operators.district")}</label>
              <input
                className={inputClass}
                value={form.addressDistrict}
                onChange={(e) => onChange("addressDistrict", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>{t("operators.province")}</label>
              <input
                className={inputClass}
                value={form.addressProvince}
                onChange={(e) => onChange("addressProvince", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>{tc("phone")}</label>
              <input
                className={inputClass}
                value={form.contactPhone}
                onChange={(e) => onChange("contactPhone", e.target.value)}
              />
            </div>
          </div>
        </section>
        <div className="border-t border-gray-100" />
        <section>
          <h3 className="mb-3 text-sm font-bold text-gray-900">
            {t("operators.mainContact")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("operators.representative")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.representativeName}
                onChange={(e) => onChange("representativeName", e.target.value)}
                placeholder={t("operators.representativePlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {tc("email")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.contactEmail}
                onChange={(e) => onChange("contactEmail", e.target.value)}
                placeholder={t("operators.contactEmailPlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {tc("phone")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.representativePhone}
                onChange={(e) =>
                  onChange("representativePhone", e.target.value)
                }
                placeholder={t("operators.contactPhonePlaceholder")}
              />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
