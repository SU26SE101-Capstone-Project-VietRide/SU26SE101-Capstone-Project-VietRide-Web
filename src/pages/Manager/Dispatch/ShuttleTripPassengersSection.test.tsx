import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOperatorShuttleTripPassengers } from "../../../api/vietride";
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
}));

describe("ShuttleTripPassengersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gom khách theo điểm đón và sắp đúng thứ tự đón", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: "shuttle-1",
      // BE trả lộn xộn — component phải tự sắp theo `pickupOrder`.
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

    render(<ShuttleTripPassengersSection shuttleTripId="shuttle-1" />);

    expect(await screen.findByText("5 Nguyễn Huệ")).toBeInTheDocument();
    const addresses = screen.getAllByText(/Nguyễn Huệ|Lê Lợi/);
    expect(addresses[0]).toHaveTextContent("5 Nguyễn Huệ");

    // Số điện thoại phải bấm gọi được ngay — điều độ viên cần nó lúc khách
    // không ra điểm đón.
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

    render(<ShuttleTripPassengersSection shuttleTripId="shuttle-1" />);

    expect(
      await screen.findByText("dispatch.passengersEmpty"),
    ).toBeInTheDocument();
  });

  // 503 = Trip service chưa lấy được snapshot booking. Đó là "thử lại sau",
  // không phải hết quyền hay sai cấu hình — nói đúng bản chất.
  it("phân biệt 503 với lỗi thật", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockRejectedValue(
      new ApiRequestError("upstream", 503, "SERVICE_UNAVAILABLE"),
    );

    render(<ShuttleTripPassengersSection shuttleTripId="shuttle-1" />);

    expect(
      await screen.findByText("dispatch.passengersUnavailable"),
    ).toBeInTheDocument();
  });

  it("lỗi khác thì hiện thông báo của BE", async () => {
    vi.mocked(getOperatorShuttleTripPassengers).mockRejectedValue(
      new ApiRequestError("Không tìm thấy chuyến trung chuyển.", 404, "NOT_FOUND"),
    );

    render(<ShuttleTripPassengersSection shuttleTripId="shuttle-1" />);

    expect(
      await screen.findByText("Không tìm thấy chuyến trung chuyển."),
    ).toBeInTheDocument();
  });
});
