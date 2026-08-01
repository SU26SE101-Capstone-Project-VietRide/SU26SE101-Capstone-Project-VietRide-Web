import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiTruck,
  FiDollarSign,
  FiBarChart2,
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
import {
  getAdminBookingStatsAggregate,
  getAdminDashboardSummary,
  getAdminRevenueAnalytics,
  type AdminDashboardSummary,
  type AdminRevenueAnalytics,
  type BookingStatsItem,
  type MetricValue,
} from "../../api/vietride";
import { downloadCsv } from "../../utils/csv";

type BookingChartPoint = {
  month: string;
  revenue: number;
  bookings: number;
};

type OperatorRevenuePoint = {
  operator: string;
  revenue: number;
};

function currentYearRange() {
  const year = new Date().getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function monthLabel(dateValue?: string) {
  if (!dateValue) {
    return "N/A";
  }

  const month = Number(dateValue.slice(5, 7));
  return Number.isNaN(month) ? dateValue : `T${month}`;
}



function formatCompactMoney(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  return value.toLocaleString("vi-VN");
}

function formatCompactNumber(value: number) {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString("vi-VN");
}

function mapDashboardChart(
  bookingItems: BookingStatsItem[],
  revenueItems: AdminRevenueAnalytics["monthly"],
) {
  const points = new Map<string, BookingChartPoint>();

  revenueItems.forEach((item) => {
    points.set(item.month, {
      month: monthLabel(item.month),
      revenue: item.grossRevenueVnd,
      bookings: 0,
    });
  });

  bookingItems.forEach((item) => {
    if (!item.date) return;
    const month = item.date.slice(0, 7);
    const current = points.get(month);
    points.set(month, {
      month: monthLabel(month),
      revenue: current?.revenue ?? 0,
      bookings: item.totalBookings,
    });
  });

  return [...points.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => point);
}

async function fetchAdminBookingStats() {
  const { from, to } = currentYearRange();
  return getAdminBookingStatsAggregate({ from, to, groupBy: "month" });
}

function formatDateValue(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function metricTrend(metric: MetricValue, newLabel: string) {
  if (metric.previousValue === 0 && metric.currentValue > 0) {
    return { label: `↑ ${newLabel}`, className: "text-emerald-600" };
  }

  if (metric.trend === "DOWN") {
    return {
      label: `↓ ${metric.changePercent.toFixed(1)}%`,
      className: "text-red-600",
    };
  }

  if (metric.trend === "FLAT") {
    return {
      label: `— ${metric.changePercent.toFixed(1)}%`,
      className: "text-gray-500",
    };
  }

  return {
    label: `↑ ${metric.changePercent.toFixed(1)}%`,
    className: "text-emerald-600",
  };
}

export default function AdminDashboard() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [bookingStatsData, setBookingStatsData] = useState<BookingChartPoint[]>([]);
  const [revenueByOperatorData, setRevenueByOperatorData] = useState<OperatorRevenuePoint[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<AdminDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = async () => {
    setIsLoading(true);
    setLoadError("");
    const { from, to } = currentYearRange();
    try {
      const [bookingStats, dashboard, revenue] = await Promise.all([
        fetchAdminBookingStats(),
        getAdminDashboardSummary({ from, to }),
        getAdminRevenueAnalytics({ from, to, groupBy: "month", top: 10 }),
      ]);
      setBookingStatsData(mapDashboardChart(bookingStats.items, revenue.monthly));
      setDashboardSummary(dashboard);
      setRevenueByOperatorData(
        revenue.topOperators.map((item) => ({
          operator: item.operatorName,
          revenue: item.revenueVnd,
        })),
      );
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error ? requestError.message : "Không thể tải dữ liệu dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadDashboard();
    });

    return () => {
      cancelled = true;
    };
  }, []);
  const metrics = dashboardSummary;
  const period = metrics
    ? t("dashboard.period", {
        from: formatDateValue(metrics.period.from),
        to: formatDateValue(metrics.period.to),
        timezone: metrics.period.timezone,
      })
    : t("dashboard.loadingPeriod");
  const adminKPIs = [
    {
      label: t("dashboard.totalRevenue"),
      value: metrics ? formatCompactMoney(metrics.totalRevenue.currentValue) : "-",
      previous: metrics ? formatCompactMoney(metrics.totalRevenue.previousValue) : "-",
      trend: metrics ? metricTrend(metrics.totalRevenue, t("dashboard.newGrowth")) : null,
      icon: <FiDollarSign className="w-6 h-6" />,
    },
    {
      label: t("dashboard.activeOperators"),
      value: metrics ? formatCompactNumber(metrics.activeOperators.currentValue) : "-",
      previous: metrics ? formatCompactNumber(metrics.activeOperators.previousValue) : "-",
      trend: metrics ? metricTrend(metrics.activeOperators, t("dashboard.newGrowth")) : null,
      icon: <FiTruck className="w-6 h-6" />,
    },
    {
      label: t("dashboard.activeUsers"),
      value: metrics ? formatCompactNumber(metrics.activeUsers.currentValue) : "-",
      previous: metrics ? formatCompactNumber(metrics.activeUsers.previousValue) : "-",
      trend: metrics ? metricTrend(metrics.activeUsers, t("dashboard.newGrowth")) : null,
      icon: <FiUsers className="w-6 h-6" />,
    },
    {
      label: t("dashboard.periodBookings"),
      value: metrics ? formatCompactNumber(metrics.bookings.currentValue) : "-",
      previous: metrics ? formatCompactNumber(metrics.bookings.previousValue) : "-",
      trend: metrics ? metricTrend(metrics.bookings, t("dashboard.newGrowth")) : null,
      icon: <FiBarChart2 className="w-6 h-6" />,
    },
  ];

  const roleLabels: Record<string, string> = {
    PASSENGER: t("dashboard.passenger"),
    DRIVER: t("dashboard.driver"),
    ASSISTANT: t("dashboard.assistant"),
    OPERATOR_STAFF: t("dashboard.operatorStaff"),
    OPERATOR_ADMIN: t("dashboard.operatorAdmin"),
    SYSTEM_ADMIN: t("dashboard.systemAdmin"),
  };
  const distributionColors = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];
  const userDistribution = (metrics?.userDistribution ?? []).map((item, index) => ({
    name: roleLabels[item.role] ?? item.role,
    value: item.count,
    color: distributionColors[index % distributionColors.length],
  }));

  const statusLabels: Record<string, string> = {
    APPROVED: t("dashboard.statusApproved"),
    PENDING: t("dashboard.statusPending"),
    SUSPENDED: t("dashboard.statusSuspended"),
    REJECTED: t("dashboard.statusRejected"),
  };
  const operatorStatus = (metrics?.operatorStatusDistribution ?? []).map((item) => ({
    key: item.status,
    status: statusLabels[item.status] ?? item.status,
    count: item.count,
    percentage: item.percent,
  }));
  const pendingOperators =
    metrics?.operatorStatusDistribution.find((item) => item.status === "PENDING")?.count ?? 0;
  const approvedOperators =
    metrics?.operatorStatusDistribution.find((item) => item.status === "APPROVED")?.count ?? 0;
  const handleExportReport = (report: string) => {
    downloadCsv(
      "admin-dashboard-report.csv",
      ["Báo cáo", "Ghi chú"],
      [[report, "Dữ liệu minh họa; mở trang Báo cáo để xem dữ liệu đầy đủ từ hệ thống"]],
    );
  };

  const exportReports = [
    t("dashboard.exportRevenue"),
    t("dashboard.exportUsers"),
    t("dashboard.exportOperators"),
    t("dashboard.exportBookings"),
  ];


  const handleRefresh = () => {
    void loadDashboard();
  };


  return (
    <div className="space-y-6 pb-4">
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {loadError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("dashboard.title")}
          </h1>
          <p className="text-gray-600 mt-1">{period}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center cursor-pointer gap-2 px-4 py-2 bg-vr-500 hover:bg-vr-600 rounded-lg text-white transition"
        >
          <FiRefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          {tc("refresh")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminKPIs.map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-vr-600">{kpi.icon}</div>
              <span
                className={`text-xs font-semibold ${kpi.trend?.className ?? "text-gray-400"}`}
              >
                {kpi.trend?.label ?? "-"}
              </span>
            </div>
            <p className="text-gray-600 text-xs mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-gray-500">
              {t("dashboard.previousValue", { value: kpi.previous })}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("dashboard.revenueBookingChart")}
          </h2>
          {isLoading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              {t("dashboard.loadingChart")}
            </div>
          ) : bookingStatsData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              {t("dashboard.noChartData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingStatsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis yAxisId="left" stroke="#9ca3af" allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#9ca3af"
                  tickFormatter={formatCompactMoney}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name={t("dashboard.revenueLegend")}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="bookings"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name={t("dashboard.bookingLegend")}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("dashboard.userDistribution")}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={userDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {userDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1 text-xs">
            {userDistribution.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold text-gray-700">
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("dashboard.revenueByOperator")}
          </h2>
          {isLoading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
              {t("dashboard.loadingChart")}
            </div>
          ) : revenueByOperatorData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
              {t("dashboard.noOperatorRevenue")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={revenueByOperatorData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  stroke="#9ca3af"
                  tickFormatter={formatCompactMoney}
                />
                <YAxis
                  dataKey="operator"
                  type="category"
                  stroke="#9ca3af"
                  width={115}
                />
                <Tooltip
                  formatter={(value) => formatCompactMoney(Number(value ?? 0))}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("dashboard.operatorStatus")}
          </h2>
          <div className="space-y-3">
            {operatorStatus.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {item.status}
                    </span>
                    <span className="text-xs font-semibold text-gray-600">
                      {item.count}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-vr-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-50">
              <FiAlertCircle className="text-amber-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {t("dashboard.pendingApproval")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("dashboard.operatorApplications")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                {t("dashboard.pendingOperators")}
              </span>
              <span className="font-bold text-amber-600">{pendingOperators}</span>
            </div>
            <button type="button" onClick={() => navigate("/admin/operators?status=PENDING")} className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-lg text-sm transition">
              {t("dashboard.viewPending")}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50">
              <FiCheckCircle className="text-emerald-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {t("dashboard.approvedOperators")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("dashboard.approvedOperatorsHint")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{t("dashboard.approvedLabel")}</span>
              <span className="font-bold text-emerald-600">{approvedOperators}</span>
            </div>
            <button type="button" onClick={() => navigate("/admin/operators?status=APPROVED")} className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg text-sm transition">
              {t("dashboard.viewDetails")}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{tc("exportReport")}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {exportReports.map((report) => (
            <button
              key={report}
              type="button"
              onClick={() => handleExportReport(report)}
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







