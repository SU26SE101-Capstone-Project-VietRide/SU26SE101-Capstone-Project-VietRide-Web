import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorBooking,
  getOperatorBookings,
  getOperatorBookingStats,
  type OperatorBookingListItem,
  type PagedResult,
} from "../../../api/vietride";
import BookingsList from ".";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorBooking: vi.fn(),
  getOperatorBookings: vi.fn(),
  getOperatorBookingStats: vi.fn(),
}));

function makePage(
  items: OperatorBookingListItem[],
  totalItems = items.length,
): PagedResult<OperatorBookingListItem> {
  return {
    items,
    page: 1,
    pageSize: Math.max(items.length, 1),
    totalItems,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function makeBooking(id: string, seatCount: number): OperatorBookingListItem {
  return {
    id,
    bookingCode: id,
    tripId: "trip-1",
    status: "NO_SHOW",
    trip: { routeName: "Tuyến thử" },
    seatCount,
    totalAmount: 300_000,
    createdAt: "2026-08-10T10:00:00+07:00",
  };
}

function statCard(label: string) {
  const card = screen.getByText(label).parentElement?.parentElement?.parentElement;
  if (!card) throw new Error(`Missing stat card: ${label}`);
  return within(card);
}

describe("Manager bookings stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorBooking).mockRejectedValue(
      new Error("Booking detail should not load in this test"),
    );
    vi.mocked(getOperatorBookingStats).mockResolvedValue({
      totalBookings: 9,
      items: [
        {
          date: "2026-08-10",
          totalBookings: 9,
          totalCompleted: 4,
          totalNoShows: 3,
        },
      ],
    });
    vi.mocked(getOperatorBookings).mockImplementation(async (params = {}) => {
      if (params.status === "PENDING_PAYMENT") return makePage([], 2);
      if (params.status === "NO_SHOW") {
        return makePage([
          makeBooking("no-show-1", 1),
          makeBooking("no-show-2", 2),
        ]);
      }
      return makePage([], 9);
    });
  });

  it("uses the booking stats contract and supplemental list counts", async () => {
    render(
      <MemoryRouter>
        <BookingsList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(statCard("bookings.totalBookings").getByText("9")).toBeInTheDocument();
      expect(statCard("bookings.pendingBookings").getByText("2")).toBeInTheDocument();
      expect(statCard("bookings.completedBookings").getByText("4")).toBeInTheDocument();
      expect(statCard("bookings.noShowBookings").getByText("3")).toBeInTheDocument();
    });
    expect(
      statCard("bookings.noShowBookings").getByText(
        "bookings.totalPassengersHelper:3",
      ),
    ).toBeInTheDocument();
  });
});
