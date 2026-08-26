import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelOperatorShuttleRequest,
  reassignOperatorShuttleTrip,
  cancelOperatorShuttleTrip,
  getOperatorShuttleContext,
  getOperatorShuttleRequests,
  getOperatorShuttleTripPassengers,
  getOperatorUsers,
  getOperatorVehicles,
  getOperatorShuttleTrips,
  getShuttleTripEta,
  getShuttleTripLatest,
  type OperatorShuttleTripListItem,
  type ShuttleRequestGroup,
} from "../../../api/vietride";
import { joinShuttleTracking } from "../../../lib/trackingSocket";
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
  getOperatorShuttleContext: vi.fn(),
  getOperatorShuttleTripPassengers: vi.fn(),
  reassignOperatorShuttleTrip: vi.fn(),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({
    id: "operator-admin-1",
    email: "ops@operator.vn",
    role: "OPERATOR_ADMIN",
  }),
  refreshAuthSession: vi.fn().mockResolvedValue(null),
}));

type FleetMapProps = {
  vehicles: Array<{
    id: string;
    status: string;
    position: { lat: number; lng: number } | null;
    headingDeg?: number | null;
  }>;
  selectedId: string | null;
  routeStops?: Array<{
    id: string;
    name: string;
    orderIndex?: number;
    position: { lat: number; lng: number };
  }>;
};

const fleetMapProps = vi.hoisted(() => [] as FleetMapProps[]);

// Google Maps không chạy trong jsdom — mock bản đồ để test kiểm phần thuộc về
// màn này: điểm nào được đẩy lên bản đồ và xe nào đang được bám.
vi.mock("../../../components/FleetMap", () => ({
  default: (props: FleetMapProps) => {
    fleetMapProps.push(props);
    return <div data-testid="shuttle-map" />;
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
  joinShuttleTracking: vi.fn(() => Promise.resolve({ success: true })),
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

function renderPage(entry = "/manager/dispatch") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <DispatchPanel />
    </MemoryRouter>,
  );
}

describe("Manager Dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackingSocketHandlers.clear();
    fleetMapProps.length = 0;
    vi.mocked(joinShuttleTracking).mockResolvedValue({
      success: true,
      shuttleTripId: shuttleTrip.shuttleTripId,
      room: `shuttle:${shuttleTrip.shuttleTripId}`,
      scope: "OPERATOR",
    });
    // Danh sách khách trong modal chi tiết chuyến — mặc định rỗng để các test
    // cũ chỉ quan tâm lộ trình điểm đón không phải khai thêm dữ liệu.
    vi.mocked(getOperatorShuttleTripPassengers).mockResolvedValue({
      shuttleTripId: shuttleTrip.shuttleTripId,
      groups: [],
    });
    // Danh sách xe/tài xế cho hộp thoại phân công và đổi phân công
    vi.mocked(getOperatorVehicles).mockResolvedValue({
      items: [
        {
          vehicleId: "vehicle-1",
          id: "vehicle-1",
          licensePlate: "51B-123.45",
          vehicleTypeName: "Limousine",
          vehicleTypeCode: "LIMO",
          totalSeats: 16,
          status: "ACTIVE",
          isActive: true,
        },
        {
          vehicleId: "vehicle-2",
          id: "vehicle-2",
          licensePlate: "51B-678.90",
          vehicleTypeName: "Hiace",
          vehicleTypeCode: "HIACE",
          totalSeats: 9,
          status: "ACTIVE",
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 50,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    } as never);
    vi.mocked(getOperatorUsers).mockResolvedValue({
      items: [
        {
          userId: "driver-1",
          email: "b@operator.vn",
          displayName: "Trần Văn B",
          phone: "0900000001",
          role: "DRIVER",
          status: "ACTIVE",
          operatorId: "operator-1",
        },
        {
          userId: "driver-2",
          email: "c@operator.vn",
          displayName: "Trần Văn C",
          phone: "0900000002",
          role: "DRIVER",
          status: "ACTIVE",
          operatorId: "operator-1",
        },
      ],
      page: 1,
      pageSize: 50,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    } as never);
    vi.mocked(getShuttleTripLatest).mockResolvedValue(null);
    vi.mocked(getShuttleTripEta).mockResolvedValue(null);
    // Nạp cùng lượt với latest/eta; mặc định trả context rỗng để các case cũ
    // không phải khai lại.
    vi.mocked(getOperatorShuttleContext).mockResolvedValue({
      shuttleTripId: shuttleTrip.shuttleTripId,
      mainTripId: shuttleTrip.mainTripId,
      direction: "INBOUND_TO_STATION",
      status: "IN_PROGRESS",
      stops: [],
      station: null,
    });
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

    // API mới ĐƯỢC GỌI chưa có nghĩa là hàng đã render — chờ đúng nút cần bấm,
    // không thì lúc máy chậm (chạy cả suite) danh sách còn đang loading và test
    // đỏ ngẫu nhiên.
    await waitFor(() => expect(getOperatorShuttleRequests).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /details/i }));

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

  // Mặc định là XEM HẾT: không gửi `status` lên BE. Không được liệt kê cứng bốn
  // trạng thái ở FE — BE thêm trạng thái mới là màn này lọc mất.
  it("mặc định xin mọi trạng thái, không gửi `status`", async () => {
    renderPage();

    await waitFor(() => expect(getOperatorShuttleTrips).toHaveBeenCalled());
    expect(
      vi.mocked(getOperatorShuttleTrips).mock.calls[0][0],
    ).not.toHaveProperty("status");
  });

  it("chọn Đang hoạt động thì gộp hai trạng thái chưa kết thúc", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(getOperatorShuttleTrips).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "dispatch.shuttleStatusFilter" }),
    );
    await user.click(
      screen.getByRole("option", {
        name: "dispatch.shuttleStatusFilters.ACTIVE",
      }),
    );

    await waitFor(() =>
      expect(getOperatorShuttleTrips).toHaveBeenCalledWith(
        expect.objectContaining({ status: "SCHEDULED,IN_PROGRESS" }),
      ),
    );
  });

  it("đổi bộ lọc sang Đã hoàn thành thì tải lại đúng trạng thái đó", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(getOperatorShuttleTrips).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "dispatch.shuttleStatusFilter" }),
    );
    await user.click(
      screen.getByRole("option", {
        name: "dispatch.shuttleStatusFilters.COMPLETED",
      }),
    );

    await waitFor(() =>
      expect(getOperatorShuttleTrips).toHaveBeenCalledWith(
        expect.objectContaining({ status: "COMPLETED" }),
      ),
    );
  });

  // Chuyến đã xong không còn nguồn GPS: không join room, và thẻ hiện mốc thời
  // gian chứ không phải hint "đang chờ tín hiệu".
  it("không đăng ký realtime cho chuyến đã hoàn thành", async () => {
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [
        {
          ...shuttleTrip,
          status: "COMPLETED",
          actualDepartureTime: "2026-08-12T21:35:00+07:00",
          completedAt: "2026-08-12T22:25:00+07:00",
        },
      ],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderPage();

    await waitFor(() => expect(getOperatorShuttleTrips).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText("dispatch.completedAt")).toBeInTheDocument(),
    );
    expect(joinShuttleTracking).not.toHaveBeenCalled();
    expect(getShuttleTripLatest).not.toHaveBeenCalled();
    expect(
      screen.queryByText("dispatch.trackingWaitingSignalHint"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "dispatch.refreshTracking" }),
    ).not.toBeInTheDocument();
  });

  // Chuyến đã kết thúc không nằm trong luồng tracking nên chưa có context sẵn —
  // modal phải tự nạp lộ trình điểm đón khi mở.
  it("mở chi tiết chuyến thì nạp và hiện lộ trình điểm đón", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [{ ...shuttleTrip, status: "COMPLETED" }],
      page: 1,
      pageSize: 12,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorShuttleContext).mockResolvedValue({
      shuttleTripId: shuttleTrip.shuttleTripId,
      mainTripId: shuttleTrip.mainTripId,
      direction: "INBOUND_TO_STATION",
      status: "COMPLETED",
      stops: [
        {
          pickupOrder: 2,
          bookingId: null,
          latitude: 10.78,
          longitude: 106.7,
          status: "PENDING",
          isStation: true,
        },
        {
          pickupOrder: 1,
          bookingId: "booking-1",
          latitude: 10.77,
          longitude: 106.7,
          status: "PICKED_UP",
          isStation: false,
          serviceAddress: "123 Nguyễn Huệ, Quận 1",
          roadDistanceMeters: 9500,
        },
      ],
      station: {
        stationId: "station-1",
        name: "Bến xe Miền Đông",
        latitude: 10.8,
        longitude: 106.71,
        pickupOrder: 2,
      },
    });

    renderPage();
    await waitFor(() => expect(getOperatorShuttleTrips).toHaveBeenCalled());

    await user.click(
      await screen.findByRole("button", { name: "dispatch.viewTripDetail" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(getOperatorShuttleContext).toHaveBeenCalledWith(
      shuttleTrip.shuttleTripId,
    );
    await waitFor(() =>
      expect(
        within(dialog).getByText("123 Nguyễn Huệ, Quận 1"),
      ).toBeInTheDocument(),
    );
    // `pickupOrder` là thứ tự nghiệp vụ, không phải index mảng: BE trả điểm bến
    // (order 2) TRƯỚC nên modal phải tự sắp lại.
    const stopItems = within(dialog).getAllByRole("listitem");
    expect(stopItems[0]).toHaveTextContent("123 Nguyễn Huệ, Quận 1");
    expect(stopItems[1]).toHaveTextContent("Bến xe Miền Đông");
    expect(
      within(dialog).getByText("dispatch.stopStatus.PICKED_UP"),
    ).toBeInTheDocument();
  });

  it("join room realtime của chuyến đang hoạt động rồi nạp vị trí/ETA một lần", async () => {
    renderPage();

    await waitFor(() =>
      expect(joinShuttleTracking).toHaveBeenCalledWith(
        expect.anything(),
        shuttleTrip.shuttleTripId,
      ),
    );
    // Room chỉ phát khi tài xế gửi GPS tiếp theo nên phải nạp REST một lần.
    await waitFor(() =>
      expect(getShuttleTripLatest).toHaveBeenCalledWith(
        shuttleTrip.shuttleTripId,
      ),
    );
    expect(getShuttleTripEta).toHaveBeenCalledWith(shuttleTrip.shuttleTripId);
  });

  it("cập nhật vị trí từ event socket mà không cần bấm làm mới", async () => {
    renderPage();

    // Phải chờ danh sách chuyến tải xong: hook chỉ nhận event của chuyến đã
    // nằm trong danh sách theo dõi.
    await waitFor(() => expect(joinShuttleTracking).toHaveBeenCalled());
    expect(
      await screen.findByText("dispatch.trackingWaitingSignalHint"),
    ).toBeInTheDocument();

    trackingSocketHandlers.get("shuttle:gps:update")?.({
      shuttleTripId: shuttleTrip.shuttleTripId,
      latitude: 10.7626,
      longitude: 106.6601,
      // Mốc thời gian thật: điểm cũ hơn TTL bị đánh dấu mất tín hiệu và không
      // còn gắn nhãn "trực tiếp" nữa.
      recordedAt: new Date().toISOString(),
    });

    // Thẻ không in toạ độ thô nữa (điều độ viên không đọc được) — vị trí thể
    // hiện bằng marker trên bản đồ, thẻ chỉ nói tín hiệu còn sống hay không.
    await waitFor(() =>
      expect(screen.getByText("dispatch.vehicleSignal")).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("dispatch.trackingWaitingSignalHint"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("dispatch.liveBadge")).toBeInTheDocument();
    expect(screen.queryByText("dispatch.signalLostBadge")).not.toBeInTheDocument();
    expect(
      fleetMapProps[fleetMapProps.length - 1].vehicles[0].position,
    ).toEqual({ lat: 10.7626, lng: 106.6601 });
    expect(getShuttleTripLatest).toHaveBeenCalledTimes(1);
  });

  it("bỏ qua event của chuyến không nằm trong danh sách đang theo dõi", async () => {
    renderPage();

    // Phải chờ danh sách chuyến tải xong: hook chỉ nhận event của chuyến đã
    // nằm trong danh sách theo dõi.
    await waitFor(() => expect(joinShuttleTracking).toHaveBeenCalled());
    // BE không có message rời room: chuyến đã kết thúc vẫn phát về trên kết nối
    // hiện tại nên handler phải tự lọc.
    trackingSocketHandlers.get("shuttle:gps:update")?.({
      shuttleTripId: "36000000-0000-4000-8000-000000000999",
      latitude: 21.0278,
      longitude: 105.8342,
      recordedAt: "2026-08-12T21:36:00+07:00",
    });

    await waitFor(() =>
      expect(
        screen.getByText("dispatch.trackingWaitingSignalHint"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("21.0278, 105.8342")).not.toBeInTheDocument();
  });

  it("giữ điểm GPS mới hơn khi event tới lệch thứ tự", async () => {
    renderPage();

    // Phải chờ danh sách chuyến tải xong: hook chỉ nhận event của chuyến đã
    // nằm trong danh sách theo dõi.
    await waitFor(() => expect(joinShuttleTracking).toHaveBeenCalled());
    const emitGps = trackingSocketHandlers.get("shuttle:gps:update");

    emitGps?.({
      shuttleTripId: shuttleTrip.shuttleTripId,
      latitude: 10.7626,
      longitude: 106.6601,
      recordedAt: "2026-08-12T21:35:00+07:00",
    });
    // Vị trí chỉ còn quan sát được qua marker đẩy lên bản đồ.
    await waitFor(() =>
      expect(
        fleetMapProps[fleetMapProps.length - 1].vehicles[0]?.position,
      ).toEqual({ lat: 10.7626, lng: 106.6601 }),
    );

    emitGps?.({
      shuttleTripId: shuttleTrip.shuttleTripId,
      latitude: 10.75,
      longitude: 106.65,
      recordedAt: "2026-08-12T21:30:00+07:00",
    });

    expect(
      fleetMapProps[fleetMapProps.length - 1].vehicles[0].position,
    ).toEqual({ lat: 10.7626, lng: 106.6601 });
  });

  it("chưa có toạ độ thì không dựng bản đồ", async () => {
    renderPage();

    await waitFor(() => expect(joinShuttleTracking).toHaveBeenCalled());
    expect(screen.queryByTestId("shuttle-map")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "dispatch.showOnMap" }),
    ).not.toBeInTheDocument();
  });

  it("đưa xe lên bản đồ khi có điểm GPS rồi bám xe khi bấm xem", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(joinShuttleTracking).toHaveBeenCalled());
    trackingSocketHandlers.get("shuttle:gps:update")?.({
      shuttleTripId: shuttleTrip.shuttleTripId,
      latitude: 10.7626,
      longitude: 106.6601,
      speedKmh: 24,
      heading: 120,
      recordedAt: new Date().toISOString(),
    });

    await waitFor(() =>
      expect(screen.getByTestId("shuttle-map")).toBeInTheDocument(),
    );
    const rendered = fleetMapProps[fleetMapProps.length - 1];
    expect(rendered.vehicles).toHaveLength(1);
    expect(rendered.vehicles[0]).toMatchObject({
      id: shuttleTrip.shuttleTripId,
      status: "moving",
      position: { lat: 10.7626, lng: 106.6601 },
      // Shuttle gửi `heading`, không phải `headingDeg` như chuyến thường.
      headingDeg: 120,
    });
    expect(rendered.selectedId).toBeNull();

    await user.click(screen.getByRole("button", { name: "dispatch.showOnMap" }));

    await waitFor(() =>
      expect(fleetMapProps[fleetMapProps.length - 1].selectedId).toBe(
        shuttleTrip.shuttleTripId,
      ),
    );
  });

  it("báo mất realtime khi socket ngắt kết nối", async () => {
    renderPage();

    await waitFor(() =>
      expect(trackingSocketHandlers.has("disconnect")).toBe(true),
    );
    trackingSocketHandlers.get("connect")?.(undefined);
    await waitFor(() =>
      expect(screen.getByText("dispatch.realtime.connected")).toBeInTheDocument(),
    );

    trackingSocketHandlers.get("disconnect")?.(undefined);

    await waitFor(() =>
      expect(screen.getByText("dispatch.realtime.error")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("dispatch.shuttleTrackingOfflineHint"),
    ).toBeInTheDocument();
  });

  it("hiện SĐT hành khách ngay trong hàng đợi chờ điều phối", async () => {
    renderPage();

    // Số này BE trả sẵn trong `passengers[]`. Sau khi phân công, lượt đặt rời
    // khỏi hàng đợi nên đây là chỗ điều độ viên lấy được số để gọi.
    const phoneLink = await screen.findByRole("link", { name: /0900000000/ });
    expect(phoneLink).toHaveAttribute("href", "tel:0900000000");
  });

  it("hiện danh sách hành khách kèm SĐT, số vé và bản đồ điểm đón ở chi tiết", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole("button", { name: "details" }))[0]);

    const dialog = await screen.findByRole("dialog");
    const phoneLink = within(dialog).getByRole("link", { name: /0900000000/ });
    expect(phoneLink).toHaveAttribute("href", "tel:0900000000");
    // Tên và số nằm cùng một dòng liên hệ — gọi đúng người chứ không phải đọc
    // ghép hai chỗ khác nhau trên màn.
    expect(phoneLink.closest("li")).toHaveTextContent("Nguyễn Văn A");
    expect(within(dialog).getByText("dispatch.ticketCount 1")).toBeInTheDocument();

    // Bản đồ điểm đón dựng từ `pickupLat`/`pickupLng` — nhóm chờ chưa có chuyến
    // nên không có xe nào, chỉ có marker điểm đón đánh số theo thứ tự đề xuất.
    expect(within(dialog).getByTestId("shuttle-map")).toBeInTheDocument();
    const mapProps = fleetMapProps[fleetMapProps.length - 1];
    expect(mapProps.vehicles).toHaveLength(0);
    expect(mapProps.routeStops).toEqual([
      {
        id: `pickup:${group.bookingGroups[0].bookingId}`,
        kind: "stop",
        name: group.bookingGroups[0].pickupAddress,
        orderIndex: 1,
        position: { lat: 10.7731, lng: 106.7032 },
      },
    ]);
  });

  it("phân trang danh sách chuyến trung chuyển thay vì chỉ tải trang đầu", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorShuttleTrips).mockResolvedValue({
      items: [shuttleTrip],
      page: 1,
      pageSize: 12,
      totalItems: 20,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    renderPage();

    await waitFor(() =>
      expect(getOperatorShuttleTrips).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 12 }),
      ),
    );

    // Hai thanh phân trang trên màn: yêu cầu chờ (trước) và chuyến trung chuyển.
    const nextButtons = screen.getAllByRole("button", { name: "next" });
    await user.click(nextButtons[nextButtons.length - 1]);

    await waitFor(() =>
      expect(getOperatorShuttleTrips).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
  });

  it("mở sẵn chi tiết chuyến và tô sáng đúng điểm đón khi vào từ thông báo", async () => {
    vi.mocked(getOperatorShuttleContext).mockResolvedValue({
      shuttleTripId: shuttleTrip.shuttleTripId,
      mainTripId: shuttleTrip.mainTripId,
      direction: "INBOUND_TO_STATION",
      status: "SCHEDULED",
      stops: [
        {
          pickupOrder: 1,
          bookingId: "booking-a",
          latitude: 10.7,
          longitude: 106.6,
          status: "PENDING",
          isStation: false,
          serviceAddress: "12 Lê Lợi",
        },
        {
          pickupOrder: 2,
          bookingId: "booking-b",
          latitude: 10.75,
          longitude: 106.65,
          status: "PENDING",
          isStation: false,
          serviceAddress: "34 Nguyễn Huệ",
        },
      ],
      station: null,
    });

    renderPage(
      `/manager/dispatch?shuttleTripId=${shuttleTrip.shuttleTripId}&bookingId=booking-b&pickupOrder=2`,
    );

    // Thông báo nói về MỘT điểm đón cụ thể → mở thẳng chi tiết, không bắt tự tìm
    const dialog = await screen.findByRole("dialog");
    const badge = await within(dialog).findByText(
      "dispatch.notifiedStopBadge",
    );
    expect(badge.closest("li")).toHaveTextContent("34 Nguyễn Huệ");
  });

  it("không tự mở chi tiết khi deep-link chỉ có shuttleTripId", async () => {
    renderPage(`/manager/dispatch?shuttleTripId=${shuttleTrip.shuttleTripId}`);

    await waitFor(() => expect(joinShuttleTracking).toHaveBeenCalled());
    // Thông báo chung cho nhà xe không đại diện nhóm khách nào — mở modal là phiền
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("đổi phân công chỉ gửi field thật sự thay đổi", async () => {
    const user = userEvent.setup();
    vi.mocked(reassignOperatorShuttleTrip).mockResolvedValue({
      shuttleTripId: shuttleTrip.shuttleTripId,
      driverUserId: "driver-2",
      vehicleId: shuttleTrip.vehicle.id,
    });

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "dispatch.reassignTitle" }),
    );

    const dialog = await screen.findByRole("dialog");
    // CustomSelect là listbox tuỳ biến: mở bằng button rồi chọn option
    await user.click(
      await within(dialog).findByRole("button", { name: "dispatch.newDriver" }),
    );
    await user.click(screen.getByRole("option", { name: /Trần Văn C/ }));
    await user.type(
      within(dialog).getByRole("textbox"),
      "Tài xế cũ báo ốm",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "dispatch.reassignConfirm" }),
    );

    await waitFor(() =>
      expect(reassignOperatorShuttleTrip).toHaveBeenCalledWith(
        shuttleTrip.shuttleTripId,
        // Không đổi xe thì KHÔNG gửi `vehicleId` — BE hiểu vắng mặt là giữ nguyên
        { driverUserId: "driver-2", reason: "Tài xế cũ báo ốm" },
        expect.any(String),
      ),
    );
  });

  it("chặn đổi phân công khi chưa nhập lý do", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "dispatch.reassignTitle" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      await within(dialog).findByRole("button", { name: "dispatch.newDriver" }),
    );
    await user.click(screen.getByRole("option", { name: /Trần Văn C/ }));
    await user.click(
      within(dialog).getByRole("button", { name: "dispatch.reassignConfirm" }),
    );

    // Lý do đi thẳng vào thông báo cho hành khách nên BE bắt buộc; chặn ở FE
    // để không tốn một vòng 422.
    expect(
      await within(dialog).findByText("dispatch.reassignReasonRequired"),
    ).toBeInTheDocument();
    expect(reassignOperatorShuttleTrip).not.toHaveBeenCalled();
  });
});
