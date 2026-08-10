import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiEye } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { type AdminOperator } from "../../../api/vietride";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { formatDateTime } from "../../../utils/date";
import { getOperatorAddress, getStatusBadge } from "./operatorHelpers";

type OperatorDetailModalProps = {
  open: boolean;
  onClose: () => void;
  operator: AdminOperator | null;
};

type InfoRowProps = {
  label: string;
  value?: ReactNode;
};

function InfoRow({ label, value }: InfoRowProps) {
  const displayValue = value === "" || value === null || value === undefined ? "-" : value;

  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{displayValue}</div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-base font-bold tracking-tight text-slate-900">{title}</h3>
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">{children}</div>
    </section>
  );
}

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
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
        >
          {tc("close")}
        </button>
      }
    >
      {operator && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-vr-100 bg-gradient-to-br from-vr-50 via-white to-cyan-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {operator.logoUrl ? (
                  <img
                    src={operator.logoUrl}
                    alt={t("operators.logoAlt", { name: operator.name })}
                    width={72}
                    height={72}
                    loading="lazy"
                    className="h-[72px] w-[72px] shrink-0 rounded-2xl border border-white bg-white object-contain p-2 shadow-sm"
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-vr-600 shadow-sm">
                    {operator.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-vr-700">{t("operators.profile")}</p>
                  <h3 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950">{operator.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t("operators.createdAt")}: {formatDateTime(operator.createdAt)}</p>
                </div>
              </div>
              <div className="shrink-0">{getStatusBadge(operator.registrationStatus, tc)}</div>
            </div>
          </section>

          <DetailSection title={t("operators.profile")}>
            <InfoRow label={t("operators.operatorName")} value={operator.name} />
            <InfoRow label={t("operators.businessRegistrationNumber")} value={operator.businessRegistrationNumber} />
            <InfoRow label={t("operators.taxCode")} value={operator.taxCode} />
            <InfoRow label={t("operators.contactEmail")} value={operator.contactEmail} />
            <InfoRow label={tc("phone")} value={formatVietnamPhoneForDisplay(operator.contactPhone)} />
            <InfoRow label={t("operators.approvedAt")} value={formatDateTime(operator.approvedAt)} />
          </DetailSection>

          <DetailSection title={t("operators.address")}>
            <InfoRow label={t("operators.street")} value={getOperatorAddress(operator).street} />
            <InfoRow label={t("operators.ward")} value={getOperatorAddress(operator).ward} />
            <InfoRow label={t("operators.province")} value={getOperatorAddress(operator).province} />
          </DetailSection>

          <DetailSection title={t("operators.representativeInfo")}>
            <InfoRow label={t("operators.representative")} value={operator.representativeName} />
            <InfoRow label={t("operators.representativePhone")} value={formatVietnamPhoneForDisplay(operator.representativePhone)} />
          </DetailSection>
        </div>
      )}
    </Modal>
  );
}
