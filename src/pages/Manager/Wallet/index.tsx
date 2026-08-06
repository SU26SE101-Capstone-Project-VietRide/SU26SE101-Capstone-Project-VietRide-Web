import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
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
  type TripSettlementStatus,
  type WalletTransaction,
  type WalletTransactionType,
} from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import CustomSelect from "../../../components/CustomSelect";
import { StatCard } from "../../../components/StatCard";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionType, setTransactionType] = useState<WalletTransactionType | "">("");
  const [settlementStatus, setSettlementStatus] = useState<TripSettlementStatus | "">("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const walletPromise = getOperatorWallet();

      if (tab === "transactions") {
        const [walletResult, transactionResult] = await Promise.all([
          walletPromise,
          getOperatorWalletTransactions({
            page,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
            type: transactionType || undefined,
          }),
        ]);

        setWallet(walletResult);
        setTransactions(transactionResult.items);
        setTotalItems(transactionResult.totalItems);
      } else if (tab === "settlements") {
        const [walletResult, settlementResult] = await Promise.all([
          walletPromise,
          getOperatorTripSettlements({
            page,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
            status: settlementStatus || undefined,
          }),
        ]);

        setWallet(walletResult);
        setSettlements(settlementResult.items);
        setTotalItems(settlementResult.totalItems);
      } else {
        const [walletResult, ledgerResult] = await Promise.all([
          walletPromise,
          getOperatorLedger({
            page,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
        ]);

        setWallet(walletResult);
        setLedger(ledgerResult.items);
        setTotalItems(ledgerResult.totalItems);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wallet.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, settlementStatus, t, tab, transactionType]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTransactions = useMemo(
    () => transactions.filter((item) => {
      if (!normalizedSearch) return true;
      return [item.transactionId, item.referenceType, item.note].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
    }),
    [normalizedSearch, transactions],
  );
  const filteredSettlements = useMemo(
    () => settlements.filter((item) => {
      if (!normalizedSearch) return true;
      return [item.settlementId, item.tripId, item.settlementMethod, item.status].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
    }),
    [normalizedSearch, settlements],
  );
  const filteredLedger = useMemo(
    () => ledger.filter((item) => {
      if (!normalizedSearch) return true;
      return [item.ledgerEntryId, item.tripId, item.entryType, item.referenceType, item.note].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
    }),
    [ledger, normalizedSearch],
  );
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

  useToastFeedback({ error });
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


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FiDollarSign />} label={t("wallet.currentBalance")} value={formatMoney(wallet?.balance ?? 0)} iconClassName="bg-emerald-50 text-emerald-700" />
        <StatCard icon={<FiClock />} label={t("wallet.pendingHold")} value={formatMoney(wallet?.pendingHoldAmount ?? 0)} iconClassName="bg-amber-50 text-amber-700" />
        <StatCard icon={<FiArrowDown />} label={t("wallet.eligibleAmount")} value={formatMoney(wallet?.eligibleAmount ?? 0)} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard icon={<FiCheckCircle />} label={t("wallet.settledAmount")} value={formatMoney(settlements.filter((item) => item.status === "SETTLED").reduce((sum, item) => sum + item.netAmount, 0))} iconClassName="bg-violet-50 text-violet-700" />
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

        <div className="border-b border-gray-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("wallet.searchPlaceholder")}
              className="w-full flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100"
            />
            {tab === "transactions" && (
              <CustomSelect value={transactionType} onChange={(event) => { setTransactionType(event.target.value as WalletTransactionType | ""); setPage(1); }} aria-label={t("wallet.allTransactionTypes")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 lg:w-72">
                <option value="">{t("wallet.allTransactionTypes")}</option>
                <option value="CREDIT">{t("wallet.moneyIn")}</option>
                <option value="DEBIT">{t("wallet.moneyOut")}</option>
              </CustomSelect>
            )}
            {tab === "settlements" && (
              <CustomSelect value={settlementStatus} onChange={(event) => { setSettlementStatus(event.target.value as TripSettlementStatus | ""); setPage(1); }} aria-label={t("wallet.allSettlementStatuses")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 lg:w-72">
                <option value="">{t("wallet.allSettlementStatuses")}</option>
                {(["PENDING_HOLD", "ELIGIBLE", "SETTLED", "CANCELLED"] as TripSettlementStatus[]).map((status) => <option key={status} value={status}>{t(`wallet.status.${status}`)}</option>)}
              </CustomSelect>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-gray-500">{tc("loading")}</p>
          ) : tab === "transactions" ? (
            <TransactionTable items={filteredTransactions} t={t} />
          ) : tab === "settlements" ? (
            <SettlementTable items={filteredSettlements} t={t} />
          ) : (
            <LedgerTable items={filteredLedger} t={t} />
          )}
        </div>

        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      </section>
    </div>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function EmptyRow({ columns, t }: { columns: number; t: Translate }) {
  return <tr><td colSpan={columns} className="px-4 py-10 text-center text-sm text-gray-500">{t("wallet.empty")}</td></tr>;
}
function settlementStatusClass(status: TripSettlementStatus) {
  switch (status) {
    case "SETTLED": return "bg-emerald-50 text-emerald-700";
    case "ELIGIBLE": return "bg-blue-50 text-blue-700";
    case "PENDING_HOLD": return "bg-amber-50 text-amber-800";
    case "CANCELLED": return "bg-red-50 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}
function TransactionTable({ items, t }: { items: WalletTransaction[]; t: Translate }) {
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full table-fixed text-sm">
        <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
          <th className="px-4 py-3">{t("wallet.time")}</th>
          <th className="px-4 py-3">{t("wallet.cashFlow")}</th>
          <th className="px-4 py-3">{t("wallet.change")}</th>
          <th className="px-4 py-3">{t("wallet.balanceBeforeShort")}</th>
          <th className="px-4 py-3">{t("wallet.balanceAfter")}</th>
          <th className="px-4 py-3">{t("wallet.transactionType")}</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <EmptyRow columns={6} t={t} /> : items.map((item) => {
            const isCredit = item.type === "CREDIT";
            return <tr key={item.transactionId} className="border-t border-gray-100">
              <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(item.createdAt)}</td>
              <td className={`px-4 py-3 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}>
                {isCredit ? <FiArrowDown className="mr-2 inline" /> : <FiArrowUp className="mr-2 inline" />}
                {t(isCredit ? "wallet.moneyIn" : "wallet.moneyOut")}
              </td>
              <td className={`whitespace-nowrap px-4 py-3 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}>{isCredit ? "+" : "-"}{formatMoney(item.amount)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatMoney(item.balanceBefore)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatMoney(item.balanceAfter)}</td>
              <td className="px-4 py-3 text-gray-700">{t(`wallet.references.${item.referenceType}`, { defaultValue: item.note || item.referenceType })}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
function SettlementTable({ items, t }: { items: TripSettlement[]; t: Translate }) {
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full table-fixed text-sm">
        <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
          <th className="px-4 py-3">{t("wallet.paymentTime")}</th>
          <th className="px-4 py-3">{t("wallet.receivedAmount")}</th>
          <th className="px-4 py-3">{t("wallet.statusLabel")}</th>
          <th className="px-4 py-3">{t("wallet.form")}</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <EmptyRow columns={4} t={t} /> : items.map((item) => {
            return <tr key={item.settlementId} className="border-t border-gray-100">
              <td className="whitespace-nowrap px-4 py-3">{formatDate(item.settlementMethod === "ADMIN_MANUAL" && item.settledAt ? item.settledAt : item.eligibleAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatMoney(item.netAmount)}</td>
              <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${settlementStatusClass(item.status)}`}>{t(`wallet.status.${item.status}`)}</span></td>
              <td className="px-4 py-3">{item.settlementMethod ? <><span>{t(`wallet.methods.${item.settlementMethod}`)}</span>{item.settlementMethod === "ADMIN_MANUAL" && item.settledBy?.displayName ? <p className="mt-1 text-xs text-gray-500">{t("wallet.settledBy")}: {item.settledBy.displayName}</p> : null}</> : "-"}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
function LedgerTable({ items, t }: { items: OperatorLedgerEntry[]; t: Translate }) {
  const { t: tc } = useTranslation("common");
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead><tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
          <th className="px-4 py-3">{t("wallet.datetime")}</th>
          <th className="px-4 py-3">{t("wallet.entryType")}</th>
          <th className="px-4 py-3">{t("wallet.amount")}</th>
          <th className="px-4 py-3">{t("wallet.actor")}</th>
          <th className="px-4 py-3">{t("wallet.note")}</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <EmptyRow columns={5} t={t} /> : items.map((item) => (
            <tr key={item.ledgerEntryId} className="border-t border-gray-100">
              <td className="whitespace-nowrap px-4 py-3">{formatDate(item.createdAt)}</td>
              <td className="px-4 py-3 font-semibold">{tc("enumLabels." + item.entryType, { defaultValue: item.entryType })}</td>
              <td className={"whitespace-nowrap px-4 py-3 font-semibold " + (item.amount < 0 ? "text-red-700" : "text-emerald-700")}>{formatMoney(item.amount)}</td>
              <td className="px-4 py-3">{item.actor?.displayName || tc("enumLabels.SYSTEM", { defaultValue: item.actorType || "-" })}</td>
              <td className="px-4 py-3 text-gray-600">{item.note || t("wallet.noNote")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
