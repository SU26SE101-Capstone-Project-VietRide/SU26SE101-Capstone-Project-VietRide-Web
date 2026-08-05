import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiBarChart2, FiPackage, FiTrendingUp, FiTruck } from "react-icons/fi";
import { formatCurrency } from "../../../utils/currency";
import {
  formatCompactNumber,
  percentageChange,
  type DashboardSummary,
} from "./dashboardHelpers";

type KPICard = {
  labelKey: string;
  value: string;
  helper: string;
  change?: string;
  trend: "up" | "down" | "neutral";
  icon: ReactNode;
  iconClassName: string;
};

type KpiGridProps = {
  summary: DashboardSummary;
};

// Khối 4 thẻ KPI: doanh thu, lượt đặt, đội xe, chuyến đang chạy
export default function KpiGrid({ summary }: KpiGridProps) {
  const { t } = useTranslation("manager");

  const kpis: KPICard[] = useMemo(() => {
    const buildChange = (current: number | null, previous: number | null) => {
      if (current !== null && current > 0 && previous === 0) {
        return {
          change: t("dashboard.newVsLastMonth"),
          trend: "up" as const,
        };
      }

      const changeValue = percentageChange(current, previous);
      if (changeValue === undefined) {
        return { trend: "neutral" as const };
      }

      return {
        change: `${changeValue > 0 ? "+" : ""}${changeValue.toFixed(1)}%`,
        trend:
          changeValue === 0
            ? ("neutral" as const)
            : changeValue > 0
              ? ("up" as const)
              : ("down" as const),
      };
    };

    const revenueChange = buildChange(
      summary.revenue.currentMonth,
      summary.revenue.previousMonth,
    );
    const bookingChange = buildChange(
      summary.bookings.currentMonth,
      summary.bookings.previousMonth,
    );
    const year = new Date().getFullYear();

    return [
      {
        labelKey: "dashboard.revenue",
        value:
          summary.revenue.currentMonth === null
            ? "-"
            : formatCurrency(summary.revenue.currentMonth),
        helper:
          summary.revenue.yearToDate === null
            ? t("dashboard.unavailable")
            : t("dashboard.yearToDateValue", {
                year,
                value: formatCurrency(summary.revenue.yearToDate),
              }),
        ...revenueChange,
        icon: <FiBarChart2 className="h-5 w-5" />,
        iconClassName: "bg-sky-50 text-sky-600",
      },
      {
        labelKey: "dashboard.bookings",
        value:
          summary.bookings.currentMonth === null
            ? "-"
            : formatCompactNumber(summary.bookings.currentMonth),
        helper:
          summary.bookings.yearToDate === null
            ? t("dashboard.unavailable")
            : t("dashboard.yearToDateValue", {
                year,
                value: formatCompactNumber(summary.bookings.yearToDate),
              }),
        ...bookingChange,
        icon: <FiPackage className="h-5 w-5" />,
        iconClassName: "bg-violet-50 text-violet-600",
      },
      {
        labelKey: "dashboard.fleet",
        value: summary.fleet === null ? "-" : formatCompactNumber(summary.fleet),
        helper: t("dashboard.fleetHelper"),
        trend: "neutral",
        icon: <FiTruck className="h-5 w-5" />,
        iconClassName: "bg-amber-50 text-amber-600",
      },
      {
        labelKey: "dashboard.activeTrips",
        value:
          summary.activeTrips === null
            ? "-"
            : formatCompactNumber(summary.activeTrips),
        helper: t("dashboard.activeTripsHelper"),
        trend: "neutral",
        icon: <FiTrendingUp className="h-5 w-5" />,
        iconClassName: "bg-emerald-50 text-emerald-600",
      },
    ];
  }, [summary, t]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <article
          key={kpi.labelKey}
          aria-label={t(kpi.labelKey)}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className={`rounded-xl p-2.5 ${kpi.iconClassName}`}>
              {kpi.icon}
            </div>
            {kpi.change && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  kpi.trend === "up"
                    ? "bg-emerald-50 text-emerald-700"
                    : kpi.trend === "down"
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {kpi.change}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-600">{t(kpi.labelKey)}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
            {kpi.value}
          </p>
          <p className="mt-2 text-xs text-gray-500">{kpi.helper}</p>
        </article>
      ))}
    </div>
  );
}
