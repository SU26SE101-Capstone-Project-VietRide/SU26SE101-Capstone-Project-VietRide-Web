import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import type { OperatorVoucher } from "../../../api/vietride";
import { PersonnelTable } from "../../../components/PersonnelTable";
import { IconButton } from "./formControls";
import { formatDate, formatMoney, truncateVoucherName } from "./voucherHelpers";

type VoucherTableProps = {
  toolbar: ReactNode;
  vouchers: OperatorVoucher[];
  isLoading: boolean;
  onEdit: (voucher: OperatorVoucher) => void;
  onToggle: (voucher: OperatorVoucher) => void;
  onDelete: (voucher: OperatorVoucher) => void;
};

export default function VoucherTable({ toolbar, vouchers, isLoading, onEdit, onToggle, onDelete }: VoucherTableProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  return (
    <PersonnelTable
      toolbar={toolbar}
      rows={vouchers}
      getRowKey={(voucher) => voucher.id}
      isLoading={isLoading}
      loadingMessage={t("vouchers.loading")}
      emptyMessage={t("vouchers.emptyOperatorVoucher")}
      page={page}
      pageSize={pageSize}
      totalItems={vouchers.length}
      onPageChange={setPage}
      className="w-full table-fixed whitespace-nowrap"
      columns={[
        { key: "code", header: t("vouchers.code"), headerClassName: "w-[14%] px-3 py-3 text-center", cellClassName: "w-[14%] whitespace-nowrap px-3 py-4 text-center font-mono text-sm font-semibold text-vr-700", render: (voucher) => voucher.code },
        { key: "name", header: t("vouchers.name"), headerClassName: "w-[24%] px-3 py-3 text-left", cellClassName: "w-[24%] min-w-0 px-3 py-4 text-left", render: (voucher) => <><p className="max-w-full truncate text-sm font-semibold leading-5 text-gray-900" title={voucher.name}>{truncateVoucherName(voucher.name)}</p><p className="whitespace-nowrap truncate text-xs text-gray-500">{tc(`voucherTypes.${voucher.type}`, { defaultValue: voucher.type })}</p></> },
        { key: "discount", header: t("vouchers.discount"), headerClassName: "w-[10%] px-3 py-3 text-center", cellClassName: "w-[10%] whitespace-nowrap px-3 py-4 text-center text-sm text-gray-700", render: (voucher) => voucher.type === "PERCENT_OFF" ? `${voucher.value}%` : `${formatMoney(voucher.value)} đ` },
        { key: "limit", header: t("vouchers.limit"), headerClassName: "w-[11%] px-3 py-3 text-center", cellClassName: "w-[11%] whitespace-nowrap px-3 py-4 text-center text-sm text-gray-700", render: (voucher) => <><p>{t("vouchers.totalLimit", { count: voucher.totalUsageLimit })}</p><p className="text-xs text-gray-500">{t("vouchers.perUserLimit", { count: voucher.perUserLimit })}</p></> },
        { key: "validity", header: t("vouchers.validity"), headerClassName: "w-[17%] px-3 py-3 text-center", cellClassName: "w-[17%] whitespace-nowrap px-3 py-4 text-center text-sm text-gray-700", render: (voucher) => <><p>{formatDate(voucher.validFrom)}</p><p className="text-xs text-gray-500">{t("vouchers.validUntil", { date: formatDate(voucher.validUntil) })}</p></> },
        { key: "status", header: tc("status"), headerClassName: "w-[10%] px-3 py-3 text-center", cellClassName: "w-[10%] whitespace-nowrap px-3 py-4 text-center", render: (voucher) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${voucher.isActive ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>{voucher.isActive ? t("vouchers.enabled") : t("vouchers.disabled")}</span> },
        { key: "actions", header: tc("actions"), headerClassName: "w-[14%] px-3 py-3 text-center", cellClassName: "w-[14%] whitespace-nowrap px-3 py-4 text-center", render: (voucher) => <div className="flex items-center justify-center gap-1"><IconButton label={voucher.isActive ? t("vouchers.disableVoucher") : t("vouchers.enableVoucher")} onClick={() => onToggle(voucher)}>{voucher.isActive ? <FiX size={16} /> : <FiCheck size={16} />}</IconButton><IconButton label={tc("edit")} onClick={() => onEdit(voucher)}><FiEdit2 size={16} /></IconButton><IconButton label={tc("delete")} onClick={() => onDelete(voucher)}><FiTrash2 size={16} /></IconButton></div> },
      ]}
    />
  );
}