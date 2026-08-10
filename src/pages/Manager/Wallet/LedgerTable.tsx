import type { OperatorLedgerEntry } from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { formatWalletDate } from "./walletFormat";
import { ProcessingStateBadge } from "./WalletBadges";
import { EmptyRow, type Translate } from "./walletTableShared";

export function LedgerTable({ items, t, tc }: { items: OperatorLedgerEntry[]; t: Translate; tc: Translate }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-center text-sm">
        <thead>
          <tr className="bg-gray-50 text-center text-xs font-semibold uppercase text-gray-600">
            <th className="px-4 py-3">{t("wallet.datetime")}</th>
            <th className="px-4 py-3">{t("wallet.reference")}</th>
            <th className="px-4 py-3">{t("wallet.entryType")}</th>
            <th className="px-4 py-3">{t("wallet.amount")}</th>
            <th className="px-4 py-3">{t("wallet.actor")}</th>
            <th className="px-4 py-3">{t("wallet.statusLabel")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow columns={6} t={t} />
          ) : (
            items.map((item) => <LedgerRow key={item.ledgerEntryId} item={item} t={t} tc={tc} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function LedgerRow({ item, t, tc }: { item: OperatorLedgerEntry; t: Translate; tc: Translate }) {
  // occurredAt là thời điểm nghiệp vụ thật; khi occurredAtSource là fallback
  // thì hiển thị kèm ghi chú, không giả vờ đó là thời điểm thật.
  const occurredAt = item.occurredAt ?? item.createdAt;
  const isFallback = item.occurredAtSource === "LEDGER_CREATED_AT_FALLBACK";

  return (
    <tr className="border-t border-gray-100">
      <td className="whitespace-nowrap px-4 py-3">
        {formatWalletDate(occurredAt)}
        {isFallback && <p className="text-[11px] font-normal text-gray-400">{t("wallet.occurredAtFallback")}</p>}
      </td>
      <td className="px-4 py-3 text-gray-600">{item.referenceCode ?? "-"}</td>
      <td className="px-4 py-3 font-semibold">
        {tc("enumLabels." + item.entryType, { defaultValue: item.entryType })}
        {item.affectsSettlement === false && (
          <p className="text-[11px] font-normal text-gray-400">{t("wallet.notAffectingSettlement")}</p>
        )}
        {item.operatorFundedVoucherAmount ? (
          <p className="text-[11px] font-normal text-gray-400">
            {t("wallet.operatorFundedVoucherAmount")}: {formatCurrency(item.operatorFundedVoucherAmount)}
          </p>
        ) : null}
      </td>
      <td className={"whitespace-nowrap px-4 py-3 font-semibold " + (item.amount < 0 ? "text-red-700" : "text-emerald-700")}>
        {formatCurrency(item.amount)}
      </td>
      <td className="px-4 py-3">{item.actor?.displayName || tc("enumLabels.SYSTEM", { defaultValue: item.actorType || "-" })}</td>
      <td className="px-4 py-3">
        {item.settlement ? <ProcessingStateBadge state={item.settlement.processingState} t={t} /> : "-"}
      </td>
    </tr>
  );
}
