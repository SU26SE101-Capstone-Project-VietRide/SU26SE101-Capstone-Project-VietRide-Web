import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  getAdminRevenueAnalytics,
  type AdminRevenueAnalytics,
  type MetricValue,
} from "../../api/vietride";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatChange = (metric?: MetricValue) => {
  if (!metric) return "-";
  const prefix = metric.changePercent > 0 ? "+" : "";
  return `${prefix}${metric.changePercent.toLocaleString("vi-VN")}%`;
};

const KPI = ({ title, metric }: { title: string; metric?: MetricValue }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <p className="text-sm text-gray-600">{title}</p>
    <div className="mt-1 flex items-end justify-between gap-3">
      <p className="text-2xl font-bold text-gray-900">
        {metric ? formatMoney(metric.currentValue) : "-"}
      </p>
      <span
        className={`text-sm font-semibold ${
          metric?.trend === "DOWN" ? "text-red-600" : "text-green-600"
        }`}
      >
        {formatChange(metric)}
      </span>
    </div>
  </div>
);

function currentYearRange() {
  const year = new Date().getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export default function Revenue() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const range = useMemo(() => currentYearRange(), []);
  const [analytics, setAnalytics] = useState<AdminRevenueAnalytics | null>(null);
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
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu doanh thu.");
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

  const chartData = analytics?.monthly.map((item) => ({
    month: item.month,
    paid: item.paidToOperatorsVnd,
    platform: item.platformRevenueVnd,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("revenue.title")} <span className="ml-3 inline-block rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{tc("adminBadge")}</span>
          </h1>
          <p className="mt-1 text-gray-600">{t("revenue.subtitle")}</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPI title="Tổng doanh thu" metric={analytics?.summary.grossRevenueVnd} />
        <KPI title={t("revenue.commission")} metric={analytics?.summary.platformRevenueVnd} />
        <KPI title={t("revenue.paidToOperators")} metric={analytics?.summary.paidToOperatorsVnd} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold">{t("revenue.monthlyChart")}</h3>
        {loading ? (
          <div className="flex h-80 items-center justify-center text-gray-500">Đang tải dữ liệu...</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-gray-500">Không có dữ liệu trong khoảng thời gian này.</div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: "#6b7280" }} />
                <YAxis tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`} />
                <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="paid" fill="#2563eb" name={t("revenue.paidLegend")} />
                <Bar dataKey="platform" fill="#10b981" name={t("revenue.commissionLegend")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h4 className="mb-3 font-semibold">{t("revenue.topOperators")}</h4>
        {!loading && (analytics?.topOperators.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">Chưa có nhà xe phát sinh doanh thu.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {analytics?.topOperators.map((operator) => (
              <div key={operator.operatorId} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vr-50 font-semibold text-vr-600">{operator.rank}</div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{operator.operatorName ?? operator.operatorId}</div>
                    <div className="text-xs text-gray-500">{operator.vehicleCount.toLocaleString("vi-VN")} {t("revenue.vehicles")}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right font-semibold">{formatMoney(operator.revenueVnd)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

