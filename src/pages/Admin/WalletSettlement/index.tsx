import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiDollarSign, FiEye, FiRefreshCw, FiSearch } from "react-icons/fi";
import Pagination from "../../../components/Pagination";

type SettlementStatus = "PENDING" | "ELIGIBLE" | "SETTLED" | "FAILED";

type SettlementRecord = {
  id: string;
  operator: string;
  tripCode: string;
  amount: number;
  fee: number;
  status: SettlementStatus;
  date: string;
};

const initialSettlements: SettlementRecord[] = [
  { id: "SET-240701-001", operator: "VietRide Express", tripCode: "TRP-SGN-DLT-0700", amount: 18400000, fee: 920000, status: "ELIGIBLE", date: "2026-07-01" },
  { id: "SET-240701-002", operator: "Futa Bus Lines", tripCode: "TRP-SGN-VTG-0930", amount: 12600000, fee: 630000, status: "PENDING", date: "2026-07-01" },
  { id: "SET-240630-018", operator: "Hoang Long", tripCode: "TRP-HNI-HPG-1400", amount: 22100000, fee: 1105000, status: "SETTLED", date: "2026-06-30" },
  { id: "SET-240630-019", operator: "Mai Linh Express", tripCode: "TRP-DNG-HUE-1600", amount: 9300000, fee: 465000, status: "FAILED", date: "2026-06-30" },
];

const statusClass: Record<SettlementStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  ELIGIBLE: "bg-blue-50 text-blue-700",
  SETTLED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
};

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
}

export default function WalletSettlement() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [records, setRecords] = useState(initialSettlements);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(
    () =>
      records.filter((record) => {
        const query = search.toLowerCase();
        return (
          record.operator.toLowerCase().includes(query) ||
          record.tripCode.toLowerCase().includes(query) ||
          record.id.toLowerCase().includes(query)
        );
      }),
    [records, search],
  );

  const paginatedRecords = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const totals = useMemo(
    () => ({
      amount: records.reduce((sum, record) => sum + record.amount, 0),
      fee: records.reduce((sum, record) => sum + record.fee, 0),
      eligible: records.filter((record) => record.status === "ELIGIBLE").length,
    }),
    [records],
  );

  const triggerSettlement = (id: string) => {
    const record = records.find((item) => item.id === id);
    if (!record) return;

    if (record.status !== "ELIGIBLE") {
      setMessage(t("walletSettlement.notEligible"));
      return;
    }

    setRecords((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "SETTLED" } : item,
      ),
    );
    setMessage(t("walletSettlement.settledMessage", { id }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("walletSettlement.title")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("walletSettlement.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">{t("walletSettlement.totalSettlement")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(totals.amount)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">{t("walletSettlement.platformFee")}</p>
          <p className="mt-1 text-2xl font-bold text-vr-700">{formatMoney(totals.fee)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">{t("walletSettlement.eligible")}</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{totals.eligible}</p>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800">
          {message}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("walletSettlement.searchPlaceholder")}
            />
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FiRefreshCw size={16} />
            {tc("refresh")}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <th className="px-4 py-3">{t("walletSettlement.settlementId")}</th>
                <th className="px-4 py-3">{t("walletSettlement.operator")}</th>
                <th className="px-4 py-3">{t("walletSettlement.trip")}</th>
                <th className="px-4 py-3">{t("walletSettlement.amount")}</th>
                <th className="px-4 py-3">{t("walletSettlement.fee")}</th>
                <th className="px-4 py-3">{tc("status")}</th>
                <th className="px-4 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((record) => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{record.id}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{record.operator}</td>
                  <td className="px-4 py-3 text-gray-600">{record.tripCode}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(record.amount)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(record.fee)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[record.status]}`}>
                      {t(`walletSettlement.status.${record.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-vr-600 hover:bg-vr-50" title={tc("details")} aria-label={tc("details")}>
                        <FiEye size={16} />
                      </button>
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                        onClick={() => triggerSettlement(record.id)}
                        title={t("walletSettlement.manualSettle")}
                        aria-label={t("walletSettlement.manualSettle")}
                      >
                        <FiCheckCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
        />

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <FiDollarSign className="mr-1 inline" />
          {t("walletSettlement.rule")}
        </div>
      </div>
    </div>
  );
}
