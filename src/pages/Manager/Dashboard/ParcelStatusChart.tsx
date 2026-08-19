import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import EmptyChartState from "./EmptyChartState";
import type { ParcelStatusPoint } from "./dashboardHelpers";
import { Badge } from "../../../components/ui/Badge";

type ParcelStatusChartProps = {
  data: ParcelStatusPoint[];
  total: number;
  isLoading: boolean;
  isOperatorAdmin: boolean;
};

// Pie thống kê parcel theo trạng thái (YTD)
export default function ParcelStatusChart({
  data,
  total,
  isLoading,
  isOperatorAdmin,
}: ParcelStatusChartProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("dashboard.parcelStatus")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("dashboard.yearToDate")}
          </p>
        </div>
        {total > 0 && (
          <Badge tone="neutral">
            {total} {t("dashboard.parcelsUnit")}
          </Badge>
        )}
      </div>
      {data.length === 0 ? (
        <EmptyChartState
          message={
            isOperatorAdmin
              ? isLoading
                ? t("dashboard.loadingData")
                : t("dashboard.noParcelData")
              : t("dashboard.statsNoPermission")
          }
        />
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-2xl text-gray-950">{total}</strong>
              <span className="text-xs text-gray-500">
                {t("dashboard.parcelStatusTotal")}
              </span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {data.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-gray-700">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {tc(`enumLabels.${item.key}`, {
                    defaultValue: item.key.replaceAll("_", " "),
                  })}
                </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
