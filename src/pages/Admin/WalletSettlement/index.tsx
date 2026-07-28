import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSettings,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import {
  adjustAdminOperatorWallet,
  adjustAdminPlatformWallet,
  getAdminPlatformWallet,
  getAdminPlatformWalletTransactions,
  getAdminTripSettlements,
  settleAdminTripSettlement,
  type AdminTripSettlementParams,
  type PlatformWallet,
  type TripSettlement,
  type TripSettlementStatus,
  type WalletTransaction,
  type WalletTransactionType,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import InvoiceRetryCard from "./InvoiceRetryCard";

const pageSize = 10;

const statusClass: Record<TripSettlementStatus, string> = {
  PENDING_HOLD: "bg-amber-50 text-amber-700",
  ELIGIBLE: "bg-blue-50 text-blue-700",
  SETTLED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const financeTabs = [
  "overview",
  "settlements",
  "transactions",
  "operations",
] as const;
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
    : "overview";
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
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustForm, setAdjustForm] = useState<{
    target: "PLATFORM" | "OPERATOR";
    operatorId: string;
    type: WalletTransactionType;
    amount: string;
    note: string;
  }>({
    target: "PLATFORM",
    operatorId: "",
    type: "CREDIT",
    amount: "",
    note: "",
  });

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
            ...settlementFilters(settlementView),
          }),
          getAdminPlatformWalletTransactions({
            page: 1,
            pageSize: 10,
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
  }, [page, settlementView, t]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) =>
      [
        record.settlementId,
        record.tripId,
        record.operatorId,
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
        (record) =>
          (record.failureCount ?? 0) > 0 || Boolean(record.severity),
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
    if (record.status !== "ELIGIBLE") {
      setMessage(t("walletSettlement.notEligible"));
      return;
    }

    setSettlingId(record.settlementId);
    setError("");
    setMessage("");

    try {
      await settleAdminTripSettlement(record.settlementId);
      setMessage(
        t("walletSettlement.settledMessage", { id: record.settlementId }),
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("walletSettlement.actionFailed"),
      );
    } finally {
      setSettlingId("");
    }
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    const amount = Number(adjustForm.amount);
    const operatorId = adjustForm.operatorId.trim();
    const note = adjustForm.note.trim();
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !note ||
      (adjustForm.target === "OPERATOR" && !operatorId)
    ) {
      setError(t("walletSettlement.adjustInvalid"));
      return;
    }

    setAdjusting(true);
    setError("");
    setMessage("");
    try {
      const request = { type: adjustForm.type, amount, note };
      if (adjustForm.target === "PLATFORM") {
        await adjustAdminPlatformWallet(request);
      } else {
        await adjustAdminOperatorWallet(operatorId, request);
      }
      setAdjustOpen(false);
      setAdjustForm({
        target: "PLATFORM",
        operatorId: "",
        type: "CREDIT",
        amount: "",
        note: "",
      });
      setMessage(t("walletSettlement.adjustSuccess"));
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("walletSettlement.actionFailed"),
      );
    } finally {
      setAdjusting(false);
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

      {activeTab === "overview" && (
        <OverviewTab
          platformBalance={platformWallet?.balance ?? 0}
          totals={totals}
          loading={loading}
          onOpenSettlements={() => selectSettlementView("NEEDS_ATTENTION")}
        />
      )}

      {activeTab === "settlements" && (
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
                {t(`walletSettlement.filters.${view}`)}
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
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                    <th className="px-4 py-3">
                      {t("walletSettlement.settlementId")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.operator")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.trip")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.amount")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.eligibleAt")}
                    </th>
                    <th className="px-4 py-3">{tc("status")}</th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.method")}
                    </th>
                    <th className="px-4 py-3">
                      {t("walletSettlement.issue")}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {tc("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
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
                      <td className="px-4 py-3 font-mono text-xs">
                        {record.settlementId}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {record.operatorId ?? "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {record.tripId}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatMoney(record.netAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(record.eligibleAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[record.status]}`}
                        >
                          {t(`walletSettlement.status.${record.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {record.settlementMethod
                          ? t(
                              `walletSettlement.methods.${record.settlementMethod}`,
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {record.activeFailureCode ? (
                          <div className="flex items-start gap-2 text-amber-700">
                            <FiAlertTriangle className="mt-0.5 shrink-0" />
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
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={
                            record.status !== "ELIGIBLE" ||
                            settlingId === record.settlementId
                          }
                          onClick={() => void triggerSettlement(record)}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title={t("walletSettlement.manualSettle")}
                          aria-label={t("walletSettlement.manualSettle")}
                        >
                          <FiCheckCircle />
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
      )}

      {activeTab === "transactions" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FiDollarSign className="text-vr-600" />
            {t("walletSettlement.latestTransactions")}
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-3">
                    {t("walletSettlement.createdAt")}
                  </th>
                  <th className="px-4 py-3">
                    {t("walletSettlement.type")}
                  </th>
                  <th className="px-4 py-3">
                    {t("walletSettlement.amount")}
                  </th>
                  <th className="px-4 py-3">
                    {t("walletSettlement.balanceAfter")}
                  </th>
                  <th className="px-4 py-3">
                    {t("walletSettlement.reference")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      {t("walletSettlement.empty")}
                    </td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr
                      key={item.transactionId}
                      className="border-t border-gray-100"
                    >
                      <td className="px-4 py-3">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold">{item.type}</td>
                      <td className="px-4 py-3">
                        {formatMoney(item.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {formatMoney(item.balanceAfter)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.referenceType}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "operations" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <FiSettings className="text-vr-600" />
                  {t("walletSettlement.adjust")}
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {t("walletSettlement.adjustHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustOpen(true)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
              >
                <FiPlus />
                {t("walletSettlement.adjust")}
              </button>
            </div>
          </section>
          <InvoiceRetryCard />
        </div>
      )}

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        icon={<FiDollarSign />}
        title={t("walletSettlement.adjust")}
        subtitle={t("walletSettlement.adjustHint")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAdjustOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              form="wallet-adjust-form"
              disabled={adjusting}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {adjusting ? tc("processing") : tc("confirm")}
            </button>
          </>
        }
      >
        <form
          id="wallet-adjust-form"
          className="space-y-4"
          onSubmit={(event) => void submitAdjustment(event)}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              {t("walletSettlement.target")}
            </span>
            <CustomSelect
              value={adjustForm.target}
              onChange={(event) =>
                setAdjustForm({
                  ...adjustForm,
                  target: event.target.value as typeof adjustForm.target,
                })
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            >
              <option value="PLATFORM">
                {t("walletSettlement.targets.PLATFORM")}
              </option>
              <option value="OPERATOR">
                {t("walletSettlement.targets.OPERATOR")}
              </option>
            </CustomSelect>
          </label>
          {adjustForm.target === "OPERATOR" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                {t("walletSettlement.operatorId")}
              </span>
              <input
                value={adjustForm.operatorId}
                onChange={(event) =>
                  setAdjustForm({
                    ...adjustForm,
                    operatorId: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                required
              />
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                {t("walletSettlement.type")}
              </span>
              <CustomSelect
                value={adjustForm.type}
                onChange={(event) =>
                  setAdjustForm({
                    ...adjustForm,
                    type: event.target.value as WalletTransactionType,
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              >
                <option value="CREDIT">Ghi có (tiền vào)</option>
                <option value="DEBIT">Ghi nợ (tiền ra)</option>
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                {t("walletSettlement.amount")}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={adjustForm.amount}
                onChange={(event) =>
                  setAdjustForm({ ...adjustForm, amount: event.target.value })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              {t("walletSettlement.note")}
            </span>
            <textarea
              value={adjustForm.note}
              onChange={(event) =>
                setAdjustForm({ ...adjustForm, note: event.target.value })
              }
              className="min-h-24 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
              required
            />
          </label>
        </form>
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

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("walletSettlement.flowTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {t("walletSettlement.flowHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettlements}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiList />
            {t("walletSettlement.openNeedsAttention")}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <FlowStep
            icon={<FiClock />}
            label={t("walletSettlement.status.PENDING_HOLD")}
            value={totals.byStatus.PENDING_HOLD}
          />
          <FlowStep
            icon={<FiCheckCircle />}
            label={t("walletSettlement.status.ELIGIBLE")}
            value={totals.byStatus.ELIGIBLE}
          />
          <FlowStep
            icon={<FiDollarSign />}
            label={t("walletSettlement.status.SETTLED")}
            value={totals.byStatus.SETTLED}
          />
          <FlowStep
            icon={<FiAlertTriangle />}
            label={t("walletSettlement.status.CANCELLED")}
            value={totals.byStatus.CANCELLED}
          />
        </div>
      </section>
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

function FlowStep({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span className="text-vr-600">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
