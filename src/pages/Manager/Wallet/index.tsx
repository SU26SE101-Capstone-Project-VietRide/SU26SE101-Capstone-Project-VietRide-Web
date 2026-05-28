import { useState, useMemo } from "react";
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
import Modal from "../../../components/Modal";

type TransactionType = "topup" | "payment" | "refund";
type TransactionStatus = "pending" | "completed" | "failed";

type WalletTransaction = {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  amount: number; // in billions VND
  balance: number; // balance after transaction
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

const transactionTypeDistribution = [
  { name: "Nạp tiền", value: 32, color: "#10b981" },
  { name: "Chi phí", value: 56, color: "#ef4444" },
  { name: "Hoàn tiền", value: 12, color: "#f59e0b" },
];

export default function ManagerWallet() {
  const [search, setSearch] = useState("");
  const [transactions] = useState<WalletTransaction[]>(mockTransactions);
  const [openTopUp, setOpenTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

  // Calculate KPI stats
  const stats = useMemo(() => {
    const totalTopUp = transactions
      .filter((t) => t.type === "topup" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPayment = transactions
      .filter((t) => t.type === "payment" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalRefund = transactions
      .filter((t) => t.type === "refund" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentBalance =
      transactions.length > 0 ? transactions[0].balance : 0;

    return {
      currentBalance,
      totalTopUp,
      totalPayment,
      totalRefund,
      netBalance: totalTopUp - totalPayment + totalRefund,
    };
  }, [transactions]);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const q = search.toLowerCase();
      return (
        !q ||
        t.id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.reference?.toLowerCase().includes(q)
      );
    });
  }, [search, transactions]);

  const handleTopUp = () => {
    if (!topUpAmount || isNaN(Number(topUpAmount))) return;
    alert(`Nạp tiền: ${topUpAmount}đ - Sẽ chuyển hướng tới VNPay`);
    setOpenTopUp(false);
    setTopUpAmount("");
  };

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
            <FiCheck size={14} /> Thành công
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
            <FiClock size={14} /> Chờ xử lý
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
            <FiAlertCircle size={14} /> Thất bại
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
        return "Nạp tiền";
      case "payment":
        return "Chi phí";
      case "refund":
        return "Hoàn tiền";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Ví quản lý nhà xe
          </h1>
          <p className="text-gray-600 mt-1">
            Nạp tiền, theo dõi chi phí và lịch sử giao dịch
          </p>
        </div>
        <button
          onClick={() => setOpenTopUp(true)}
          className="flex items-center gap-2 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
        >
          <FiPlus size={18} /> Nạp tiền
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Số dư hiện tại</p>
          <p className="text-3xl font-bold text-vr-600 mt-2">
            đ{stats.currentBalance.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">Tỷ VND</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Tổng nạp tiền</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            đ{stats.totalTopUp.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">Tỷ VND</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Tổng chi phí</p>
          <p className="text-3xl font-bold text-red-600 mt-2">
            đ{stats.totalPayment.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">Tỷ VND</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Hoàn tiền</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            đ{stats.totalRefund.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">Tỷ VND</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Lịch sử giao dịch hàng tháng
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
                name="Nạp tiền"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="payment"
                name="Chi phí"
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="refund"
                name="Hoàn tiền"
                fill="#f59e0b"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution Pie */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Phân bố giao dịch
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

      {/* Transaction List */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mã giao dịch, mô tả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiFilter size={16} /> Bộ lọc
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiDownload size={16} /> Xuất CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Ngày giờ
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Loại
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Mô tả
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Số tiền
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Số dư
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Mã tham chiếu
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn) => (
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

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div>
            Hiển thị {filtered.length} / {transactions.length} giao dịch
          </div>
          <div className="flex gap-1">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
              Trước
            </button>
            <button className="px-3 py-1.5 bg-vr-500 text-white rounded-lg font-semibold">
              1
            </button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
              2
            </button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Top-up Modal */}
      <Modal
        open={openTopUp}
        onClose={() => setOpenTopUp(false)}
        title="Nạp tiền vào ví"
        wide
      >
        <div className="space-y-6">
          <div className="bg-vr-50 border border-vr-200 rounded-lg p-4">
            <p className="text-sm text-vr-900 font-medium">
              Số dư hiện tại: đ{stats.currentBalance.toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Số tiền nạp <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                đ
              </span>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Nhập số tiền"
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tối thiểu: 100,000đ | Tối đa: 10,000,000đ
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>Lưu ý:</strong> Sau khi xác nhận, bạn sẽ được chuyển hướng
              tới VNPay để thanh toán. Giao dịch sẽ được xử lý trong vòng 1–2
              phút.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setOpenTopUp(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              onClick={handleTopUp}
              className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
            >
              Nạp tiền & thanh toán VNPay
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
