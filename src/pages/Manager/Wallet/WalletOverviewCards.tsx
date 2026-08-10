import { FiArrowDown, FiCheckCircle, FiClock, FiDollarSign } from "react-icons/fi";
import type { OperatorWallet } from "../../../api/vietride";
import { StatCard } from "../../../components/StatCard";
import { formatCurrency } from "../../../utils/currency";
import { formatWalletDate } from "./walletFormat";
import type { Translate } from "./walletTableShared";

// 4 card mô tả 4 GIAI ĐOẠN khác nhau trong vòng đời tất toán — không cộng
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
  return (
    <>
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
          icon={<FiClock />}
          label={t("wallet.awaitingTripCompletion")}
          value={formatCurrency(wallet?.awaitingTripCompletionAmount ?? 0)}
          iconClassName="bg-slate-100 text-slate-700"
          isLoading={isLoading}
          helper={t("wallet.countHelper", { count: wallet?.awaitingTripCompletionCount ?? 0 })}
        />
        <StatCard
          icon={<FiClock />}
          label={t("wallet.pendingHold")}
          value={formatCurrency(wallet?.pendingHoldAmount ?? 0)}
          iconClassName="bg-amber-50 text-amber-700"
          isLoading={isLoading}
          helper={t("wallet.countHelper", { count: wallet?.pendingHoldCount ?? 0 })}
        />
        <StatCard
          icon={<FiArrowDown />}
          label={t("wallet.eligibleAmount")}
          value={formatCurrency(wallet?.eligibleAmount ?? 0)}
          iconClassName="bg-blue-50 text-blue-700"
          isLoading={isLoading}
          helper={t("wallet.countHelper", { count: wallet?.eligibleCount ?? 0 })}
        />
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
      {wallet.nextScheduledSettlementAttemptAt && (
        <span>
          <FiClock className="mr-1.5 inline text-gray-400" />
          {t("wallet.nextScheduledAttempt")}: {formatWalletDate(wallet.nextScheduledSettlementAttemptAt)}
        </span>
      )}
      {wallet.lifetimeSettledAmount !== undefined && (
        <span>
          <FiCheckCircle className="mr-1.5 inline text-gray-400" />
          {t("wallet.lifetimeSettled")}: {formatCurrency(wallet.lifetimeSettledAmount)}
        </span>
      )}
      {wallet.lastSettlement && (
        <span>
          {t("wallet.lastSettlement")}: {formatCurrency(wallet.lastSettlement.amount)} (
          {formatWalletDate(wallet.lastSettlement.settledAt)})
        </span>
      )}
      {wallet.withdrawalSupported === false && (
        <span className="ml-auto rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {t("wallet.withdrawalUnsupported")}
        </span>
      )}
    </div>
  );
}
