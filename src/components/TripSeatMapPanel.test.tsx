import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableOperatorTripSeat,
  enableOperatorTripSeat,
  getPublicTripSeatMap,
} from "../api/vietride";
import TripSeatMapPanel from "./TripSeatMapPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../api/vietride", () => ({
  getPublicTripSeatMap: vi.fn(),
  disableOperatorTripSeat: vi.fn(),
  enableOperatorTripSeat: vi.fn(),
}));

const seatMap = {
  tripId: "trip-1",
  vehicleType: "SLEEPER_BUS",
  aisles: [{ afterCol: 2 }],
  seats: [
    { seatNumber: "A01", status: "BOOKED", type: "BED", row: 1, col: 1, deck: 1 },
    { seatNumber: "A02", status: "HELD", type: "BED", row: 1, col: 2, deck: 1 },
    { seatNumber: "A03", status: "AVAILABLE", type: "BED", row: 2, col: 4, deck: 1 },
    { seatNumber: "B01", status: "UNAVAILABLE", type: "BED", row: 1, col: 1, deck: 2 },
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
    expect(screen.getAllByLabelText("vehicles.aisleAfterColumn")).toHaveLength(3);
    expect(screen.getAllByLabelText("vehicles.emptyPosition").length).toBeGreaterThan(0);
  });

  // HELD là trạng thái quan trọng nhất với nhà xe: ghế khách đang giữ chờ trả
  // tiền. Lẫn nó với "còn trống" là bán trùng ghế.
  it("đếm đúng số ghế theo từng trạng thái ở chú giải", async () => {
    render(<TripSeatMapPanel tripId="trip-1" />);

    await screen.findByText("A01");
    expect(screen.getByText(/bookings\.seatStatus\.HELD \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/bookings\.seatStatus\.BOOKED \(1\)/)).toBeInTheDocument();
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

  it("chỉ ghế trống và ghế đã khóa mới bấm được", async () => {
    render(<TripSeatMapPanel tripId="trip-1" manageable />);

    await screen.findByText("A01");
    // AVAILABLE + UNAVAILABLE => nút; BOOKED + HELD => không phải nút, vì BE
    // trả `409 TRIP_SEAT_IN_USE` cho chúng.
    expect(screen.getByRole("gridcell", { name: /A03/ }).tagName).toBe("BUTTON");
    expect(screen.getByRole("gridcell", { name: /B01/ }).tagName).toBe("BUTTON");
    expect(screen.getByRole("gridcell", { name: /A01/ }).tagName).not.toBe(
      "BUTTON",
    );
    expect(screen.getByRole("gridcell", { name: /A02/ }).tagName).not.toBe(
      "BUTTON",
    );
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
      expect(disableOperatorTripSeat).toHaveBeenCalledWith("trip-1", "A03"),
    );
    expect(onSeatsChanged).toHaveBeenCalled();
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
