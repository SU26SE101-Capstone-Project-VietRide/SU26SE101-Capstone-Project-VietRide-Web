import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import type { TripSettlement } from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { actorDisplayName, formatWalletDate, settlementStatusTone } from "./walletFormat";
import { Badge } from "../../../components/ui/Badge";
import { DataCompletenessBadge, ProcessingStateBadge } from "./WalletBadges";
import { pickSettlementTripCode } from "../../../utils/businessCode";
import { BusinessCodeCell, EmptyRow, type Translate } from "./walletTableShared";

export function SettlementsTable({ items, t, tc }: { items: TripSettlement[]; t: Translate; tc: Translate }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto p-4" tabIndex={0}>
      <table className="w-full min-w-[1020px] table-fixed text-center text-sm">
        <thead>
          <tr className="bg-gray-50 text-center text-xs font-semibold text-gray-600">
            <th className="px-4 py-3">{t("wallet.settlementCode")}</th>
            <th className="px-4 py-3">{t("wallet.trip")}</th>
            <th className="px-4 py-3">{t("wallet.statusLabel")}</th>
            <th className="px-4 py-3">{t("wallet.receivedAmount")}</th>
            <th className="px-4 py-3">{t("wallet.form")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow columns={6} t={t} />
          ) : (
            items.map((item) => (
              <SettlementRowGroup
                key={item.settlementId}
                item={item}
                t={t}
                tc={tc}
                expanded={expandedId === item.settlementId}
                onToggle={() =>
                  setExpandedId((current) => (current === item.settlementId ? null : item.settlementId))
                }
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SettlementRowGroup({
  item,
  t,
  tc,
  expanded,
  onToggle,
}: {
  item: TripSettlement;
  t: Translate;
  tc: Translate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const netAmount = item.netEntitlementAmount ?? item.netAmount;

  return (
    <>
      <tr className="cursor-pointer border-t border-gray-100 hover:bg-gray-50" onClick={onToggle}>
        <td className="whitespace-nowrap px-4 py-3">
          <BusinessCodeCell code={item.settlementCode} />
        </td>
        {/* Mã chuyến là nhãn chính, tên tuyến chỉ là phụ đề. Bản operator không
            có top-level `tripCode` nên phải đọc qua `pickSettlementTripCode`.
            Không dựng nhãn từ `tripId` nữa — 8 ký tự đầu UUID không tra được. */}
        <td className="whitespace-nowrap px-4 py-3">
          <BusinessCodeCell code={pickSettlementTripCode(item)} />
          {item.trip?.routeName && (
            <span className="mt-0.5 block text-xs text-gray-500">{item.trip.routeName}</span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          {item.processingState ? (
            <ProcessingStateBadge state={item.processingState} t={t} />
          ) : (
            <Badge tone={settlementStatusTone(item.status)}>
              {t(`wallet.status.${item.status}`)}
            </Badge>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatCurrency(netAmount)}</td>
        <td className="px-4 py-3">
          {item.settlementMethod ? t(`wallet.methods.${item.settlementMethod}`) : "-"}
        </td>
        <td className="px-4 py-3 text-gray-500">{expanded ? <FiChevronUp /> : <FiChevronDown />}</td>
      </tr>
      {expanded && <SettlementDetailRow item={item} t={t} tc={tc} />}
    </>
  );
}

function SettlementDetailRow({ item, t, tc }: { item: TripSettlement; t: Translate; tc: Translate }) {
  return (
    <tr className="border-t border-gray-100 bg-gray-50/60">
      <td colSpan={6} className="px-4 py-4 text-left">
        <SettlementStateDetail item={item} t={t} tc={tc} />
        <SettlementBreakdown item={item} t={t} />
      </td>
    </tr>
  );
}

function SettlementStateDetail({ item, t, tc }: { item: TripSettlement; t: Translate; tc: Translate }) {
  const state = item.processingState;

  return (
    <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
      {state === "ON_HOLD" && item.eligibleAt && (
        <span>{t("wallet.eligibleAt")}: {formatWalletDate(item.eligibleAt)}</span>
      )}
      {state === "RETRY_SCHEDULED" && (
        <>
          {item.delayReason && <span>{t(`wallet.delayReason.${item.delayReason}`, { defaultValue: t("wallet.delayReason.default") })}</span>}
          {item.attemptCount !== undefined && <span>{t("wallet.attemptCount", { count: item.attemptCount })}</span>}
          {item.lastAttemptAt && <span>{t("wallet.lastAttemptAt")}: {formatWalletDate(item.lastAttemptAt)}</span>}
          {item.nextRetryAt && <span>{t("wallet.nextRetryAt")}: {formatWalletDate(item.nextRetryAt)}</span>}
        </>
      )}
      {state === "COMPLETED" && (
        <>
          {item.settledAt && <span>{t("wallet.settledAt")}: {formatWalletDate(item.settledAt)}</span>}
          {actorDisplayName(item.settledBy, tc) && (
            <span>{t("wallet.settledBy")}: {actorDisplayName(item.settledBy, tc)}</span>
          )}
        </>
      )}
      {/* BE hiện chỉ phát NON_POSITIVE_NET_ENTITLEMENT, nhưng vẫn để defaultValue
          là mã thô để mã mới không biến mất khỏi màn hình. */}
      {state === "CANCELLED" && item.cancelReason && <span>{t("wallet.cancelReason")}: {t(`wallet.cancelReasons.${item.cancelReason}`, { defaultValue: item.cancelReason })}</span>}
      <DataCompletenessBadge completeness={item.trip === null ? "PARTIAL" : undefined} t={t} />
    </div>
  );
}

const BREAKDOWN_FIELDS = [
  "grossSalesAmount",
  "passengerPaidAmount",
  "vietRideFundedAmount",
  "operatorFundedDiscountAmount",
  "refundAmount",
  "recognizedAdjustmentAmount",
] as const;

function SettlementBreakdown({ item, t }: { item: TripSettlement; t: Translate }) {
  const hasBreakdown = BREAKDOWN_FIELDS.some((field) => item[field] !== undefined);
  if (!hasBreakdown) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-700 sm:grid-cols-3">
      {BREAKDOWN_FIELDS.map((field) =>
        item[field] === undefined ? null : (
          <div key={field} className="flex justify-between gap-2">
            <dt className="text-gray-500">{t(`wallet.breakdown.${field}`)}</dt>
            <dd className="font-semibold">{formatCurrency(item[field])}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
