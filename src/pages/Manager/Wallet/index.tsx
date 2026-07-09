import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowDown,
  FiArrowUp,
  FiDownload,
  FiFilter,
  FiPlus,
  FiSearch,
  FiClock,
  FiCheck,
  FiAlertCircle,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import CurrencyInput from "../../../components/CurrencyInput";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";

type TransactionType = "topup" | "payment" | "refund";
type TransactionStatus = "pending" | "completed" | "failed";

type WalletTransaction = {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  amount: number;
  balance: number;
  status: TransactionStatus;
  reference?: string;
};

const mockTransactions: WalletTransaction[] = [
  {
    id: "TXN-001",
    date: "2026-05-24 10:30",
    type: "topup",
    description: "Nạp tiền qua VNPay",
    amount: 500,
    balance: 5284.3,
    status: "completed",
    reference: "VNP-20260524-001",
  },
  {
    id: "TXN-002",
    date: "2026-05-23 14:15",
    type: "payment",
    description: "Phí duyệt chuyến VR-2401",
    amount: 284,
    balance: 4784.3,
    status: "completed",
    reference: "BK-VR2401",
  },
  {
    id: "TXN-003",
    date: "2026-05-23 09:45",
    type: "payment",
    description: "Phí duyệt chuyến VR-2399",
    amount: 256,
    balance: 5068.3,
    status: "completed",
  },
  {
    id: "TXN-004",
    date: "2026-05-22 16:20",
    type: "refund",
    description: "Hoàn tiền hủy chuyến VR-2395",
    amount: 120,
    balance: 5324.3,
    status: "completed",
    reference: "REF-VR2395",
  },
  {
    id: "TXN-005",
    date: "2026-05-22 11:00",
    type: "topup",
    description: "Nạp tiền qua VNPay",
    amount: 300,
    balance: 5204.3,
    status: "completed",
    reference: "VNP-20260522-002",
  },
  {
    id: "TXN-006",
    date: "2026-05-21 08:30",
    type: "payment",
    description: "Phí duyệt chuyến VR-2388",
    amount: 195,
    balance: 5399.3,
    status: "completed",
  },
];

const monthlyData = [
  { month: "Tháng 1", topup: 2000, payment: 1240, refund: 180 },
  { month: "Tháng 2", topup: 2100, payment: 1420, refund: 210 },
  { month: "Tháng 3", topup: 2300, payment: 1650, refund: 150 },
  { month: "Tháng 4", topup: 2500, payment: 1880, refund: 320 },
  { month: "Tháng 5", topup: 2800, payment: 2150, refund: 280 },
];

export default function ManagerWallet() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [transactions] = useState<WalletTransaction[]>(mockTransactions);
  const [openTopUp, setOpenTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const transactionTypeDistribution = useMemo(
    () => [
      { name: t("wallet.topupType"), value: 32, color: "#10b981" },
      { name: t("wallet.expenseType"), value: 56, color: "#ef4444" },
      { name: t("wallet.refundType"), value: 12, color: "#f59e0b" },
    ],
    [t],
  );

  const stats = useMemo(() => {
    const totalTopUp = transactions
      .filter((txn) => txn.type === "topup" && txn.status === "completed")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const totalPayment = transactions
      .filter((txn) => txn.type === "payment" && txn.status === "completed")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const totalRefund = transactions
      .filter((txn) => txn.type === "refund" && txn.status === "completed")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const currentBalance =
      transactions.length > 0 ? transactions[0].balance : 0;

    return {
      currentBalance,
      totalTopUp,
      totalPayment,
      totalRefund,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      const q = search.toLowerCase();
      return (
        !q ||
        txn.id.toLowerCase().includes(q) ||
        txn.description.toLowerCase().includes(q) ||
        txn.reference?.toLowerCase().includes(q)
      );
    });
  }, [search, transactions]);

  const handleTopUp = () => {
    if (!topUpAmount || isNaN(Number(topUpAmount))) return;
    alert(t("wallet.topupAlert", { amount: topUpAmount }));
    setOpenTopUp(false);
    setTopUpAmount("");
  };

  const paginatedTransactions = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
            <FiCheck size={14} /> {t("wallet.success")}
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
            <FiClock size={14} /> {t("wallet.pending")}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
            <FiAlertCircle size={14} /> {t("wallet.failed")}
          </span>
        );
    }
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case "topup":
        return <FiArrowDown className="text-green-500" />;
      case "payment":
        return <FiArrowUp className="text-red-500" />;
      case "refund":
        return <FiArrowDown className="text-amber-500" />;
    }
  };

  const getTransactionTypeLabel = (type: TransactionType) => {
    switch (type) {
      case "topup":
        return t("wallet.topupType");
      case "payment":
        return t("wallet.expenseType");
      case "refund":
        return t("wallet.refundType");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("wallet.title")}
          </h1>
          <p className="text-gray-600 mt-1">{t("wallet.subtitleShort")}</p>
        </div>
        <button
          onClick={() => setOpenTopUp(true)}
          className="flex items-center gap-2 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
        >
          <FiPlus size={18} /> {t("wallet.topup")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("wallet.currentBalance")}
          </p>
          <p className="text-3xl font-bold text-vr-600 mt-2">
            đ{stats.currentBalance.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">{t("wallet.billionVnd")}</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("wallet.totalTopup")}
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            đ{stats.totalTopUp.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">{t("wallet.billionVnd")}</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("wallet.totalExpense")}
          </p>
          <p className="text-3xl font-bold text-red-600 mt-2">
            đ{stats.totalPayment.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">{t("wallet.billionVnd")}</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("wallet.refund")}
          </p>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            đ{stats.totalRefund.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">{t("wallet.billionVnd")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t("wallet.monthlyHistory")}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                dataKey="topup"
                name={t("wallet.topupType")}
                fill="#10b981"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="payment"
                name={t("wallet.expenseType")}
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="refund"
                name={t("wallet.refundType")}
                fill="#f59e0b"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t("wallet.distribution")}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={transactionTypeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {transactionTypeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("wallet.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiFilter size={16} /> {tc("filter")}
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiDownload size={16} /> {tc("exportCsv")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("wallet.datetime")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("wallet.type")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("wallet.descriptionCol")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("wallet.amount")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("wallet.balance")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {tc("status")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("wallet.reference")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-700">{txn.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(txn.type)}
                      <span className="font-medium">
                        {getTransactionTypeLabel(txn.type)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{txn.description}</td>
                  <td className="px-4 py-3 font-semibold">
                    <span
                      className={
                        txn.type === "topup" || txn.type === "refund"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {txn.type === "topup" || txn.type === "refund"
                        ? "+"
                        : "-"}
                      đ{txn.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    đ{txn.balance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(txn.status)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {txn.reference || "—"}
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
      </div>

      <Modal
        open={openTopUp}
        onClose={() => setOpenTopUp(false)}
        title={t("wallet.topupTitle")}
        wide
      >
        <div className="space-y-6">
          <div className="bg-vr-50 border border-vr-200 rounded-lg p-4">
            <p className="text-sm text-vr-900 font-medium">
              {t("wallet.currentBalanceLabel", {
                amount: stats.currentBalance.toLocaleString(),
              })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("wallet.topupAmount")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                đ
              </span>
              <CurrencyInput
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder={t("wallet.topupPlaceholder")}
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t("wallet.topupLimit")}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>{t("wallet.topupNoteLabel")}</strong>{" "}
              {t("wallet.topupNote")}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setOpenTopUp(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleTopUp}
              className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
            >
              {t("wallet.topupPay")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
