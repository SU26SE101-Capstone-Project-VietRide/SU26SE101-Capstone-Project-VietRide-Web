import { FiDollarSign, FiUsers } from "react-icons/fi";
import type { AdminWalletReconciliationSummary } from "../../../api/vietride";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { StatCard } from "../../../components/StatCard";
import { formatCurrency } from "../../../utils/currency";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function ReconciliationOverview({
  summary,
  loading,
  from,
  to,
  onFromChange,
  onToChange,
  t,
}: {
  summary: AdminWalletReconciliationSummary | null;
  loading: boolean;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  t: Translate;
}) {
  const snapshot = summary?.snapshot;
  const period = summary?.period;
  const pairIncomplete = Boolean(from) !== Boolean(to);

  const snapshotCards = [
    {
      label: t("walletSettlement.reconciliation.platformBalance"),
      value: snapshot?.platformWalletBalanceVnd ?? 0,
      icon: <FiDollarSign />,
      iconClassName: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t("walletSettlement.reconciliation.outstandingPayable"),
      value: snapshot?.outstandingOperatorPayableVnd ?? 0,
      icon: <FiUsers />,
      iconClassName: "bg-violet-50 text-violet-700",
    },
    ...(period
      ? [
          {
            label: t("walletSettlement.reconciliation.subscriptionRevenue"),
            value: period?.subscriptionRevenueVnd ?? 0,
            icon: <FiDollarSign />,
            iconClassName: "bg-blue-50 text-blue-700",
          },
          {
            label: t("walletSettlement.reconciliation.paidToOperators"),
            value: period?.paidToOperatorsVnd ?? 0,
            icon: <FiUsers />,
            iconClassName: "bg-amber-50 text-amber-700",
          },
        ]
      : []),
  ];

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">
              {t("walletSettlement.reconciliation.title")}
            </h2>
            {snapshot && snapshot.partialReconciliationTransactionCount > 0 && (
              <span
                title={t("walletSettlement.reconciliation.partialWarning", {
                  count: snapshot.partialReconciliationTransactionCount,
                })}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
              >
                {t("walletSettlement.reconciliation.partialCount", {
                  count: snapshot.partialReconciliationTransactionCount,
                })}
              </span>
            )}
          </div>
          {period && (
            <p className="text-sm text-slate-600">
              {t("walletSettlement.reconciliation.periodTitle")}: {period.from}{" "}
              – {period.to}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomDateTimeInput
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            placeholder={t("walletSettlement.reconciliation.from")}
          />
          <span className="text-sm text-slate-500">–</span>
          <CustomDateTimeInput
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            placeholder={t("walletSettlement.reconciliation.to")}
          />
        </div>
      </div>

      {pairIncomplete && (
        <p className="text-sm font-medium text-amber-700">
          {t("walletSettlement.reconciliation.datePairRequired")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {snapshotCards.map((card) => (
          <StatCard
            key={card.label}
            {...card}
            value={loading ? "…" : formatCurrency(card.value)}
          />
        ))}
      </div>
    </section>
  );
}
