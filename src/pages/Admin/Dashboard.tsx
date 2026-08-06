import { useEffect, useRef, useState } from "react";
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
import { formatCurrency } from "../../utils/currency";
import { StatCard } from "../../components/StatCard";

import { downloadRevenueCsv } from "./revenueCsv";
type BookingChartPoint = {
  month: string;
  revenue: number;
  bookings: number;
};

type OperatorRevenuePoint = {
  operator: string;
  revenue: number;
};

const operatorRevenueColors = [
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
];

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

type MetricTrend = { label: string; className: string; hint?: string };

function metricTrend(
  metric: MetricValue,
  newLabel: string,
  newHint: string,
): MetricTrend {
  if (metric.previousValue === 0 && metric.currentValue > 0) {
    return {
      label: newLabel,
      className: "text-emerald-600",
      hint: newHint,
    };
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
  const [bookingStatsData, setBookingStatsData] = useState<BookingChartPoint[]>(
    [],
  );
  const [revenueByOperatorData, setRevenueByOperatorData] = useState<
    OperatorRevenuePoint[]
  >([]);
  const [dashboardSummary, setDashboardSummary] =
    useState<AdminDashboardSummary | null>(null);
  const [revenueAnalytics, setRevenueAnalytics] =
    useState<AdminRevenueAnalytics | null>(null);
  const [loadError, setLoadError] = useState("");

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

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
      setBookingStatsData(
        mapDashboardChart(bookingStats.items, revenue.monthly),
      );
      setDashboardSummary(dashboard);
      setRevenueAnalytics(revenue);
      setRevenueByOperatorData(
        revenue.topOperators.map((item) => ({
          operator: item.operatorName,
          revenue: item.revenueVnd,
        })),
      );
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : tRef.current("dashboard.loadFailed"),
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
      value: metrics ? formatCurrency(metrics.totalRevenue.currentValue) : "-",
      previous: metrics
        ? formatCurrency(metrics.totalRevenue.previousValue)
        : "-",
      trend: metrics
        ? metricTrend(
            metrics.totalRevenue,
            t("dashboard.newGrowth"),
            t("dashboard.newGrowthHint"),
          )
        : null,
      icon: <FiDollarSign className="w-6 h-6" />,
      iconClassName: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t("dashboard.activeOperators"),
      value: metrics
        ? formatCompactNumber(metrics.activeOperators.currentValue)
        : "-",
      previous: metrics
        ? formatCompactNumber(metrics.activeOperators.previousValue)
        : "-",
      trend: metrics
        ? metricTrend(
            metrics.activeOperators,
            t("dashboard.newGrowth"),
            t("dashboard.newGrowthHint"),
          )
        : null,
      icon: <FiTruck className="w-6 h-6" />,
      iconClassName: "bg-blue-50 text-blue-700",
    },
    {
      label: t("dashboard.activeUsers"),
      value: metrics
        ? formatCompactNumber(metrics.activeUsers.currentValue)
        : "-",
      previous: metrics
        ? formatCompactNumber(metrics.activeUsers.previousValue)
        : "-",
      trend: metrics
        ? metricTrend(
            metrics.activeUsers,
            t("dashboard.newGrowth"),
            t("dashboard.newGrowthHint"),
          )
        : null,
      icon: <FiUsers className="w-6 h-6" />,
      iconClassName: "bg-violet-50 text-violet-700",
    },
    {
      label: t("dashboard.periodBookings"),
      value: metrics ? formatCompactNumber(metrics.bookings.currentValue) : "-",
      previous: metrics
        ? formatCompactNumber(metrics.bookings.previousValue)
        : "-",
      trend: metrics
        ? metricTrend(
            metrics.bookings,
            t("dashboard.newGrowth"),
            t("dashboard.newGrowthHint"),
          )
        : null,
      icon: <FiBarChart2 className="w-6 h-6" />,
      iconClassName: "bg-amber-50 text-amber-700",
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
  const userDistribution = (metrics?.userDistribution ?? []).map(
    (item, index) => ({
      name: roleLabels[item.role] ?? item.role,
      value: item.count,
      color: distributionColors[index % distributionColors.length],
    }),
  );

  const pendingOperators =
    metrics?.operatorStatusDistribution.find(
      (item) => item.status === "PENDING",
    )?.count ?? 0;
  const approvedOperators =
    metrics?.operatorStatusDistribution.find(
      (item) => item.status === "APPROVED",
    )?.count ?? 0;
  const sortedRevenueByOperatorData = [...revenueByOperatorData].sort(
    (left, right) => right.revenue - left.revenue,
  );
  const totalOperatorRevenue = sortedRevenueByOperatorData.reduce(
    (sum, item) => sum + item.revenue,
    0,
  );
  const handleExportReport = (report: { key: string; label: string }) => {
    if (report.key === "revenue" && revenueAnalytics) {
      downloadRevenueCsv(revenueAnalytics, {
        periodFrom: t("revenue.csvPeriodFrom"),
        periodTo: t("revenue.csvPeriodTo"),
        timezone: t("revenue.csvTimezone"),
        month: t("revenue.csvMonth"),
        grossRevenue: t("revenue.csvGrossRevenue"),
        paidToOperators: t("revenue.csvPaidToOperators"),
        platformRevenue: t("revenue.csvPlatformRevenue"),
      });
      return;
    }

    downloadCsv(
      "admin-dashboard-report.csv",
      [t("dashboard.csvReportHeader"), t("dashboard.csvNoteHeader")],
      [[report.label, t("dashboard.csvPlaceholderNote")]],
    );
  };

  const exportReports = [
    { key: "revenue", label: t("dashboard.exportRevenue") },
    { key: "users", label: t("dashboard.exportUsers") },
    { key: "operators", label: t("dashboard.exportOperators") },
    { key: "bookings", label: t("dashboard.exportBookings") },
  ];

  const handleRefresh = () => {
    void loadDashboard();
  };

  return (
    <div className="space-y-6 pb-4">
      {loadError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminKPIs.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            iconClassName={kpi.iconClassName}
            labelInline
          />
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
              <BarChart
                data={bookingStatsData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis
                  yAxisId="bookings"
                  stroke="#8b5cf6"
                  allowDecimals={false}
                  tickFormatter={formatCompactNumber}
                  width={45}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  stroke="#3b82f6"
                  tickFormatter={(value) => formatCurrency(Number(value))}
                  width={115}
                />
                <Tooltip
                  formatter={(value, name) => [
                    name === t("dashboard.revenueLegend")
                      ? formatCurrency(Number(value ?? 0))
                      : formatCompactNumber(Number(value ?? 0)),
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  name={t("dashboard.revenueLegend")}
                />
                <Bar
                  yAxisId="bookings"
                  dataKey="bookings"
                  fill="#8b5cf6"
                  radius={[6, 6, 0, 0]}
                  name={t("dashboard.bookingLegend")}
                />
              </BarChart>
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

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("dashboard.revenueByOperator")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("dashboard.revenueByOperatorHint")}
          </p>
        </div>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
            {t("dashboard.loadingChart")}
          </div>
        ) : revenueByOperatorData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
            {t("dashboard.noOperatorRevenue")}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.2fr)] lg:items-center">
            <div className="relative h-[280px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sortedRevenueByOperatorData}
                    dataKey="revenue"
                    nameKey="operator"
                    cx="50%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={112}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sortedRevenueByOperatorData.map((item, index) => (
                      <Cell
                        key={item.operator}
                        fill={
                          operatorRevenueColors[
                            index % operatorRevenueColors.length
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-medium uppercase text-gray-500">
                  {t("dashboard.totalRevenue")}
                </span>
                <strong className="mt-1 text-lg text-gray-900">
                  {formatCurrency(totalOperatorRevenue)}
                </strong>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              {sortedRevenueByOperatorData.map((item, index) => {
                const percentage =
                  totalOperatorRevenue > 0
                    ? (item.revenue / totalOperatorRevenue) * 100
                    : 0;
                const color =
                  operatorRevenueColors[index % operatorRevenueColors.length];

                return (
                  <div
                    key={item.operator}
                    className="rounded-lg border border-gray-200 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {item.operator}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t("dashboard.revenueShare", {
                              value: percentage.toLocaleString("vi-VN", {
                                maximumFractionDigits: 1,
                              }),
                            })}
                          </p>
                        </div>
                      </div>
                      <strong className="shrink-0 text-sm text-gray-900">
                        {formatCurrency(item.revenue)}
                      </strong>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: color,
                          width: `${Math.max(percentage, 2)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
              <span className="font-bold text-amber-600">
                {pendingOperators}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/operators?status=PENDING")}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-lg text-sm transition"
            >
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
              <span className="text-gray-700">
                {t("dashboard.approvedLabel")}
              </span>
              <span className="font-bold text-emerald-600">
                {approvedOperators}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/operators?status=APPROVED")}
              className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg text-sm transition"
            >
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
              key={report.key}
              type="button"
              onClick={() => handleExportReport(report)}
              disabled={report.key === "revenue" && !revenueAnalytics}
              className="py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-sm font-medium transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiDownload size={14} />
              {report.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
