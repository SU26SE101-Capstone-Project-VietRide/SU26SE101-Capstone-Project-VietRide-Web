import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyChartState from "./EmptyChartState";
import { compactRouteName, type ParcelRoutePoint } from "./dashboardHelpers";

type ParcelRouteChartProps = {
  data: ParcelRoutePoint[];
  total: number;
  isLoading: boolean;
  isOperatorAdmin: boolean;
};

// Bar top tuyến theo số parcel + danh sách chi tiết tuyến
export default function ParcelRouteChart({
  data,
  total,
  isLoading,
  isOperatorAdmin,
}: ParcelRouteChartProps) {
  const { t } = useTranslation("manager");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("dashboard.parcelDetail")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("dashboard.parcelRouteHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
            {t("dashboard.parcelRouteTotal", { count: total })}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {t("dashboard.topRoutes", { count: data.length })}
          </span>
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyChartState
          message={
            isOperatorAdmin
              ? isLoading
                ? t("dashboard.loadingData")
                : t("dashboard.noParcelRouteData")
              : t("dashboard.statsNoPermission")
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)]">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 20, bottom: 4 }}
            >
              <defs>
                <linearGradient id="parcelRouteBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="#e5e7eb"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                width={145}
                tickFormatter={compactRouteName}
                tick={{ fill: "#374151", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "#e5e7eb",
                  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
                }}
              />
              <Bar
                dataKey="value"
                name={t("dashboard.parcelsUnit")}
                fill="url(#parcelRouteBar)"
                radius={[0, 8, 8, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>

          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-slate-50/70 px-4">
            {data.map((route, index) => (
              <div key={route.routeId ?? route.name} className="py-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-sky-700 shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {route.name}
                      </p>
                      <span className="shrink-0 text-sm font-bold text-gray-950">
                        {route.value}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>
                        {t("dashboard.shareOfTotal", {
                          percent: route.sharePercent.toFixed(1),
                        })}
                      </span>
                      {route.tripCount !== undefined && (
                        <span>
                          {t("dashboard.tripCount", { count: route.tripCount })}
                        </span>
                      )}
                      {route.completionRatePercent !== undefined && (
                        <span>
                          {t("dashboard.completionRate", {
                            percent: route.completionRatePercent.toFixed(1),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
