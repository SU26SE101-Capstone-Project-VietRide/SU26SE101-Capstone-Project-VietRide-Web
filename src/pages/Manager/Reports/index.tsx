import { useMemo } from "react";
import { FiDownload, FiArrowUp, FiCalendar } from "react-icons/fi";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

type RevenueData = {
  month: string;
  revenue: number; // Doanh thu
  trips: number; // Lượt về
};

type RouteEfficiency = {
  name: string;
  efficiency: number; // Hiệu suất (0-100)
};

type RevenueCategory = {
  category: string;
  amount: number;
  percent: number;
};

const monthlyData: RevenueData[] = [
  { month: "Jan", revenue: 1200, trips: 210 },
  { month: "Feb", revenue: 1300, trips: 200 },
  { month: "Mar", revenue: 1400, trips: 220 },
  { month: "Apr", revenue: 1350, trips: 215 },
  { month: "May", revenue: 1600, trips: 280 },
  { month: "Jun", revenue: 1700, trips: 300 },
  { month: "Jul", revenue: 1800, trips: 310 },
  { month: "Aug", revenue: 1750, trips: 290 },
  { month: "Sep", revenue: 1900, trips: 320 },
  { month: "Oct", revenue: 2100, trips: 340 },
  { month: "Nov", revenue: 2200, trips: 360 },
  { month: "Dec", revenue: 2300, trips: 380 },
];

const routeEfficiencyData: RouteEfficiency[] = [
  { name: "Hà Nội - HCM", efficiency: 92 },
  { name: "HCM - TP.HCM", efficiency: 85 },
  { name: "Hải Phòng", efficiency: 88 },
  { name: "Vũng Tàu", efficiency: 78 },
  { name: "Cần Thơ", efficiency: 72 },
  { name: "Sóc Trăng", efficiency: 80 },
];

const revenueDistribution: RevenueCategory[] = [
  { category: "Vé khách online", amount: 1800, percent: 64 },
  { category: "Vé tại quầy", amount: 560, percent: 18 },
  { category: "Hàng hóa kỳ gửi", amount: 410, percent: 14 },
  { category: "Dịch vụ khác", amount: 145, percent: 4 },
];

export default function ManagerReports() {
  // Calculate KPIs
  const stats = useMemo(() => {
    const totalRevenue = monthlyData.reduce((sum, d) => sum + d.revenue, 0);
    const avgPerTrip = Math.round(
      totalRevenue / monthlyData.reduce((sum, d) => sum + d.trips, 0),
    );
    const currentMonthRevenue = monthlyData[monthlyData.length - 1].revenue;
    const prevMonthRevenue = monthlyData[monthlyData.length - 2].revenue;
    const monthChangePercent = Math.round(
      ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100,
    );

    const onlineRevenue = revenueDistribution[0].amount;
    const counterRevenue = revenueDistribution[1].amount;
    const parcelRevenue = revenueDistribution[2].amount;

    return {
      totalRevenue: (totalRevenue / 100).toFixed(1), // Convert to billions
      avgPerTrip,
      monthChangePercent,
      onlineRevenue: (onlineRevenue / 100).toFixed(2), // Billions
      counterRevenue: (counterRevenue / 100).toFixed(2),
      parcelRevenue: (parcelRevenue / 100).toFixed(2),
    };
  }, []);

  // Format data for revenue distribution chart (horizontal)
  const revenueChartData = revenueDistribution.map((item) => ({
    name: item.category,
    revenue: item.amount,
    percent: item.percent,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Doanh thu & phân tích
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Báo cáo tài chính chi tiết, hiệu suất tuyến và phân bố doanh thu.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition">
          <FiDownload size={16} /> Xuất báo cáo
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Doanh thu tháng */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Doanh thu tháng</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.totalRevenue}B
          </p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <FiArrowUp size={12} /> {stats.monthChangePercent > 0 ? "↑" : "↓"}{" "}
            {Math.abs(stats.monthChangePercent)}%
          </p>
        </div>

        {/* Trung bình chuyến */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            Trung bình / chuyến
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.avgPerTrip}M
          </p>
          <p className="text-xs text-green-600 mt-2">4.2%</p>
        </div>

        {/* Doanh thu vé */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Doanh thu về</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.onlineRevenue}B
          </p>
          <p className="text-xs text-green-600 mt-2">12.1%</p>
        </div>

        {/* Doanh thu hàng */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">Doanh thu hàng</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.parcelRevenue}M
          </p>
          <p className="text-xs text-green-600 mt-2">22.7%</p>
        </div>
      </div>

      {/* Revenue & Trips Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Doanh thu & lượt về
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              12 tháng doanh thu định kỳ và số lượt về
            </p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <FiCalendar size={14} /> Tháng
          </button>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={monthlyData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
            />
            <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: any) => {
                if (typeof value === "number" && value > 1000) {
                  return value; // trips
                }
                return value;
              }}
            />
            <Legend />
            <Bar
              dataKey="revenue"
              name="Doanh thu"
              fill="#3b82f6"
              radius={[6, 6, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="trips"
              name="Lượt về"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 4 }}
              yAxisId="right"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Grid: Route Efficiency & Revenue Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Efficiency Radar */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Hiệu suất tuyến
            </h2>
            <p className="text-xs text-gray-600 mt-1">Từng tuyến trong tháng</p>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={routeEfficiencyData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="name"
                stroke="#9ca3af"
                style={{ fontSize: "11px" }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                stroke="#9ca3af"
                style={{ fontSize: "11px" }}
              />
              <Radar
                name="Hiệu suất %"
                dataKey="efficiency"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Distribution Horizontal Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Phân bố doanh thu
            </h2>
            <p className="text-xs text-gray-600 mt-1">Theo nguồn</p>
          </div>

          <div className="space-y-6">
            {revenueChartData.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {item.name}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    d{item.revenue}M{" "}
                    <span className="text-gray-500">· {item.percent}%</span>
                  </span>
                </div>
                <div className="w-full h-8 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full flex items-center justify-end px-3 text-white text-xs font-semibold rounded-full transition-all ${
                      idx === 0
                        ? "bg-blue-500"
                        : idx === 1
                          ? "bg-blue-400"
                          : idx === 2
                            ? "bg-blue-300"
                            : "bg-blue-200"
                    }`}
                    style={{ width: `${item.percent * 3}%` }}
                  >
                    {item.percent > 10 && `${item.percent}%`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Tổng doanh thu
              </span>
              <span className="text-lg font-bold text-gray-900">
                d{revenueChartData.reduce((sum, item) => sum + item.revenue, 0)}
                M
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Thống kê chi tiết
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Chỉ tiêu
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Giá trị
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  So với tháng trước
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  Tổng doanh thu
                </td>
                <td className="px-4 py-3 text-gray-900">
                  d{stats.totalRevenue}B
                </td>
                <td className="px-4 py-3 text-green-600 font-medium">
                  +{stats.monthChangePercent}%
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                    ↑ Tăng
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  Trung bình trên chuyến
                </td>
                <td className="px-4 py-3 text-gray-900">
                  d{stats.avgPerTrip}M
                </td>
                <td className="px-4 py-3 text-green-600 font-medium">+4.2%</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                    ↑ Tăng
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  Doanh thu vé online
                </td>
                <td className="px-4 py-3 text-gray-900">
                  d{stats.onlineRevenue}B
                </td>
                <td className="px-4 py-3 text-green-600 font-medium">+12.1%</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                    ↑ Tăng
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
