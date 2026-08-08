import { describe, expect, it, vi } from "vitest";
import type { AdminRevenueAnalytics } from "../../api/vietride";
import { downloadCsv } from "../../utils/csv";
import { downloadRevenueCsv, type RevenueCsvLabels } from "./revenueCsv";

vi.mock("../../utils/csv", () => ({
  downloadCsv: vi.fn(),
}));

const labels = {
  periodFrom: "Từ ngày",
  periodTo: "Đến ngày",
  timezone: "Múi giờ",
  month: "Tháng",
  totalProjectRevenue: "Tổng doanh thu dự án (VND)",
  netTransportRevenue: "Doanh thu vận tải ròng (VND)",
  netTicketRevenue: "Doanh thu vé ròng (VND)",
  netParcelRevenue: "Doanh thu bưu phẩm ròng (VND)",
  subscriptionRevenue: "Doanh thu gói dịch vụ (VND)",
  paidToOperators: "Trả nhà xe (VND)",
} satisfies RevenueCsvLabels;

const analytics = {
  period: {
    from: "2026-01-01",
    to: "2026-12-31",
    timezone: "Asia/Ho_Chi_Minh",
  },
  summary: {
    revenue: {
      totalProjectRevenueVnd: { currentValue: 100, previousValue: 0, changePercent: 0, trend: "UP" },
      netTransportRevenueVnd: { currentValue: 90, previousValue: 0, changePercent: 0, trend: "UP" },
      netTicketRevenueVnd: { currentValue: 80, previousValue: 0, changePercent: 0, trend: "UP" },
      netParcelRevenueVnd: { currentValue: 10, previousValue: 0, changePercent: 0, trend: "UP" },
      subscriptionRevenueVnd: { currentValue: 10, previousValue: 0, changePercent: 0, trend: "UP" },
    },
    settlement: {
      paidToOperatorsVnd: { currentValue: 60, previousValue: 0, changePercent: 0, trend: "UP" },
    },
  },
  monthly: [
    {
      month: "2026-07",
      revenue: {
        totalProjectRevenueVnd: 100,
        netTransportRevenueVnd: 90,
        netTicketRevenueVnd: 80,
        netParcelRevenueVnd: 10,
        subscriptionRevenueVnd: 10,
      },
      settlement: { paidToOperatorsVnd: 60 },
    },
  ],
  topOperators: [],
} satisfies AdminRevenueAnalytics;

describe("downloadRevenueCsv", () => {
  it("exports a flat Excel-friendly monthly revenue table", () => {
    downloadRevenueCsv(analytics, labels);

    expect(downloadCsv).toHaveBeenCalledWith(
      "vietride-revenue-2026-01-01-to-2026-12-31.csv",
      [
        "Từ ngày",
        "Đến ngày",
        "Múi giờ",
        "Tháng",
        "Tổng doanh thu dự án (VND)",
        "Doanh thu vận tải ròng (VND)",
        "Doanh thu vé ròng (VND)",
        "Doanh thu bưu phẩm ròng (VND)",
        "Doanh thu gói dịch vụ (VND)",
        "Trả nhà xe (VND)",
      ],
      [["2026-01-01", "2026-12-31", "Asia/Ho_Chi_Minh", "2026-07", 100, 90, 80, 10, 10, 60]],
    );
  });
});
