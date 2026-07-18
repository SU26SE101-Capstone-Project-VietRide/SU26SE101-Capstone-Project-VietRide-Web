import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiDollarSign,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import {
  getAdminPlatformWallet,
  getAdminPlatformWalletTransactions,
  getAdminTripSettlements,
  settleAdminTripSettlement,
  type PlatformWallet,
  type TripSettlement,
  type WalletTransaction,
} from "../../../api/vietride";
import Pagination from "../../../components/Pagination";

const pageSize = 10;

const statusClass: Record<TripSettlement["status"], string> = {
  PENDING_HOLD: "bg-amber-50 text-amber-700",
  ELIGIBLE: "bg-blue-50 text-blue-700",
  SETTLED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

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

export default function WalletSettlement() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [platformWallet, setPlatformWallet] = useState<PlatformWallet | null>(null);
  const [records, setRecords] = useState<TripSettlement[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [walletResult, settlementResult, transactionResult] =
        await Promise.all([
          getAdminPlatformWallet(),
          getAdminTripSettlements({
            page,
            pageSize,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
          getAdminPlatformWalletTransactions({
            page: 1,
            pageSize: 5,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
        ]);

      setPlatformWallet(walletResult);
      setRecords(settlementResult.items);
      setTotalItems(settlementResult.totalItems);
      setTransactions(transactionResult.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("walletSettlement.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter(
      (record) =>
        record.settlementId.toLowerCase().includes(query) ||
        record.operatorId?.toLowerCase().includes(query) ||
        record.tripId.toLowerCase().includes(query),
    );
  }, [records, search]);

  const totals = useMemo(
    () => ({
      amount: records.reduce((sum, record) => sum + record.netAmount, 0),
      eligible: records.filter((record) => record.status === "ELIGIBLE").length,
    }),
    [records],
  );

  async function triggerSettlement(record: TripSettlement) {
    if (record.status !== "ELIGIBLE") {
      setMessage(t("walletSettlement.notEligible"));
      return;
    }

    setSettlingId(record.settlementId);
    setError("");
    setMessage("");

    try {
      const updated = await settleAdminTripSettlement(record.settlementId);
      setRecords((current) =>
        current.map((item) =>
          item.settlementId === updated.settlementId ? updated : item,
        ),
      );
      setMessage(
        t("walletSettlement.settledMessage", { id: record.settlementId }),
      );
      const walletResult = await getAdminPlatformWallet();
      setPlatformWallet(walletResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("walletSettlement.actionFailed"),
      );
    } finally {
      setSettlingId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("walletSettlement.title")}</h1>
          <p className="mt-1 text-sm text-gray-600">{t("walletSettlement.apiSubtitle")}</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> {tc("refresh")}
        </button>
      </div>

      {message && <div role="status" className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800">{message}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label={t("walletSettlement.platformBalance")} value={formatMoney(platformWallet?.balance ?? 0)} />
        <Metric label={t("walletSettlement.pageSettlementTotal")} value={formatMoney(totals.amount)} />
        <Metric label={t("walletSettlement.eligible")} value={String(totals.eligible)} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="relative max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("walletSettlement.searchPlaceholder")} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <th className="px-4 py-3">{t("walletSettlement.settlementId")}</th><th className="px-4 py-3">{t("walletSettlement.operator")}</th><th className="px-4 py-3">{t("walletSettlement.trip")}</th><th className="px-4 py-3">{t("walletSettlement.amount")}</th><th className="px-4 py-3">{t("walletSettlement.eligibleAt")}</th><th className="px-4 py-3">{tc("status")}</th><th className="px-4 py-3 text-center">{tc("actions")}</th>
          </tr></thead><tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">{t("walletSettlement.empty")}</td></tr>}
            {filtered.map((record) => <tr key={record.settlementId} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{record.settlementId}</td><td className="px-4 py-3 font-mono text-xs">{record.operatorId || "-"}</td><td className="px-4 py-3 font-mono text-xs">{record.tripId}</td><td className="px-4 py-3 font-semibold">{formatMoney(record.netAmount)}</td><td className="px-4 py-3">{formatDate(record.eligibleAt)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[record.status]}`}>{t(`walletSettlement.status.${record.status}`)}</span></td>
              <td className="px-4 py-3 text-center"><button type="button" disabled={record.status !== "ELIGIBLE" || settlingId === record.settlementId} onClick={() => void triggerSettlement(record)} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40" title={t("walletSettlement.manualSettle")} aria-label={t("walletSettlement.manualSettle")}><FiCheckCircle /></button></td>
            </tr>)}
          </tbody></table>
        </div>
        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><FiDollarSign className="text-vr-600" />{t("walletSettlement.latestTransactions")}</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600"><th className="px-4 py-3">{t("walletSettlement.createdAt")}</th><th className="px-4 py-3">{t("walletSettlement.type")}</th><th className="px-4 py-3">{t("walletSettlement.amount")}</th><th className="px-4 py-3">{t("walletSettlement.balanceAfter")}</th><th className="px-4 py-3">{t("walletSettlement.reference")}</th></tr></thead><tbody>{transactions.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">{t("walletSettlement.empty")}</td></tr> : transactions.map((item) => <tr key={item.transactionId} className="border-t border-gray-100"><td className="px-4 py-3">{formatDate(item.createdAt)}</td><td className="px-4 py-3 font-semibold">{item.type}</td><td className="px-4 py-3">{formatMoney(item.amount)}</td><td className="px-4 py-3">{formatMoney(item.balanceAfter)}</td><td className="px-4 py-3 font-mono text-xs">{item.referenceType}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">{label}</p><p className="mt-2 text-2xl font-bold text-gray-900">{value}</p></div>;
}
