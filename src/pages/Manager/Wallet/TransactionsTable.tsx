import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { WalletTransaction } from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { Badge } from "../../../components/ui/Badge";
import { actorDisplayName, formatWalletDate } from "./walletFormat";
import { DataCompletenessBadge } from "./WalletBadges";
import {
  BusinessCodeCell,
  EmptyRow,
  type Translate,
} from "./walletTableShared";

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
            <th className="w-[17%] px-3 py-3">{t("wallet.transactionCode")}</th>
            <th className="w-[12%] px-3 py-3">{t("wallet.time")}</th>
            <th className="w-[21%] px-4 py-3">{t("wallet.cashFlow")}</th>
            <th className="w-[12%] px-3 py-3">{t("wallet.change")}</th>
            <th className="w-[11%] px-3 py-3">{t("wallet.balanceAfter")}</th>
            <th className="w-[12%] px-3 py-3">{t("wallet.actor")}</th>
            <th className="w-[15%] px-4 py-3">
              {t("wallet.relatedSettlement")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow columns={7} t={t} />
          ) : (
            items.map((item) => (
              <TransactionRow
                key={item.transactionId}
                item={item}
                t={t}
                tc={tc}
              />
            ))
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
  const signed =
    item.signedAmount ?? (item.type === "CREDIT" ? item.amount : -item.amount);
  const isCredit = signed >= 0;
  const copyKey = `wallet.transactionCopy.${item.referenceType}_${item.type}`;
  const fallbackCopy = t(`wallet.references.${item.referenceType}`, {
    defaultValue: item.note || item.referenceType,
  });
  const copy = t(copyKey, { defaultValue: fallbackCopy });
  const purpose = item.cashFlowPurpose
    ? t(`wallet.cashFlowPurposes.${item.cashFlowPurpose}`, {
        defaultValue: item.cashFlowPurpose,
      })
    : copy;

  return (
    <tr className="border-t border-gray-100">
      <td className="w-[17%] whitespace-nowrap px-3 py-3">
        <BusinessCodeCell code={item.transactionCode} />
      </td>
      <td className="w-[12%] whitespace-nowrap px-3 py-3 text-gray-700">
        {formatWalletDate(item.createdAt)}
      </td>
      <td
        className={`w-[21%] whitespace-nowrap px-4 py-3 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}
      >
        {isCredit ? (
          <FiArrowDown className="mr-2 inline" />
        ) : (
          <FiArrowUp className="mr-2 inline" />
        )}
        {purpose}
        {item.businessGroup && (
          <p className="mt-0.5 text-xs font-normal text-gray-600">
            {t(`wallet.businessGroups.${item.businessGroup}`, {
              defaultValue: item.businessGroup,
            })}
          </p>
        )}
        {item.adjustmentReason && (
          <p className="mt-0.5 text-xs font-normal text-gray-600">
            {t(`wallet.adjustmentReasons.${item.adjustmentReason}`, {
              defaultValue: item.adjustmentReason,
            })}
          </p>
        )}
        <DataCompletenessBadge
          completeness={item.dataCompleteness}
          missingFields={item.missingFields}
          t={t}
        />
      </td>
      <td
        className={`w-[12%] whitespace-nowrap px-3 py-3 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}
      >
        {isCredit ? "+" : ""}
        {formatCurrency(signed)}
      </td>
      <td className="w-[11%] whitespace-nowrap px-3 py-3 font-semibold">
        {formatCurrency(item.balanceAfter)}
      </td>
      <td className="w-[12%] whitespace-nowrap px-3 py-3 text-gray-600">
        {actorDisplayName(item.actor, tc) ||
          tc("enumLabels.SYSTEM", { defaultValue: "-" })}
      </td>
      {/*
        Chỉ hiện HÌNH THỨC đối soát, dạng pill.

        Mã tất toán + mã chuyến cố ý KHÔNG hiện ở đây: ô rộng ~210px không đủ
        cho hai mã 21–22 ký tự nên chúng bị bẻ giữa chuỗi
        ("TRIP-20260817-" / "8F6AP5SS") và mất luôn tác dụng tra cứu. Cần đối
        chiếu mã thì xem tab "Doanh thu hàng tuần" — ở đó mã tất toán và mã
        chuyến là hai cột riêng, đủ chỗ.

        Pill (không phải chữ thường) vì cột "Người thực hiện" ngay bên cạnh
        cũng là tên người: để chữ trần thì "Đối soát thủ công" đọc như một
        người thực hiện thứ hai.
      */}
      <td className="w-[15%] px-4 py-3 text-gray-600">
        {item.relatedSettlement ? (
          <Badge tone="neutral">
            {item.relatedSettlement.method
              ? t(`wallet.methods.${item.relatedSettlement.method}`, {
                  defaultValue: item.relatedSettlement.method,
                })
              : item.relatedSettlement.settlementCode || "-"}
          </Badge>
        ) : (
          "-"
        )}
      </td>
    </tr>
  );
}
