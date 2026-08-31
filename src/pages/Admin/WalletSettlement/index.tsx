import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiDollarSign,
  FiRefreshCw,
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
  type WalletTransactionType,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import CustomSelect from "../../../components/CustomSelect";
import { StatCard } from "../../../components/StatCard";
import { formatCurrency } from "../../../utils/currency";
import {
  displayBusinessCode,
  pickSettlementTripCode,
} from "../../../utils/businessCode";
import { SearchInput } from "../../../components/ui/SearchInput";

const pageSize = 10;

// `displayName` là tên tài khoản trong DB, KHÔNG phải chuỗi dịch — nên bình
// thường không được đụng vào. Ngoại lệ duy nhất: tài khoản hệ thống được seed
// sẵn với tên tiếng Anh cố định, không phải người thật, nên hiện alias đã dịch
// cho khớp phần còn lại của UI. Đổi tên tài khoản đó trong DB thì bỏ map này.
const SYSTEM_ACCOUNT_DISPLAY_NAMES = new Set([
  "System Admin",
  "System Administrator",
]);

function accountName(
  displayName: string | null | undefined,
  systemAdminLabel: string,
) {
  const name = displayName?.trim();
  if (!name) return "-";

  return SYSTEM_ACCOUNT_DISPLAY_NAMES.has(name) ? systemAdminLabel : name;
}

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
  return formatCurrency(value);
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [transactionType, setTransactionType] = useState<
    WalletTransactionType | ""
  >("");
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
  // Hai bảng chạy song song trong `loadData` nên mỗi bảng cần bộ đếm riêng.
  const startSettlementsRequest = useLatestRequest();
  const startTransactionsRequest = useLatestRequest();

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

  // `search` chạy server-side, TRƯỚC khi count và phân trang. Trước đây màn
  // phân trang server nhưng lại lọc `records` của đúng trang đang xem, nên gõ
  // mã nằm ở trang 3 trong khi đang ở trang 1 là ra bảng rỗng.
  const loadSettlements = useCallback(async () => {
    const isLatest = startSettlementsRequest();
    const settlementResult = await getAdminTripSettlements({
      page,
      pageSize,
      sortBy: "createdAt",
      sortDir: "desc",
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...settlementFilters(settlementView),
    });
    if (!isLatest()) return;
    setRecords(settlementResult.items);
    setTotalItems(settlementResult.totalItems);
  }, [debouncedSearch, page, settlementView, startSettlementsRequest]);

  const loadTransactions = useCallback(async () => {
    const isLatest = startTransactionsRequest();
    const transactionResult = await getAdminPlatformWalletTransactions({
      page: transactionPage,
      pageSize,
      sortBy: "createdAt",
      sortDir: "desc",
      type: transactionType || undefined,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    if (!isLatest()) return;
    setTransactions(transactionResult.items);
    setTransactionTotalItems(transactionResult.totalItems);
  }, [
    debouncedSearch,
    startTransactionsRequest,
    transactionPage,
    transactionType,
  ]);

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

  // Search đi thẳng lên BE nên phải debounce; đổi từ khoá thì cả hai tab về
  // trang 1 vì tổng số bản ghi đã khác.
  // Bỏ qua lượt chạy đầu: effect này cũng chạy lúc mount và sau đó gọi
  // `setPage(1)` dù người dùng chưa gõ gì — ai bấm sang trang trong khoảng
  // debounce đầu tiên sẽ bị đá ngược về trang 1.
  const hasFilterChanged = useRef(false);
  useEffect(() => {
    if (!hasFilterChanged.current) {
      hasFilterChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
      setTransactionPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Không còn lọc ở client: BE đã lọc trước khi phân trang nên `records` /
  // `transactions` chính là kết quả đã khớp từ khoá.
  const filteredRecords = records;
  const filteredTransactions = transactions;

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

  useToastFeedback({ message, error });
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
                ? "border-vr-500 text-vr-900"
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
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <SearchInput
                  label={t("walletSettlement.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("walletSettlement.searchPlaceholder")}
                  inputClassName="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
                  wrapperClassName="relative min-w-0 flex-1"
                />
                <CustomSelect
                  value={settlementView}
                  onChange={(event) =>
                    selectSettlementView(event.target.value as SettlementView)
                  }
                  aria-label={tc("status")}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 lg:w-64"
                >
                  {settlementViews.map((view) => (
                    <option key={view} value={view}>
                      {t(`walletSettlement.filters.${view}`)}
                    </option>
                  ))}
                </CustomSelect>
              </div>

              {/* Cột trạng thái và mã đối soát được nén lại để bảng vừa trên
                màn hình rộng vừa mở rộng nhẹ cho thời gian xử lý. */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                    <col className="w-[12%]" />
                    <col className="w-[18%]" />
                    <col className="w-[10%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-center text-[11px] font-semibold whitespace-nowrap text-gray-600">
                      <th className="px-2 py-2.5 text-left">
                        {t("walletSettlement.settlementCode")}
                      </th>
                      <th className="px-2 py-2.5 text-left">
                        {t("walletSettlement.operator")}
                      </th>
                      <th className="px-2 py-2.5 text-center">
                        {t("walletSettlement.settlementAmount")}
                      </th>
                      <th className="px-2 py-2.5 text-center">
                        {t("walletSettlement.eligibleAt")}
                      </th>
                      <th className="px-2 py-2.5 text-center">{tc("status")}</th>
                      <th className="px-2 py-2.5 text-center">
                        {t("walletSettlement.method")}
                      </th>
                      <th className="sticky right-0 z-10 bg-gray-50 px-2 py-2.5 text-center">
                        {tc("actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && filteredRecords.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-10 text-center text-gray-500"
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
                        {/* Bản admin có top-level `tripCode`; `pickSettlementTripCode`
                          vẫn dùng chung để nếu BE đổi sang snapshot thì không vỡ. */}
                        <td className="whitespace-nowrap px-2 py-2.5 text-left">
                          <p className="font-mono text-[11px] tabular-nums font-semibold text-gray-900">
                            {displayBusinessCode(record.settlementCode)}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-gray-500">
                            {displayBusinessCode(
                              pickSettlementTripCode(record),
                            )}
                          </p>
                        </td>
                        <td className="overflow-hidden px-1 py-2.5 text-left">
                          <p
                            title={
                              record.operator?.name ?? record.operatorId ?? "-"
                            }
                            className="max-w-[150px] truncate whitespace-nowrap font-semibold text-gray-900"
                          >
                            {record.operator?.name ?? record.operatorId ?? "-"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-center font-semibold">
                          {formatMoney(record.netAmount)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-center tabular-nums">
                          {formatDate(
                            record.settlementMethod === "ADMIN_MANUAL" &&
                              record.settledAt
                              ? record.settledAt
                              : record.eligibleAt,
                          )}
                        </td>
                        <td className="overflow-hidden px-1 py-2.5 text-center">
                          <span
                            className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass[record.status]}`}
                          >
                            {t(`walletSettlement.status.${record.status}`)}
                          </span>
                          {/* Mã lỗi chi trả trước đây chiếm hẳn một cột "Ghi chú"
                            trống ở gần như mọi dòng. Gắn xuống dưới chip trạng
                            thái để thẻ "Cần xử lý" trên đầu trang vẫn tra được
                            lý do ngay trên dòng bị kẹt. */}
                          {record.activeFailureCode ? (
                            <p className="mx-auto mt-1 flex max-w-[220px] items-center justify-center gap-1.5 whitespace-normal text-xs text-amber-700">
                              <FiAlertTriangle className="shrink-0" />
                              <span>
                                {t(
                                  `walletSettlement.failureCodes.${record.activeFailureCode}`,
                                  { defaultValue: record.activeFailureCode },
                                )}
                                {(record.failureCount ?? 0) > 0 &&
                                  ` (${record.failureCount})`}
                              </span>
                            </p>
                          ) : null}
                        </td>
                        <td className="overflow-hidden px-2 py-3 text-center">
                          <p
                            className="truncate"
                            title={
                              record.settlementMethod
                                ? t(
                                    `walletSettlement.methods.${record.settlementMethod}`,
                                  )
                                : "-"
                            }
                          >
                            {record.settlementMethod
                              ? t(
                                  `walletSettlement.methods.${record.settlementMethod}`,
                                )
                              : "-"}
                          </p>
                          {record.settledBy ? (
                            <p
                              className="mt-1 truncate text-xs text-gray-500"
                              title={`${t("walletSettlement.settledBy")}: ${accountName(record.settledBy.displayName, t("walletSettlement.systemAdminActor"))}`}
                            >
                              {t("walletSettlement.settledBy")}:{" "}
                              {accountName(
                                record.settledBy.displayName,
                                t("walletSettlement.systemAdminActor"),
                              )}
                            </p>
                          ) : null}
                        </td>
                        {/* Ghim cột Thao tác — bảng min-w-[1120px] nên ở laptop
                          cột này luôn nằm ngoài khung nếu không ghim. */}
                        <td className="sticky right-0 z-10 whitespace-nowrap bg-white px-2 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={
                              !canSettleManually(record.status) ||
                              settlingId === record.settlementId
                            }
                            onClick={() => setSettlementToConfirm(record)}
                            className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FiCheckCircle className="text-[12px]" />
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
            items={filteredTransactions}
            page={transactionPage}
            totalItems={transactionTotalItems}
            onPageChange={setTransactionPage}
            t={t}
            search={search}
            onSearch={setSearch}
            transactionType={transactionType}
            onTransactionTypeChange={(value) => {
              setTransactionType(value);
              setTransactionPage(1);
            }}
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
              <dt className="text-gray-600">
                {t("walletSettlement.operator")}
              </dt>
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
  const cards = [
    {
      label: t("walletSettlement.platformBalance"),
      value: formatMoney(platformBalance),
      icon: <FiDollarSign />,
      iconClassName: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t("walletSettlement.pageSettlementTotal"),
      value: formatMoney(totals.amount),
      icon: <FiArrowDown />,
      iconClassName: "bg-blue-50 text-blue-700",
    },
    {
      label: t("walletSettlement.eligible"),
      value: String(totals.eligible),
      icon: <FiCheckCircle />,
      iconClassName: "bg-violet-50 text-violet-700",
    },
    {
      label: t("walletSettlement.needsAttention"),
      value: String(totals.attention),
      icon: <FiAlertTriangle />,
      iconClassName: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <button
          key={card.label}
          type="button"
          onClick={index === 3 ? onOpenSettlements : undefined}
          className={index === 3 ? "text-left" : "cursor-default text-left"}
        >
          <StatCard {...card} value={loading ? "…" : card.value} />
        </button>
      ))}
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
  search,
  onSearch,
  transactionType,
  onTransactionTypeChange,
}: {
  items: WalletTransaction[];
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  t: Translate;
  search: string;
  onSearch: (value: string) => void;
  transactionType: WalletTransactionType | "";
  onTransactionTypeChange: (value: WalletTransactionType | "") => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <h2 className="text-center text-lg font-semibold text-gray-900">
          {t("walletSettlement.latestTransactions")}
        </h2>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            label={t("walletSettlement.searchPlaceholder")}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("walletSettlement.searchPlaceholder")}
            inputClassName="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-vr-400 focus:ring-2 focus:ring-vr-100"
            wrapperClassName="relative min-w-0 flex-1"
          />
          <CustomSelect
            value={transactionType}
            onChange={(event) =>
              onTransactionTypeChange(
                event.target.value as WalletTransactionType | "",
              )
            }
            aria-label={t("walletSettlement.allTransactionTypes")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 lg:w-56"
          >
            <option value="">
              {t("walletSettlement.allTransactionTypes")}
            </option>
            <option value="CREDIT">{t("walletSettlement.moneyIn")}</option>
            <option value="DEBIT">{t("walletSettlement.moneyOut")}</option>
          </CustomSelect>
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[1140px] text-sm">
          <thead>
            <tr className="bg-gray-50 text-center text-xs font-semibold text-gray-600">
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.transactionCode")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.createdAt")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.cashFlow")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.amount")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.balanceBefore")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.balanceAfter")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.reference")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("walletSettlement.actor")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  {t("walletSettlement.empty")}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isCredit = item.type === "CREDIT";
                return (
                  <tr
                    key={item.transactionId}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    {/* Ví nền tảng dùng mã `PWT-…`; cùng type WalletTransaction với ví
                      nhà xe nên field vẫn là `transactionCode`. */}
                    <td className="whitespace-nowrap px-4 py-3 text-center font-mono text-xs tabular-nums text-gray-700">
                      {displayBusinessCode(item.transactionCode)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-2 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}
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
                      className={`whitespace-nowrap px-4 py-3 text-center font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatMoney(item.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-gray-600">
                      {formatMoney(item.balanceBefore)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      {formatMoney(item.balanceAfter)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {t(`walletSettlement.references.${item.referenceType}`, {
                        defaultValue: item.referenceType,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.actorType === "SYSTEM"
                        ? t("walletSettlement.systemActor")
                        : accountName(
                            item.actor?.displayName,
                            t("walletSettlement.systemAdminActor"),
                          )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
