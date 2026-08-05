import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiDollarSign,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import {
  getAdminPlatformWallet,
  getAdminPlatformWalletTransactions,
  getAdminTripSettlements,
  settleAdminTripSettlement,
  type AdminTripSettlementParams,
  type PlatformWallet,
  type TripSettlement,
  type TripSettlementStatus,
  type WalletTransaction,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";

const pageSize = 10;

const statusClass: Record<TripSettlementStatus, string> = {
  PENDING_HOLD: "bg-amber-50 text-amber-700",
  ELIGIBLE: "bg-blue-50 text-blue-700",
  SETTLED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const financeTabs = ["settlements", "transactions"] as const;
type FinanceTab = (typeof financeTabs)[number];

const settlementViews = [
  "ALL",
  "NEEDS_ATTENTION",
  "PENDING_HOLD",
  "ELIGIBLE",
  "SETTLED",
  "CANCELLED",
] as const;
type SettlementView = (typeof settlementViews)[number];

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function canSettleManually(status: TripSettlementStatus) {
  return status === "PENDING_HOLD" || status === "ELIGIBLE";
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

function parseFinanceTab(value: string | null): FinanceTab {
  return financeTabs.includes(value as FinanceTab)
    ? (value as FinanceTab)
    : "settlements";
}

function parseSettlementView(value: string | null): SettlementView {
  const normalized = value?.replaceAll("-", "_").toUpperCase();
  return settlementViews.includes(normalized as SettlementView)
    ? (normalized as SettlementView)
    : "ALL";
}

function settlementViewQuery(view: SettlementView) {
  return view.toLowerCase().replaceAll("_", "-");
}

function settlementFilters(
  view: SettlementView,
): Pick<AdminTripSettlementParams, "status" | "stuckOnly"> {
  if (view === "NEEDS_ATTENTION") {
    return { stuckOnly: true };
  }

  if (view === "ALL") {
    return {};
  }

  return { status: view };
}

export default function WalletSettlement() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseFinanceTab(searchParams.get("tab"));
  const settlementView = parseSettlementView(searchParams.get("filter"));
  const [platformWallet, setPlatformWallet] = useState<PlatformWallet | null>(
    null,
  );
  const [records, setRecords] = useState<TripSettlement[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalItems, setTransactionTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState("");
  const [settlementToConfirm, setSettlementToConfirm] =
    useState<TripSettlement | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  // Đếm số request đang chạy để `loading` chỉ tắt khi tất cả xong
  const pendingLoadsRef = useRef(0);

  const runLoad = useCallback(async (task: () => Promise<unknown>) => {
    pendingLoadsRef.current += 1;
    setLoading(true);
    setError("");

    try {
      await task();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tRef.current("walletSettlement.loadFailed"),
      );
    } finally {
      pendingLoadsRef.current -= 1;
      if (pendingLoadsRef.current === 0) {
        setLoading(false);
      }
    }
  }, []);

  const loadWallet = useCallback(async () => {
    const walletResult = await getAdminPlatformWallet();
    setPlatformWallet(walletResult);
  }, []);

  const loadSettlements = useCallback(async () => {
    const settlementResult = await getAdminTripSettlements({
      page,
      pageSize,
      sortBy: "createdAt",
      sortDir: "desc",
      ...settlementFilters(settlementView),
    });
    setRecords(settlementResult.items);
    setTotalItems(settlementResult.totalItems);
  }, [page, settlementView]);

  const loadTransactions = useCallback(async () => {
    const transactionResult = await getAdminPlatformWalletTransactions({
      page: transactionPage,
      pageSize,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    setTransactions(transactionResult.items);
    setTransactionTotalItems(transactionResult.totalItems);
  }, [transactionPage]);

  // Refresh toàn bộ: dùng cho nút refresh và sau khi settle thủ công
  const loadData = useCallback(
    () =>
      runLoad(() =>
        Promise.all([loadWallet(), loadSettlements(), loadTransactions()]),
      ),
    [loadSettlements, loadTransactions, loadWallet, runLoad],
  );

  // Ví chỉ load lúc mount (và sau settle qua loadData)
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runLoad(loadWallet);
    });

    return () => {
      cancelled = true;
    };
  }, [loadWallet, runLoad]);

  // Settlements load theo page / filter đang xem
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runLoad(loadSettlements);
    });

    return () => {
      cancelled = true;
    };
  }, [loadSettlements, runLoad]);

  // Transactions load theo trang giao dịch
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runLoad(loadTransactions);
    });

    return () => {
      cancelled = true;
    };
  }, [loadTransactions, runLoad]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) =>
      [
        record.settlementId,
        record.tripId,
        record.operatorId,
        record.operator?.name,
        record.settledBy?.displayName,
        record.status,
        record.settlementMethod,
        record.activeFailureCode,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [records, search]);

  const totals = useMemo(
    () => ({
      amount: records.reduce((sum, record) => sum + record.netAmount, 0),
      eligible: records.filter((record) => record.status === "ELIGIBLE").length,
      attention: records.filter(
        (record) => (record.failureCount ?? 0) > 0 || Boolean(record.severity),
      ).length,
      byStatus: {
        PENDING_HOLD: records.filter(
          (record) => record.status === "PENDING_HOLD",
        ).length,
        ELIGIBLE: records.filter((record) => record.status === "ELIGIBLE")
          .length,
        SETTLED: records.filter((record) => record.status === "SETTLED").length,
        CANCELLED: records.filter((record) => record.status === "CANCELLED")
          .length,
      },
    }),
    [records],
  );

  const settlementViewCounts: Record<SettlementView, number> = {
    ALL: totalItems,
    NEEDS_ATTENTION: totals.attention,
    PENDING_HOLD: totals.byStatus.PENDING_HOLD,
    ELIGIBLE: totals.byStatus.ELIGIBLE,
    SETTLED: totals.byStatus.SETTLED,
    CANCELLED: totals.byStatus.CANCELLED,
  };

  function selectTab(tab: FinanceTab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }

  function selectSettlementView(view: SettlementView) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "settlements");
    next.set("filter", settlementViewQuery(view));
    setPage(1);
    setSearch("");
    setSearchParams(next, { replace: true });
  }

  async function triggerSettlement(record: TripSettlement) {
    if (!canSettleManually(record.status)) {
      setMessage(t("walletSettlement.notEligible"));
      return;
    }

    setSettlingId(record.settlementId);
    setError("");
    setMessage("");

    try {
      await settleAdminTripSettlement(record.settlementId);
      setMessage(
        t("walletSettlement.settledMessage", {
          operator:
            record.operator?.name ?? t("walletSettlement.operatorFallback"),
        }),
      );
      setSettlementToConfirm(null);
      await loadData();
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
          <h1 className="text-3xl font-bold text-gray-900">
            {t("walletSettlement.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("walletSettlement.apiSubtitle")}
          </p>
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

      {message && (
        <div
          role="status"
          className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <OverviewTab
        platformBalance={platformWallet?.balance ?? 0}
        totals={totals}
        loading={loading}
        onOpenSettlements={() => selectSettlementView("NEEDS_ATTENTION")}
      />

      <nav
        aria-label={t("walletSettlement.financeSections")}
        className="flex flex-wrap gap-2 border-b border-gray-200"
      >
        {financeTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => selectTab(tab)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab
                ? "border-vr-500 text-vr-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t(`walletSettlement.tabs.${tab}`)}
          </button>
        ))}
      </nav>

      {activeTab === "settlements" && (
        <>
          <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settlementViews.map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={settlementView === view}
                onClick={() => selectSettlementView(view)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  settlementView === view
                    ? "border-vr-500 bg-vr-50 text-vr-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>{t(`walletSettlement.filters.${view}`)}</span>
                <span
                  className={`ml-1.5 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${
                    settlementView === view
                      ? "bg-vr-100 text-vr-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {settlementViewCounts[view]}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="relative max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("walletSettlement.searchPlaceholder")}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold whitespace-nowrap text-gray-600">
                    <th className="px-4 py-3">
                      {t("walletSettlement.operator")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.settlementAmount")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.eligibleAt")}
                    </th>
                    <th className="px-4 py-3">{tc("status")}</th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.method")}
                    </th>
                    <th className="px-4 py-3">{t("walletSettlement.issue")}</th>
                    <th className="px-4 py-3 text-center">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        {t("walletSettlement.empty")}
                      </td>
                    </tr>
                  )}
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.settlementId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          {record.operator?.logoUrl ? (
                            <img
                              src={record.operator.logoUrl}
                              alt=""
                              width={32}
                              height={32}
                              loading="lazy"
                              className="h-8 w-8 rounded-lg object-cover"
                            />
                          ) : null}
                          <p className="font-medium text-gray-900">
                            {record.operator?.name ?? record.operatorId ?? "-"}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        {formatMoney(record.netAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(
                          record.settlementMethod === "ADMIN_MANUAL" && record.settledAt
                            ? record.settledAt
                            : record.eligibleAt,
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[record.status]}`}
                        >
                          {t(`walletSettlement.status.${record.status}`)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p>
                          {record.settlementMethod
                            ? t(
                                `walletSettlement.methods.${record.settlementMethod}`,
                              )
                            : "-"}
                        </p>
                        {record.settledBy ? (
                          <p className="mt-1 text-xs text-gray-500">
                            {t("walletSettlement.settledBy")}:{" "}
                            {record.settledBy.displayName}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {record.activeFailureCode ? (
                          <div className="flex items-center gap-2 text-amber-700">
                            <FiAlertTriangle className="shrink-0" />
                            <span>
                              {record.activeFailureCode}
                              {(record.failureCount ?? 0) > 0 &&
                                ` (${record.failureCount})`}
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={
                            !canSettleManually(record.status) ||
                            settlingId === record.settlementId
                          }
                          onClick={() => setSettlementToConfirm(record)}
                          className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiCheckCircle />
                          {t("walletSettlement.manualSettle")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
            />
          </div>
        </section>
        </>
      )}

      {activeTab === "transactions" && (
        <>
          <WalletTransactionTable
            items={transactions}
            page={transactionPage}
            totalItems={transactionTotalItems}
            onPageChange={setTransactionPage}
            t={t}
          />
        </>
      )}

      <Modal
        open={Boolean(settlementToConfirm)}
        onClose={() => setSettlementToConfirm(null)}
        icon={<FiDollarSign />}
        title={t("walletSettlement.manualSettle")}
        subtitle={t("walletSettlement.manualSettleHint")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setSettlementToConfirm(null)}
              disabled={Boolean(settlingId)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (settlementToConfirm) {
                  void triggerSettlement(settlementToConfirm);
                }
              }}
              disabled={Boolean(settlingId)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {settlingId
                ? tc("processing")
                : t("walletSettlement.confirmManualSettle")}
            </button>
          </>
        }
      >
        {settlementToConfirm && (
          <dl className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">{t("walletSettlement.operator")}</dt>
              <dd className="text-right font-semibold text-gray-900">
                {settlementToConfirm.operator?.name ??
                  settlementToConfirm.operatorId ??
                  "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">
                {t("walletSettlement.settlementAmount")}
              </dt>
              <dd className="text-lg font-bold text-emerald-700">
                {formatMoney(settlementToConfirm.netAmount)}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

   </div>
  );
}

function OverviewTab({
  platformBalance,
  totals,
  loading,
  onOpenSettlements,
}: {
  platformBalance: number;
  totals: {
    amount: number;
    eligible: number;
    attention: number;
    byStatus: Record<TripSettlementStatus, number>;
  };
  loading: boolean;
  onOpenSettlements: () => void;
}) {
  const { t } = useTranslation("admin");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t("walletSettlement.platformBalance")}
          value={formatMoney(platformBalance)}
          isLoading={loading}
        />
        <Metric
          label={t("walletSettlement.pageSettlementTotal")}
          value={formatMoney(totals.amount)}
          isLoading={loading}
        />
        <Metric
          label={t("walletSettlement.eligible")}
          value={String(totals.eligible)}
          isLoading={loading}
        />
        <Metric
          label={t("walletSettlement.needsAttention")}
          value={String(totals.attention)}
          isLoading={loading}
          action={onOpenSettlements}
        />
      </div>

    </div>
  );
}

function Metric({
  label,
  value,
  isLoading,
  action,
}: {
  label: string;
  value: string;
  isLoading: boolean;
  action?: () => void;
}) {
  const content = (
    <>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {isLoading ? "…" : value}
      </p>
    </>
  );

  if (action) {
    return (
      <button
        type="button"
        onClick={action}
        className="rounded-lg border border-gray-200 bg-white p-5 text-left transition hover:border-vr-300 hover:bg-vr-50/40"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      {content}
    </div>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function WalletTransactionTable({
  items,
  page,
  totalItems,
  onPageChange,
  t,
}: {
  items: WalletTransaction[];
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  t: Translate;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("walletSettlement.latestTransactions")}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <th className="px-4 py-3">{t("walletSettlement.createdAt")}</th>
                <th className="px-4 py-3">{t("walletSettlement.cashFlow")}</th>
                <th className="px-4 py-3">{t("walletSettlement.amount")}</th>
                <th className="px-4 py-3">
                  {t("walletSettlement.balanceBefore")}
                </th>
                <th className="px-4 py-3">
                  {t("walletSettlement.balanceAfter")}
                </th>
                <th className="px-4 py-3">{t("walletSettlement.reference")}</th>
                <th className="px-4 py-3">{t("walletSettlement.actor")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t("walletSettlement.empty")}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isCredit = item.type === "CREDIT";

                  return (
                    <tr key={item.transactionId} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-2 font-semibold ${
                            isCredit ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {isCredit ? <FiArrowDown /> : <FiArrowUp />}
                          {t(
                            isCredit
                              ? "walletSettlement.moneyIn"
                              : "walletSettlement.moneyOut",
                          )}
                        </span>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          isCredit ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatMoney(item.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatMoney(item.balanceBefore)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        {formatMoney(item.balanceAfter)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">
                          {t(`walletSettlement.references.${item.referenceType}`, {
                            defaultValue: item.referenceType,
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {item.actorType === "SYSTEM"
                          ? t("walletSettlement.systemActor")
                          : (item.actor?.displayName ?? "-")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </section>
  );
}
