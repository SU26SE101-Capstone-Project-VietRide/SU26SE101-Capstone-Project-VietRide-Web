import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminRevenueAnalytics,
  type AdminRevenueAnalytics,
} from "../../api/vietride";
import { downloadRevenueCsv } from "./revenueCsv";
import Revenue from "./Revenue";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Chart = ({ children }: { children?: ReactNode }) => <svg>{children}</svg>;
  return {
    ResponsiveContainer: Container,
    BarChart: Chart,
    Bar: ({ dataKey }: { dataKey?: string }) => (
      <g data-testid={`bar-${dataKey ?? "unknown"}`} />
    ),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

vi.mock("../../api/vietride", () => ({
  getAdminRevenueAnalytics: vi.fn(),
}));

vi.mock("./revenueCsv", () => ({
  downloadRevenueCsv: vi.fn(),
}));

describe("Admin Revenue", () => {
  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const analytics = {
    period: { from, to, timezone: "Asia/Ho_Chi_Minh" },
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
    topOperators: [
      {
        rank: 1,
        operatorId: "operator-1",
        operatorName: "Nhà xe A",
        logoUrl: "https://cdn.example.com/operator-1.png",
        revenueVnd: 137_600_000,
        vehicleCount: 5,
      },
    ],
  } satisfies AdminRevenueAnalytics;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminRevenueAnalytics).mockResolvedValue(analytics);
  });

  it("renders the complete analytics period, chart highlights and operator logo", async () => {
    const user = userEvent.setup();
    render(<Revenue />);

    expect(
      await screen.findByText(
        `revenue.period 01/01/${year} 31/12/${year} Asia/Ho_Chi_Minh`,
      ),
    ).toBeInTheDocument();

    expect(getAdminRevenueAnalytics).toHaveBeenCalledWith({
      from,
      to,
      groupBy: "month",
      top: 10,
    });
    expect(screen.getAllByText("137.600.000 ₫")).toHaveLength(4);
    expect(screen.queryByText(/137,6M/)).not.toBeInTheDocument();
    expect(screen.getByText("revenue.monthValue 7")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByTestId("bar-paid")).toBeInTheDocument();
    expect(screen.getByTestId("bar-platform")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "revenue.operatorLogoAlt Nhà xe A" }),
    ).toHaveAttribute("src", analytics.topOperators[0].logoUrl);

    await user.click(screen.getByRole("button", { name: "revenue.exportCsv" }));
    expect(downloadRevenueCsv).toHaveBeenCalledWith(
      analytics,
      expect.objectContaining({ timezone: "revenue.csvTimezone" }),
    );
  });
});
