import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowUp,
  FiCalendar,
  FiDownload,
  FiFileText,
  FiLoader,
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
  OPERATOR_REPORT_EXPORT_TYPES,
  type OperatorReportExportType,
} from "../../../api/vietride";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import Pagination from "../../../components/Pagination";
import { formatDateInputValue } from "../../../utils/date";

type RevenueData = {
  month: string;
  revenue: number;
  trips: number;
};

type RouteEfficiency = {
  name: string;
  efficiency: number;
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
  { category: "Hàng hóa", amount: 410, percent: 14 },
  { category: "Dịch vụ khác", amount: 145, percent: 4 },
];

const CATEGORY_KEYS = [
  "onlineTickets",
  "counterTickets",
  "parcels",
  "otherServices",
] as const;

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

export default function ManagerReports() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [page, setPage] = useState(1);
  const [exportRange, setExportRange] = useState<ExportRange>(
    createInitialExportRange,
  );
  const [downloadingType, setDownloadingType] =
    useState<OperatorReportExportType | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const pageSize = 8;

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
      totalRevenue: (totalRevenue / 100).toFixed(1),
      avgPerTrip,
      monthChangePercent,
      onlineRevenue: (onlineRevenue / 100).toFixed(2),
      counterRevenue: (counterRevenue / 100).toFixed(2),
      parcelRevenue: (parcelRevenue / 100).toFixed(2),
    };
  }, []);

  const revenueChartData = revenueDistribution.map((item, idx) => ({
    name: t(`reports.${CATEGORY_KEYS[idx]}`),
    revenue: item.amount,
    percent: item.percent,
  }));

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

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("reports.title")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t("reports.subtitleDetail")}
          </p>
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
            d{stats.totalRevenue}B
          </p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <FiArrowUp size={12} /> {stats.monthChangePercent > 0 ? "↑" : "↓"}{" "}
            {Math.abs(stats.monthChangePercent)}%
          </p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.avgPerTrip")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.avgPerTrip}M
          </p>
          <p className="text-xs text-green-600 mt-2">4.2%</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.ticketRevenueShort")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.onlineRevenue}B
          </p>
          <p className="text-xs text-green-600 mt-2">12.1%</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-medium">
            {t("reports.parcelRevenue")}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            d{stats.parcelRevenue}M
          </p>
          <p className="text-xs text-green-600 mt-2">22.7%</p>
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
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <FiCalendar size={14} /> {tc("month")}
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
              formatter={(value) =>
                typeof value === "number" ? value : (value ?? "")
              }
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
                {t("reports.totalRevenue")}
              </span>
              <span className="text-lg font-bold text-gray-900">
                d{revenueChartData.reduce((sum, item) => sum + item.revenue, 0)}
                M
              </span>
            </div>
          </div>
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
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  {t("reports.totalRevenue")}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  d{stats.totalRevenue}B
                </td>
                <td className="px-4 py-3 text-green-600 font-medium">
                  +{stats.monthChangePercent}%
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                    {t("reports.increased")}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  {t("reports.avgPerTripRow")}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  d{stats.avgPerTrip}M
                </td>
                <td className="px-4 py-3 text-green-600 font-medium">+4.2%</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                    {t("reports.increased")}
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  {t("reports.onlineTicketRevenue")}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  d{stats.onlineRevenue}B
                </td>
                <td className="px-4 py-3 text-green-600 font-medium">+12.1%</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                    {t("reports.increased")}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={3}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
