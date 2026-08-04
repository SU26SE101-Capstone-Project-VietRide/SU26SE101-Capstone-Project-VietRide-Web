import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorBookingStats,
  getOperatorParcelStats,
  getOperatorParcels,
  getOperatorRevenueAnalytics,
  getOperatorTrips,
  getOperatorVehicles,
} from "../../api/vietride";
import ManagerDashboard from "./Dashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const LineChart = ({
    children,
    data,
  }: {
    children?: ReactNode;
    data?: unknown;
  }) => (
    <div data-testid="revenue-chart" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  );
  const BarChart = ({
    children,
    data,
  }: {
    children?: ReactNode;
    data?: unknown;
  }) => (
    <div data-testid="route-chart" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  );

  return {
    ResponsiveContainer: Container,
    LineChart,
    BarChart,
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
  getOperatorBookingStats: vi.fn(),
  getOperatorParcelStats: vi.fn(),
  getOperatorParcels: vi.fn(),
  getOperatorRevenueAnalytics: vi.fn(),
  getOperatorTrips: vi.fn(),
  getOperatorVehicles: vi.fn(),
}));

describe("Manager Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 2, 9, 30));

    vi.mocked(getOperatorBookingStats).mockResolvedValue({
      items: [
        { date: "2026-07-15", totalBookings: 80, totalRevenue: 8_000_000 },
        { date: "2026-08-01", totalBookings: 30, totalRevenue: 3_000_000 },
      ],
      totalBookings: 110,
      totalRevenue: 11_000_000,
    });
    vi.mocked(getOperatorVehicles).mockResolvedValue({
      items: [
        {
          vehicleId: "vehicle-1",
          operatorId: "operator-1",
          vehicleTypeId: "type-1",
          licensePlate: "51A-123.45",
          totalSeats: 40,
          maxCargoWeightKg: 1_000,
          status: "AVAILABLE",
        },
      ],
      totalItems: 3,
      page: 1,
      pageSize: 5,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getOperatorRevenueAnalytics).mockResolvedValue({
      period: {
        month: "2026-08",
        timezone: "Asia/Ho_Chi_Minh",
        from: "2026-08-01",
        to: "2026-08-31",
      },
      summary: {
        totalRevenueVnd: {
          currentValue: 9_000_000,
          previousValue: 12_000_000,
          changePercent: -25,
          trend: "DOWN",
        },
        ticketRevenueVnd: {
          currentValue: 4_000_000,
          previousValue: 8_000_000,
          changePercent: -50,
          trend: "DOWN",
        },
        parcelRevenueVnd: {
          currentValue: 5_000_000,
          previousValue: 4_000_000,
          changePercent: 25,
          trend: "UP",
        },
        averageRevenuePerTripVnd: {
          currentValue: 2_000_000,
          previousValue: 2_000_000,
          changePercent: 0,
          trend: "FLAT",
        },
      },
      monthly: [
        {
          month: "2026-07",
          revenueVnd: 12_000_000,
          ticketRevenueVnd: 8_000_000,
          parcelRevenueVnd: 4_000_000,
          tripCount: 7,
        },
        {
          month: "2026-08",
          revenueVnd: 9_000_000,
          ticketRevenueVnd: 4_000_000,
          parcelRevenueVnd: 5_000_000,
          tripCount: 2,
        },
      ],
      routePerformance: [
        {
          routeId: "route-a",
          routeName: "Sài Gòn - Đà Lạt",
          originName: "Sài Gòn",
          destinationName: "Đà Lạt",
          tripCount: 5,
          completedTripCount: 4,
          bookingCount: 70,
          parcelCount: 12,
          revenueVnd: 7_000_000,
          completionRatePercent: 80,
        },
      ],
    });
    vi.mocked(getOperatorTrips).mockResolvedValue({
      items: [],
      totalItems: 1,
      page: 1,
      pageSize: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getOperatorParcelStats).mockImplementation(async (params) => {
      if (params.groupBy === "status") {
        return {
          items: [
            { key: "IN_TRANSIT", count: 15 },
            { key: "DELIVERED", count: 10 },
          ],
          totalParcels: 25,
        };
      }

      return {
        items: [
          {
            routeId: "route-a",
            routeName: "Sài Gòn - Đà Lạt",
            parcelCount: 12,
          },
          {
            routeId: "route-b",
            routeName: "Sài Gòn - Vũng Tàu",
            parcelCount: 8,
          },
        ],
        totalParcels: 25,
      };
    });
    vi.mocked(getOperatorParcels).mockResolvedValue({
      items: [],
      totalItems: 0,
      page: 1,
      pageSize: 8,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows monthly ticket metrics with YTD context and keeps chart semantics correct", async () => {
    render(<ManagerDashboard />);

    const revenueCard = await screen.findByRole("article", {
      name: "dashboard.revenue",
    });
    expect(within(revenueCard).getByText("4.000.000 ₫")).toBeInTheDocument();
    expect(
      within(revenueCard).getByText("dashboard.yearToDateValue 2026 11.000.000 ₫"),
    ).toBeInTheDocument();
    expect(within(revenueCard).getByText("-50.0%")).toBeInTheDocument();

    const bookingCard = screen.getByRole("article", {
      name: "dashboard.bookings",
    });
    expect(within(bookingCard).getByText("30")).toBeInTheDocument();
    expect(
      within(bookingCard).getByText("dashboard.yearToDateValue 2026 110"),
    ).toBeInTheDocument();

    const fleetCard = screen.getByRole("article", { name: "dashboard.fleet" });
    expect(within(fleetCard).getByText("3")).toBeInTheDocument();
    const activeTripCard = screen.getByRole("article", {
      name: "dashboard.activeTrips",
    });
    expect(within(activeTripCard).getByText("1")).toBeInTheDocument();

    const chartData = screen.getByTestId("revenue-chart").getAttribute("data-chart");
    expect(chartData).toContain('"monthKey":"2026-08"');
    expect(chartData).toContain('"revenue":4000000');
    expect(chartData).toContain('"bookings":30');
    expect(chartData).not.toContain('"bookings":2');
  });

  it("preserves the parcel total and exposes route share plus available operations data", async () => {
    render(<ManagerDashboard />);

    expect(
      await screen.findByText("dashboard.parcelRouteTotal 25"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sài Gòn - Đà Lạt")).toBeInTheDocument();
    expect(screen.getByText("dashboard.shareOfTotal 48.0")).toBeInTheDocument();
    expect(screen.getByText("dashboard.tripCount 5")).toBeInTheDocument();
    expect(screen.getByText("dashboard.completionRate 80.0")).toBeInTheDocument();

    await waitFor(() => {
      expect(getOperatorBookingStats).toHaveBeenCalledWith({
        from: "2026-01-01",
        to: "2026-08-02",
        groupBy: "date",
      });
      expect(getOperatorRevenueAnalytics).toHaveBeenCalledWith("2026-08");
      expect(getOperatorTrips).toHaveBeenCalledWith(
        expect.objectContaining({ status: "IN_PROGRESS" }),
      );
    });
  });
});
