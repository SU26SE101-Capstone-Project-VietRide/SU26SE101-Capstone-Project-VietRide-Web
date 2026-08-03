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
  grossRevenue: "Tổng doanh thu (VND)",
  paidToOperators: "Trả nhà xe (VND)",
  platformRevenue: "Doanh thu nền tảng (VND)",
} satisfies RevenueCsvLabels;

const analytics = {
  period: {
    from: "2026-01-01",
    to: "2026-12-31",
    timezone: "Asia/Ho_Chi_Minh",
  },
  summary: {
    grossRevenueVnd: { currentValue: 100, previousValue: 0, changePercent: 0, trend: "UP" },
    paidToOperatorsVnd: { currentValue: 60, previousValue: 0, changePercent: 0, trend: "UP" },
    platformRevenueVnd: { currentValue: 40, previousValue: 0, changePercent: 0, trend: "UP" },
  },
  monthly: [
    {
      month: "2026-07",
      grossRevenueVnd: 100,
      paidToOperatorsVnd: 60,
      platformRevenueVnd: 40,
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
        "Tổng doanh thu (VND)",
        "Trả nhà xe (VND)",
        "Doanh thu nền tảng (VND)",
      ],
      [["2026-01-01", "2026-12-31", "Asia/Ho_Chi_Minh", "2026-07", 100, 60, 40]],
    );
  });
});
