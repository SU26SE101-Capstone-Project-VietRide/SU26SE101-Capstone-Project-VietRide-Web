import { useState } from "react";
import {
  FiUsers,
  FiTruck,
  FiDollarSign,
  FiBarChart2,
  FiTrendingUp,
  FiGift,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiDownload,
} from "react-icons/fi";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type AdminKPI = {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: React.ReactNode;
};

const adminKPIs: AdminKPI[] = [
  {
    label: "Tổng doanh thu",
    value: "45.8B",
    change: "+24.5%",
    trend: "up",
    icon: <FiDollarSign className="w-6 h-6" />,
  },
  {
    label: "Nhà xe hoạt động",
    value: "342",
    change: "+18%",
    trend: "up",
    icon: <FiTruck className="w-6 h-6" />,
  },
  {
    label: "Người dùng hoạt động",
    value: "182.5K",
    change: "+22.5%",
    trend: "up",
    icon: <FiUsers className="w-6 h-6" />,
  },
  {
    label: "Booking tháng",
    value: "245.6K",
    change: "+16.3%",
    trend: "up",
    icon: <FiBarChart2 className="w-6 h-6" />,
  },
];

const revenueByOperator = [
  { operator: "Phương Trang", revenue: 12500, bookings: 3240 },
  { operator: "Mai Linh", revenue: 10800, bookings: 2890 },
  { operator: "Kumho", revenue: 9200, bookings: 2450 },
  { operator: "Thaco", revenue: 8100, bookings: 2160 },
  { operator: "Khác", revenue: 5200, bookings: 1390 },
];

const bookingStats = [
  { month: "T1", revenue: 2400, bookings: 15200, cancelled: 1850 },
  { month: "T2", revenue: 2210, bookings: 14880, cancelled: 1920 },
  { month: "T3", revenue: 2290, bookings: 15450, cancelled: 1890 },
  { month: "T4", revenue: 2000, bookings: 14200, cancelled: 1650 },
  { month: "T5", revenue: 2181, bookings: 15890, cancelled: 2050 },
  { month: "T6", revenue: 2500, bookings: 17240, cancelled: 2100 },
  { month: "T7", revenue: 2100, bookings: 16100, cancelled: 1980 },
  { month: "T8", revenue: 2300, bookings: 16890, cancelled: 2200 },
  { month: "T9", revenue: 2400, bookings: 17500, cancelled: 2350 },
  { month: "T10", revenue: 2800, bookings: 19240, cancelled: 2400 },
  { month: "T11", revenue: 3100, bookings: 21500, cancelled: 2650 },
  { month: "T12", revenue: 3400, bookings: 23800, cancelled: 2900 },
];

const userDistribution = [
  { name: "Hành khách", value: 165000, color: "#3b82f6" },
  { name: "Tài xế/Phụ xe", value: 8500, color: "#8b5cf6" },
  { name: "Nhà xe (Admin)", value: 342, color: "#10b981" },
  { name: "System Admin", value: 12, color: "#f59e0b" },
];

const operatorStatus = [
  { status: "Hoạt động", count: 285, percentage: 83 },
  { status: "Chờ duyệt", count: 28, percentage: 8 },
  { status: "Tạm khóa", count: 19, percentage: 6 },
  { status: "Bị từ chối", count: 10, percentage: 3 },
];

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bảng điều khiển</h1>
          <p className="text-gray-600 mt-1">Hôm nay, 24 Tháng 5 2026</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center cursor-pointer gap-2 px-4 py-2 bg-vr-500 hover:bg-vr-600 rounded-lg text-white transition"
        >
          <FiRefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminKPIs.map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-vr-600">{kpi.icon}</div>
              <span className="text-xs font-semibold text-emerald-600">
                {kpi.change}
              </span>
            </div>
            <p className="text-gray-600 text-xs mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Bookings Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Doanh thu & Booking theo tháng</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bookingStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Doanh thu (100tr)" />
              <Line type="monotone" dataKey="bookings" stroke="#8b5cf6" strokeWidth={2} name="Booking" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* User Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phân bố người dùng</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={userDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                {userDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1 text-xs">
            {userDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-semibold text-gray-700">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Operator */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Doanh thu theo nhà xe</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueByOperator} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis dataKey="operator" type="category" stroke="#9ca3af" width={115} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Operator Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trạng thái nhà xe</h2>
          <div className="space-y-3">
            {operatorStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.status}</span>
                    <span className="text-xs font-semibold text-gray-600">{item.count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-vr-500"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-50">
              <FiAlertCircle className="text-amber-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Chờ duyệt</h3>
              <p className="text-sm text-gray-600">Đơn đăng ký nhà xe</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Nhà xe mới</span>
              <span className="font-bold text-amber-600">28</span>
            </div>
            <button className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-lg text-sm transition">
              Xem đơn chờ
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50">
              <FiCheckCircle className="text-emerald-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Duyệt ngày</h3>
              <p className="text-sm text-gray-600">Đã phê duyệt hôm nay</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Hôm nay</span>
              <span className="font-bold text-emerald-600">12</span>
            </div>
            <button className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg text-sm transition">
              Xem chi tiết
            </button>
          </div>
        </div>
      </div>

      {/* Reports Export */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Xuất báo cáo</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Doanh thu", "Người dùng", "Nhà xe", "Booking"].map((report) => (
            <button
              key={report}
              className="py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <FiDownload size={14} />
              {report}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
