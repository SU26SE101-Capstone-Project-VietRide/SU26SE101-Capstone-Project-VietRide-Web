import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyChartState from "./EmptyChartState";
import { formatCompactMoney, type RevenueChartPoint } from "./dashboardHelpers";

type RevenueChartProps = {
  data: RevenueChartPoint[];
  isLoading: boolean;
  onViewAll: () => void;
};

// Biểu đồ doanh thu + lượt đặt theo tháng
export default function RevenueChart({ data, isLoading, onViewAll }: RevenueChartProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("dashboard.revenueChart")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("dashboard.revenueChartHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="cursor-pointer text-left text-sm font-medium text-vr-600 hover:text-vr-700"
        >
          {tc("viewAll")}
        </button>
      </div>
      {data.length === 0 ? (
        <EmptyChartState
          message={
            isLoading ? t("dashboard.loadingData") : t("dashboard.noRevenueData")
          }
        />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <YAxis
              yAxisId="bookings"
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tickFormatter={formatCompactMoney}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
              contentStyle={{
                borderRadius: 12,
                borderColor: "#e5e7eb",
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
              }}
            />
            <Legend iconType="circle" />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="#0284c7"
              strokeWidth={3}
              dot={{ r: 3, fill: "#ffffff", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              name={`${t("dashboard.chartRevenue")} (VND)`}
            />
            <Bar
              yAxisId="bookings"
              dataKey="bookings"
              fill="#8b5cf6"
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
              name={t("dashboard.chartBookings")}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
