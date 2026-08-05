import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import type { OperatorVoucher } from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import { IconButton } from "./formControls";
import { formatDate, formatMoney, truncateVoucherName } from "./voucherHelpers";

type VoucherTableProps = {
  vouchers: OperatorVoucher[];
  isLoading: boolean;
  onEdit: (voucher: OperatorVoucher) => void;
  onToggle: (voucher: OperatorVoucher) => void;
  onDelete: (voucher: OperatorVoucher) => void;
};

export default function VoucherTable({
  vouchers,
  isLoading,
  onEdit,
  onToggle,
  onDelete,
}: VoucherTableProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(vouchers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedVouchers = useMemo(
    () =>
      vouchers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [currentPage, vouchers],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">{t("vouchers.code")}</th>
              <th className="px-5 py-3">{t("vouchers.name")}</th>
              <th className="px-5 py-3">{t("vouchers.discount")}</th>
              <th className="px-5 py-3">{t("vouchers.limit")}</th>
              <th className="px-5 py-3">{t("vouchers.validity")}</th>
              <th className="px-5 py-3">{tc("status")}</th>
              <th className="px-5 py-3">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedVouchers.map((voucher) => (
              <tr
                key={voucher.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
              >
                <td className="px-5 py-4 font-mono text-sm font-semibold text-vr-700">
                  {voucher.code}
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[300px] truncate whitespace-nowrap text-sm font-semibold leading-5 text-gray-900" title={voucher.name}>
                    {truncateVoucherName(voucher.name)}
                  </p>
                  <p className="text-xs text-gray-500">{tc(`voucherTypes.${voucher.type}`, { defaultValue: voucher.type })}</p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {voucher.type === "PERCENT_OFF"
                    ? `${voucher.value}%`
                    : `${formatMoney(voucher.value)} VND`}
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>
                    {t("vouchers.totalLimit", {
                      count: voucher.totalUsageLimit,
                    })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("vouchers.perUserLimit", {
                      count: voucher.perUserLimit,
                    })}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>{formatDate(voucher.validFrom)}</p>
                  <p className="text-xs text-gray-500">
                    {t("vouchers.validUntil", {
                      date: formatDate(voucher.validUntil),
                    })}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      voucher.isActive
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {voucher.isActive
                      ? t("vouchers.enabled")
                      : t("vouchers.disabled")}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <IconButton
                      label={
                        voucher.isActive
                          ? t("vouchers.disableVoucher")
                          : t("vouchers.enableVoucher")
                      }
                      onClick={() => onToggle(voucher)}
                    >
                      {voucher.isActive ? (
                        <FiX size={16} />
                      ) : (
                        <FiCheck size={16} />
                      )}
                    </IconButton>
                    <IconButton
                      label={tc("edit")}
                      onClick={() => onEdit(voucher)}
                    >
                      <FiEdit2 size={16} />
                    </IconButton>
                    <IconButton
                      label={tc("delete")}
                      onClick={() => onDelete(voucher)}
                    >
                      <FiTrash2 size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
          {t("vouchers.loading")}
        </div>
      )}
      {!isLoading && vouchers.length === 0 && (
        <div className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">
          {t("vouchers.emptyOperatorVoucher")}
        </div>
      )}
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        totalItems={vouchers.length}
        onPageChange={setPage}
      />
    </div>
  );
}
