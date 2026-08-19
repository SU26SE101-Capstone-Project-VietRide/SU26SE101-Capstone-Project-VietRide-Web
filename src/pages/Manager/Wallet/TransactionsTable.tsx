import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { WalletTransaction } from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { actorDisplayName, formatWalletDate } from "./walletFormat";
import { DataCompletenessBadge } from "./WalletBadges";
import { EmptyRow, type Translate } from "./walletTableShared";

export function TransactionsTable({
  items,
  t,
  tc,
}: {
  items: WalletTransaction[];
  t: Translate;
  tc: Translate;
}) {
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[1100px] table-fixed text-center text-sm">
        <thead>
          <tr className="bg-gray-50 text-center text-xs font-semibold text-gray-600">
            <th className="w-[11%] px-3 py-3">{t("wallet.time")}</th>
            <th className="w-[22%] px-4 py-3">{t("wallet.cashFlow")}</th>
            <th className="w-[13%] px-3 py-3">{t("wallet.change")}</th>
            <th className="w-[11%] px-3 py-3">{t("wallet.balanceAfter")}</th>
            <th className="w-[12%] px-3 py-3">{t("wallet.actor")}</th>
            <th className="w-[28%] px-4 py-3">{t("wallet.relatedSettlement")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow columns={6} t={t} />
          ) : (
            items.map((item) => <TransactionRow key={item.transactionId} item={item} t={t} tc={tc} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function TransactionRow({
  item,
  t,
  tc,
}: {
  item: WalletTransaction;
  t: Translate;
  tc: Translate;
}) {
  // amount luôn dương (giữ cho client cũ) — signedAmount mới là field đúng để
  // suy dấu +/-. Fallback theo type chỉ dùng khi BE chưa trả signedAmount.
  const signed = item.signedAmount ?? (item.type === "CREDIT" ? item.amount : -item.amount);
  const isCredit = signed >= 0;
  const copyKey = `wallet.transactionCopy.${item.referenceType}_${item.type}`;
  const fallbackCopy = t(`wallet.references.${item.referenceType}`, {
    defaultValue: item.note || item.referenceType,
  });
  const copy = t(copyKey, { defaultValue: fallbackCopy });

  return (
    <tr className="border-t border-gray-100">
      <td className="w-[11%] whitespace-nowrap px-3 py-3 text-gray-700">{formatWalletDate(item.createdAt)}</td>
      <td className={`w-[22%] whitespace-nowrap px-4 py-3 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}>
        {isCredit ? <FiArrowDown className="mr-2 inline" /> : <FiArrowUp className="mr-2 inline" />}
        {copy}
        {item.adjustmentReason && (
          <p className="mt-0.5 text-xs font-normal text-gray-600">
            {t(`wallet.adjustmentReasons.${item.adjustmentReason}`, {
              defaultValue: item.adjustmentReason,
            })}
          </p>
        )}
        <DataCompletenessBadge completeness={item.dataCompleteness} missingFields={item.missingFields} t={t} />
      </td>
      <td className={`w-[13%] whitespace-nowrap px-3 py-3 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}>
        {isCredit ? "+" : ""}
        {formatCurrency(signed)}
      </td>
      <td className="w-[14%] whitespace-nowrap px-3 py-3 font-semibold">{formatCurrency(item.balanceAfter)}</td>
      <td className="w-[12%] whitespace-nowrap px-3 py-3 text-gray-600">
        {actorDisplayName(item.actor, tc) ||
          tc("enumLabels.SYSTEM", { defaultValue: "-" })}
      </td>
      <td className="w-[28%] px-4 py-3 text-gray-600">
        {item.relatedSettlement
          ? t("wallet.relatedSettlementValue", { method: t(`wallet.methods.${item.relatedSettlement.method}`, { defaultValue: item.relatedSettlement.method }) })
          : "-"}
      </td>
    </tr>
  );
}
