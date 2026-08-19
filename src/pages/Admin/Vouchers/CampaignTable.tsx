import { useTranslation } from "react-i18next";
import { FiEdit2, FiPlus, FiPower } from "react-icons/fi";
import type { AdminCampaign } from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import { formatDisplayDate } from "./voucherHelpers";

type CampaignTableProps = {
  campaigns: AdminCampaign[];
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  isActionLoading: boolean;
  onCreate: () => void;
  onEdit: (campaign: AdminCampaign) => void;
  onToggle: (campaign: AdminCampaign) => void;
};

export default function CampaignTable({
  campaigns,
  page,
  pageSize,
  totalItems,
  onPageChange,
  isLoading,
  isActionLoading,
  onCreate,
  onEdit,
  onToggle,
}: CampaignTableProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {t("vouchers.campaignsTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("vouchers.campaignsDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-900"
        >
          <FiPlus size={16} />
          {t("vouchers.createCampaign")}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">{t("vouchers.name")}</th>
              <th className="px-5 py-3">{t("vouchers.operatorScope")}</th>
              <th className="px-5 py-3">{t("vouchers.validity")}</th>
              <th className="px-5 py-3">{tc("status")}</th>
              <th className="px-5 py-3 text-right">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b border-gray-100 last:border-0">
                <td className="px-5 py-4">
                  <p className="font-semibold text-gray-900">{campaign.name}</p>
                  <p className="text-xs text-gray-500">{campaign.description}</p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {campaign.ownerOperatorId ?? t("vouchers.allOperators")}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {formatDisplayDate(campaign.validFrom)} -{" "}
                  {formatDisplayDate(campaign.validUntil)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                      campaign.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {campaign.isActive ? tc("active") : tc("inactive")}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(campaign)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      aria-label={tc("edit")}
                      title={tc("edit")}
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => onToggle(campaign)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={
                        campaign.isActive
                          ? t("vouchers.deactivateCampaign")
                          : t("vouchers.activateCampaign")
                      }
                      title={
                        campaign.isActive
                          ? t("vouchers.deactivateCampaign")
                          : t("vouchers.activateCampaign")
                      }
                    >
                      <FiPower size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && totalItems === 0 && (
          <p className="border-t border-gray-100 px-5 py-6 text-center text-sm text-gray-500">
            {t("vouchers.noCampaigns")}
          </p>
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
        />
      </div>
    </section>
  );
}
