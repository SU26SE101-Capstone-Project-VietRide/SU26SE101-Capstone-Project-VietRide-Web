import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatCompactMoney(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  return value.toLocaleString("vi-VN");
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
      setAnalytics(await getOperatorRevenueAnalytics(month));
    } catch (error) {
      setAnalytics(null);
      setLoadError(
        error instanceof Error ? error.message : t("reports.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [month, t]);

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
        revenue: Math.round(item.revenueVnd / 1_000_000),
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
    const ticket = analytics.summary.ticketRevenueVnd.currentValue;
    const parcel = analytics.summary.parcelRevenueVnd.currentValue;
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
          value: formatCompactMoney(summary.totalRevenueVnd.currentValue),
          metric: summary.totalRevenueVnd,
        },
        {
          key: "avgPerTrip",
          label: t("reports.avgPerTripRow"),
          value: formatCompactMoney(
            summary.averageRevenuePerTripVnd.currentValue,
          ),
          metric: summary.averageRevenuePerTripVnd,
        },
        {
          key: "ticketRevenue",
          label: t("reports.onlineTicketRevenue"),
          value: formatCompactMoney(summary.ticketRevenueVnd.currentValue),
          metric: summary.ticketRevenueVnd,
        },
      ]
    : [];

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

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {loadError}
        </div>
      )}

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
          {exportError && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {exportError}
            </p>
          )}
          {exportMessage && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {exportMessage}
            </p>
          )}
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
              : formatCompactMoney(summary.totalRevenueVnd.currentValue)}
          </p>
          {summary && <TrendBadge metric={summary.totalRevenueVnd} />}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.avgPerTrip")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCompactMoney(
                  summary.averageRevenuePerTripVnd.currentValue,
                )}
          </p>
          {summary && <TrendBadge metric={summary.averageRevenuePerTripVnd} />}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.ticketRevenueShort")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCompactMoney(summary.ticketRevenueVnd.currentValue)}
          </p>
          {summary && <TrendBadge metric={summary.ticketRevenueVnd} />}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.parcelRevenue")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading || !summary
              ? "-"
              : formatCompactMoney(summary.parcelRevenueVnd.currentValue)}
          </p>
          {summary && <TrendBadge metric={summary.parcelRevenueVnd} />}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("reports.revenueTrips")}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {t("reports.revenueChartSubtitle")}
            </p>
          </div>
        </div>

        {monthlyChartData.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-sm text-gray-500">
            {isLoading ? tc("loading") : t("reports.noData")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={monthlyChartData}
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
              />
              <Legend />
              <Bar
                dataKey="revenue"
                name={t("reports.chartRevenue")}
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="trips"
                name={t("reports.chartTrips")}
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
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={routeChartData}>
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
                  name={t("reports.efficiency")}
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
                    {formatCompactMoney(item.amount)}{" "}
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
                  {formatCompactMoney(summary.totalRevenueVnd.currentValue)}
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
