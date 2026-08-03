import type { AdminRevenueAnalytics } from "../../api/vietride";
import { downloadCsv } from "../../utils/csv";

export type RevenueCsvLabels = {
  periodFrom: string;
  periodTo: string;
  timezone: string;
  month: string;
  grossRevenue: string;
  paidToOperators: string;
  platformRevenue: string;
};

export function downloadRevenueCsv(
  analytics: AdminRevenueAnalytics,
  labels: RevenueCsvLabels,
) {
  const { period, monthly } = analytics;

  downloadCsv(
    `vietride-revenue-${period.from}-to-${period.to}.csv`,
    [
      labels.periodFrom,
      labels.periodTo,
      labels.timezone,
      labels.month,
      labels.grossRevenue,
      labels.paidToOperators,
      labels.platformRevenue,
    ],
    monthly.map((item) => [
      period.from,
      period.to,
      period.timezone,
      item.month,
      item.grossRevenueVnd,
      item.paidToOperatorsVnd,
      item.platformRevenueVnd,
    ]),
  );
}
