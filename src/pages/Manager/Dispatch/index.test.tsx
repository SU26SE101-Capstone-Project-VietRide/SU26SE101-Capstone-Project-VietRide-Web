import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelOperatorShuttleRequest,
  cancelOperatorShuttleTrip,
  getOperatorShuttleRequests,
  getOperatorShuttleTrips,
  type OperatorShuttleTripListItem,
  type ShuttleRequestGroup,
} from "../../../api/vietride";
import DispatchPanel from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  cancelOperatorShuttleRequest: vi.fn(),
  cancelOperatorShuttleTrip: vi.fn(),
  checkShuttleTripAvailability: vi.fn(),
  createOperatorShuttleTrip: vi.fn(),
  getOperatorShuttleRequests: vi.fn(),
  getOperatorShuttleTrips: vi.fn(),
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
  getShuttleTripEta: vi.fn(),
  getShuttleTripLatest: vi.fn(),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({
    id: "operator-admin-1",
    email: "ops@operator.vn",
    role: "OPERATOR_ADMIN",
  }),
}));

const group: ShuttleRequestGroup = {
  mainTripId: "36000000-0000-4000-8000-000000000101",
  routeName: "Sài Gòn - Đà Lạt",
  direction: "INBOUND_TO_STATION",
  departureDateTime: "2026-08-12T23:00:00+07:00",
  hardCutoffAt: "2099-08-12T22:30:00+07:00",
  stationId: "36000000-0000-4000-8000-000000000201",
  stationName: "Bến xe Miền Đông",
  pendingPassengerCount: 2,
  bookingGroups: [
    {
      bookingId: "36000000-0000-4000-8000-000000000301",
      passengerCount: 2,
      pickupAddress: "123 Nguyễn Huệ, Quận 1, TP.HCM",
      pickupLat: 10.7731,
      pickupLng: 106.7032,
      distanceToStationMeters: 9500,
      roadDistanceMeters: 9500,
      requestedAt: "2026-08-11T16:30:00+07:00",
      passengers: [
        {
          passengerUserId: "36000000-0000-4000-8000-000000000901",
          displayName: "Nguyễn Văn A",
          phone: "0900000000",
          ticketIds: ["36000000-0000-4000-8000-000000000801"],
        },
      ],
    },
  ],
  suggestedBookingOrder: ["36000000-0000-4000-8000-000000000301"],
};

const shuttleTrip: OperatorShuttleTripListItem = {
  shuttleTripId: "36000000-0000-4000-8000-000000000401",
  mainTripId: group.mainTripId,
  direction: "INBOUND_TO_STATION",
  status: "SCHEDULED",
  scheduledDepartureTime: "2026-08-12T21:30:00+07:00",
  scheduledEndTime: "2026-08-12T22:20:00+07:00",
  actualDepartureTime: null,
  completedAt: null,
  vehicle: { id: "vehicle-1", licensePlate: "51B-123.45" },
  driver: { id: "driver-1", displayName: "Trần Văn B", phone: "0900000001" },
  passengerCount: 2,
  stopCount: 1,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/manager/dispatch"]}>
      <DispatchPanel />
    </MemoryRouter>,
  );
}

describe("Manager Dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorShuttleRequests).mockResolvedValue({
      items: [group],
      page: 1,
      pageSize: 8,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [shuttleTrip],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(cancelOperatorShuttleRequest).mockResolvedValue({
      shuttleTripId: "00000000-0000-0000-0000-000000000000",
      status: "CANCELLED",
      changedPassengerCount: 2,
      transitionedAt: "2026-08-11T17:00:00+07:00",
    });
    vi.mocked(cancelOperatorShuttleTrip).mockResolvedValue({
      shuttleTripId: shuttleTrip.shuttleTripId,
      status: "CANCELLED",
      changedPassengerCount: 2,
      transitionedAt: "2026-08-11T17:00:00+07:00",
    });
  });

  it("dùng routeName làm nhãn nhóm và không hiện mainTripId", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText("Sài Gòn - Đà Lạt").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Bến xe Miền Đông").length).toBeGreaterThan(0);
    expect(screen.queryByText(group.mainTripId)).not.toBeInTheDocument();
  });

  it("huỷ một yêu cầu chờ với direction, lý do rồi tải lại cả hai danh sách", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(getOperatorShuttleRequests).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /details/i }));

    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /dispatch.cancelRequest/ }),
    );

    // Chưa nhập lý do thì BE sẽ từ chối, nút xác nhận phải khoá từ FE.
    const confirmButton = screen.getByRole("button", {
      name: "dispatch.confirmCancel",
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByLabelText("dispatch.cancelReason"),
      "Không còn đủ xe",
    );
    await user.click(
      screen.getByRole("button", { name: "dispatch.confirmCancel" }),
    );

    await waitFor(() =>
      expect(cancelOperatorShuttleRequest).toHaveBeenCalledWith(
        group.mainTripId,
        group.bookingGroups[0].bookingId,
        "INBOUND_TO_STATION",
        { reason: "Không còn đủ xe" },
        expect.any(String),
      ),
    );
    await waitFor(() =>
      expect(getOperatorShuttleRequests).toHaveBeenCalledTimes(2),
    );
    expect(getOperatorShuttleTrips).toHaveBeenCalledTimes(2);
  });

  it("huỷ một chuyến trung chuyển đang lên lịch", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "dispatch.cancelShuttleTrip" }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: "dispatch.cancelShuttleTrip" }),
    );
    await user.type(
      screen.getByLabelText("dispatch.cancelReason"),
      "Điều phối nhầm xe",
    );
    await user.click(
      screen.getByRole("button", { name: "dispatch.confirmCancel" }),
    );

    await waitFor(() =>
      expect(cancelOperatorShuttleTrip).toHaveBeenCalledWith(
        shuttleTrip.shuttleTripId,
        { reason: "Điều phối nhầm xe" },
        expect.any(String),
      ),
    );
    await waitFor(() =>
      expect(getOperatorShuttleTrips).toHaveBeenCalledTimes(2),
    );
  });

  it("không hiện nút huỷ cho chuyến đã kết thúc", async () => {
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [{ ...shuttleTrip, status: "COMPLETED" }],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderPage();

    await waitFor(() => expect(getOperatorShuttleTrips).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "dispatch.cancelShuttleTrip" }),
    ).not.toBeInTheDocument();
  });
});
