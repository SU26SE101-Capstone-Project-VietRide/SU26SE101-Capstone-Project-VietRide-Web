import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorRouteChangeProposals,
  getOperatorTrips,
  getOperatorUsers,
  getOperatorVehicles,
  getTrackingTripLatest,
  getTrackingTripRouteGeometry,
  type OperatorTripListItem,
} from "../../../api/vietride";
import OperationsPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: () => <div data-testid="fleet-map" />,
}));

// Socket realtime không chạy trong jsdom — mock để effect join không mở kết nối thật
vi.mock("../../../lib/trackingSocket", () => ({
  createTrackingSocket: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
  })),
  joinTripTracking: vi.fn(),
}));

vi.mock("../../../api/vietride", () => ({
  approveOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposals: vi.fn(),
  getOperatorTrips: vi.fn(),
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
  getTrackingTripLatest: vi.fn(),
  getTrackingTripRouteGeometry: vi.fn(),
  getTrackingTripTrail: vi.fn(),
  rejectOperatorRouteChangeProposal: vi.fn(),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

const tripItem: OperatorTripListItem = {
  tripId: "trip-1",
  status: "IN_PROGRESS",
  route: {
    routeId: "route-1",
    name: "Sài Gòn - Đà Lạt",
    originName: "Sài Gòn",
    destinationName: "Đà Lạt",
  },
  vehicle: { vehicleId: "vehicle-1", licensePlate: "51A-123.45", status: "IN_USE" },
  driver: { userId: "driver-1", displayName: "Tài xế A", phone: null },
  assistant: null,
  departureAt: "2026-08-05T08:00:00Z",
  arrivalEstimate: null,
  canSubstituteVehicle: false,
};

function renderPage(initialEntry = "/manager/operations") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <OperationsPage />
    </MemoryRouter>,
  );
}

describe("Manager Operations Center", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getOperatorTrips).mockResolvedValue({
      items: [tripItem],
      totalItems: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getTrackingTripLatest).mockResolvedValue({
      latest: {
        tripId: "trip-1",
        latitude: 10.77,
        longitude: 106.7,
        speedKmh: 42,
        recordedAt: "2026-08-05T08:30:00Z",
      },
    });
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      points: [],
    });
    vi.mocked(getOperatorVehicles).mockResolvedValue({
      items: [
        {
          id: "vehicle-2",
          operatorId: "operator-1",
          licensePlate: "51B-999.99",
          vehicleTypeId: "type-1",
          totalSeats: 40,
          maxCargoWeightKg: 500,
          status: "ACTIVE",
        },
      ],
      totalItems: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getOperatorRouteChangeProposals).mockResolvedValue({
      items: [],
      totalItems: 2,
      page: 1,
      pageSize: 1,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true,
    });
    vi.mocked(getOperatorUsers).mockResolvedValue({
      items: [
        {
          userId: "driver-2",
          email: "driver@operator.vn",
          displayName: "Driver Two",
          role: "DRIVER",
          status: "ACTIVE",
          operatorId: "operator-1",
        },
      ],
      totalItems: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tải fleet và hiển thị KPI + danh sách xe khi chưa chọn chuyến", async () => {
    renderPage();

    expect(screen.getByText("operations.title")).toBeInTheDocument();

    // Danh sách xe hiện biển số sau khi fleet load xong
    expect(await screen.findByText("51A-123.45")).toBeInTheDocument();
    expect(screen.getByText("gps.totalOnMap")).toBeInTheDocument();
    expect(screen.getByText("gps.vehicleList")).toBeInTheDocument();
    // Chưa chọn chuyến — panel theo dõi chưa hiển thị
    expect(screen.queryByText("gps.realTrackingTitle")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getOperatorTrips).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
      expect(getTrackingTripLatest).toHaveBeenCalledWith("trip-1");
    });
  });

  it("vào màn với ?tripId= thì tự chọn chuyến đó sau khi load fleet", async () => {
    renderPage("/manager/operations?tripId=trip-1");

    // Panel theo dõi thay thế KPI + danh sách xe
    expect(await screen.findByText("gps.realTrackingTitle")).toBeInTheDocument();
    expect(screen.getByText("operations.selectedTripId trip-1")).toBeInTheDocument();
    expect(screen.getByText("operations.deselectTrip")).toBeInTheDocument();
    expect(screen.queryByText("gps.vehicleList")).not.toBeInTheDocument();

    // Panel hành động (thay xe / huỷ chuyến) hiện ngay dưới panel theo dõi
    expect(screen.getByText("tripOperations.title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tripOperations\.loadCapacity/ }),
    ).toBeInTheDocument();
    // Link "Xem tuyến" trỏ sang màn Routes đúng tuyến của chuyến
    expect(
      screen.getByRole("link", { name: /operations\.viewRoute/ }),
    ).toHaveAttribute("href", "/manager/routes?routeId=route-1");

    await waitFor(() => {
      expect(getTrackingTripRouteGeometry).toHaveBeenCalledWith("trip-1");
    });
  });

  it("bỏ qua im lặng khi ?tripId= không tồn tại trong danh sách", async () => {
    renderPage("/manager/operations?tripId=khong-ton-tai");

    expect(await screen.findByText("51A-123.45")).toBeInTheDocument();
    expect(screen.queryByText("gps.realTrackingTitle")).not.toBeInTheDocument();
    expect(getTrackingTripRouteGeometry).not.toHaveBeenCalled();
  });

  it("chọn xe trong danh sách mở panel theo dõi, nút Bỏ chọn quay lại danh sách", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("51A-123.45"));

    expect(await screen.findByText("gps.realTrackingTitle")).toBeInTheDocument();
    expect(getTrackingTripRouteGeometry).toHaveBeenCalledWith("trip-1");

    await user.click(screen.getByText("operations.deselectTrip"));
    expect(await screen.findByText("gps.vehicleList")).toBeInTheDocument();
    expect(screen.queryByText("gps.realTrackingTitle")).not.toBeInTheDocument();
  });

  it("hiện badge đề xuất lộ trình với số lượng PENDING cho OPERATOR_ADMIN", async () => {
    renderPage();

    // Badge lấy totalItems từ trang PENDING pageSize=1
    expect(
      await screen.findByRole("button", { name: "operations.proposalsBadge 2" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(getOperatorRouteChangeProposals).toHaveBeenCalledWith({
        page: 1,
        pageSize: 1,
        status: "PENDING",
      }),
    );
  });

  it("vào màn với ?panel=proposals thì mở panel đề xuất thay cột phải", async () => {
    renderPage("/manager/operations?panel=proposals");

    // Panel đề xuất hiển thị (header dùng key routeEta.title) thay cho danh sách xe
    expect(await screen.findByText("routeEta.title")).toBeInTheDocument();
    expect(screen.queryByText("gps.vehicleList")).not.toBeInTheDocument();

    // Panel tự tải danh sách đề xuất PENDING
    await waitFor(() =>
      expect(getOperatorRouteChangeProposals).toHaveBeenCalledWith({
        page: 1,
        pageSize: 50,
        status: "PENDING",
      }),
    );
  });

  it("bấm badge mở panel đề xuất, nút đóng quay lại danh sách xe", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "operations.proposalsBadge 2" }),
    );
    expect(await screen.findByText("routeEta.title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close" }));
    expect(await screen.findByText("gps.vehicleList")).toBeInTheDocument();
    expect(screen.queryByText("routeEta.title")).not.toBeInTheDocument();
  });
});
