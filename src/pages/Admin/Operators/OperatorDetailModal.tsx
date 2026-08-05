import { useTranslation } from "react-i18next";
import { FiEye } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import { type AdminOperator } from "../../../api/vietride";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { formatDateTime } from "../../../utils/date";
import { getOperatorAddress, getStatusBadge } from "./operatorHelpers";

type OperatorDetailModalProps = {
  open: boolean;
  onClose: () => void;
  operator: AdminOperator | null;
};

// Modal xem chi tiết nhà xe — chỉ hiển thị, không có form
export default function OperatorDetailModal({
  open,
  onClose,
  operator,
}: OperatorDetailModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiEye size={20} />}
      title={t("operators.detailTitle")}
      footer={
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("close")}
        </button>
      }
    >
      {operator && (
        <div className="space-y-5">
          {operator.logoUrl && (
            <img
              src={operator.logoUrl}
              alt={t("operators.logoAlt", { name: operator.name })}
              width={96}
              height={96}
              loading="lazy"
              className="h-24 w-24 rounded-lg border border-gray-200 object-contain"
            />
          )}
          <DetailSection title={t("operators.profile")} columns="three">
            <DetailItem
              label={t("operators.operatorName")}
              value={operator.name}
            />
            <DetailItem
              label={t("operators.businessRegistrationNumber")}
              value={operator.businessRegistrationNumber}
            />
            <DetailItem
              label={t("operators.taxCode")}
              value={operator.taxCode}
            />
            <DetailItem
              label={t("operators.contactEmail")}
              value={operator.contactEmail}
            />
            <DetailItem
              label={tc("phone")}
              value={formatVietnamPhoneForDisplay(operator.contactPhone)}
            />
            <DetailItem
              label={tc("status")}
              value={getStatusBadge(operator.registrationStatus, tc)}
            />
            <DetailItem
              label={t("operators.createdAt")}
              value={formatDateTime(operator.createdAt)}
            />
            <DetailItem
              label={t("operators.approvedAt")}
              value={formatDateTime(operator.approvedAt)}
            />
          </DetailSection>

          <DetailSection title={t("operators.address")}>
            <DetailItem
              label={t("operators.street")}
              value={getOperatorAddress(operator).street}
            />
            <DetailItem
              label={t("operators.ward")}
              value={getOperatorAddress(operator).ward}
            />
            <DetailItem
              label={t("operators.district")}
              value={getOperatorAddress(operator).district}
            />
            <DetailItem
              label={t("operators.province")}
              value={getOperatorAddress(operator).province}
            />
          </DetailSection>

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {t("operators.representativeInfo")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                label={t("operators.representative")}
                value={operator.representativeName}
              />
              <DetailItem
                label={t("operators.representativePhone")}
                value={formatVietnamPhoneForDisplay(operator.representativePhone)}
              />
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
