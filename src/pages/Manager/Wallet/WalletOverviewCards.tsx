import { FiCheckCircle, FiClock, FiDollarSign } from "react-icons/fi";
import type { OperatorWallet } from "../../../api/vietride";
import { StatCard } from "../../../components/StatCard";
import { formatCurrency } from "../../../utils/currency";
import { displayBusinessCode } from "../../../utils/businessCode";
import { formatWalletDate } from "./walletFormat";
import type { Translate } from "./walletTableShared";

// 4 card mô tả 4 GIAI ĐOẠN khác nhau trong vòng đời đối soát — không cộng
// gộp lại thành "tổng tài sản" (xem FE-REQUEST-operator-wallet-transparency
// -RESPONSE.md §5, §13). Không đặt tiêu đề chung phía trên nhóm card này.
export function WalletOverviewCards({
  wallet,
  isLoading,
  t,
}: {
  wallet: OperatorWallet | null;
  isLoading: boolean;
  t: Translate;
}) {
  const reconciliation = wallet?.reconciliation;
  const outstanding =
    reconciliation?.outstandingPayableVnd ??
    (wallet?.awaitingTripCompletionAmount ?? 0) +
      (wallet?.pendingHoldAmount ?? 0) +
      (wallet?.eligibleAmount ?? 0);
  const awaiting =
    reconciliation?.awaitingTripCompletionPayableVnd ??
    wallet?.awaitingTripCompletionAmount ??
    0;
  const pending =
    reconciliation?.pendingHoldPayableVnd ?? wallet?.pendingHoldAmount ?? 0;
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-slate-900">
            {t("wallet.reconciliationTitle")}
          </h2>
          <p className="text-sm text-slate-600">
            {t("wallet.reconciliationHint")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiDollarSign />}
          label={t("wallet.currentBalance")}
          value={formatCurrency(wallet?.balance ?? 0)}
          iconClassName="bg-emerald-50 text-emerald-700"
          isLoading={isLoading}
          helper={t("wallet.balanceHelper")}
        />
        <StatCard
          icon={<FiDollarSign />}
          label={t("wallet.outstandingPayable")}
          value={formatCurrency(outstanding)}
          iconClassName="bg-violet-50 text-violet-700"
          isLoading={isLoading}
          helper={t("wallet.outstandingHelper")}
        />
        <StatCard
          icon={<FiClock />}
          label={t("wallet.awaitingTripCompletion")}
          value={formatCurrency(awaiting)}
          iconClassName="bg-slate-100 text-slate-700"
          isLoading={isLoading}
          helper={t("wallet.countHelper", { count: wallet?.awaitingTripCompletionCount ?? 0 })}
        />
        <StatCard
          icon={<FiClock />}
          label={t("wallet.pendingHold")}
          value={formatCurrency(pending)}
          iconClassName="bg-amber-50 text-amber-700"
          isLoading={isLoading}
          helper={t("wallet.countHelper", { count: wallet?.pendingHoldCount ?? 0 })}
        />
        </div>
      </div>
      <WalletScheduleSummary wallet={wallet} t={t} />
    </>
  );
}

function WalletScheduleSummary({
  wallet,
  t,
}: {
  wallet: OperatorWallet | null;
  t: Translate;
}) {
  if (!wallet) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
      {wallet.nextScheduledSettlementAttemptAt && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <FiClock className="shrink-0 text-amber-600" />
          <span>{t("wallet.nextScheduledAttempt")}:</span>
          <strong className="font-semibold">
            {formatWalletDate(wallet.nextScheduledSettlementAttemptAt)}
          </strong>
        </span>
      )}
      {wallet.lifetimeSettledAmount !== undefined && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          <FiCheckCircle className="shrink-0 text-emerald-600" />
          <span>{t("wallet.lifetimeSettled")}:</span>
          <strong className="font-semibold">
            {formatCurrency(wallet.lifetimeSettledAmount)}
          </strong>
        </span>
      )}
      {wallet.lastSettlement && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">
          <FiDollarSign className="shrink-0 text-blue-600" />
          <span>{t("wallet.lastSettlement")}:</span>
          <strong className="font-semibold">
            {formatCurrency(wallet.lastSettlement.amount)} (
            {formatWalletDate(wallet.lastSettlement.settledAt)})
          </strong>
          {/* Mã tất toán để nhà xe đọc thẳng cho CSKH khi thắc mắc lần chi gần
              nhất, thay vì phải mở tab Đối soát dò lại. */}
          <span className="font-mono text-xs tabular-nums text-blue-800">
            {displayBusinessCode(wallet.lastSettlement.settlementCode)}
          </span>
        </span>
      )}
    </div>
  );
}
