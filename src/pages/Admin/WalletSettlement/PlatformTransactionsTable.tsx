import { useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
} from "react-icons/fi";
import type {
  AdminWalletTransactionParams,
  FinancialBusinessGroup,
  WalletTransaction,
  WalletTransactionType,
} from "../../../api/vietride";
import { FinancialDataCompletenessBadge } from "../../../components/FinancialDataCompletenessBadge";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { SearchInput } from "../../../components/ui/SearchInput";
import { displayBusinessCode } from "../../../utils/businessCode";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTimeInVietnam } from "../../../utils/date";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const businessGroups = [
  "TICKET",
  "PARCEL",
  "REFUND",
  "SETTLEMENT",
  "SUBSCRIPTION",
  "COMPENSATION",
  "MANUAL_ADJUSTMENT",
] as const;

const cashFlowPurposes = [
  "CUSTOMER_FUNDS_HELD",
  "CUSTOMER_REFUND",
  "OPERATOR_PAYOUT",
  "PLATFORM_REVENUE",
  "PARCEL_COMPENSATION_PAYOUT",
  "MANUAL_ADJUSTMENT",
] as const;

export type AdminTransactionFilters = Pick<
  AdminWalletTransactionParams,
  "operatorId" | "tripId" | "businessGroup" | "cashFlowPurpose"
> & {
  search: string;
  type: WalletTransactionType | "";
  from: string;
  to: string;
};

export function PlatformTransactionsTable({
  items,
  page,
  totalItems,
  pageSize,
  filters,
  exporting,
  onPageChange,
  onFiltersChange,
  onExport,
  t,
}: {
  items: WalletTransaction[];
  page: number;
  totalItems: number;
  pageSize: number;
  filters: AdminTransactionFilters;
  exporting: boolean;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: AdminTransactionFilters) => void;
  onExport: () => void;
  t: Translate;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const update = (changes: Partial<AdminTransactionFilters>) =>
    onFiltersChange({ ...filters, ...changes });

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("walletSettlement.latestTransactions")}
          </h2>
          <button
            type="button"
            onClick={onExport}
            disabled={
              exporting || Boolean(filters.from) !== Boolean(filters.to)
            }
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-vr-700 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiDownload />
            {exporting
              ? t("walletSettlement.exporting")
              : t("walletSettlement.exportXlsx")}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SearchInput
            label={t("walletSettlement.transactionSearchPlaceholder")}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder={t("walletSettlement.transactionSearchPlaceholder")}
            wrapperClassName="relative min-w-0 xl:col-span-2"
          />
          <SearchInput
            label={t("walletSettlement.operatorId")}
            value={filters.operatorId ?? ""}
            onChange={(event) => update({ operatorId: event.target.value })}
            placeholder={t("walletSettlement.operatorIdPlaceholder")}
            wrapperClassName="relative min-w-0"
          />
          <CustomSelect
            value={filters.type}
            onChange={(event) =>
              update({ type: event.target.value as WalletTransactionType | "" })
            }
            aria-label={t("walletSettlement.allTransactionTypes")}
          >
            <option value="">
              {t("walletSettlement.allTransactionTypes")}
            </option>
            <option value="CREDIT">{t("walletSettlement.moneyIn")}</option>
            <option value="DEBIT">{t("walletSettlement.moneyOut")}</option>
          </CustomSelect>
          <CustomSelect
            value={filters.businessGroup ?? ""}
            onChange={(event) =>
              update({
                businessGroup: event.target.value as FinancialBusinessGroup,
              })
            }
            aria-label={t("walletSettlement.allBusinessGroups")}
          >
            <option value="">{t("walletSettlement.allBusinessGroups")}</option>
            {businessGroups.map((value) => (
              <option key={value} value={value}>
                {t(`walletSettlement.businessGroups.${value}`, {
                  defaultValue: value,
                })}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            value={filters.cashFlowPurpose ?? ""}
            onChange={(event) =>
              update({ cashFlowPurpose: event.target.value })
            }
            aria-label={t("walletSettlement.allCashFlowPurposes")}
          >
            <option value="">
              {t("walletSettlement.allCashFlowPurposes")}
            </option>
            {cashFlowPurposes.map((value) => (
              <option key={value} value={value}>
                {t(`walletSettlement.cashFlowPurposes.${value}`, {
                  defaultValue: value,
                })}
              </option>
            ))}
          </CustomSelect>
          <CustomDateTimeInput
            type="date"
            value={filters.from}
            onChange={(event) => update({ from: event.target.value })}
            placeholder={t("walletSettlement.from")}
          />
          <CustomDateTimeInput
            type="date"
            value={filters.to}
            onChange={(event) => update({ to: event.target.value })}
            placeholder={t("walletSettlement.to")}
          />
        </div>
        {Boolean(filters.from) !== Boolean(filters.to) && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            {t("walletSettlement.datePairRequired")}
          </p>
        )}
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[17%]" />
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-center text-xs font-semibold text-gray-600">
              <th className="px-2 py-3" />
              <th className="px-3 py-3">
                {t("walletSettlement.transactionCode")}
              </th>
              <th className="px-3 py-3">
                {t("walletSettlement.businessContext")}
              </th>
              <th className="px-3 py-3">{t("walletSettlement.amount")}</th>
              <th className="px-3 py-3">
                {t("walletSettlement.balanceBefore")}
              </th>
              <th className="px-3 py-3">
                {t("walletSettlement.balanceAfter")}
              </th>
              <th className="px-3 py-3">{t("walletSettlement.actor")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {t("walletSettlement.empty")}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const expanded = expandedId === item.transactionId;
                const isCredit = item.type === "CREDIT";
                return (
                  <TransactionRows
                    key={item.transactionId}
                    item={item}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedId(expanded ? null : item.transactionId)
                    }
                    isCredit={isCredit}
                    t={t}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </section>
  );
}

function TransactionRows({
  item,
  expanded,
  onToggle,
  isCredit,
  t,
}: {
  item: WalletTransaction;
  expanded: boolean;
  onToggle: () => void;
  isCredit: boolean;
  t: Translate;
}) {
  const allocations = item.allocations ?? [];
  const purpose = item.cashFlowPurpose
    ? t(`walletSettlement.cashFlowPurposes.${item.cashFlowPurpose}`, {
        defaultValue: item.cashFlowPurpose,
      })
    : t(`walletSettlement.references.${item.referenceType}`, {
        defaultValue: item.referenceType,
      });

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <td className="px-2 py-3 text-center">
          <button
            type="button"
            onClick={onToggle}
            aria-label={t("walletSettlement.toggleAllocations")}
            aria-expanded={expanded}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            {expanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </td>
        <td className="px-3 py-3 text-center">
          <p className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums">
            {displayBusinessCode(item.transactionCode)}
          </p>
          <p className="mt-1 whitespace-nowrap text-xs text-gray-500">
            {formatDateTimeInVietnam(item.createdAt)}
          </p>
        </td>
        <td className="px-3 py-3 text-center font-semibold text-gray-800">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span>{purpose}</span>
            <FinancialDataCompletenessBadge
              completeness={item.dataCompleteness}
              missingFields={item.missingFields}
              label={t("walletSettlement.partialBadge")}
              tooltip={t("walletSettlement.partialTooltip")}
            />
          </div>
          {item.businessGroup && (
            <p className="mt-1 text-xs font-normal text-gray-500">
              {t(`walletSettlement.businessGroups.${item.businessGroup}`, {
                defaultValue: item.businessGroup,
              })}
            </p>
          )}
        </td>
        <td
          className={`whitespace-nowrap px-3 py-3 text-center font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}
        >
          {isCredit ? (
            <FiArrowDown className="mr-1 inline" />
          ) : (
            <FiArrowUp className="mr-1 inline" />
          )}
          {isCredit ? "+" : "-"}
          {formatCurrency(item.amount)}
        </td>
        <td className="px-3 py-3 text-center text-sm text-gray-700">
          {formatCurrency(item.balanceBefore)}
        </td>
        <td className="px-3 py-3 text-center text-base font-bold text-vr-800">
          {formatCurrency(item.balanceAfter)}
        </td>
        <td className="px-3 py-3 text-center">
          {item.actorType === "SYSTEM"
            ? Array.from(
                new Set(
                  item.allocations
                    ?.map((allocation) => allocation.operator?.name)
                    .filter(Boolean),
                ),
              ).join(", ") || t("walletSettlement.systemActor")
            : item.actor?.displayName === "System Admin"
              ? t("walletSettlement.systemAdminActor")
              : item.actor?.displayName || "—"}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-100 bg-slate-50/70">
          <td colSpan={7} className="px-5 py-4">
            <AllocationDetails allocations={allocations} t={t} />
          </td>
        </tr>
      )}
    </>
  );
}

function AllocationDetails({
  allocations,
  t,
}: {
  allocations: NonNullable<WalletTransaction["allocations"]>;
  t: Translate;
}) {
  if (allocations.length === 0) {
    return (
      <p className="text-left text-sm text-gray-500">
        {t("walletSettlement.noAllocations")}
      </p>
    );
  }

  return (
    <div className="grid gap-3 text-left lg:grid-cols-2">
      {allocations.map((allocation, index) => (
        <article
          key={`${allocation.referenceId ?? "allocation"}-${index}`}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {allocation.operator?.name ||
                  t("walletSettlement.unknownOperator")}
              </p>
              {allocation.operator?.contactPhone && (
                <p className="text-xs text-slate-500">
                  {allocation.operator.contactPhone}
                </p>
              )}
            </div>
            <strong className="whitespace-nowrap text-vr-800">
              {formatCurrency(allocation.allocatedAmountVnd)}
            </strong>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">{t("walletSettlement.trip")}</dt>
            <dd className="font-mono text-xs">
              {allocation.tripCode ||
                t("walletSettlement.tripInformationUnavailable")}
            </dd>
            <dt className="text-slate-500">
              {t("walletSettlement.reference")}
            </dt>
            <dd className="font-mono text-xs">
              {allocation.referenceCode ? `${allocation.referenceCode} · ` : ""}
              {t(`walletSettlement.references.${allocation.referenceType}`, {
                defaultValue: allocation.referenceType,
              })}
            </dd>
            <dt className="text-slate-500">
              {t("walletSettlement.settlementCode")}
            </dt>
            <dd className="font-mono text-xs">
              {allocation.relatedSettlement?.settlementCode || "—"}
            </dd>
            {allocation.relatedSettlement?.status && (
              <>
                <dt className="text-slate-500">
                  {t("walletSettlement.statusLabel")}
                </dt>
                <dd>
                  {t(
                    `walletSettlement.status.${allocation.relatedSettlement.status}`,
                    { defaultValue: allocation.relatedSettlement.status },
                  )}
                </dd>
              </>
            )}
          </dl>
        </article>
      ))}
    </div>
  );
}
