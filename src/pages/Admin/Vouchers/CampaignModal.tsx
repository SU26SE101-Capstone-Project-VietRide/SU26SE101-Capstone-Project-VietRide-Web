import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { FiTag } from "react-icons/fi";
import type { AdminCampaign, AdminOperator, AdminVoucher } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import CampaignVoucherSelector from "./CampaignVoucherSelector";
import { Field } from "./formControls";
import type { CampaignForm } from "./types";
import { isActiveOperator } from "./voucherHelpers";
import Checkbox from "../../../components/form/Checkbox";
import { Button } from "../../../components/ui/Button";

type CampaignModalProps = {
  open: boolean;
  onClose: () => void;
  editingCampaign: AdminCampaign | null;
  campaignForm: CampaignForm;
  setCampaignForm: Dispatch<SetStateAction<CampaignForm>>;
  onSave: () => Promise<void>;
  isActionLoading: boolean;
  operators: AdminOperator[];
  vouchers: AdminVoucher[];
};

export default function CampaignModal({
  open,
  onClose,
  editingCampaign,
  campaignForm,
  setCampaignForm,
  onSave,
  isActionLoading,
  operators,
  vouchers,
}: CampaignModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiTag size={20} />}
      title={
        editingCampaign
          ? t("vouchers.editCampaign")
          : t("vouchers.createCampaign")
      }
      subtitle={t("vouchers.campaignModalSubtitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button variant="primary" disabled={isActionLoading} onClick={() => void onSave()}>
            {editingCampaign
              ? t("vouchers.saveActionUpdate")
              : t("vouchers.createCampaign")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vouchers.campaignName")}
            value={campaignForm.name}
            onChange={(value) =>
              setCampaignForm((current) => ({ ...current, name: value }))
            }
            required
          />
          <div>
            <label className={labelClass}>{t("vouchers.ownerOperator")}</label>
            <CustomSelect
              className={inputClass}
              value={campaignForm.ownerOperatorId}
              onChange={(event) =>
                setCampaignForm((current) => ({
                  ...current,
                  ownerOperatorId: event.target.value,
                }))
              }
            >
              <option value="">{t("vouchers.allOperators")}</option>
              {operators.filter(isActiveOperator).map((operator) => (
                <option key={operator.operatorId} value={operator.operatorId}>
                  {operator.name}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>
        <div>
          <label className={labelClass}>{tc("description")}</label>
          <textarea
            className={`${inputClass} min-h-[88px]`}
            value={campaignForm.description}
            onChange={(event) =>
              setCampaignForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vouchers.validFrom")}
            type="datetime-local"
            value={campaignForm.validFrom}
            placeholder="dd/mm/yyyy"
            onChange={(value) =>
              setCampaignForm((current) => ({ ...current, validFrom: value }))
            }
            required
          />
          <Field
            label={t("vouchers.validUntil")}
            type="datetime-local"
            value={campaignForm.validUntil}
            placeholder="dd/mm/yyyy"
            onChange={(value) =>
              setCampaignForm((current) => ({ ...current, validUntil: value }))
            }
            required
          />
        </div>
        <CampaignVoucherSelector
          vouchers={vouchers}
          selectedVoucherIds={campaignForm.voucherIds}
          onChange={(voucherIds) =>
            setCampaignForm((current) => ({ ...current, voucherIds }))
          }
        />
        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
          <Checkbox
            className="mt-0.5"
            checked={campaignForm.isActive}
            onChange={(checked) =>
              setCampaignForm((current) => ({
                ...current,
                isActive: checked,
              }))
            }
          />
          <span>
            <span className="block text-sm font-bold text-gray-900">
              {t("vouchers.activateCampaign")}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {t("vouchers.activateCampaignHint")}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
