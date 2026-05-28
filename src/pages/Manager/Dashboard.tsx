import { useState } from "react";
import {
  FiTruck,
  FiBarChart2,
  FiTrendingUp,
  FiPackage,
  FiRefreshCw,
  FiDownload,
  FiEye,
  FiEdit2,
} from "react-icons/fi";
import {
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
  ResponsiveContainer,
} from "recharts";

type KPICard = {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ReactNode;
};


const kpis: KPICard[] = [
  {
    label: "Doanh thu khi hành",
    value: "2284.5M",
    change: "+15.2%",
    trend: "up",
    icon: <FiBarChart2 className="w-6 h-6" />,
  },
  {
    label: "Kỳ đơn bận",
    value: "1,284",
    change: "+8.5%",
    trend: "up",
    icon: <FiPackage className="w-6 h-6" />,
  },
  {
    label: "Bền bảng hôm",
    value: "342",
    change: "+2.3%",
    trend: "up",
    icon: <FiTruck className="w-6 h-6" />,
  },
  {
    label: "Chuyên chở động hôm",
    value: "48",
    change: "+5.8%",
    trend: "up",
    icon: <FiTrendingUp className="w-6 h-6" />,
  },
];

const revenueChartData = [
  { month: "T1", revenue: 180, orders: 320 },
  { month: "T2", revenue: 165, orders: 310 },
  { month: "T3", revenue: 195, orders: 340 },
  { month: "T4", revenue: 175, orders: 300 },
  { month: "T5", revenue: 210, orders: 380 },
  { month: "T6", revenue: 225, orders: 410 },
  { month: "T7", revenue: 235, orders: 430 },
  { month: "T8", revenue: 240, orders: 450 },
  { month: "T9", revenue: 255, orders: 470 },
  { month: "T10", revenue: 270, orders: 490 },
];

const cargoStatusData = [
  { name: "HCM - Da Lat", value: 245 },
  { name: "HCM - Nha Trang", value: 195 },
  { name: "HCM - Vũng Tàu", value: 165 },
  { name: "HCM - Cần Thơ", value: 142 },
  { name: "Nôi khác", value: 98 },
];

const distributionData = [
  { name: "Đang vận chuyển", value: 45, color: "#3b82f6" },
  { name: "Có giao", value: 35, color: "#10b981" },
  { name: "Chưa giao", value: 15, color: "#f59e0b" },
  { name: "Hoãn lại", value: 5, color: "#ef4444" },
];

const vehicleOperationData = [
  { name: "XE-KDD2485", trips: 14, status: "active" },
  { name: "XE-KDD2483", trips: 12, status: "active" },
  { name: "XE-KDD2472", trips: 10, status: "active" },
  { name: "XE-KDD2471", trips: 8, status: "active" },
  { name: "XE-KDD2462", trips: 5, status: "maintenance" },
];

type Shipment = {
  id: string;
  code: string;
  route: string;
  address: string;
  driver: string;
  cost: string;
  status: "completed" | "pending" | "in_transit" | "cancelled";
};

const recentShipments: Shipment[] = [
  {
    id: "1",
    code: "VR-2401",
    route: "HCM - Da Lat",
    address: "Người gửi: Văn An",
    driver: "Nguyễn Văn An",
    cost: "320.00",
    status: "completed",
  },
  {
    id: "2",
    code: "VR-2402",
    route: "HCM - Nha Trang",
    address: "Người gửi: Thái Giang",
    driver: "Trần Minh Quân",
    cost: "320.00",
    status: "completed",
  },
  {
    id: "3",
    code: "VR-2403",
    route: "HCM - Vũng Tàu",
    address: "Người gửi: Lê Hoàng Phúc",
    driver: "Phạm Bảo Anh",
    cost: "220.00",
    status: "in_transit",
  },
  {
    id: "4",
    code: "VR-2404",
    route: "HCM - Cần Thơ",
    address: "Người gửi: Mạnh Quý Linh",
    driver: "Vũ Tú Phương",
    cost: "320.00",
    status: "in_transit",
  },
  {
    id: "5",
    code: "VR-2405",
    route: "HCM - Cần Thơ",
    address: "Người gửi: Trần Quốc Anh",
    driver: "Bùi Quốc Dân",
    cost: "320.00",
    status: "pending",
  },
];

export default function ManagerDashboard() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const getStatusBadge = (status: Shipment["status"]) => {
    const statusMap = {
      completed: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Hoàn tất" },
      in_transit: { bg: "bg-sky-50", text: "text-sky-700", label: "Đang vận chuyển" },
      pending: { bg: "bg-amber-50", text: "text-amber-700", label: "Chờ xử lý" },
      cancelled: { bg: "bg-red-50", text: "text-red-700", label: "Đã hủy" },
    };
    const s = statusMap[status];
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tổng quan vận hành</h1>
          <p className="text-gray-600 mt-1">Ngày 24 Tháng 5 2026</p>
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
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-vr-600">{kpi.icon}</div>
              <span
                className={`text-xs font-semibold ${
                  kpi.trend === "up"
                    ? "text-emerald-600"
                    : kpi.trend === "down"
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
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
        {/* Revenue & Orders Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Doanh thu & kỳ đơn tất cả</h2>
            <button className="text-vr-600 hover:text-vr-700 text-sm font-medium">
              Xem tất cả
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
                name="Doanh thu"
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", r: 4 }}
                activeDot={{ r: 6 }}
                name="Kỳ đơn"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Trạng thái hàng hóa</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2 text-sm">
            {distributionData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-700">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cargo Status Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Trạng thái hàng hóa chi tiết</h2>
            <button className="text-vr-600 hover:text-vr-700 text-sm font-medium">
              Xem tất cả
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={cargoStatusData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" width={95} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle Operation */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Xe trong vận hành</h2>
          </div>
          <div className="space-y-3">
            {vehicleOperationData.map((vehicle) => (
              <div key={vehicle.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex items-center gap-2">
                  <FiTruck size={16} className="text-vr-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{vehicle.name}</p>
                    <p className="text-xs text-gray-500">{vehicle.status === "active" ? "Hoạt động" : "Bảo trì"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full w-[56%] bg-vr-500"></div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 min-w-7">{vehicle.trips}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Shipments Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Chuyên chở gần nhất</h2>
          <button className="flex items-center gap-2 text-vr-600 hover:text-vr-700 text-sm font-medium">
            <FiDownload size={16} />
            Xuất CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Mã chuyến</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tuyến</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Địa chỉ giao</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tài xế</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Giá</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentShipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{shipment.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{shipment.route}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{shipment.address}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{shipment.driver}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{shipment.cost}k</td>
                  <td className="px-4 py-3">{getStatusBadge(shipment.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1 text-vr-600 hover:bg-vr-50 rounded" title="Chi tiết">
                        <FiEye size={16} />
                      </button>
                      <button className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Sửa">
                        <FiEdit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
