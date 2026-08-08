import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowDown,
  FiArrowUp,
  FiDownload,
  FiFileText,
  FiLoader,
  FiMinus,
  FiRefreshCw,
} from "react-icons/fi";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  exportOperatorReport,
  getOperatorRevenueAnalytics,
  OPERATOR_REPORT_EXPORT_TYPES,
  type MetricValue,
  type OperatorRevenueAnalytics,
  type OperatorReportExportType,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import Pagination from "../../../components/Pagination";
import { formatDateInputValue } from "../../../utils/date";
import { formatCurrency } from "../../../utils/currency";

type ExportRange = {
  from: string;
  to: string;
};

function createInitialExportRange(): ExportRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);

  return {
    from: formatDateInputValue(from),
    to: formatDateInputValue(to),
  };
}

function isValidExportRange({ from, to }: ExportRange) {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  const rangeInDays = (toTime - fromTime) / 86_400_000;

  return (
    Number.isFinite(fromTime) &&
    Number.isFinite(toTime) &&
    rangeInDays >= 0 &&
    rangeInDays < 92
  );
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function monthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const value = date.toISOString().slice(0, 7);
    options.push({
      value,
      label: `${date.getMonth() + 1}/${date.getFullYear()}`,
    });
  }

  return options;
}

function monthLabel(value: string) {
  const [, month] = value.split("-");
  return month ? `T${Number(month)}` : value;
}

function TrendBadge({ metric }: { metric: MetricValue }) {
  const isUp = metric.trend === "UP";
  const isDown = metric.trend === "DOWN";
  const Icon = isUp ? FiArrowUp : isDown ? FiArrowDown : FiMinus;
  const colorClass = isUp
    ? "text-green-600"
    : isDown
      ? "text-red-600"
      : "text-gray-500";

  return (
    <p className={`mt-2 flex items-center gap-1 text-xs ${colorClass}`}>
      <Icon size={12} />
      {metric.changePercent > 0 ? "+" : ""}
      {metric.changePercent.toFixed(1)}%
    </p>
  );
}

function TrendStatusBadge({ trend }: { trend: MetricValue["trend"] }) {
  const { t } = useTranslation("manager");
  const isUp = trend === "UP";
  const isDown = trend === "DOWN";
  const label = isUp
    ? t("reports.increased")
    : isDown
      ? t("reports.decreased")
      : t("reports.flat");
  const colorClass = isUp
    ? "bg-green-100 text-green-700"
    : isDown
      ? "bg-red-100 text-red-700"
      : "bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {label}
    </span>
  );
}

export default function ManagerReports() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(currentMonthValue);
  const [analytics, setAnalytics] = useState<OperatorRevenueAnalytics | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [exportRange, setExportRange] = useState<ExportRange>(
    createInitialExportRange,
  );
  const [downloadingType, setDownloadingType] =
    useState<OperatorReportExportType | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const pageSize = 8;
  const months = useMemo(() => monthOptions(), []);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      setAnalytics(await getOperatorRevenueAnalytics({ month }));
    } catch (error) {
      setAnalytics(null);
      setLoadError(
        error instanceof Error ? error.message : tRef.current("reports.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadAnalytics();
    });

    return () => {
      cancelled = true;
    };
  }, [loadAnalytics]);

  const monthlyChartData = useMemo(
    () =>
      (analytics?.monthly ?? []).map((item) => ({
        month: monthLabel(item.month),
        revenue: Math.round(item.netRevenueVnd),
        trips: item.tripCount,
      })),
    [analytics],
  );

  const routeChartData = useMemo(
    () =>
      (analytics?.routePerformance ?? []).map((item) => ({
        name: item.routeName,
        efficiency: item.completionRatePercent,
      })),
    [analytics],
  );

  const distribution = useMemo(() => {
    if (!analytics) return [];
    const ticket = analytics.summary.netTicketRevenueVnd.currentValue;
    const parcel = analytics.summary.netParcelRevenueVnd.currentValue;
    const total = ticket + parcel;

    return [
      {
        label: t("reports.ticketRevenue"),
        amount: ticket,
        percent: total > 0 ? (ticket / total) * 100 : 0,
      },
      {
        label: t("reports.parcelRevenue"),
        amount: parcel,
        percent: total > 0 ? (parcel / total) * 100 : 0,
      },
    ];
  }, [analytics, t]);

  async function handleExport(reportType: OperatorReportExportType) {
    setExportError("");
    setExportMessage("");

    if (!isValidExportRange(exportRange)) {
      setExportError(t("reports.invalidExportRange"));
      return;
    }

    setDownloadingType(reportType);

    try {
      const report = await exportOperatorReport(reportType, exportRange);
      const url = URL.createObjectURL(report);
      const anchor = document.createElement("a");
      const from = exportRange.from.replaceAll("-", "");
      const to = exportRange.to.replaceAll("-", "");

      anchor.href = url;
      anchor.download = `${reportType}-report-${from}-${to}.xlsx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage(
        t("reports.exportSuccess", {
          report: t(`reports.exportTypes.${reportType}`),
        }),
      );
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error
          ? downloadError.message
          : t("reports.exportFailed"),
      );
    } finally {
      setDownloadingType(null);
    }
  }

  const summary = analytics?.summary;
  const detailRows = summary
    ? [
        {
          key: "totalRevenue",
          label: t("reports.totalRevenue"),
          value: formatCurrency(summary.netRevenueVnd.currentValue),
          metric: summary.netRevenueVnd,
        },
        {
          key: "avgPerTrip",
          label: t("reports.avgPerTripRow"),
          value: formatCurrency(
            summary.averageNetRevenuePerTripVnd.currentValue,
          ),
          metric: summary.averageNetRevenuePerTripVnd,
        },
        {
          key: "ticketRevenue",
          label: t("reports.onlineTicketRevenue"),
          value: formatCurrency(summary.netTicketRevenueVnd.currentValue),
          metric: summary.netTicketRevenueVnd,
        },
      ]
    : [];

  useToastFeedback({ message: exportMessage, error: loadError || exportError });
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("reports.title")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t("reports.subtitleDetail")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomSelect
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            {months.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={isLoading}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
            {tc("refresh")}
          </button>
        </div>
      </div>


      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
                <FiFileText />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {t("reports.exportTitle")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("reports.exportSubtitle")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                {tc("from")}
              </span>
              <CustomDateTimeInput
                type="date"
                value={exportRange.from}
                onChange={(event) =>
                  setExportRange((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm sm:w-44"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                {tc("to")}
              </span>
              <CustomDateTimeInput
                type="date"
                value={exportRange.to}
                onChange={(event) =>
                  setExportRange((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm sm:w-44"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {OPERATOR_REPORT_EXPORT_TYPES.map((reportType) => (
            <button
              key={reportType}
              type="button"
              onClick={() => void handleExport(reportType)}
              disabled={downloadingType !== null}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-vr-300 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  {t(`reports.exportTypes.${reportType}`)}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {t("reports.xlsxFile")}
                </span>
              </span>
              {downloadingType === reportType ? (
                <FiLoader className="shrink-0 animate-spin text-vr-600" />
              ) : (
                <FiDownload className="shrink-0 text-vr-700" />
              )}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          <p className="text-xs text-gray-500">
            {t("reports.exportRangeHint")}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.monthRevenue")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCurrency(summary.netRevenueVnd.currentValue)}
          </p>
          {summary && <TrendBadge metric={summary.netRevenueVnd} />}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.avgPerTrip")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCurrency(
                  summary.averageNetRevenuePerTripVnd.currentValue,
                )}
          </p>
          {summary && <TrendBadge metric={summary.averageNetRevenuePerTripVnd} />}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.ticketRevenueShort")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCurrency(summary.netTicketRevenueVnd.currentValue)}
          </p>
          {summary && <TrendBadge metric={summary.netTicketRevenueVnd} />}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.parcelRevenue")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCurrency(summary.netParcelRevenueVnd.currentValue)}
          </p>
          {summary && <TrendBadge metric={summary.netParcelRevenueVnd} />}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("reports.revenueTrips")}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {t("reports.revenueChartSubtitle")}
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
            aria-label={t("reports.revenueTrips")}
          >
            <span className="inline-flex items-center gap-2 font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              {t("reports.chartRevenue")}
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
              {t("reports.chartTrips")}
            </span>
          </div>
        </div>

        {monthlyChartData.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-sm text-gray-500">
            {isLoading ? tc("loading") : t("reports.noData")}
          </div>
        ) : (
          <div className="px-3 pb-4 pt-6 sm:px-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("reports.chartRevenue")}
                  </span>
                  <span className="text-xs text-gray-500">đ</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="operatorRevenueArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 6" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value) => formatCurrency(Number(value))} width={100} />
                    <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }} contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)" }} formatter={(value) => [formatCurrency(Number(value)), t("reports.chartRevenue")]} />
                    <Area type="monotone" dataKey="revenue" name={t("reports.chartRevenue")} stroke="#0f9f94" strokeWidth={3} fill="url(#operatorRevenueArea)" activeDot={{ r: 5, fill: "#0f9f94", stroke: "#ffffff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("reports.chartTrips")}
                  </span>
                  <span className="text-xs text-gray-500">{t("reports.chartTrips")}</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 6" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} width={28} />
                    <Tooltip cursor={{ fill: "#e0f2fe" }} contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)" }} formatter={(value) => [String(Number(value ?? 0)), t("reports.chartTrips")]} />
                    <Bar dataKey="trips" name={t("reports.chartTrips")} fill="#0ea5e9" radius={[6, 6, 2, 2]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("reports.routePerformance")}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {t("reports.routePerformanceSubtitle")}
            </p>
          </div>

          {routeChartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
              {isLoading ? tc("loading") : t("reports.noData")}
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(300, routeChartData.length * 52)}
            >
              <BarChart
                data={routeChartData}
                layout="vertical"
                margin={{ top: 4, right: 18, left: 8, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value ?? 0).toFixed(1)}%`,
                    t("reports.efficiency"),
                  ]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                  }}
                />
                <Bar
                  dataKey="efficiency"
                  name={t("reports.efficiency")}
                  fill="#14b8a6"
                  radius={[0, 6, 6, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("reports.revenueDistribution")}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {t("reports.bySource")}
            </p>
          </div>

          <div className="space-y-6">
            {distribution.map((item, idx) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {item.label}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(item.amount)}{" "}
                    <span className="text-gray-500">
                      · {item.percent.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="w-full h-8 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full flex items-center justify-end px-3 text-white text-xs font-semibold rounded-full transition-all ${
                      idx === 0 ? "bg-blue-500" : "bg-blue-300"
                    }`}
                    style={{ width: `${item.percent}%` }}
                  >
                    {item.percent > 10 && `${item.percent.toFixed(0)}%`}
                  </div>
                </div>
              </div>
            ))}
            {distribution.length === 0 && (
              <p className="text-sm text-gray-500">
                {isLoading ? tc("loading") : t("reports.noData")}
              </p>
            )}
          </div>

          {summary && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {t("reports.totalRevenue")}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(summary.netRevenueVnd.currentValue)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {t("reports.detailStats")}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("reports.metric")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("reports.value")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t("reports.vsLastMonth")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {tc("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{row.value}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      row.metric.trend === "UP"
                        ? "text-green-600"
                        : row.metric.trend === "DOWN"
                          ? "text-red-600"
                          : "text-gray-500"
                    }`}
                  >
                    {row.metric.changePercent > 0 ? "+" : ""}
                    {row.metric.changePercent.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <TrendStatusBadge trend={row.metric.trend} />
                  </td>
                </tr>
              ))}
              {detailRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                    {isLoading ? tc("loading") : t("reports.noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={detailRows.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

