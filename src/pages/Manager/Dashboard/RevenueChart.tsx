import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import EmptyChartState from "./EmptyChartState";
import { formatCompactMoney, formatCompactNumber, type RevenueChartPoint } from "./dashboardHelpers";

type RevenueChartProps = { data: RevenueChartPoint[]; isLoading: boolean };

export default function RevenueChart({ data, isLoading }: RevenueChartProps) {
  const { t } = useTranslation("manager");
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">{t("dashboard.revenueChart")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("dashboard.revenueChartHint")}</p>
      </div>
      {data.length === 0 ? (
        <EmptyChartState message={isLoading ? t("dashboard.loadingData") : t("dashboard.noRevenueData")} />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
  <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
    <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
    <YAxis yAxisId="revenue" width={88} axisLine={false} tickLine={false} tickFormatter={formatCompactMoney} tick={{ fill: "#6b7280", fontSize: 12 }} />
    <YAxis yAxisId="bookings" orientation="right" width={44} axisLine={false} tickLine={false} tickFormatter={formatCompactNumber} tick={{ fill: "#6b7280", fontSize: 12 }} />
    <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)" }} formatter={(value, name) => [name === t("dashboard.chartRevenue") ? formatCompactMoney(Number(value ?? 0)) : formatCompactNumber(Number(value ?? 0)), name]} />
    <Legend />
    <Bar yAxisId="revenue" dataKey="revenue" fill="#0284c7" radius={[5, 5, 0, 0]} name={t("dashboard.chartRevenue")} />
    <Bar yAxisId="bookings" dataKey="bookings" fill="#14b8a6" radius={[5, 5, 0, 0]} name={t("dashboard.chartBookings")} />
  </BarChart>
</ResponsiveContainer>
      )}
    </section>
  );
}