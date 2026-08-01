import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminBookingStatsAggregate,
  getAdminDashboardSummary,
  getAdminRevenueAnalytics,
  type AdminDashboardSummary,
  type AdminRevenueAnalytics,
} from "../../api/vietride";
import AdminDashboard from "./Dashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container,
    LineChart: Container,
    BarChart: Container,
    PieChart: Container,
    Pie: Container,
    Line: () => null,
    Bar: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

vi.mock("../../api/vietride", () => ({
  getAdminBookingStatsAggregate: vi.fn(),
  getAdminDashboardSummary: vi.fn(),
  getAdminRevenueAnalytics: vi.fn(),
}));

describe("Admin Dashboard", () => {
  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const dashboard = {
    period: { from, to, timezone: "Asia/Ho_Chi_Minh" },
    totalRevenue: { currentValue: 2_850_000, previousValue: 0, changePercent: 0, trend: "UP" },
    activeOperators: { currentValue: 1, previousValue: 0, changePercent: 0, trend: "UP" },
    activeUsers: { currentValue: 15, previousValue: 10, changePercent: 50, trend: "UP" },
    bookings: { currentValue: 9, previousValue: 12, changePercent: -25, trend: "DOWN" },
    userDistribution: [
      { role: "PASSENGER", count: 7 },
      { role: "OPERATOR_STAFF", count: 2 },
    ],
    operatorStatusDistribution: [
      { status: "APPROVED", count: 8, percent: 80 },
      { status: "PENDING", count: 2, percent: 20 },
    ],
  } satisfies AdminDashboardSummary;

  const revenue = {
    period: dashboard.period,
    summary: {
      grossRevenueVnd: { currentValue: 137_600_000, previousValue: 0, changePercent: 0, trend: "UP" },
      platformRevenueVnd: { currentValue: 137_600_000, previousValue: 0, changePercent: 0, trend: "UP" },
      paidToOperatorsVnd: { currentValue: 0, previousValue: 0, changePercent: 0, trend: "FLAT" },
    },
    monthly: [
      {
        month: `${year}-07`,
        grossRevenueVnd: 137_600_000,
        paidToOperatorsVnd: 0,
        platformRevenueVnd: 137_600_000,
      },
    ],
    topOperators: [],
  } satisfies AdminRevenueAnalytics;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminBookingStatsAggregate).mockResolvedValue({
      items: [{ date: `${year}-07-01`, totalBookings: 9 }],
    });
    vi.mocked(getAdminDashboardSummary).mockResolvedValue(dashboard);
    vi.mocked(getAdminRevenueAnalytics).mockResolvedValue(revenue);
  });

  it("uses the exact local calendar year and API-backed dashboard values", async () => {
    render(<AdminDashboard />);

    expect(
      await screen.findByText(
        `dashboard.period 01/01/${year} 31/12/${year} Asia/Ho_Chi_Minh`,
      ),
    ).toBeInTheDocument();

    expect(getAdminDashboardSummary).toHaveBeenCalledWith({ from, to });
    expect(getAdminRevenueAnalytics).toHaveBeenCalledWith({
      from,
      to,
      groupBy: "month",
      top: 10,
    });
    expect(getAdminBookingStatsAggregate).toHaveBeenCalledTimes(1);
    expect(getAdminBookingStatsAggregate).toHaveBeenCalledWith({
      from,
      to,
      groupBy: "month",
    });

    const pendingCard = screen.getByText("dashboard.pendingOperators").parentElement;
    expect(pendingCard).not.toBeNull();
    expect(within(pendingCard as HTMLElement).getByText("2")).toBeInTheDocument();

    const approvedCard = screen.getByText("dashboard.approvedLabel").parentElement;
    expect(approvedCard).not.toBeNull();
    expect(within(approvedCard as HTMLElement).getByText("8")).toBeInTheDocument();

    expect(screen.queryByText("28")).not.toBeInTheDocument();
    expect(screen.getByText("dashboard.noOperatorRevenue")).toBeInTheDocument();
    expect(screen.getByText("dashboard.operatorStaff")).toBeInTheDocument();
    expect(screen.getByText("↓ -25.0%")).toHaveClass("text-red-600");
  });
});
