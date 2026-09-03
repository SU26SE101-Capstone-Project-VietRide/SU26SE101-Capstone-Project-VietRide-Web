import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  routeEndpointPinPath,
  stopNumberPath,
} from "../../../components/mapMarkerPaths";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorFleetLatest,
  getOperatorIncidents,
  getOperatorShuttleTrips,
  getOperatorShuttleContext,
  getOperatorRouteChangeProposals,
  getOperatorTrips,
  getPublicTripSeatMap,
  getOperatorUsers,
  getOperatorVehicles,
  getPublicTrip,
  getTrackingTripEta,
  getTrackingTripEtas,
  getTrackingTripLatest,
  getTrackingTripRouteGeometry,
  getTrackingTripTrail,
  type OperatorIncident,
  type OperatorShuttleTripListItem,
  type OperatorTripListItem,
} from "../../../api/vietride";
import OperationsPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

// Ghi lại props camera để khẳng định màn lái đúng cơ chế (bám xe vs fit cả tuyến)
const { canvasProps } = vi.hoisted(() => ({
  canvasProps: [] as Array<{
    fitPoints?: Array<{ lat: number; lng: number }>;
    focusCenter?: { lat: number; lng: number } | null;
    focusZoom?: number;
    polylines?: Array<{ id: string; color: string; opacity?: number }>;
    pointMarkers?: Array<{
      id: string;
      icon?: {
        scale?: number;
        fillColor?: string;
        path?: string;
        fillOpacity?: number;
      };
      label?: { text: string };
      zIndex?: number;
    }>;
  }>,
}));

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: (props: (typeof canvasProps)[number]) => {
    canvasProps.push(props);
    return <div data-testid="fleet-map" />;
  },
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
  // TripActionsPanel tự tải sự cố của chuyến khi được chọn
  getOperatorIncidents: vi.fn(),
  getOperatorShuttleTrips: vi.fn(),
  getOperatorShuttleContext: vi.fn(),
  getOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposals: vi.fn(),
  getOperatorTrips: vi.fn(),
  getPublicTripSeatMap: vi.fn(),
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

const shuttleTripItem: OperatorShuttleTripListItem = {
  shuttleTripId: "36000000-0000-4000-8000-000000000001",
  mainTripId: "36000000-0000-4000-8000-000000000101",
  direction: "INBOUND_TO_STATION",
  status: "IN_PROGRESS",
  scheduledDepartureTime: "2026-08-05T07:30:00Z",
  scheduledEndTime: "2026-08-05T08:20:00Z",
  actualDepartureTime: null,
  completedAt: null,
  vehicle: { id: "vehicle-9", licensePlate: "51B-999.99" },
  driver: { id: "driver-9", displayName: "Tài xế C", phone: null },
  passengerCount: 3,
  stopCount: 2,
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

function pagedIncidents(items: OperatorIncident[]) {
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

function openIncidentForTrip(trip: OperatorTripListItem): OperatorIncident {
  return {
    incidentId: `incident-${trip.tripId}`,
    category: "VEHICLE_BREAKDOWN",
    description: "Engine failure",
    photoUrls: null,
    latitude: null,
    longitude: null,
    reportedAt: "2026-08-05T08:20:00Z",
    status: "OPEN",
    resolvedAt: null,
    resolvedByUserId: null,
    resolutionNote: null,
    trip: {
      tripId: trip.tripId,
      status: trip.status,
      departureDateTime: trip.departureAt,
      route: {
        routeId: trip.route.routeId,
        name: trip.route.name,
        originStation: { stationId: "origin-1", name: trip.route.originName },
        destinationStation: {
          stationId: "destination-1",
          name: trip.route.destinationName,
        },
      },
    },
    reporter: {
      userId: "driver-1",
      displayName: "Driver One",
      role: "DRIVER",
    },
  };
}

describe("Manager Operations Center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Panel thao tác chuyến tải sơ đồ ghế lúc mount để kiểm xe thay có đủ ghế —
    // không mock thì effect vỡ và mọi test dùng panel này đỏ theo.
    vi.mocked(getPublicTripSeatMap).mockResolvedValue({
      tripId: "trip-1",
      vehicleType: "SEAT_40",
      seats: [],
    });
    // Panel cũng tải sự cố của chuyến để chọn khi thay xe — cùng lý do như trên.
    vi.mocked(getOperatorIncidents).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      totalItems: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    trackingSocketHandlers.clear();
    canvasProps.length = 0;

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
    // Mặc định không có xe trung chuyển nào đang chạy — case riêng tự override
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [],
      totalItems: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
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
      // Opt-in xe trung chuyển: không truyền `include` thì BE chỉ trả chuyến chính
      expect(getOperatorFleetLatest).toHaveBeenCalledWith({
        status: "IN_PROGRESS",
        include: "shuttle",
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
    vi.mocked(getOperatorIncidents).mockResolvedValue(
      pagedIncidents([openIncidentForTrip(disruptedTrip)]),
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

  it("ẩn chuyến đã hoàn tất và chuyến sự cố đã xử lý", async () => {
    const completedTrip: OperatorTripListItem = {
      ...tripItem,
      status: "COMPLETED",
    };
    const resolvedDisruptedTrip: OperatorTripListItem = {
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
        pagedTrips(
          params?.status === "DISRUPTED"
            ? [resolvedDisruptedTrip]
            : [completedTrip],
        ),
      ),
    );
    // Query OPEN không còn trả sự cố của trip-9 sau khi đã resolve.
    vi.mocked(getOperatorIncidents).mockResolvedValue(pagedIncidents([]));

    renderPage();

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenCalledWith({
        status: "OPEN",
        page: 1,
        pageSize: 100,
      }),
    );
    expect(screen.queryByText("51A-123.45")).not.toBeInTheDocument();
    expect(screen.queryByText("51D-111.11")).not.toBeInTheDocument();
    expect(
      screen.queryByText("operations.disruptedChip 1"),
    ).not.toBeInTheDocument();
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

  // Bản đồ CHỈ vẽ tuyến nhà xe đã set up + marker vị trí xe. GPS demo/teleport
  // nối lại thành "đường xe đã đi" là bịa ra lộ trình không có thật.
  it("chỉ vẽ tuyến đã set up, không vẽ đường xe thực đi từ điểm GPS", async () => {
    const user = userEvent.setup();
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      geometry: {
        source: "ROUTE_POLYLINE",
        points: [
          { latitude: 10.77, longitude: 106.7 },
          { latitude: 11.94, longitude: 108.44 },
        ],
      },
      originStation: null,
      intermediateStops: [],
      destinationStation: null,
    });
    // Vệt GPS nhảy cóc TP.HCM → Tuy Hoà: có dữ liệu nhưng không được lên bản đồ
    vi.mocked(getTrackingTripTrail).mockResolvedValue({
      items: [
        {
          tripId: "trip-1",
          latitude: 13.09,
          longitude: 109.3,
          speedKmh: 60,
          recordedAt: "2026-08-05T09:30:00Z",
        },
        {
          tripId: "trip-1",
          latitude: 10.77,
          longitude: 106.7,
          speedKmh: 40,
          recordedAt: "2026-08-05T08:30:00Z",
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    renderPage();

    await user.click(await screen.findByText("51A-123.45"));
    await screen.findByText("gps.realTrackingTitle");

    await waitFor(() => {
      const ids = (canvasProps.at(-1)?.polylines ?? []).map((line) => line.id);
      expect(ids.some((id) => id.startsWith("selected-trip-route"))).toBe(true);
      expect(ids).not.toContain("selected-trip-trail");
    });
    // Chú giải cũng không còn dòng "hành trình đã đi"
    expect(screen.queryByText("gps.legendTrailLine")).not.toBeInTheDocument();

    // Tuyến phải vẽ bằng tông teal của app, KHÔNG phải xám nhạt — xám 55% chìm
    // nghỉm vào chính các con đường của bản đồ nền
    const routeLine = (canvasProps.at(-1)?.polylines ?? []).find((line) =>
      line.id.startsWith("selected-trip-route"),
    );
    expect(routeLine?.color).not.toBe("#94a3b8");
    expect(routeLine?.opacity ?? 1).toBeGreaterThan(0.9);
  });

  // Bến/điểm dừng phải vẽ ĐÚNG kiểu màn Tuyến & điểm dừng: pin cho hai bến, đĩa
  // đánh số cho điểm dừng giữa tuyến (trước đây là chấm tròn ~3px, mất hút)
  it("vẽ pin bến đi/bến đến và đĩa số điểm dừng như màn Tuyến & điểm dừng", async () => {
    const user = userEvent.setup();
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      geometry: {
        source: "ROUTE_POLYLINE",
        points: [
          { latitude: 10.77, longitude: 106.7 },
          { latitude: 11.94, longitude: 108.44 },
        ],
      },
      originStation: {
        stationId: "station-1",
        name: "Bến xe Cần Thơ",
        latitude: 10.03,
        longitude: 105.78,
      },
      intermediateStops: [
        {
          stopId: "stop-1",
          name: "Trạm Trung Lương",
          sequence: 1,
          latitude: 10.4,
          longitude: 106.3,
        },
      ],
      destinationStation: {
        stationId: "station-2",
        name: "Bến xe Miền Tây",
        latitude: 10.74,
        longitude: 106.62,
      },
    });
    renderPage();

    await user.click(await screen.findByText("51A-123.45"));

    await waitFor(() => {
      const markers = canvasProps.at(-1)?.pointMarkers ?? [];
      const origin = markers.find((marker) =>
        marker.id.startsWith("route-origin-"),
      );
      const destination = markers.find((marker) =>
        marker.id.startsWith("route-destination-"),
      );
      const stop = markers.find((marker) => marker.id.startsWith("route-stop-"));

      // Cùng Symbol path với màn Tuyến & điểm dừng
      expect(origin?.icon?.path).toBe(routeEndpointPinPath);
      expect(origin?.icon?.fillColor).toBe("#0f766e");
      expect(destination?.icon?.path).toBe(routeEndpointPinPath);
      expect(destination?.icon?.fillColor).toBe("#dc2626");
      // Điểm dừng giữa tuyến là đĩa mang số thứ tự ngay bên trong
      expect(stop?.icon?.path).toBe(stopNumberPath);
      expect(stop?.label?.text).toBe("1");
    });

    // Chú giải nói rõ mấy chấm đó là gì
    expect(screen.getByText("gps.originStation")).toBeInTheDocument();
    expect(screen.getByText("gps.stopPoint")).toBeInTheDocument();
  });

  // Theo dõi chuyến là để thấy xe đang chạy đường nào: camera phải BÁM XE ở mức
  // zoom đường phố, không fitBounds cả tuyến liên tỉnh (zoom ra mức nhìn cả nước).
  it("bám xe ở zoom đường phố khi chọn chuyến, không fit cả tuyến", async () => {
    const user = userEvent.setup();
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      geometry: {
        source: "ROUTE_POLYLINE",
        points: [
          { latitude: 10.77, longitude: 106.7 },
          { latitude: 11.94, longitude: 108.44 },
        ],
      },
      originStation: null,
      intermediateStops: [],
      destinationStation: null,
    });
    renderPage();

    await user.click(await screen.findByText("51A-123.45"));
    await screen.findByText("gps.realTrackingTitle");

    await waitFor(() => {
      const props = canvasProps.at(-1);
      expect(props?.focusCenter).toEqual({ lat: 10.77, lng: 106.7 });
      expect(props?.focusZoom).toBe(14);
      // fitBounds tắt hẳn — hai cơ chế cùng lái camera sẽ giật qua lại
      expect(props?.fitPoints ?? []).toHaveLength(0);
    });
  });

  it("bấm nút chuyển sang xem cả tuyến thì fit lại toàn tuyến", async () => {
    const user = userEvent.setup();
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      geometry: {
        source: "ROUTE_POLYLINE",
        points: [
          { latitude: 10.77, longitude: 106.7 },
          { latitude: 11.94, longitude: 108.44 },
        ],
      },
      originStation: null,
      intermediateStops: [],
      destinationStation: null,
    });
    renderPage();

    await user.click(await screen.findByText("51A-123.45"));
    await user.click(await screen.findByTestId("follow-vehicle-toggle"));

    await waitFor(() => {
      const props = canvasProps.at(-1);
      expect(props?.focusCenter).toBeNull();
      expect((props?.fitPoints ?? []).length).toBeGreaterThan(1);
    });
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

  // Xe trung chuyển gộp chung bản đồ Vận hành nhưng phải lọc riêng được: nhét
  // chung dropdown trạng thái thì chọn "Trung chuyển" là mất bộ lọc trạng thái.
  it("chip loc rieng cho xe trung chuyen", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [shuttleTripItem],
      totalItems: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getOperatorFleetLatest).mockImplementation((params) =>
      Promise.resolve({
        items:
          params?.status === "DISRUPTED"
            ? []
            : [
                {
                  kind: "TRIP" as const,
                  tripId: "trip-1",
                  latitude: 10.77,
                  longitude: 106.7,
                  speedKmh: 42,
                  headingDeg: 128,
                  recordedAt: "2026-08-05T08:30:00Z",
                  status: "IN_PROGRESS" as const,
                },
                {
                  kind: "SHUTTLE" as const,
                  shuttleTripId: shuttleTripItem.shuttleTripId,
                  mainTripId: shuttleTripItem.mainTripId,
                  latitude: 10.76,
                  longitude: 106.66,
                  speedKmh: 24,
                  headingDeg: 120,
                  recordedAt: "2026-08-05T08:30:01Z",
                  status: "IN_PROGRESS" as const,
                },
              ],
        generatedAt: "2026-08-05T08:30:02Z",
      }),
    );

    renderPage();

    // Cả hai loại xe cùng nằm trên danh sách khi chưa lọc
    expect(await screen.findByText("51A-123.45")).toBeInTheDocument();
    expect(screen.getByText("51B-999.99")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /gps\.filterKind\.shuttle/ }),
    );

    await waitFor(() =>
      expect(screen.queryByText("51A-123.45")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("51B-999.99")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "gps.filterKind.trip" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("51B-999.99")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("51A-123.45")).toBeInTheDocument();
  });
  // Shuttle không có polyline nên điểm đón là thứ DUY NHẤT vẽ được ngoài chấm
  // xe. Trước đây màn này không nạp context, bản đồ chỉ còn một chấm trơ trọi.
  it("nap diem don cua xe trung chuyen khi chon tren ban do", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [shuttleTripItem],
      totalItems: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getOperatorShuttleContext).mockResolvedValue({
      shuttleTripId: shuttleTripItem.shuttleTripId,
      mainTripId: shuttleTripItem.mainTripId,
      direction: "INBOUND_TO_STATION",
      status: "IN_PROGRESS",
      station: {
        stationId: "station-1",
        name: "Bến xe Miền Đông",
        latitude: 10.81,
        longitude: 106.63,
        pickupOrder: 3,
      },
      stops: [
        {
          pickupOrder: 1,
          bookingId: "booking-1",
          latitude: 10.76,
          longitude: 106.66,
          status: "PICKED_UP",
          isStation: false,
          serviceAddress: "123 Nguyễn Huệ",
        },
        {
          pickupOrder: 3,
          bookingId: null,
          latitude: 10.81,
          longitude: 106.63,
          status: "PENDING",
          isStation: true,
        },
      ],
    });
    vi.mocked(getOperatorFleetLatest).mockImplementation((params) =>
      Promise.resolve({
        items:
          params?.status === "DISRUPTED"
            ? []
            : [
                {
                  kind: "SHUTTLE" as const,
                  shuttleTripId: shuttleTripItem.shuttleTripId,
                  mainTripId: shuttleTripItem.mainTripId,
                  latitude: 10.76,
                  longitude: 106.66,
                  speedKmh: 24,
                  headingDeg: 120,
                  recordedAt: "2026-08-05T08:30:01Z",
                  status: "IN_PROGRESS" as const,
                },
              ],
        generatedAt: "2026-08-05T08:30:02Z",
      }),
    );

    renderPage();

    await user.click(await screen.findByText("51B-999.99"));

    await waitFor(() =>
      expect(getOperatorShuttleContext).toHaveBeenCalledWith(
        shuttleTripItem.shuttleTripId,
      ),
    );
    // Không gọi nhầm endpoint lộ trình của chuyến chính bằng id shuttle
    expect(getTrackingTripRouteGeometry).not.toHaveBeenCalledWith(
      expect.stringContaining("shuttle:"),
    );

    // Marker thực sự tới được bản đồ, không dừng lại ở state
    await waitFor(() => {
      const drawn = (canvasProps.at(-1)?.pointMarkers ?? []).filter((marker) =>
        marker.id.startsWith("route-shuttle-stop:"),
      );
      expect(drawn).toHaveLength(2);
    });

    const markers = canvasProps.at(-1)?.pointMarkers ?? [];
    const pickup = markers.find((m) => m.id === "route-shuttle-stop:1");
    const station = markers.find((m) => m.id === "route-shuttle-stop:3");

    // Điểm đón #1 đã PICKED_UP => mờ đi và lùi xuống dưới
    expect(pickup?.label?.text).toBe("1");
    expect(pickup?.icon?.fillOpacity).toBe(0.8);
    expect(pickup?.zIndex).toBe(2);
    // Bến là điểm cuối (INBOUND) nên không có số thứ tự, còn PENDING nên đậm
    expect(station?.label).toBeUndefined();
    expect(station?.icon?.fillOpacity).toBe(1);
    expect(station?.zIndex).toBe(3);
  });

  it("context loi thi van giu marker xe, khong lam vo man hinh", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [shuttleTripItem],
      totalItems: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    vi.mocked(getOperatorShuttleContext).mockRejectedValue(new Error("boom"));
    vi.mocked(getOperatorFleetLatest).mockImplementation((params) =>
      Promise.resolve({
        items:
          params?.status === "DISRUPTED"
            ? []
            : [
                {
                  kind: "SHUTTLE" as const,
                  shuttleTripId: shuttleTripItem.shuttleTripId,
                  mainTripId: shuttleTripItem.mainTripId,
                  latitude: 10.76,
                  longitude: 106.66,
                  speedKmh: 24,
                  headingDeg: 120,
                  recordedAt: "2026-08-05T08:30:01Z",
                  status: "IN_PROGRESS" as const,
                },
              ],
        generatedAt: "2026-08-05T08:30:02Z",
      }),
    );

    renderPage();
    await user.click(await screen.findByText("51B-999.99"));

    await waitFor(() => expect(getOperatorShuttleContext).toHaveBeenCalled());
    expect(screen.getByText("51B-999.99")).toBeInTheDocument();
  });
});
