import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import EmptyChartState from "./EmptyChartState";
import { formatCompactMoney, formatCompactNumber, type RevenueChartPoint } from "./dashboardHelpers";
import { CHART_GRID_COLOR, chartColorAt } from "../../../lib/chartColors";
import CustomSelect from "../../../components/CustomSelect";

type RevenueMonthOption = { value: string; label: string };

type RevenueChartProps = {
  data: RevenueChartPoint[];
  isLoading: boolean;
  selectedMonth?: string;
  monthOptions?: RevenueMonthOption[];
  onMonthChange?: (month: string) => void;
};

export default function RevenueChart({
  data,
  isLoading,
  selectedMonth,
  monthOptions = [],
  onMonthChange,
}: RevenueChartProps) {
  const { t } = useTranslation("manager");
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("dashboard.revenueChart")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("dashboard.revenueChartHint")}</p>
        </div>
        {selectedMonth && onMonthChange && monthOptions.length > 0 && (
          <CustomSelect
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
            className="min-w-[132px] shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-medium text-gray-800"
            aria-label={t("dashboard.revenueMonth")}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
        )}
      </div>
      {data.length === 0 ? (
        <EmptyChartState message={isLoading ? t("dashboard.loadingData") : t("dashboard.noRevenueData")} />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
  <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
    <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID_COLOR} vertical={false} />
    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
    {/* Nhãn dạng "14.000.000 đ" cần ~95px ở cỡ chữ 12; để 88px là bị bẻ xuống
        hai dòng. Chừa dư cho mốc hàng tỷ ("1.250.000.000 đ"). */}
    <YAxis yAxisId="revenue" width={120} axisLine={false} tickLine={false} tickFormatter={formatCompactMoney} tick={{ fill: "#6b7280", fontSize: 12 }} />
    <YAxis yAxisId="bookings" orientation="right" width={44} axisLine={false} tickLine={false} tickFormatter={formatCompactNumber} tick={{ fill: "#6b7280", fontSize: 12 }} />
    <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)" }} formatter={(value, name) => [name === t("dashboard.chartRevenue") ? formatCompactMoney(Number(value ?? 0)) : formatCompactNumber(Number(value ?? 0)), name]} />
    <Legend />
    <Bar yAxisId="revenue" dataKey="revenue" fill={chartColorAt(0)} radius={[5, 5, 0, 0]} name={t("dashboard.chartRevenue")} />
    <Bar yAxisId="bookings" dataKey="bookings" fill={chartColorAt(1)} radius={[5, 5, 0, 0]} name={t("dashboard.chartBookings")} />
  </BarChart>
</ResponsiveContainer>
      )}
    </section>
  );
}
