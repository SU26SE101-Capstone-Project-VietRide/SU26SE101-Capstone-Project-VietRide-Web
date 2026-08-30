import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import {
  getOperatorLedger,
  getOperatorTripSettlements,
  getOperatorWallet,
  getOperatorWalletTransactions,
  type OperatorLedgerEntry,
  type OperatorLedgerParams,
  type OperatorTripSettlementParams,
  type OperatorWallet,
  type TripSettlement,
  type TripSettlementStatus,
  type WalletTransaction,
  type WalletTransactionParams,
  type WalletTransactionType,
} from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import CustomSelect from "../../../components/CustomSelect";
import { toExclusiveUtcDayEnd, toUtcDayStart } from "../../../utils/date";
import { LedgerTable } from "./LedgerTable";
import { SettlementsTable } from "./SettlementsTable";
import { TransactionsTable } from "./TransactionsTable";
import { WalletFilters, type DateFieldOption } from "./WalletFilters";
import { WalletOverviewCards } from "./WalletOverviewCards";

type WalletTab = "transactions" | "settlements" | "ledger";

const pageSize = 10;
const inputClass =
  "h-12 w-full rounded-[9999px] border border-[#bfe1ec] bg-white px-4 py-3 text-[15px] text-slate-700 shadow-[0_0_0_1px_rgba(175,219,234,0.18)] transition placeholder:text-slate-400 focus:border-[#2bb7b0] focus:ring-4 focus:ring-[#dff7f5] lg:w-64";

const DATE_FIELD_OPTIONS: Record<WalletTab, string[]> = {
  transactions: ["createdAt"],
  settlements: ["createdAt", "tripTerminalAt", "eligibleAt", "settledAt"],
  ledger: ["createdAt", "occurredAt"],
};

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateField, setDateField] = useState("createdAt");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [transactionType, setTransactionType] = useState<
    WalletTransactionType | ""
  >("");
  const [settlementStatus, setSettlementStatus] = useState<
    TripSettlementStatus | ""
  >("");
  const startRequest = useLatestRequest();

  // Chỉ gọi API khi search rỗng hoặc đã trim >= 2 ký tự (§10) — 1 ký tự thì
  // giữ nguyên kết quả cũ, không bắn request.
  // Bỏ qua lượt chạy đầu: effect này cũng chạy lúc mount và sau đó gọi
  // `setPage(1)` dù người dùng chưa gõ gì — ai bấm sang trang trong khoảng
  // debounce đầu tiên sẽ bị đá ngược về trang 1. Giá trị debounce lúc mount vốn
  // đã bằng ô nhập nên bỏ lượt này không làm lệch state.
  const hasFilterChanged = useRef(false);
  useEffect(() => {
    if (!hasFilterChanged.current) {
      hasFilterChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed.length === 1) return;
      setDebouncedSearch(trimmed);
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    const isLatest = startRequest();
    setLoading(true);
    setError("");

    const listParams = {
      page,
      pageSize,
      sortBy: "createdAt",
      sortDir: "desc" as const,
      search: debouncedSearch || undefined,
      dateField,
      from: toUtcDayStart(dateFrom),
      to: toExclusiveUtcDayEnd(dateTo),
    };

    try {
      const walletPromise = getOperatorWallet();

      if (tab === "transactions") {
        const [walletResult, result] = await Promise.all([
          walletPromise,
          getOperatorWalletTransactions({
            ...listParams,
            dateField: "createdAt",
            type: transactionType || undefined,
          } satisfies WalletTransactionParams),
        ]);
        if (!isLatest()) return;
        setWallet(walletResult);
        setTransactions(result.items);
        setTotalItems(result.totalItems);
      } else if (tab === "settlements") {
        const [walletResult, result] = await Promise.all([
          walletPromise,
          getOperatorTripSettlements({
            ...listParams,
            dateField: dateField as OperatorTripSettlementParams["dateField"],
            status: settlementStatus || undefined,
          } satisfies OperatorTripSettlementParams),
        ]);
        if (!isLatest()) return;
        setWallet(walletResult);
        setSettlements(result.items);
        setTotalItems(result.totalItems);
      } else {
        const [walletResult, result] = await Promise.all([
          walletPromise,
          getOperatorLedger({
            ...listParams,
            dateField: dateField as OperatorLedgerParams["dateField"],
          } satisfies OperatorLedgerParams),
        ]);
        if (!isLatest()) return;
        setWallet(walletResult);
        setLedger(result.items);
        setTotalItems(result.totalItems);
      }
    } catch (err) {
      if (!isLatest()) return;
      setError(err instanceof Error ? err.message : t("wallet.loadFailed"));
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [
    dateField,
    dateFrom,
    dateTo,
    debouncedSearch,
    page,
    settlementStatus,
    startRequest,
    t,
    tab,
    transactionType,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  function selectTab(nextTab: WalletTab) {
    setTab(nextTab);
    setPage(1);
    setSearchTerm("");
    setDebouncedSearch("");
    setDateField("createdAt");
    setDateFrom("");
    setDateTo("");
  }

  const tabs: { value: WalletTab; label: string }[] = [
    { value: "transactions", label: t("wallet.tabs.transactions") },
    { value: "settlements", label: t("wallet.tabs.settlements") },
    { value: "ledger", label: t("wallet.tabs.ledger") },
  ];
  const dateFieldOptions: DateFieldOption[] = DATE_FIELD_OPTIONS[tab].map(
    (value) => ({
      value,
      label: t(`wallet.dateFieldOption.${value}`),
    }),
  );

  useToastFeedback({ error });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("wallet.title")}
          </h1>
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

      <WalletOverviewCards
        wallet={wallet}
        isLoading={loading && !wallet}
        t={t}
      />

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex border-b border-gray-200 px-4">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectTab(item.value)}
              className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === item.value
                  ? "border-vr-500 text-vr-900"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <WalletFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          dateField={dateField}
          dateFieldOptions={dateFieldOptions}
          onDateFieldChange={(value) => {
            setDateField(value);
            setPage(1);
          }}
          dateFrom={dateFrom}
          onDateFromChange={(value) => {
            setDateFrom(value);
            setPage(1);
          }}
          dateTo={dateTo}
          onDateToChange={(value) => {
            setDateTo(value);
            setPage(1);
          }}
          searchPlaceholder={t(`wallet.searchPlaceholder.${tab}`)}
          t={t}
          extraFilter={
            tab === "transactions" ? (
              <CustomSelect
                value={transactionType}
                onChange={(event) => {
                  setTransactionType(
                    event.target.value as WalletTransactionType | "",
                  );
                  setPage(1);
                }}
                aria-label={t("wallet.allTransactionTypes")}
                className={inputClass}
              >
                <option value="">{t("wallet.allTransactionTypes")}</option>
                <option value="CREDIT">{t("wallet.moneyIn")}</option>
                <option value="DEBIT">{t("wallet.moneyOut")}</option>
              </CustomSelect>
            ) : tab === "settlements" ? (
              <CustomSelect
                value={settlementStatus}
                onChange={(event) => {
                  setSettlementStatus(
                    event.target.value as TripSettlementStatus | "",
                  );
                  setPage(1);
                }}
                aria-label={t("wallet.allSettlementStatuses")}
                className={inputClass}
              >
                <option value="">{t("wallet.allSettlementStatuses")}</option>
                {(
                  [
                    "PENDING_HOLD",
                    "ELIGIBLE",
                    "SETTLED",
                    "CANCELLED",
                  ] as TripSettlementStatus[]
                ).map((status) => (
                  <option key={status} value={status}>
                    {t(`wallet.status.${status}`)}
                  </option>
                ))}
              </CustomSelect>
            ) : null
          }
        />

        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {tc("loading")}
            </p>
          ) : tab === "transactions" ? (
            <TransactionsTable items={transactions} t={t} tc={tc} />
          ) : tab === "settlements" ? (
            <SettlementsTable items={settlements} t={t} tc={tc} />
          ) : (
            <LedgerTable items={ledger} t={t} tc={tc} />
          )}
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
