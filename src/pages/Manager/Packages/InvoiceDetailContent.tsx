import { useTranslation } from "react-i18next";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import type { OperatorInvoiceDetail } from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";
import { formatNumber } from "./subscriptionHelpers";
import { InfoItem } from "./packageDetails";

export default function InvoiceDetailContent({
  detail,
}: {
  detail: OperatorInvoiceDetail;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const buyer = detail.buyerSnapshot;
  const address = [
    buyer.addressStreet,
    buyer.addressWard,
    buyer.addressDistrict,
    buyer.addressProvince,
  ]
    .filter(Boolean)
    .join(", ");
  const statusLabel = tc(`enumLabels.${detail.status}`, {
    defaultValue: detail.status,
  });
  const billingLabel = tc(`enumLabels.${detail.billingPeriod}`, {
    defaultValue: detail.billingPeriod,
  });

  return (
    <div className="space-y-6 pb-2">
      <div className="rounded-xl border border-vr-100 bg-gradient-to-br from-vr-50 via-white to-slate-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-vr-600">
              {t("packages.invoiceNumber")}
            </p>
            <p className="mt-2 font-mono text-lg font-bold tracking-tight text-gray-900">
              {detail.invoiceNumber}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {detail.planName} · {billingLabel}
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            {statusLabel}
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-1 border-t border-vr-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <span className="text-sm font-medium text-gray-500">
            {t("packages.amount")}
          </span>
          <span className="text-2xl font-bold tracking-tight text-vr-700">
            {formatNumber(detail.amount)} đ
          </span>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-vr-500" />
          <h3 className="font-bold text-gray-900">
            {t("packages.packageColumn")}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoItem
            label={t("packages.packageColumn")}
            value={detail.planName}
          />
          <InfoItem label={t("packages.billingPeriod")} value={billingLabel} />
          <InfoItem
            label={t("packages.period")}
            value={
              formatDateOnly(detail.periodFrom) +
              " - " +
              formatDateOnly(detail.periodTo)
            }
          />
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-vr-500" />
          <h3 className="font-bold text-gray-900">{t("packages.buyerInfo")}</h3>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="grid gap-x-6 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-y-0">
            <div className="space-y-4 p-4 sm:border-r sm:border-gray-100">
              <InfoItem
                label={t("packages.buyerName")}
                value={buyer.name || "-"}
              />
              <InfoItem
                label={t("packages.businessRegistrationNumber")}
                value={buyer.businessRegistrationNumber || "-"}
              />
              <InfoItem
                label={t("packages.contactPhone")}
                value={formatVietnamPhoneForDisplay(buyer.contactPhone)}
              />
            </div>
            <div className="space-y-4 p-4">
              <InfoItem
                label={t("packages.taxCode")}
                value={buyer.taxCode || "-"}
              />
              <InfoItem
                label={t("packages.contactEmail")}
                value={buyer.contactEmail || "-"}
              />
              <InfoItem label={t("packages.address")} value={address || "-"} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
