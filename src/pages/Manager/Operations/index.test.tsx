import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorFleetLatest,
  getOperatorRouteChangeProposals,
  getOperatorTrips,
  getOperatorUsers,
  getOperatorVehicles,
  getPublicTrip,
  getTrackingTripEta,
  getTrackingTripEtas,
  getTrackingTripLatest,
  getTrackingTripRouteGeometry,
  getTrackingTripTrail,
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

type TrackingSocketHandler = (event: unknown) => void;

const trackingSocketHandlers = vi.hoisted(
  () => new Map<string, TrackingSocketHandler>(),
);

// Socket realtime không chạy trong jsdom — mock để effect join không mở kết nối
// thật. `connected: true` cho phép hook phát lệnh join như khi đã kết nối.
vi.mock("../../../lib/trackingSocket", () => ({
  createTrackingSocket: vi.fn(() => ({
    connected: true,
    on: vi.fn((eventName: string, handler: TrackingSocketHandler) => {
      trackingSocketHandlers.set(eventName, handler);
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
  })),
  joinOperatorFleet: vi.fn(() => Promise.resolve({ success: true })),
  joinTripTracking: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("../../../api/vietride", () => ({
  approveOperatorRouteChangeProposal: vi.fn(),
  getOperatorFleetLatest: vi.fn(),
  getOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposals: vi.fn(),
  getOperatorTrips: vi.fn(),
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
  getPublicTrip: vi.fn(),
  getTrackingTripEta: vi.fn(),
  getTrackingTripEtas: vi.fn(),
  getTrackingTripLatest: vi.fn(),
  getTrackingTripRouteGeometry: vi.fn(),
  getTrackingTripTrail: vi.fn(),
  rejectOperatorRouteChangeProposal: vi.fn(),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
  refreshAuthSession: vi.fn().mockResolvedValue(null),
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

function pagedTrips(items: OperatorTripListItem[]) {
  return {
    items,
    totalItems: items.length,
    page: 1,
    pageSize: 100,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

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
    trackingSocketHandlers.clear();

    // Màn gọi mỗi endpoint hai lượt (IN_PROGRESS + DISRUPTED); mock phải phân
    // biệt theo status, nếu trả cùng một danh sách cho cả hai thì mọi xe bị nhân đôi.
    vi.mocked(getOperatorTrips).mockImplementation((params) =>
      Promise.resolve(pagedTrips(params?.status === "DISRUPTED" ? [] : [tripItem])),
    );
    vi.mocked(getOperatorFleetLatest).mockImplementation((params) =>
      Promise.resolve({
        items:
          params?.status === "DISRUPTED"
            ? []
            : [
                {
                  tripId: "trip-1",
                  latitude: 10.77,
                  longitude: 106.7,
                  speedKmh: 42,
                  headingDeg: 128,
                  recordedAt: "2026-08-05T08:30:00Z",
                  status: "IN_PROGRESS" as const,
                },
              ],
        generatedAt: "2026-08-05T08:30:02Z",
      }),
    );
    vi.mocked(getTrackingTripEta).mockResolvedValue({ eta: null });
    vi.mocked(getTrackingTripEtas).mockResolvedValue({ etas: [] });
    vi.mocked(getPublicTrip).mockRejectedValue(new Error("not available"));
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      geometry: null,
      originStation: null,
      intermediateStops: [],
      destinationStation: null,
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

    // Đúng 2 request cho fleet: trips (metadata) + fleet-latest (vị trí batch), không còn N+1
    await waitFor(() => {
      expect(getOperatorTrips).toHaveBeenCalledWith({
        status: "IN_PROGRESS",
        page: 1,
        pageSize: 100,
      });
      expect(getOperatorFleetLatest).toHaveBeenCalledWith({
        status: "IN_PROGRESS",
      });
    });
  });

  it("chuyến thiếu trong fleet-latest (mất tín hiệu GPS) vẫn hiện trong danh sách xe", async () => {
    vi.mocked(getOperatorTrips).mockResolvedValue({
      items: [
        tripItem,
        {
          ...tripItem,
          tripId: "trip-2",
          vehicle: {
            vehicleId: "vehicle-3",
            licensePlate: "51C-777.77",
            status: "IN_USE",
          },
        },
      ],
      totalItems: 2,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });

    renderPage();

    // trip-2 không có GPS trong fleet-latest — vẫn nằm trong list với trạng thái mất tín hiệu
    expect(await screen.findByText("51C-777.77")).toBeInTheDocument();
    expect(screen.getByText("51A-123.45")).toBeInTheDocument();
    expect(screen.getAllByText("gps.gpsSignalLost").length).toBeGreaterThan(0);
  });

  it("chuyến DISRUPTED vẫn lên bản đồ và báo sự cố trên thanh trạng thái", async () => {
    const disruptedTrip: OperatorTripListItem = {
      ...tripItem,
      tripId: "trip-9",
      status: "DISRUPTED",
      vehicle: {
        vehicleId: "vehicle-9",
        licensePlate: "51D-111.11",
        status: "IN_USE",
      },
    };
    vi.mocked(getOperatorTrips).mockImplementation((params) =>
      Promise.resolve(
        pagedTrips(params?.status === "DISRUPTED" ? [disruptedTrip] : [tripItem]),
      ),
    );
    vi.mocked(getOperatorFleetLatest).mockImplementation((params) =>
      Promise.resolve({
        items: [
          {
            tripId: params?.status === "DISRUPTED" ? "trip-9" : "trip-1",
            latitude: 10.77,
            longitude: 106.7,
            speedKmh: 30,
            headingDeg: 128,
            recordedAt: "2026-08-05T08:30:00Z",
            status:
              params?.status === "DISRUPTED"
                ? ("DISRUPTED" as const)
                : ("IN_PROGRESS" as const),
          },
        ],
        generatedAt: "2026-08-05T08:30:02Z",
      }),
    );

    renderPage();

    // Trước đây màn chỉ hỏi IN_PROGRESS nên chuyến sự cố biến mất khỏi bản đồ
    expect(await screen.findByText("51D-111.11")).toBeInTheDocument();
    // Đang chạy 30 km/h nhưng phải hiện là sự cố, không phải "đang chạy"
    expect(screen.getAllByText("gps.disruptedStatus").length).toBeGreaterThan(0);
    expect(screen.getByText("operations.disruptedChip 1")).toBeInTheDocument();
  });

  it("chọn chuyến thì gọi ETA và hiển thị stopName + trạng thái trễ", async () => {
    const user = userEvent.setup();
    vi.mocked(getTrackingTripEta).mockResolvedValue({
      eta: {
        tripId: "trip-1",
        stopId: "stop-1",
        stopName: "Bến xe Đà Lạt",
        etaMinutes: 37,
        estimatedArrivalTime: "2026-08-05T09:07:00Z",
        distanceMeters: 32000,
        updatedAt: "2026-08-05T08:30:00Z",
        delayed: true,
        delayStatus: "DELAYED",
        delayMinutes: 5,
      },
    });

    renderPage();
    await user.click(await screen.findByText("51A-123.45"));

    expect(await screen.findByText("37 min · 32000 m")).toBeInTheDocument();
    expect(screen.getByText("gps.etaToStop Bến xe Đà Lạt")).toBeInTheDocument();
    expect(screen.getByText("gps.etaDelayed 5")).toBeInTheDocument();
    await waitFor(() =>
      expect(getTrackingTripEta).toHaveBeenCalledWith("trip-1"),
    );
  });
  it("chọn chuyến thì tự tải tracking, không cần bấm nút Tải tracking", async () => {
    const user = userEvent.setup();
    vi.mocked(getTrackingTripLatest).mockResolvedValue({
      latest: {
        tripId: "trip-1",
        latitude: 10.77,
        longitude: 106.7,
        speedKmh: 40,
        recordedAt: "2026-08-05T08:30:00Z",
      },
    });
    vi.mocked(getTrackingTripTrail).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderPage();
    await user.click(await screen.findByText("51A-123.45"));

    // Trước đây vệt hành trình chỉ nạp sau khi bấm tay "Tải tracking"
    await waitFor(() =>
      expect(getTrackingTripLatest).toHaveBeenCalledWith("trip-1"),
    );
    // Trail phải lấy tối đa 100 điểm, không phải 20 như trước
    expect(getTrackingTripTrail).toHaveBeenCalledWith(
      "trip-1",
      expect.objectContaining({ pageSize: 100 }),
    );
  });

  it("eta:batch:update thay thế toàn bộ danh sách target realtime cũ", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText("51A-123.45"));

    await waitFor(() => {
      expect(trackingSocketHandlers.has("eta:batch:update")).toBe(true);
    });
    const handleBatchUpdate = trackingSocketHandlers.get("eta:batch:update");
    if (!handleBatchUpdate) throw new Error("Missing eta:batch:update handler");

    act(() => {
      handleBatchUpdate({
        tripId: "trip-1",
        updatedAt: "2026-08-05T08:30:00Z",
        etas: [
          {
            tripId: "trip-1",
            targetKind: "STOP",
            stopId: "stop-1",
            stopName: "Trạm A",
            sequence: 1,
            etaMinutes: 15,
            estimatedArrivalTime: "2026-08-05T08:45:00Z",
            distanceMeters: 8000,
            updatedAt: "2026-08-05T08:30:00Z",
            estimateQuality: "TRAFFIC_AWARE",
          },
          {
            tripId: "trip-1",
            targetKind: "STATION",
            stationId: "station-destination",
            stopName: "Bến đích",
            etaMinutes: 60,
            estimatedArrivalTime: "2026-08-05T09:30:00Z",
            distanceMeters: 70000,
            updatedAt: "2026-08-05T08:30:00Z",
            estimateQuality: "TRAFFIC_AWARE",
          },
        ],
      });
    });

    expect(screen.getByText("Trạm A")).toBeInTheDocument();
    expect(screen.getByText("Bến đích")).toBeInTheDocument();

    act(() => {
      handleBatchUpdate({
        tripId: "trip-1",
        updatedAt: "2026-08-05T08:40:00Z",
        etas: [
          {
            tripId: "trip-1",
            targetKind: "STOP",
            stopId: "stop-2",
            stopName: "Trạm B",
            sequence: 2,
            etaMinutes: 20,
            estimatedArrivalTime: "2026-08-05T09:00:00Z",
            distanceMeters: 12000,
            updatedAt: "2026-08-05T08:40:00Z",
            estimateQuality: "FALLBACK",
          },
        ],
      });
    });

    expect(screen.queryByText("Trạm A")).not.toBeInTheDocument();
    expect(screen.queryByText("Bến đích")).not.toBeInTheDocument();
    expect(screen.getByText("Trạm B")).toBeInTheDocument();
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
