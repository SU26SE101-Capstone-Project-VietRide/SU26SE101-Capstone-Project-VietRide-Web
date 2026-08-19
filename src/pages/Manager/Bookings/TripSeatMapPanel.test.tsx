import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicTripSeatMap } from "../../../api/vietride";
import TripSeatMapPanel from "./TripSeatMapPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  getPublicTripSeatMap: vi.fn(),
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
