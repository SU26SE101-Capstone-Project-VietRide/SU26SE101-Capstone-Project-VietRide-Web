import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableOperatorTripSeat,
  enableOperatorTripSeat,
  getOperatorBooking,
  getOperatorBookings,
  getPublicTripSeatMap,
} from "../api/vietride";
import { useToastFeedback } from "../hooks/useToastFeedback";
import TripSeatMapPanel from "./TripSeatMapPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../api/vietride", () => ({
  getPublicTripSeatMap: vi.fn(),
  disableOperatorTripSeat: vi.fn(),
  enableOperatorTripSeat: vi.fn(),
  getOperatorBooking: vi.fn(),
  getOperatorBookings: vi.fn(),
}));

const seatMap = {
  tripId: "trip-1",
  vehicleType: "SLEEPER_BUS",
  aisles: [{ afterCol: 2 }],
  seats: [
    {
      seatNumber: "A01",
      status: "BOOKED",
      type: "BED",
      row: 1,
      col: 1,
      deck: 1,
    },
    { seatNumber: "A02", status: "HELD", type: "BED", row: 1, col: 2, deck: 1 },
    {
      seatNumber: "A03",
      status: "AVAILABLE",
      type: "BED",
      row: 2,
      col: 4,
      deck: 1,
    },
    {
      seatNumber: "B01",
      status: "UNAVAILABLE",
      type: "BED",
      row: 1,
      col: 1,
      deck: 2,
    },
  ],
};

describe("TripSeatMapPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicTripSeatMap).mockResolvedValue(seatMap);
  });

  it("vẽ đủ ghế của chuyến, tách theo tầng", async () => {
    render(<TripSeatMapPanel tripId="trip-1" />);

    expect(await screen.findByText("A01")).toBeInTheDocument();
    expect(screen.getByText("A02")).toBeInTheDocument();
    expect(screen.getByText("A03")).toBeInTheDocument();
    expect(screen.getByText("B01")).toBeInTheDocument();
    // Hai tầng => hiện nhãn tầng
    expect(screen.getAllByText("bookings.seatMapDeck")).toHaveLength(2);
  });

  it("giữ vị trí trống và tách lối đi theo sơ đồ xe", async () => {
    render(<TripSeatMapPanel tripId="trip-1" />);

    await screen.findByText("A01");
    expect(screen.getAllByLabelText("vehicles.aisleAfterColumn")).toHaveLength(
      3,
    );
    expect(
      screen.getAllByLabelText("vehicles.emptyPosition").length,
    ).toBeGreaterThan(0);
  });

  // HELD là trạng thái quan trọng nhất với nhà xe: ghế khách đang giữ chờ trả
  // tiền. Lẫn nó với "còn trống" là bán trùng ghế.
  it("đếm đúng số ghế theo từng trạng thái ở chú giải", async () => {
    render(<TripSeatMapPanel tripId="trip-1" />);

    await screen.findByText("A01");
    expect(
      screen.getByText(/bookings\.seatStatus\.HELD \(1\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/bookings\.seatStatus\.BOOKED \(1\)/),
    ).toBeInTheDocument();
  });

  it("bấm tải lại thì gọi lại API", async () => {
    const user = userEvent.setup();
    render(<TripSeatMapPanel tripId="trip-1" />);

    await screen.findByText("A01");
    await user.click(
      screen.getByRole("button", { name: "bookings.seatMapRefresh" }),
    );

    await waitFor(() => expect(getPublicTripSeatMap).toHaveBeenCalledTimes(2));
  });

  it("lỗi tải thì hiện thông báo, không vỡ modal", async () => {
    vi.mocked(getPublicTripSeatMap).mockRejectedValue(new Error("boom"));
    render(<TripSeatMapPanel tripId="trip-1" />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});

/**
 * Chế độ quản lý ghế của màn Chuyến xe — dùng
 * `POST /v1/operator/trips/{id}/seats/{seat}/disable|enable`.
 *
 * Hai endpoint này trả về SƠ ĐỒ MỚI nguyên vẹn, nên panel phải thay cả state
 * bằng response thay vì tự sửa một ghế rồi đoán phần còn lại.
 */
describe("TripSeatMapPanel — chế độ quản lý ghế", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicTripSeatMap).mockResolvedValue(seatMap);
  });

  it("cho phép xem ghế đã bán và chỉ khóa/mở được ghế phù hợp", async () => {
    render(<TripSeatMapPanel tripId="trip-1" manageable />);

    await screen.findByText("A01");
    // AVAILABLE + UNAVAILABLE dùng để khóa/mở; BOOKED dùng để xem người mua.
    expect(screen.getByRole("gridcell", { name: /A03/ }).tagName).toBe(
      "BUTTON",
    );
    expect(screen.getByRole("gridcell", { name: /B01/ }).tagName).toBe(
      "BUTTON",
    );
    expect(screen.getByRole("gridcell", { name: /A01/ }).tagName).toBe(
      "BUTTON",
    );
    expect(screen.getByRole("gridcell", { name: /A02/ }).tagName).not.toBe(
      "BUTTON",
    );
  });

  it("tải và hiển thị người mua khi bấm ghế đã bán", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorBookings).mockResolvedValue({
      items: [
        {
          id: "booking-1",
          tripId: "trip-1",
          seatCount: 1,
          totalAmount: 100000,
          createdAt: "2026-08-28T10:00:00Z",
          buyer: null,
          trip: {},
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorBooking).mockResolvedValue({
      id: "booking-1",
      bookingCode: "VR-BOOK-001",
      buyerUserId: "buyer-1",
      tripId: "trip-1",
      trip: {},
      seatCount: 1,
      baseFare: 100000,
      discountAmount: 0,
      totalAmount: 100000,
      createdAt: "2026-08-28T10:00:00Z",
      buyer: {
        userId: "buyer-1",
        displayName: "Nguyen Van An",
        phone: "0901234567",
        email: "an@example.com",
        avatarUrl: null,
      },
      seats: [
        {
          passengerRecordId: "passenger-1",
          ticketId: "ticket-1",
          seatNumber: "A01",
          ticketStatus: "PAID",
          boardingStatus: "PENDING",
        },
      ],
    });
    render(<TripSeatMapPanel tripId="trip-1" manageable />);

    await screen.findByText("A01");
    await user.click(screen.getByRole("gridcell", { name: /A01/ }));

    expect(await screen.findAllByText("Nguyen Van An")).toHaveLength(2);
    expect(screen.getByText("0901234567")).toBeInTheDocument();
    expect(screen.getByText("an@example.com")).toBeInTheDocument();
    expect(screen.getByText("VR-BOOK-001")).toBeInTheDocument();
    expect(getOperatorBookings).toHaveBeenCalledWith({
      tripId: "trip-1",
      page: 1,
      pageSize: 100,
    });
    expect(getOperatorBooking).toHaveBeenCalledWith("booking-1");
  });

  it("không dựng nút khi không bật chế độ quản lý", async () => {
    render(<TripSeatMapPanel tripId="trip-1" />);

    await screen.findByText("A03");
    expect(screen.getByRole("gridcell", { name: /A03/ }).tagName).not.toBe(
      "BUTTON",
    );
  });

  it("bấm ghế trống thì khóa ghế và vẽ lại theo sơ đồ BE trả", async () => {
    const user = userEvent.setup();
    const onSeatsChanged = vi.fn();
    vi.mocked(disableOperatorTripSeat).mockResolvedValue({
      ...seatMap,
      seats: seatMap.seats.map((seat) =>
        seat.seatNumber === "A03" ? { ...seat, status: "UNAVAILABLE" } : seat,
      ),
    });
    render(
      <TripSeatMapPanel
        tripId="trip-1"
        manageable
        onSeatsChanged={onSeatsChanged}
      />,
    );

    await screen.findByText("A03");
    await user.click(screen.getByRole("gridcell", { name: /A03/ }));

    await waitFor(() =>
      expect(disableOperatorTripSeat).toHaveBeenCalledWith(
        "trip-1",
        "A03",
        "bookings.seatDisableReason",
      ),
    );
    expect(onSeatsChanged).toHaveBeenCalled();
    expect(useToastFeedback).toHaveBeenLastCalledWith({
      message: "bookings.seatDisabledSuccess",
      error: "",
    });
    // Sơ đồ mới có 2 ghế UNAVAILABLE nên chú giải phải đếm lại, không giữ số cũ.
    expect(
      await screen.findByText(/bookings\.seatStatus\.UNAVAILABLE \(2\)/),
    ).toBeInTheDocument();
  });

  it("bấm ghế đã khóa thì mở bán lại", async () => {
    const user = userEvent.setup();
    vi.mocked(enableOperatorTripSeat).mockResolvedValue(seatMap);
    render(<TripSeatMapPanel tripId="trip-1" manageable />);

    await screen.findByText("B01");
    await user.click(screen.getByRole("gridcell", { name: /B01/ }));

    await waitFor(() =>
      expect(enableOperatorTripSeat).toHaveBeenCalledWith("trip-1", "B01"),
    );
    expect(useToastFeedback).toHaveBeenLastCalledWith({
      message: "bookings.seatEnabledSuccess",
      error: "",
    });
    expect(disableOperatorTripSeat).not.toHaveBeenCalled();
  });

  it("khóa ghế hỏng thì hiện lỗi và giữ nguyên sơ đồ", async () => {
    const user = userEvent.setup();
    vi.mocked(disableOperatorTripSeat).mockRejectedValue(
      new Error("Ghế đang được sử dụng."),
    );
    render(<TripSeatMapPanel tripId="trip-1" manageable />);

    await screen.findByText("A03");
    await user.click(screen.getByRole("gridcell", { name: /A03/ }));

    expect(
      await screen.findByText("Ghế đang được sử dụng."),
    ).toBeInTheDocument();
    expect(screen.getByText("A03")).toBeInTheDocument();
  });
});
