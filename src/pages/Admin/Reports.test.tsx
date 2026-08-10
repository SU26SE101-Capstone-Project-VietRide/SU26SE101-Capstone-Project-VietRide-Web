import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminPlatformReport,
  type AdminPlatformReport,
} from "../../api/vietride";
import { formatDateInputValue } from "../../utils/date";
import AdminReports from "./Reports";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key === "reports.viewingPeriod"
        ? values?.from + " – " + values?.to
        : key,
    i18n: { language: "vi" },
  }),
}));

vi.mock("../../api/vietride", () => ({
  getAdminPlatformReport: vi.fn(),
}));

const emptyReport = {
  period: { from: "", to: "", timezone: "UTC" },
  totals: {
    completedBookingCount: 0,
    completedTripCount: 0,
    deliveredParcelCount: 0,
    netTicketRevenueVnd: 0,
    netParcelRevenueVnd: 0,
    netTransportRevenueVnd: 0,
  },
  byOperator: [],
  generatedAt: "2026-08-11T00:00:00Z",
} satisfies AdminPlatformReport;

describe("Admin reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminPlatformReport).mockResolvedValue(emptyReport);
  });

  it("applies a quick date range and updates the displayed period", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const sevenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 6,
    );
    const expectedFilters = {
      from: formatDateInputValue(sevenDaysAgo),
      to: formatDateInputValue(today),
    };
    const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    render(<AdminReports />);

    expect(screen.getByText("reports.dateRangeTitle")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "reports.last7Days" }),
    );

    await waitFor(() =>
      expect(getAdminPlatformReport).toHaveBeenLastCalledWith(expectedFilters),
    );
    expect(
      screen.getByText(
        dateFormatter.format(sevenDaysAgo) +
          " – " +
          dateFormatter.format(today),
      ),
    ).toBeInTheDocument();
  });
});
