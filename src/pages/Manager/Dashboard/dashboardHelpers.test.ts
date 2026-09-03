import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mapDashboardChart,
  revenueChartRange,
  summarizeDashboardPeriod,
  type RevenueChartPoint,
} from "./dashboardHelpers";

describe("dashboard period helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends a historical 12-month chart at the selected month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 3, 9, 30));

    expect(revenueChartRange("2026-08")).toEqual({
      from: "2025-09-01",
      to: "2026-08-31",
    });
    expect(revenueChartRange("2026-09")).toEqual({
      from: "2025-10-01",
      to: "2026-09-03",
    });
  });

  it("summarizes the selected quarter and selected year separately", () => {
    const data: RevenueChartPoint[] = [
      { monthKey: "2026-01", month: "T1", revenue: 1_000, bookings: 1 },
      { monthKey: "2026-07", month: "T7", revenue: 7_000, bookings: 7 },
      { monthKey: "2026-08", month: "T8", revenue: 8_000, bookings: 8 },
      { monthKey: "2026-09", month: "T9", revenue: 9_000, bookings: 9 },
    ];

    expect(summarizeDashboardPeriod(data, "2026-08")).toEqual({
      quarterRevenue: 15_000,
      quarterBookings: 15,
      yearRevenue: 16_000,
      yearBookings: 16,
    });
  });

  it("does not render a month after the selected chart month", () => {
    const data = mapDashboardChart(
      [
        { date: "2026-08-15", totalBookings: 6 },
        { date: "2026-09-01", totalBookings: 8 },
      ],
      [],
      "2026-08",
    );

    expect(data).toEqual([
      {
        monthKey: "2026-08",
        month: "T8",
        revenue: 0,
        bookings: 6,
      },
    ]);
  });
});
