import { useTranslation } from "react-i18next";
import type { AdminVoucher } from "../../../api/vietride";
import { labelClass } from "../../../components/form/formClasses";

type CampaignVoucherSelectorProps = {
  vouchers: AdminVoucher[];
  selectedVoucherIds: string[];
  onChange: (voucherIds: string[]) => void;
};

export default function CampaignVoucherSelector({
  vouchers,
  selectedVoucherIds,
  onChange,
}: CampaignVoucherSelectorProps) {
  const { t } = useTranslation("admin");

  function toggleVoucher(voucherId: string) {
    const nextVoucherIds = selectedVoucherIds.includes(voucherId)
      ? selectedVoucherIds.filter((id) => id !== voucherId)
      : [...selectedVoucherIds, voucherId];

    onChange(nextVoucherIds);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className={labelClass}>{t("vouchers.campaignVouchers")}</label>
        <span className="text-xs font-medium text-gray-500">
          {t("vouchers.selectedVouchersCount", {
            count: selectedVoucherIds.length,
          })}
        </span>
      </div>
      <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {vouchers.length > 0 ? (
          <div className="space-y-1">
            {vouchers.map((voucher) => {
              const checked = selectedVoucherIds.includes(voucher.id);

              return (
                <label
                  key={voucher.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    checked
                      ? "bg-vr-50 text-vr-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVoucher(voucher.id)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {voucher.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {voucher.code}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.noVouchersAvailable")}
          </p>
        )}
      </div>
    </div>
  );
}
