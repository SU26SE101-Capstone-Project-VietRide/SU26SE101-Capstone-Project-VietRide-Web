import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDownload } from "react-icons/fi";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  getAdminRevenueAnalytics,
  type AdminRevenueAnalytics,
  type MetricValue,
} from "../../api/vietride";
import { formatCurrency } from "../../utils/currency";
import { downloadRevenueCsv } from "./revenueCsv";

function monthNumber(value: string) {
  const month = Number(value.slice(5, 7));
  return Number.isNaN(month) ? value : String(month);
}

type KPIProps = {
  title: string;
  metric?: MetricValue;
  previousLabel: string;
  newLabel: string;
  newHint: string;
};

const KPI = ({ title, metric }: KPIProps) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{title}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold text-gray-900">
          {metric ? formatCurrency(metric.currentValue) : "-"}
        </p>
      </div>
    </div>
  );
};

function formatDateValue(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export default function Revenue() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const range = useMemo(() => currentYearRange(), []);
  const [analytics, setAnalytics] = useState<AdminRevenueAnalytics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAnalytics(
        await getAdminRevenueAnalytics({
          from: range.from,
          to: range.to,
          groupBy: "month",
          top: 10,
        }),
      );
    } catch (reason) {
      setAnalytics(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải dữ liệu doanh thu.",
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const chartData =
    analytics?.monthly.map((item) => ({
      month: item.month,
      gross: item.grossRevenueVnd,
      paid: item.paidToOperatorsVnd,
      platform: item.platformRevenueVnd,
    })) ?? [];
  const totalInPeriod = analytics?.summary.grossRevenueVnd.currentValue ?? 0;
  const platformRevenue =
    analytics?.summary.platformRevenueVnd.currentValue ?? 0;
  const platformShare =
    totalInPeriod > 0 ? Math.round((platformRevenue / totalInPeriod) * 100) : 0;
  const peakMonth = chartData.reduce<(typeof chartData)[number] | null>(
    (peak, item) => (!peak || item.gross > peak.gross ? item : peak),
    null,
  );
  const peakMonthLabel =
    peakMonth && peakMonth.gross > 0
      ? t("revenue.monthValue", { month: monthNumber(peakMonth.month) })
      : "—";
  const handleExport = () => {
    if (!analytics) return;

    downloadRevenueCsv(analytics, {
      periodFrom: t("revenue.csvPeriodFrom"),
      periodTo: t("revenue.csvPeriodTo"),
      timezone: t("revenue.csvTimezone"),
      month: t("revenue.csvMonth"),
      grossRevenue: t("revenue.csvGrossRevenue"),
      paidToOperators: t("revenue.csvPaidToOperators"),
      platformRevenue: t("revenue.csvPlatformRevenue"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("revenue.title")}{" "}
            <span className="ml-3 inline-block rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {tc("adminBadge")}
            </span>
          </h1>

          {analytics && (
            <div className="mt-1 space-y-1 text-sm text-gray-500">
              <p>
                {t("revenue.period", {
                  from: formatDateValue(analytics.period.from),
                  to: formatDateValue(analytics.period.to),
                  timezone: analytics.period.timezone,
                })}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!analytics || loading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiDownload />
            {t("revenue.exportCsv")}
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("revenue.loadingRefresh") : t("revenue.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPI
          title={t("revenue.grossRevenue")}
          metric={analytics?.summary.grossRevenueVnd}
          previousLabel={t("revenue.previousPeriod")}
          newLabel={t("revenue.newGrowth")}
          newHint={t("revenue.newGrowthHint")}
        />
        <KPI
          title={t("revenue.commission")}
          metric={analytics?.summary.platformRevenueVnd}
          previousLabel={t("revenue.previousPeriod")}
          newLabel={t("revenue.newGrowth")}
          newHint={t("revenue.newGrowthHint")}
        />
        <KPI
          title={t("revenue.paidToOperators")}
          metric={analytics?.summary.paidToOperatorsVnd}
          previousLabel={t("revenue.previousPeriod")}
          newLabel={t("revenue.newGrowth")}
          newHint={t("revenue.newGrowthHint")}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                {t("revenue.monthlyChart")}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {t("revenue.chartHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t("revenue.commissionLegend")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                {t("revenue.paidLegend")}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("revenue.totalInPeriod")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatCurrency(totalInPeriod)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("revenue.peakMonth")}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {peakMonthLabel}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("revenue.platformShare")}
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-600">
                {platformShare}%
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-5 pt-6 sm:px-6">
          {loading ? (
            <div className="flex h-80 items-center justify-center text-gray-500">
              {t("revenue.loading")}
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-80 items-center justify-center text-gray-500">
              {t("revenue.noData")}
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={chartData}
                  barCategoryGap="34%"
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="paidRevenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                    <linearGradient
                      id="platformRevenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="4 4"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(value: string) => `T${monthNumber(value)}`}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    width={112}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    labelFormatter={(value) =>
                      t("revenue.monthValue", {
                        month: monthNumber(String(value)),
                      })
                    }
                    contentStyle={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                    }}
                  />
                  <Bar
                    stackId="revenue"
                    dataKey="paid"
                    fill="url(#paidRevenueGradient)"
                    name={t("revenue.paidLegend")}
                    maxBarSize={52}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    stackId="revenue"
                    dataKey="platform"
                    fill="url(#platformRevenueGradient)"
                    name={t("revenue.commissionLegend")}
                    maxBarSize={52}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h4 className="mb-3 font-semibold">{t("revenue.topOperators")}</h4>
        {!loading && (analytics?.topOperators.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">{t("revenue.noOperators")}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {analytics?.topOperators.map((operator) => (
              <div
                key={operator.operatorId}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vr-50 font-semibold text-vr-600">
                    {operator.rank}
                  </div>
                  {operator.logoUrl && (
                    <img
                      src={operator.logoUrl}
                      alt={t("revenue.operatorLogoAlt", {
                        name: operator.operatorName,
                      })}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {operator.operatorName ?? operator.operatorId}
                    </div>
                    <div className="text-xs text-gray-500">
                      {operator.vehicleCount.toLocaleString("vi-VN")}{" "}
                      {t("revenue.vehicles")}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right font-semibold">
                  {formatCurrency(operator.revenueVnd)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
