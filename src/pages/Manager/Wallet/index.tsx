import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowDown,
  FiArrowUp,
  FiClock,
  FiDollarSign,
  FiRefreshCw,
} from "react-icons/fi";
import {
  getOperatorLedger,
  getOperatorTripSettlements,
  getOperatorWallet,
  getOperatorWalletTransactions,
  type OperatorLedgerEntry,
  type OperatorWallet,
  type TripSettlement,
  type WalletTransaction,
} from "../../../api/vietride";
import Pagination from "../../../components/Pagination";

type WalletTab = "transactions" | "settlements" | "ledger";

const pageSize = 10;

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export default function ManagerWallet() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [wallet, setWallet] = useState<OperatorWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [settlements, setSettlements] = useState<TripSettlement[]>([]);
  const [ledger, setLedger] = useState<OperatorLedgerEntry[]>([]);
  const [tab, setTab] = useState<WalletTab>("transactions");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [walletResult, transactionResult, settlementResult, ledgerResult] =
        await Promise.all([
          getOperatorWallet(),
          getOperatorWalletTransactions({
            page: tab === "transactions" ? page : 1,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
          getOperatorTripSettlements({
            page: tab === "settlements" ? page : 1,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
          getOperatorLedger({
            page: tab === "ledger" ? page : 1,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
        ]);

      setWallet(walletResult);
      setTransactions(transactionResult.items);
      setSettlements(settlementResult.items);
      setLedger(ledgerResult.items);
      setTotalItems(
        tab === "transactions"
          ? transactionResult.totalItems
          : tab === "settlements"
            ? settlementResult.totalItems
            : ledgerResult.totalItems,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wallet.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, t, tab]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const tabs = useMemo(
    () =>
      (["transactions", "settlements", "ledger"] as WalletTab[]).map(
        (value) => ({ value, label: t(`wallet.tabs.${value}`) }),
      ),
    [t],
  );

  function selectTab(nextTab: WalletTab) {
    setTab(nextTab);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("wallet.title")}</h1>
          <p className="mt-1 text-gray-600">{t("wallet.apiSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          {tc("refresh")}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={<FiDollarSign />} label={t("wallet.currentBalance")} value={formatMoney(wallet?.balance ?? 0)} />
        <Metric icon={<FiClock />} label={t("wallet.pendingHold")} value={formatMoney(wallet?.pendingHoldAmount ?? 0)} />
        <Metric icon={<FiArrowDown />} label={t("wallet.eligibleAmount")} value={formatMoney(wallet?.eligibleAmount ?? 0)} />
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex border-b border-gray-200 px-4">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectTab(item.value)}
              className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === item.value
                  ? "border-vr-500 text-vr-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-gray-500">{tc("loading")}</p>
          ) : tab === "transactions" ? (
            <TransactionTable items={transactions} t={t} />
          ) : tab === "settlements" ? (
            <SettlementTable items={settlements} t={t} />
          ) : (
            <LedgerTable items={ledger} t={t} />
          )}
        </div>

        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">{icon}{label}</div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

type Translate = (key: string) => string;

function EmptyRow({ columns, t }: { columns: number; t: Translate }) {
  return <tr><td colSpan={columns} className="px-4 py-10 text-center text-sm text-gray-500">{t("wallet.empty")}</td></tr>;
}

function TransactionTable({ items, t }: { items: WalletTransaction[]; t: Translate }) {
  return (
    <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
      <th className="px-4 py-3">{t("wallet.datetime")}</th><th className="px-4 py-3">{t("wallet.type")}</th><th className="px-4 py-3">{t("wallet.descriptionCol")}</th><th className="px-4 py-3">{t("wallet.amount")}</th><th className="px-4 py-3">{t("wallet.balance")}</th><th className="px-4 py-3">{t("wallet.reference")}</th>
    </tr></thead><tbody>{items.length === 0 ? <EmptyRow columns={6} t={t} /> : items.map((item) => (
      <tr key={item.transactionId} className="border-t border-gray-100">
        <td className="px-4 py-3 text-gray-600">{formatDate(item.createdAt)}</td>
        <td className="px-4 py-3"><span className="inline-flex items-center gap-1 font-semibold">{item.type === "CREDIT" ? <FiArrowDown className="text-emerald-600" /> : <FiArrowUp className="text-red-600" />}{item.type}</span></td>
        <td className="px-4 py-3 text-gray-700">{item.note || item.referenceType}</td>
        <td className={`px-4 py-3 font-semibold ${item.type === "CREDIT" ? "text-emerald-700" : "text-red-700"}`}>{item.type === "CREDIT" ? "+" : "-"}{formatMoney(item.amount)}</td>
        <td className="px-4 py-3">{formatMoney(item.balanceAfter)}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.referenceId || "-"}</td>
      </tr>
    ))}</tbody></table>
  );
}

function SettlementTable({ items, t }: { items: TripSettlement[]; t: Translate }) {
  return (
    <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
      <th className="px-4 py-3">{t("wallet.settlementId")}</th><th className="px-4 py-3">{t("wallet.trip")}</th><th className="px-4 py-3">{t("wallet.amount")}</th><th className="px-4 py-3">{t("wallet.eligibleAt")}</th><th className="px-4 py-3">{t("wallet.statusLabel")}</th>
    </tr></thead><tbody>{items.length === 0 ? <EmptyRow columns={5} t={t} /> : items.map((item) => (
      <tr key={item.settlementId} className="border-t border-gray-100"><td className="px-4 py-3 font-mono text-xs">{item.settlementId}</td><td className="px-4 py-3 font-mono text-xs">{item.tripId}</td><td className="px-4 py-3 font-semibold">{formatMoney(item.netAmount)}</td><td className="px-4 py-3">{formatDate(item.eligibleAt)}</td><td className="px-4 py-3"><span className="rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-700">{item.status}</span></td></tr>
    ))}</tbody></table>
  );
}

function LedgerTable({ items, t }: { items: OperatorLedgerEntry[]; t: Translate }) {
  return (
    <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
      <th className="px-4 py-3">{t("wallet.datetime")}</th><th className="px-4 py-3">{t("wallet.entryType")}</th><th className="px-4 py-3">{t("wallet.trip")}</th><th className="px-4 py-3">{t("wallet.amount")}</th><th className="px-4 py-3">{t("wallet.reference")}</th>
    </tr></thead><tbody>{items.length === 0 ? <EmptyRow columns={5} t={t} /> : items.map((item) => (
      <tr key={item.ledgerEntryId} className="border-t border-gray-100"><td className="px-4 py-3">{formatDate(item.createdAt)}</td><td className="px-4 py-3 font-semibold">{item.entryType}</td><td className="px-4 py-3 font-mono text-xs">{item.tripId}</td><td className={`px-4 py-3 font-semibold ${item.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatMoney(item.amount)}</td><td className="px-4 py-3 font-mono text-xs text-gray-500">{item.referenceId}</td></tr>
    ))}</tbody></table>
  );
}
