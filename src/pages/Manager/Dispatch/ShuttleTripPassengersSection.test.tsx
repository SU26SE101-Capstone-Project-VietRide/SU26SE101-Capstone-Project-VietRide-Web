import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorShuttleTripPassengers,
  unassignOperatorShuttleBooking,
  type OperatorShuttleTripStatus,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import ShuttleTripPassengersSection from "./ShuttleTripPassengersSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const entries = Object.entries(vars ?? {}).filter(
        ([name]) => name !== "defaultValue",
      );
      return entries.length === 0
        ? key
        : `${key} ${entries.map(([name, value]) => `${name}=${value}`).join(" ")}`;
    },
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorShuttleTripPassengers: vi.fn(),
  unassignOperatorShuttleBooking: vi.fn(),
}));

function renderSection(
  status: OperatorShuttleTripStatus = "SCHEDULED",
  onMutationSettled = vi.fn(),
) {
  render(
    <ShuttleTripPassengersSection
      shuttleTripId="shuttle-1"
      tripStatus={status}
      canUnassignBooking
      onMutationSettled={onMutationSettled}
    />,
  );

  return { onMutationSettled };
}

describe("ShuttleTripPassengersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gom khách theo điểm đón và sắp đúng thứ tự đón", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: "shuttle-1",
      groups: [
        {
          pickupOrder: 2,
          bookingId: "booking-2",
          bookingCode: "BK-20260826-XYZ",
          pickupAddress: "12 Lê Lợi",
          passengerCount: 1,
          passengers: [
            {
              passengerUserId: "user-2",
              displayName: "Trần Bình",
              phone: "0901234567",
              ticketIds: ["ticket-2"],
            },
          ],
        },
        {
          pickupOrder: 1,
          bookingId: "booking-1",
          bookingCode: "BK-20260826-ABC",
          pickupAddress: "5 Nguyễn Huệ",
          passengerCount: 2,
          passengers: [
            {
              passengerUserId: "user-1",
              displayName: "Nguyễn An",
              phone: "0987654321",
              ticketIds: ["ticket-1"],
            },
            {
              passengerUserId: "user-3",
              displayName: null,
              phone: null,
              ticketIds: [],
            },
          ],
        },
      ],
    });

    renderSection();

    expect(await screen.findByText("5 Nguyễn Huệ")).toBeInTheDocument();
    const addresses = screen.getAllByText(/Nguyễn Huệ|Lê Lợi/);
    expect(addresses[0]).toHaveTextContent("5 Nguyễn Huệ");
    expect(screen.getByRole("link", { name: /0987654321/ })).toHaveAttribute(
      "href",
      "tel:0987654321",
    );
    expect(screen.getByText("dispatch.passengerUnnamed")).toBeInTheDocument();
    expect(screen.getByText("dispatch.passengerNoPhone")).toBeInTheDocument();
  });

  it("BE trả groups null thì hiện trạng thái rỗng, không vỡ", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: "shuttle-1",
      groups: null,
    });

    renderSection();

    expect(
      await screen.findByText("dispatch.passengersEmpty"),
    ).toBeInTheDocument();
  });

  it("phân biệt 503 tải manifest với lỗi thật", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockRejectedValue(
      new ApiRequestError("upstream", 503, "SERVICE_UNAVAILABLE"),
    );

    renderSection();

    expect(
      await screen.findByText("dispatch.passengersUnavailable"),
    ).toBeInTheDocument();
  });

  it("lỗi tải manifest khác thì hiện thông báo của BE", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockRejectedValue(
      new ApiRequestError("Không tìm thấy chuyến trung chuyển.", 404, "NOT_FOUND"),
    );

    renderSection();

    expect(
      await screen.findByText("Không tìm thấy chuyến trung chuyển."),
    ).toBeInTheDocument();
  });

  it("gỡ cả Booking với lý do nội bộ rồi refetch manifest", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: "shuttle-1",
      groups: [
        {
          pickupOrder: 1,
          bookingId: "booking-1",
          bookingCode: "BK-20260901-ABC",
          pickupAddress: "5 Nguyễn Huệ",
          passengerCount: 2,
          passengers: [],
        },
      ],
    });
    const result = {
      shuttleTripId: "shuttle-1",
      bookingId: "booking-1",
      unassignedPassengerCount: 2,
      remainingPassengerCount: 1,
      shuttleTripStatus: "SCHEDULED" as const,
      returnedToPendingAssignment: true,
      shuttleTripCancelled: false,
      unassignedAt: "2026-09-01T17:00:00+07:00",
    };
    vi.mocked(unassignOperatorShuttleBooking).mockResolvedValue(result);
    const { onMutationSettled } = renderSection();

    await user.click(
      await screen.findByRole("button", {
        name: "dispatch.unassignBooking",
      }),
    );
    expect(
      screen.getByRole("button", {
        name: "dispatch.confirmUnassignBooking",
      }),
    ).toBeDisabled();

    await user.type(
      screen.getByLabelText("dispatch.unassignBookingReason"),
      "  Gán nhầm khách vào xe  ",
    );
    await user.click(
      screen.getByRole("button", {
        name: "dispatch.confirmUnassignBooking",
      }),
    );

    await waitFor(() =>
      expect(unassignOperatorShuttleBooking).toHaveBeenCalledWith(
        "shuttle-1",
        "booking-1",
        { reason: "Gán nhầm khách vào xe" },
        expect.any(String),
      ),
    );
    expect(onMutationSettled).toHaveBeenCalledWith({ result });
    await waitFor(() =>
      expect(getOperatorShuttleTripPassengers).toHaveBeenCalledTimes(2),
    );
  });

  it("giữ nguyên Idempotency-Key khi thử lại cùng thao tác", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: "shuttle-1",
      groups: [
        {
          pickupOrder: 1,
          bookingId: "booking-1",
          passengerCount: 1,
          passengers: [],
        },
      ],
    });
    vi.mocked(unassignOperatorShuttleBooking)
      .mockRejectedValueOnce(
        new ApiRequestError(
          "Dịch vụ tạm thời không khả dụng.",
          503,
          "UPSTREAM_UNAVAILABLE",
        ),
      )
      .mockResolvedValueOnce({
        shuttleTripId: "shuttle-1",
        bookingId: "booking-1",
        unassignedPassengerCount: 1,
        remainingPassengerCount: 0,
        shuttleTripStatus: "CANCELLED",
        returnedToPendingAssignment: true,
        shuttleTripCancelled: true,
        unassignedAt: "2026-09-01T17:00:00+07:00",
      });
    renderSection();

    await user.click(
      await screen.findByRole("button", {
        name: "dispatch.unassignBooking",
      }),
    );
    await user.type(
      screen.getByLabelText("dispatch.unassignBookingReason"),
      "Gán nhầm khách",
    );
    const confirm = screen.getByRole("button", {
      name: "dispatch.confirmUnassignBooking",
    });
    await user.click(confirm);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dịch vụ tạm thời không khả dụng.",
    );
    await user.click(confirm);

    await waitFor(() =>
      expect(unassignOperatorShuttleBooking).toHaveBeenCalledTimes(2),
    );
    const firstKey = vi.mocked(unassignOperatorShuttleBooking).mock.calls[0][3];
    const retryKey = vi.mocked(unassignOperatorShuttleBooking).mock.calls[1][3];
    expect(retryKey).toBe(firstKey);
  });

  it("khóa thao tác khi chuyến không còn SCHEDULED", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: "shuttle-1",
      groups: [
        {
          pickupOrder: 1,
          bookingId: "booking-1",
          passengerCount: 1,
          passengers: [],
        },
      ],
    });
    renderSection("IN_PROGRESS");

    expect(
      await screen.findByText("dispatch.unassignBookingLocked"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "dispatch.unassignBooking" }),
    ).toBeDisabled();
    expect(unassignOperatorShuttleBooking).not.toHaveBeenCalled();
  });
});
