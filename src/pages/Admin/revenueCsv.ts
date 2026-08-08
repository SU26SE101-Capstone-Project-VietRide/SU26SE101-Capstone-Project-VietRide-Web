import type { AdminRevenueAnalytics } from "../../api/vietride";
import { downloadCsv } from "../../utils/csv";

export type RevenueCsvLabels = {
  periodFrom: string;
  periodTo: string;
  timezone: string;
  month: string;
  totalProjectRevenue: string;
  netTransportRevenue: string;
  netTicketRevenue: string;
  netParcelRevenue: string;
  subscriptionRevenue: string;
  paidToOperators: string;
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
      labels.totalProjectRevenue,
      labels.netTransportRevenue,
      labels.netTicketRevenue,
      labels.netParcelRevenue,
      labels.subscriptionRevenue,
      labels.paidToOperators,
    ],
    monthly.map((item) => [
      period.from,
      period.to,
      period.timezone,
      item.month,
      item.revenue.totalProjectRevenueVnd,
      item.revenue.netTransportRevenueVnd,
      item.revenue.netTicketRevenueVnd,
      item.revenue.netParcelRevenueVnd,
      item.revenue.subscriptionRevenueVnd,
      item.settlement.paidToOperatorsVnd,
    ]),
  );
}
