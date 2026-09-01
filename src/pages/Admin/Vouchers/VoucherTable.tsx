import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";
import type { AdminVoucher } from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import {
  activeOf,
  discountTypeOf,
  discountValueOf,
  formatNumber,
  quantityOf,
  usedCountOf,
} from "./voucherHelpers";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { Badge } from "../../../components/ui/Badge";

type VoucherTableProps = {
  toolbar: ReactNode;
  /**
   * Nội dung khi bảng rỗng — render BÊN TRONG bảng chứ không thay thế cả bảng,
   * nếu không thanh tìm kiếm biến mất đúng lúc người dùng cần sửa từ khoá.
   */
  emptyState: ReactNode;
  isLoading?: boolean;
  vouchers: AdminVoucher[];
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onView: (voucher: AdminVoucher) => void;
  onEdit: (voucher: AdminVoucher) => void;
  onDelete: (voucher: AdminVoucher) => void;
};

export default function VoucherTable({
  toolbar,
  emptyState,
  isLoading = false,
  vouchers,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: VoucherTableProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">{toolbar}</div>
      <div className="overflow-x-auto px-2" tabIndex={0}>
      <table className="w-full min-w-[900px] table-fixed text-sm [&_th]:overflow-hidden [&_th]:text-ellipsis [&_th]:whitespace-nowrap [&_th]:px-2">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[26%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
              {t("vouchers.code")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
              {t("vouchers.name")}
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
              {t("vouchers.discount")}
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
              {t("vouchers.used")}
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
              {tc("status")}
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
              {tc("actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && vouchers.length === 0 && (
            <TableSkeletonRows columns={6} testId="admin-vouchers-table-skeleton" cellClassName="px-6 py-4" />
          )}
          {!isLoading && vouchers.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center">
                {emptyState}
              </td>
            </tr>
          )}
          {vouchers.map((voucher) => {
            const quantity = quantityOf(voucher);
            const usedCount = usedCountOf(voucher);
            const usageRate =
              quantity > 0 ? Math.round((usedCount / quantity) * 100) : 0;
            const discount = discountValueOf(voucher);

            return (
              <tr key={voucher.id} className="border-t border-gray-200">
                <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-center">
                  <span
                    className="block truncate font-mono font-semibold text-vr-900"
                    title={voucher.code}
                  >
                    {voucher.code}
                  </span>
                </td>
                <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-center">
                  <p
                    className="truncate font-medium text-gray-900"
                    title={voucher.name}
                  >
                    {voucher.name}
                  </p>
                  <p
                    className="truncate text-xs text-gray-500"
                    title={voucher.description}
                  >
                    {voucher.description}
                  </p>
                </td>
                <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-center">
                  <span className="block truncate text-base font-bold text-gray-900">
                    {discountTypeOf(voucher) === "percent"
                      ? `${discount}%`
                      : `${formatNumber(discount)} đ`}
                  </span>
                </td>
                <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-center">
                  <div className="mx-auto w-full max-w-20 text-center">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-vr-500"
                        style={{ width: `${Math.min(100, usageRate)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      {formatNumber(usedCount)} ({usageRate}%)
                    </p>
                  </div>
                </td>
                <td className="overflow-hidden whitespace-nowrap px-2 py-4 text-center">
                  <Badge tone={activeOf(voucher) ? "success" : "neutral"}>
                    {activeOf(voucher) ? tc("active") : tc("inactive")}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-2 py-4 text-center">
                  <div className="flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onView(voucher)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-vr-100 text-vr-900 hover:bg-vr-50"
                      aria-label={t("vouchers.viewDetails")}
                      title={t("vouchers.viewDetails")}
                    >
                      <FiEye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(voucher)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      aria-label={tc("edit")}
                      title={tc("edit")}
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(voucher)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                      aria-label={tc("delete")}
                      title={tc("delete")}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </div>
  );
}
