import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiBarChart2, FiPackage, FiTrendingUp, FiTruck } from "react-icons/fi";
import { formatCurrency } from "../../../utils/currency";
import { formatCompactNumber, type DashboardSummary } from "./dashboardHelpers";
import { StatCard } from "../../../components/StatCard";

type KPICard = {
  labelKey: string;
  value: string;
  icon: ReactNode;
  iconClassName: string;
};

type KpiGridProps = { summary: DashboardSummary };

export default function KpiGrid({ summary }: KpiGridProps) {
  const { t } = useTranslation("manager");

  const kpis: KPICard[] = useMemo(
    () => [
      {
        labelKey: "dashboard.revenue",
        value: summary.revenue.currentMonth === null ? "-" : formatCurrency(summary.revenue.currentMonth),
        icon: <FiBarChart2 className="h-5 w-5" />,
        iconClassName: "bg-sky-50 text-sky-600",
      },
      {
        labelKey: "dashboard.bookings",
        value: summary.bookings.currentMonth === null ? "-" : formatCompactNumber(summary.bookings.currentMonth),
        icon: <FiPackage className="h-5 w-5" />,
        iconClassName: "bg-violet-50 text-violet-600",
      },
      {
        labelKey: "dashboard.fleet",
        value: summary.fleet === null ? "-" : formatCompactNumber(summary.fleet),
        icon: <FiTruck className="h-5 w-5" />,
        iconClassName: "bg-amber-50 text-amber-600",
      },
      {
        labelKey: "dashboard.activeTrips",
        value: summary.activeTrips === null ? "-" : formatCompactNumber(summary.activeTrips),
        icon: <FiTrendingUp className="h-5 w-5" />,
        iconClassName: "bg-emerald-50 text-emerald-600",
      },
    ],
    [summary],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <StatCard
          key={kpi.labelKey}
          label={t(kpi.labelKey)}
          value={kpi.value}
          icon={kpi.icon}
          iconClassName={kpi.iconClassName}
        />
      ))}
    </div>
  );
}