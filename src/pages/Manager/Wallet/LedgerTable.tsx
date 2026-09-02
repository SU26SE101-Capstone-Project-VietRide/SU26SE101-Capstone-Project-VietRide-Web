import type { OperatorLedgerEntry } from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { formatWalletDate } from "./walletFormat";
import { DataCompletenessBadge } from "./WalletBadges";
import { BusinessCodeCell, EmptyRow, type Translate } from "./walletTableShared";

export function LedgerTable({ items, t, tc }: { items: OperatorLedgerEntry[]; t: Translate; tc: Translate }) {
  return (
    <div className="overflow-x-auto" tabIndex={0}>
      <table className="w-full min-w-[1120px] table-fixed text-center text-sm">
        {/* `table-fixed` mà không khai bề rộng thì các cột chia đều — mã tham
            chiếu (VR-PCL-20260815-44KV5S53) bị bẻ xuống hai dòng trong khi cột
            số tiền lại thừa chỗ. */}
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[21%]" />
          <col className="w-[16%]" />
          <col className="w-[25%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="whitespace-nowrap bg-gray-50 text-center text-xs font-semibold text-gray-600">
            <th className="px-4 py-3">{t("wallet.datetime")}</th>
            <th className="px-4 py-3">{t("wallet.trip")}</th>
            <th className="px-4 py-3">{t("wallet.reference")}</th>
            <th className="px-4 py-3">{t("wallet.businessContext")}</th>
            <th className="px-4 py-3">{t("wallet.amount")}</th>
            <th className="px-4 py-3">{t("wallet.recordSource")}</th>
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
        {isFallback && <p className="text-xs font-normal text-gray-600">{t("wallet.occurredAtFallback")}</p>}
      </td>
      <td className="px-4 py-3">
        {item.trip ? (
          <>
            <BusinessCodeCell code={item.trip.tripCode} />
            <p className="mt-0.5 truncate text-xs text-gray-600">
              {item.trip.routeName ||
                [item.trip.originName, item.trip.destinationName]
                  .filter(Boolean)
                  .join(" → ") ||
                "—"}
            </p>
            {item.trip.departureAt && (
              <p className="text-xs text-gray-500">
                {formatWalletDate(item.trip.departureAt)}
              </p>
            )}
          </>
        ) : (
          <span className="text-gray-500">{t("wallet.tripUnavailable")}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <BusinessCodeCell code={item.referenceCode} />
      </td>
      <td className="px-4 py-3 font-semibold">
        {item.businessGroup
          ? t(`wallet.businessGroups.${item.businessGroup}`, {
              defaultValue: item.businessGroup,
            })
          : tc("enumLabels." + item.entryType, { defaultValue: item.entryType })}
        {item.operatorEffect && (
          <p className="text-xs font-normal text-gray-600">
            {t(`wallet.operatorEffects.${item.operatorEffect}`, {
              defaultValue: item.operatorEffect,
            })}
          </p>
        )}
        {item.affectsSettlement === false && (
          <p className="text-xs font-normal text-gray-600">{t("wallet.notAffectingSettlement")}</p>
        )}
        {item.operatorFundedVoucherAmount ? (
          <p className="text-xs font-normal text-gray-600">
            {t("wallet.operatorFundedVoucherAmount")}: {formatCurrency(item.operatorFundedVoucherAmount)}
          </p>
        ) : null}
        <DataCompletenessBadge
          completeness={item.dataCompleteness}
          missingFields={item.missingFields}
          t={t}
        />
      </td>
      <td className={"whitespace-nowrap px-4 py-3 font-semibold " + (item.amount < 0 ? "text-red-700" : "text-emerald-700")}>
        {formatCurrency(item.amount)}
      </td>
      <td className="px-4 py-3">
        {item.actorType === "SYSTEM"
          ? t("wallet.recordSourceAutomatic")
          : item.actor?.displayName || "-"}
      </td>
    </tr>
  );
}
