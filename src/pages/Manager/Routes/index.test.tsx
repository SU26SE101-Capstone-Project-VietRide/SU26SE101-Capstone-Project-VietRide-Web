import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperatorRouteFull,
  createOperatorStation,
  getAlternativeRoutes,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStop,
  getOperatorStops,
  getPublicLocations,
  searchStations,
  updateOperatorRouteFull,
  type OperatorRoute,
  type OperatorRouteDetail,
  type OperatorStation,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import {
  distanceKmBetween,
  requestRoadGeometry,
  type RoadRouteOption,
} from "./geometry";
import { encodeGooglePolyline } from "./polyline";
import RoutesPage from "./index";

// Mock riêng requestRoadGeometry (gọi Google Routes) — các helper thuần giữ bản thật
vi.mock("./geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geometry")>();

  return { ...actual, requestRoadGeometry: vi.fn() };
});

vi.mock("react-i18next", () => {
  const translate = (key: string) => key;

  return {
    useTranslation: () => ({ t: translate }),
  };
});

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

vi.mock("../../../components/PlacePicker", () => ({
  default: ({
    label,
    onSelect,
  }: {
    label: string;
    onSelect: (place: {
      placeId: string;
      name: string;
      address: string;
      city: string;
      ward: string;
      latitude: number;
      longitude: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          placeId: "place-1",
          name: "Bến xe Trung tâm",
          address: "1 Đường Chính",
          city: "Hồ Chí Minh",
          ward: "Hồ Chí Minh",
          latitude: 10.77,
          longitude: 106.69,
        })
      }
    >
      {label}
    </button>
  ),
}));

// Trạng thái cho nút giả lập event drag liên tục — mỗi lần bấm dịch ~5.5km để
// vượt ngưỡng di chuyển tối thiểu của throttle "kéo tới đâu tính tới đó"
const dragMoveState = vi.hoisted(() => ({ tick: 0 }));

// Mock canvas hiển thị polyline/marker nhận được dưới dạng test-id — để test
// khẳng định bản đồ nhận ĐỦ các phương án đường (bug từng chỉ vẽ 1 đường)
vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: ({
    markers = [],
    pointMarkers = [],
    polylines = [],
  }: {
    markers?: Array<{ id: string; onClick?: () => void }>;
    pointMarkers?: Array<{
      id: string;
      draggable?: boolean;
      label?: { text: string };
      onClick?: () => void;
      onDrag?: (position: { lat: number; lng: number }) => void;
      onDragEnd?: (position: { lat: number; lng: number }) => void;
    }>;
    polylines?: Array<{
      id: string;
      color: string;
      opacity?: number;
      onClick?: (position?: { lat: number; lng: number }) => void;
    }>;
  }) => (
    <div data-testid="route-map">
      {polylines.map((polyline) => (
        <button
          key={polyline.id}
          type="button"
          data-testid={`map-polyline-${polyline.id}`}
          data-color={polyline.color}
          data-opacity={polyline.opacity ?? 1}
          // Giả lập click trên đường tại một tọa độ cố định (như event.latLng thật)
          onClick={() => polyline.onClick?.({ lat: 11.05, lng: 107.4 })}
        />
      ))}
      {pointMarkers.map((marker) => (
        <span key={marker.id} data-testid={`map-pointmarker-${marker.id}`}>
          <button
            type="button"
            data-testid={`map-pointmarker-click-${marker.id}`}
            onClick={marker.onClick}
          >
            {marker.label?.text}
          </button>
          <button
            type="button"
            data-testid={`map-pointmarker-drag-${marker.id}`}
            // Giả lập dragend tới một tọa độ cố định
            onClick={() => marker.onDragEnd?.({ lat: 11.31, lng: 107.61 })}
          />
          <button
            type="button"
            data-testid={`map-pointmarker-dragmove-${marker.id}`}
            // Giả lập event drag LIÊN TỤC — mỗi lần bấm là một vị trí mới xa hơn
            onClick={() =>
              marker.onDrag?.({
                lat: 11.3 + dragMoveState.tick++ * 0.05,
                lng: 107.6,
              })
            }
          />
        </span>
      ))}
      {markers.map((marker) => (
        <button
          key={marker.id}
          type="button"
          data-testid={`map-marker-${marker.id}`}
          onClick={marker.onClick}
        />
      ))}
    </div>
  ),
}));

vi.mock("../../../api/vietride", () => ({
  createOperatorRouteFull: vi.fn(),
  createAlternativeRoute: vi.fn(),
  createOperatorStation: vi.fn(),
  createOperatorStop: vi.fn(),
  deleteAlternativeRoute: vi.fn(),
  getAlternativeRoutes: vi.fn(),
  getOperatorRoute: vi.fn(),
  getOperatorRoutes: vi.fn(),
  getOperatorStations: vi.fn(),
  getOperatorStop: vi.fn(),
  getOperatorStops: vi.fn(),
  getPublicLocations: vi.fn(),
  searchStations: vi.fn(),
  updateAlternativeRoute: vi.fn(),
  updateOperatorRouteFull: vi.fn(),
  updateOperatorStop: vi.fn(),
}));

// RoutesPage dùng useSearchParams nên phải render trong Router context
function renderRoutesPage(initialEntries: string[] = ["/manager/routes"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RoutesPage />
    </MemoryRouter>,
  );
}

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 50,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const originStationId = "11111111-1111-1111-1111-111111111111";
const destinationStationId = "22222222-2222-2222-2222-222222222222";

const routeA: OperatorRoute = {
  id: "route-1",
  operatorId: "operator-1",
  name: "Tuyến A",
  originStationId,
  destinationStationId,
  baseFare: 150000,
  totalDistanceKm: 120,
  estimatedDurationMinutes: 180,
  isActive: true,
};

const operatorStations: OperatorStation[] = [
  {
    id: "op-station-1",
    operatorId: "operator-1",
    stationId: originStationId,
    station: {
      id: originStationId,
      name: "Bến A",
      city: "Hồ Chí Minh",
      ward: null,
      latitude: 10.77,
      longitude: 106.69,
    },
  },
  {
    id: "op-station-2",
    operatorId: "operator-1",
    stationId: destinationStationId,
    station: {
      id: destinationStationId,
      name: "Bến B",
      city: "Lâm Đồng",
      ward: "Phường Xuân Hương - Đà Lạt",
      latitude: 11.94,
      longitude: 108.44,
    },
  },
];

// Load xong khi các skeleton lần đầu biến mất (sidebar + panel phải)
async function waitForLoaded() {
  await screen.findByRole("heading", { name: "routes.manageTitle" });
  await waitFor(() => {
    expect(
      screen.queryByTestId("route-detail-skeleton"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryAllByTestId("route-list-skeleton-row"),
    ).toHaveLength(0);
  });
}

describe("Manager route setup workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dragMoveState.tick = 0;
    // Xóa cache danh sách tuyến để test không dính dữ liệu của test trước
    sessionStorage.clear();
    vi.mocked(getOperatorRoutes).mockResolvedValue(emptyPage);
    vi.mocked(getAlternativeRoutes).mockResolvedValue(emptyPage);
    vi.mocked(getOperatorStops).mockResolvedValue(emptyPage);
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      pageSize: 100,
    });
    vi.mocked(getPublicLocations).mockResolvedValue([]);
    vi.mocked(searchStations).mockResolvedValue([]);
    // Mặc định như môi trường test/CI: không có Google Routes API key → request lỗi
    vi.mocked(requestRoadGeometry).mockRejectedValue(
      new Error("routes.routingFailed"),
    );
  });

  it("shows skeletons instead of empty states while the initial load is pending", async () => {
    // API treo (backend spike) → skeleton, KHÔNG được hiện empty-state gây hiểu nhầm
    vi.mocked(getOperatorRoutes).mockReturnValue(new Promise<never>(() => {}));

    renderRoutesPage();
    await screen.findByRole("heading", { name: "routes.manageTitle" });

    expect(
      screen.getAllByTestId("route-list-skeleton-row").length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("route-detail-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("routes.noRoutesFound")).not.toBeInTheDocument();
    expect(
      screen.queryByText("routes.emptyStateTitle"),
    ).not.toBeInTheDocument();
  });

  it("shows both empty states only after loading finishes with no routes", async () => {
    renderRoutesPage();
    await waitForLoaded();

    expect(screen.getByText("routes.noRoutesFound")).toBeInTheDocument();
    expect(screen.getByText("routes.emptyStateTitle")).toBeInTheDocument();
  });

  it("renders cached routes in the sidebar immediately while the API is still pending", async () => {
    // Cache phiên trước (getAuthUser mock không có id → key anonymous)
    sessionStorage.setItem(
      "vietride:routeList:anonymous",
      JSON.stringify({ ts: Date.now(), data: [routeA] }),
    );
    vi.mocked(getOperatorRoutes).mockReturnValue(new Promise<never>(() => {}));

    renderRoutesPage();
    await screen.findByRole("heading", { name: "routes.manageTitle" });

    // Sidebar hiện tên tuyến từ cache ngay, không skeleton danh sách
    expect(screen.getAllByText("Tuyến A").length).toBeGreaterThan(0);
    expect(
      screen.queryAllByTestId("route-list-skeleton-row"),
    ).toHaveLength(0);
    expect(screen.queryByText("routes.noRoutesFound")).not.toBeInTheDocument();
  });

  it("shows the route list sidebar and an empty state when no route is selected", async () => {
    renderRoutesPage();
    await waitForLoaded();
    await waitFor(() => expect(getOperatorRoutes).toHaveBeenCalledTimes(1));

    expect(screen.getByText("routes.routeListTitle")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("routes.searchRoutePlaceholder"),
    ).toBeInTheDocument();
    expect(screen.getByText("routes.emptyStateTitle")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /routes.newRoute/ }).length,
    ).toBeGreaterThan(0);
    // Chưa chọn tuyến → không hiển thị tab và form tuyến
    expect(screen.queryByText("routes.tabs.info")).not.toBeInTheDocument();
    expect(
      screen.queryByText("routes.routeManagement"),
    ).not.toBeInTheDocument();
  });

  it("shows the merged map-first tab active for the selected route", async () => {
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage();
    await waitForLoaded();

    expect(await screen.findByText("routes.tabs.info")).toBeInTheDocument();
    // Tab "Điểm dừng" riêng đã gộp vào tab Thông tin — không còn nút tab đó
    expect(screen.queryByText("routes.tabs.stops")).not.toBeInTheDocument();
    expect(screen.getByText("routes.tabs.alternatives")).toBeInTheDocument();
    // Tab gộp: panel nổi chứa form + mục điểm dừng, bản đồ toàn khung,
    // nút "Lưu tuyến" atomic nổi trên bản đồ (disabled khi chưa có thay đổi)
    expect(screen.getByTestId("route-floating-panel")).toBeInTheDocument();
    expect(screen.getByText("routes.routeManagement")).toBeInTheDocument();
    expect(screen.getByText("routes.panelStopsTitle")).toBeInTheDocument();
    expect(screen.getByTestId("route-map")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.saveRoute/ }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /routes.createRoute/ }),
    ).not.toBeInTheDocument();
    // Bến đi/bến đến bất biến sau khi tạo → 2 ô chọn bến bị khóa kèm hint
    expect(screen.getByText("routes.stationsLockedHint")).toBeInTheDocument();
  });

  it("redirects the legacy ?tab=stops deep link to the merged info tab", async () => {
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage(["/manager/routes?routeId=route-1&tab=stops"]);
    await waitForLoaded();

    // Tab stops cũ → về tab gộp: form tuyến + mục điểm dừng cùng hiển thị
    expect(
      await screen.findByText("routes.routeManagement"),
    ).toBeInTheDocument();
    expect(screen.getByText("routes.panelStopsTitle")).toBeInTheDocument();
    expect(screen.getByText("routes.noStopsAttached")).toBeInTheDocument();
  });

  it("collapses the floating panel into a reopen button", async () => {
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage();
    await waitForLoaded();
    expect(await screen.findByText("routes.routeManagement")).toBeInTheDocument();

    // Thu gọn: panel biến mất, chỉ còn nút mở lại
    fireEvent.click(
      screen.getByRole("button", { name: "routes.collapsePanel" }),
    );
    expect(
      screen.queryByText("routes.routeManagement"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("route-floating-panel"),
    ).not.toBeInTheDocument();

    // Mở lại: form + mục điểm dừng quay về
    fireEvent.click(screen.getByRole("button", { name: "routes.expandPanel" }));
    expect(screen.getByText("routes.routeManagement")).toBeInTheDocument();
    expect(screen.getByText("routes.panelStopsTitle")).toBeInTheDocument();
  });

  it("sends the shuttle capability when creating a station", async () => {
    vi.mocked(getPublicLocations).mockResolvedValue([
      {
        id: "location-1",
        code: "HCM",
        name: "Hồ Chí Minh",
        type: "MUNICIPALITY",
        sortOrder: 1,
        isActive: true,
      },
    ]);
    vi.mocked(createOperatorStation).mockResolvedValue({
      operatorId: "operator-1",
      stationId: "station-1",
      supportsShuttle: true,
      station: {
        id: "station-1",
        name: "Bến xe Trung tâm",
        city: "Hồ Chí Minh",
        ward: "Phường Bến Thành",
        latitude: 10.77,
        longitude: 106.69,
        supportsShuttle: true,
      },
    });

    renderRoutesPage();
    await waitForLoaded();

    // Quản lý bến giờ nằm trong modal — mở từ empty state
    fireEvent.click(
      screen.getByRole("button", { name: /routes.stationManagement/ }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "routes.stationName" }),
    );

    const locationSelect = await screen.findByRole("button", {
      name: "routes.searchLocation",
    });
    fireEvent.click(locationSelect);
    fireEvent.click(screen.getByRole("option", { name: "Hồ Chí Minh · HCM" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /routes\.supportsShuttle/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "routes.createAndAttachStation" }),
    );

    await waitFor(() =>
      expect(createOperatorStation).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: "location-1",
          supportsShuttle: true,
        }),
      ),
    );
  });

  it("selects the route from the routeId deep link", async () => {
    const routeB: OperatorRoute = {
      ...routeA,
      id: "route-2",
      name: "Tuyến B",
    };
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA, routeB],
      totalItems: 2,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockImplementation(async (routeId) =>
      routeId === routeB.id ? routeB : routeA,
    );

    renderRoutesPage(["/manager/routes?routeId=route-2"]);
    await waitForLoaded();

    // Deep-link phải kích hoạt tải chi tiết tuyến route-2 và đưa nó vào form
    await waitFor(() =>
      expect(getOperatorRoute).toHaveBeenCalledWith("route-2"),
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue("Tuyến B")).toBeInTheDocument(),
    );
  });

  it("ignores a stale route detail response when another route was selected meanwhile", async () => {
    const routeB: OperatorRoute = {
      ...routeA,
      id: "route-2",
      name: "Tuyến B",
    };
    // route-2 đứng đầu danh sách → loadData ban đầu chọn route-2 (resolve nhanh),
    // còn route-1 (Tuyến A) trả chậm để mô phỏng backend spike 3-10s
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeB, routeA],
      totalItems: 2,
      totalPages: 1,
    });
    let resolveRouteA: (route: OperatorRoute) => void = () => {};
    vi.mocked(getOperatorRoute).mockImplementation(
      (routeId) =>
        new Promise((resolve) => {
          if (routeId === routeA.id) {
            resolveRouteA = resolve;
          } else {
            resolve(routeB);
          }
        }),
    );

    renderRoutesPage();
    await waitForLoaded();
    expect(await screen.findByDisplayValue("Tuyến B")).toBeInTheDocument();

    // Click Tuyến A (pending) → panel phải hiện overlay loading, sidebar vẫn bấm được
    fireEvent.click(screen.getByRole("button", { name: /Tuyến A/ }));
    expect(
      await screen.findByText("routes.loadingRouteDetail"),
    ).toBeInTheDocument();

    // Đổi ý: click Tuyến B ngay khi A còn pending → B resolve trước, form là B.
    // (jsdom render cả trigger CustomSelect mobile cùng tên → lấy item sidebar cuối)
    const routeBButtons = screen.getAllByRole("button", { name: /Tuyến B/ });
    fireEvent.click(routeBButtons[routeBButtons.length - 1]);
    await waitFor(() =>
      expect(
        screen.queryByText("routes.loadingRouteDetail"),
      ).not.toBeInTheDocument(),
    );

    // Response A về sau cùng → phải bị bỏ qua, KHÔNG đè form đang hiển thị B
    await act(async () => {
      resolveRouteA(routeA);
    });
    expect(screen.getByDisplayValue("Tuyến B")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Tuyến A")).not.toBeInTheDocument();
  });

  it("creates a route atomically through POST /routes/full and opens the merged workspace", async () => {
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(createOperatorRouteFull).mockResolvedValue({
      ...routeA,
      id: "route-new",
      name: "Tuyến mới",
      stops: [],
    });

    renderRoutesPage();
    await waitForLoaded();

    fireEvent.click(
      screen.getAllByRole("button", { name: /routes.newRoute/ })[0],
    );

    expect(
      await screen.findByText("routes.createRouteModalTitle"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("routes.namePlaceholder"), {
      target: { value: "Tuyến mới" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "routes.selectOriginStation" }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: "Bến A · Hồ Chí Minh" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "routes.selectDestinationStation" }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
      }),
    );
    // Google Routes lỗi (mặc định môi trường test) → chờ fallback haversine
    // trước khi submit để payload có manualMetrics deterministic
    expect(
      await screen.findByText("routes.autoMetricsFallbackHint"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /routes.createRoute/ }));

    const expectedDistance = Number(
      distanceKmBetween(
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ).toFixed(1),
    );

    await waitFor(() =>
      expect(createOperatorRouteFull).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tuyến mới",
          originStationId,
          destinationStationId,
          returnRouteId: null,
          stops: [],
          // Fallback không có polyline → gửi manualMetrics ước lượng
          manualMetrics: expect.objectContaining({
            totalDistanceKm: expectedDistance,
          }),
        }),
      ),
    );
    // Có fallback → KHÔNG gửi pathPolyline (contract 12.1)
    expect(
      vi.mocked(createOperatorRouteFull).mock.calls[0][0].pathPolyline,
    ).toBeUndefined();
    // Tạo xong → auto-select tuyến mới, mở tab gộp map-first: mục điểm dừng
    // hiển thị ngay trong panel nổi để bổ sung tiếp
    expect(
      await screen.findByText("routes.panelStopsTitle"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tuyến mới")).toBeInTheDocument();
  });

  it("saves the selected route atomically with replace-all stops from the floating save button", async () => {
    const routeDetail: OperatorRouteDetail = {
      ...routeA,
      stops: [
        {
          routeId: routeA.id,
          stopId: "stop-9",
          // orderIndex thưa (5) → payload phải chuẩn hóa lại 1..N
          orderIndex: 5,
          estimatedDurationFromOriginMinutes: 30,
          distanceFromOriginKm: 10,
          allowPickup: true,
          allowDropoff: false,
          name: "Điểm dừng 9",
          address: null,
          latitude: 10.8,
          longitude: 106.7,
          isActive: true,
        },
      ],
    };
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeDetail);
    vi.mocked(updateOperatorRouteFull).mockResolvedValue({
      ...routeDetail,
      name: "Tuyến A mới",
      totalDistanceKm: 123.45,
      estimatedDurationMinutes: 135,
    });

    renderRoutesPage();
    await waitForLoaded();

    // Sửa form → cờ dirty bật, nút "Lưu tuyến" enable
    fireEvent.change(await screen.findByDisplayValue("Tuyến A"), {
      target: { value: "Tuyến A mới" },
    });
    const saveButton = screen.getByRole("button", {
      name: /routes.saveRoute/,
    });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(updateOperatorRouteFull).toHaveBeenCalledWith(
        routeA.id,
        expect.objectContaining({
          name: "Tuyến A mới",
          originStationId,
          destinationStationId,
          // Replace-all: gửi TOÀN BỘ stops hiện tại, orderIndex đánh lại 1..N
          stops: [expect.objectContaining({ stopId: "stop-9", orderIndex: 1 })],
          // Không có polyline cục bộ → gửi manualMetrics từ form
          pathPolyline: null,
          manualMetrics: {
            totalDistanceKm: 120,
            estimatedDurationMinutes: 180,
          },
        }),
      ),
    );
    // Sync theo response server (nguồn sự thật) + báo đã lưu
    expect(await screen.findByText("routes.routeSaved")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123.45")).toBeInTheDocument();
  });

  // Điểm dừng hiện thành marker đánh số trên bản đồ — click marker chọn stop và
  // highlight dòng tương ứng trong panel, click dòng cũng chọn stop (2 chiều)
  it("syncs stop selection between the numbered map markers and the panel list", async () => {
    const routeDetail: OperatorRouteDetail = {
      ...routeA,
      stops: [
        {
          routeId: routeA.id,
          stopId: "stop-9",
          orderIndex: 1,
          estimatedDurationFromOriginMinutes: 30,
          distanceFromOriginKm: 10,
          allowPickup: true,
          allowDropoff: false,
          name: "Điểm dừng 9",
          address: null,
          latitude: 10.8,
          longitude: 106.7,
          isActive: true,
        },
      ],
    };
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeDetail);
    vi.mocked(getOperatorStop).mockResolvedValue({
      id: "stop-9",
      operatorId: "operator-1",
      name: "Điểm dừng 9",
      latitude: 10.8,
      longitude: 106.7,
      description: null,
      address: null,
      googlePlaceId: "place-9",
      isActive: true,
    });

    renderRoutesPage();
    await waitForLoaded();

    // Marker đánh số của stop hiện trên bản đồ, dòng trong panel chưa được chọn
    expect(
      await screen.findByTestId("map-pointmarker-route-stop-stop-9"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-stop-row-stop-9")).toHaveAttribute(
      "data-selected",
      "false",
    );

    // Click marker → dòng tương ứng trong panel được highlight
    fireEvent.click(
      screen.getByTestId("map-pointmarker-click-route-stop-stop-9"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("route-stop-row-stop-9")).toHaveAttribute(
        "data-selected",
        "true",
      ),
    );
    expect(getOperatorStop).toHaveBeenCalledWith("stop-9");

    // Chiều ngược lại: click dòng trong danh sách → chọn stop đó (tải chi tiết)
    vi.mocked(getOperatorStop).mockClear();
    fireEvent.click(screen.getByTestId("route-stop-select-stop-9"));
    await waitFor(() =>
      expect(getOperatorStop).toHaveBeenCalledWith("stop-9"),
    );
    expect(screen.getByTestId("route-stop-select-stop-9")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers opening the existing route when creation returns 409 ROUTE_DUPLICATED", async () => {
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);
    vi.mocked(createOperatorRouteFull).mockRejectedValue(
      new ApiRequestError("Route already exists.", 409, "ROUTE_DUPLICATED", [
        { field: "existingRouteId", message: routeA.id },
      ]),
    );

    renderRoutesPage();
    await waitForLoaded();

    fireEvent.click(
      screen.getAllByRole("button", { name: /routes.newRoute/ })[0],
    );
    // Form tuyến đang chọn cũng có ô tên cùng placeholder → lấy ô trong modal (cuối)
    const nameInputs = await screen.findAllByPlaceholderText(
      "routes.namePlaceholder",
    );
    fireEvent.change(nameInputs[nameInputs.length - 1], {
      target: { value: "Tuyến A" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "routes.selectOriginStation" }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: "Bến A · Hồ Chí Minh" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "routes.selectDestinationStation" }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /routes.createRoute/ }));

    // 409 ROUTE_DUPLICATED → message + nút mở tuyến có sẵn ngay trong modal
    expect(
      await screen.findByText("Route already exists."),
    ).toBeInTheDocument();
    vi.mocked(getOperatorRoute).mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: /routes.openExistingRoute/ }),
    );

    // Chọn lại tuyến có sẵn theo existingRouteId đọc từ error.fields
    await waitFor(() =>
      expect(getOperatorRoute).toHaveBeenCalledWith(routeA.id),
    );
  });

  it("auto-fills distance and duration from the road geometry and locks the fields", async () => {
    const zeroMetricsRoute: OperatorRoute = {
      ...routeA,
      totalDistanceKm: 0,
      estimatedDurationMinutes: 0,
    };
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [zeroMetricsRoute],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(zeroMetricsRoute);
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    // Shape mới: mảng phương án — auto-fill dùng phương án đầu
    vi.mocked(requestRoadGeometry).mockResolvedValue([
      {
        points: [
          { latitude: 10.77, longitude: 106.69 },
          { latitude: 11.94, longitude: 108.44 },
        ],
        totalDistanceKm: 250.5,
        estimatedDurationMinutes: 300,
      },
    ]);

    renderRoutesPage();
    await waitForLoaded();

    // Đủ 2 bến có tọa độ + số liệu còn 0 → tự gọi tính đường
    await waitFor(() => expect(requestRoadGeometry).toHaveBeenCalled());
    // Đã có đường → 2 ô km/thời lượng khóa lại thành số chỉ đọc
    expect(
      await screen.findByText("routes.autoMetricsBadge"),
    ).toBeInTheDocument();
    expect(screen.getByText(/250\.5/)).toBeInTheDocument();

    // Có đường đi → KHÔNG còn nút "Sửa tay" (server bỏ qua manualMetrics khi có
    // polyline nên số nhập tay sẽ bị ghi đè) — thay bằng hint "xóa đường đi để nhập tay"
    expect(
      screen.queryByRole("button", { name: /routes.editMetricsManually/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("routes.metricsLockedHint")).toBeInTheDocument();
  });

  // Regression guard: chọn tuyến server ĐÃ có pathPolyline → hiển thị đường đã lưu
  // ở trạng thái SẠCH. Auto-fetch phương án VẪN chạy (để vẽ các đường so sánh) nhưng
  // lỗi/thiếu key → chỉ hiện text "không tính được", KHÔNG dirty, không gãy flow
  it("keeps a saved route clean when auto-fetch fails and shows the fallback text", async () => {
    const savedPolyline = encodeGooglePolyline([
      { latitude: 11.94, longitude: 108.44 },
      { latitude: 10.77, longitude: 106.69 },
    ]);
    // Tuyến chiều ngược (cặp bến ĐỔI so với tuyến A) để chắc chắn guard theo cặp
    // bến không ăn may nhờ ref còn giữ cặp cũ
    const routeWithPath: OperatorRoute = {
      ...routeA,
      id: "route-3",
      name: "Tuyến C",
      originStationId: destinationStationId,
      destinationStationId: originStationId,
      totalDistanceKm: 305.2,
      estimatedDurationMinutes: 360,
      pathPolyline: savedPolyline,
    };
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA, routeWithPath],
      totalItems: 2,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockImplementation(async (routeId) =>
      routeId === routeWithPath.id ? routeWithPath : routeA,
    );
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });

    renderRoutesPage();
    await waitForLoaded();
    expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

    // Chọn tuyến đã có đường đi lưu sẵn
    fireEvent.click(screen.getByRole("button", { name: /Tuyến C/ }));
    await waitFor(() =>
      expect(screen.getByDisplayValue("Tuyến C")).toBeInTheDocument(),
    );

    // Auto-fetch phương án chạy nhưng lỗi (mặc định môi trường test không có key)
    // → toolbar hiện text nhỏ "không tính được", KHÔNG báo lỗi toàn cục
    expect(
      await screen.findByTestId("auto-route-unavailable"),
    ).toBeInTheDocument();
    expect(requestRoadGeometry).toHaveBeenCalled();
    expect(
      screen.queryByText("routes.routingFailed"),
    ).not.toBeInTheDocument();
    // Không dirty, nút lưu vẫn disabled — xem tuyến mà không đổi gì thì không có gì để lưu
    expect(
      screen.queryByText("routes.unsavedChanges"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.saveRoute/ }),
    ).toBeDisabled();

    // Có đường đi → số liệu khóa: không có nút "Sửa tay", chỉ badge + hint
    expect(screen.getByText("routes.autoMetricsBadge")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /routes.editMetricsManually/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("routes.metricsLockedHint")).toBeInTheDocument();
  });

  it("keeps the metric inputs editable with a hint when road calculation fails", async () => {
    const zeroMetricsRoute: OperatorRoute = {
      ...routeA,
      totalDistanceKm: 0,
      estimatedDurationMinutes: 0,
    };
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [zeroMetricsRoute],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(zeroMetricsRoute);
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(requestRoadGeometry).mockRejectedValue(
      new Error("routes.routingFailed"),
    );

    renderRoutesPage();
    await waitForLoaded();

    // Request lỗi (vd: thiếu API key) → hint nhập tay, không khóa ô
    expect(
      await screen.findByText("routes.autoMetricsFallbackHint"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("routes.autoMetricsBadge"),
    ).not.toBeInTheDocument();

    // Fallback haversine vẫn prefill và ô km vẫn là input sửa được
    const expectedDistance = Number(
      distanceKmBetween(
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ).toFixed(1),
    );
    expect(screen.getByDisplayValue(String(expectedDistance))).toBeEnabled();
  });

  describe("route geometry options", () => {
    // 3 phương án như Google Maps thật: TỰ hiện trên bản đồ sau khi chọn tuyến
    // (không còn nút "Tính đường tự động" và không còn chip) — bấm đường mờ hoặc
    // bubble thời lượng để chọn
    const optionOne = {
      points: [
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.2, longitude: 107.5 },
        { latitude: 11.94, longitude: 108.44 },
      ],
      totalDistanceKm: 308,
      estimatedDurationMinutes: 310,
      description: "QL20",
    };
    const optionTwo = {
      points: [
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 10.95, longitude: 107.9 },
        { latitude: 11.94, longitude: 108.44 },
      ],
      totalDistanceKm: 410.2,
      estimatedDurationMinutes: 372,
      description: "QL1A",
    };
    const optionThree = {
      points: [
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.5, longitude: 107.2 },
        { latitude: 11.94, longitude: 108.44 },
      ],
      totalDistanceKm: 355.4,
      estimatedDurationMinutes: 345,
    };

    beforeEach(() => {
      vi.mocked(getOperatorRoutes).mockResolvedValue({
        ...emptyPage,
        items: [routeA],
        totalItems: 1,
        totalPages: 1,
      });
      vi.mocked(getOperatorRoute).mockResolvedValue(routeA);
      vi.mocked(getOperatorStations).mockResolvedValue({
        ...emptyPage,
        items: operatorStations,
        totalItems: operatorStations.length,
        totalPages: 1,
        pageSize: 100,
      });
      vi.mocked(requestRoadGeometry).mockResolvedValue([
        optionOne,
        optionTwo,
        optionThree,
      ]);
    });

    // Chờ bộ phương án auto-fetch vẽ xong trên bản đồ (debounce 400ms)
    async function waitForOptionPolylines(count: number) {
      await waitFor(
        () =>
          expect(
            screen.getAllByTestId(/map-polyline-route-option-/),
          ).toHaveLength(count),
        { timeout: 2000 },
      );
    }

    it("auto-fetches and draws every option after selecting a route without marking it dirty", async () => {
      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

      // KHÔNG còn nút "Tính đường tự động" — các phương án tự hiện trên bản đồ
      expect(
        screen.queryByRole("button", { name: /routes.calculateGeometry/ }),
      ).not.toBeInTheDocument();
      await waitForOptionPolylines(3);
      expect(screen.queryAllByTestId(/route-option-chip-/)).toHaveLength(0);

      // Request chính TRUCK + request DRIVE so sánh chạy song song
      expect(requestRoadGeometry).toHaveBeenCalledWith(
        expect.any(Array),
        "routes.routingFailed",
        { travelMode: "TRUCK" },
      );
      expect(requestRoadGeometry).toHaveBeenCalledWith(
        expect.any(Array),
        "routes.routingFailed",
        { travelMode: "DRIVE" },
      );

      // Phương án 1 đậm, phương án khác mờ — kèm bubble thời lượng bấm được
      expect(
        screen.getByTestId("map-polyline-route-option-0"),
      ).toHaveAttribute("data-opacity", "1");
      expect(
        Number(
          screen
            .getByTestId("map-polyline-route-option-1")
            .getAttribute("data-opacity"),
        ),
      ).toBeLessThan(1);
      expect(
        screen.getByTestId("map-pointmarker-route-option-label-0"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("map-pointmarker-route-option-label-2"),
      ).toBeInTheDocument();

      // Auto-fetch CHỈ vẽ để so — không tự áp: không dirty, nút lưu vẫn disabled
      expect(
        screen.queryByText("routes.unsavedChanges"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /routes.saveRoute/ }),
      ).toBeDisabled();
    });

    it("applies an option and marks dirty only when clicking its line on the map", async () => {
      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      const callsBefore = vi.mocked(requestRoadGeometry).mock.calls.length;

      // Click đường mờ phương án 2 → áp polyline + km/thời lượng và bật dirty
      fireEvent.click(screen.getByTestId("map-polyline-route-option-1"));
      await waitFor(() =>
        expect(
          screen.getByTestId("map-polyline-route-option-1"),
        ).toHaveAttribute("data-opacity", "1"),
      );
      expect(screen.getByText(/410\.2/)).toBeInTheDocument();
      expect(
        await screen.findByText("routes.unsavedChanges"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /routes.saveRoute/ }),
      ).toBeEnabled();
      // Chọn phương án là thao tác cục bộ — không gọi thêm Google
      expect(vi.mocked(requestRoadGeometry).mock.calls.length).toBe(
        callsBefore,
      );
    });

    it("selects the option matching the saved polyline and restores the clean state when re-picked", async () => {
      // Tuyến đã lưu polyline TRÙNG phương án 2 → phương án 2 phải là "đang chọn"
      const routeWithSaved: OperatorRoute = {
        ...routeA,
        id: "route-saved",
        name: "Tuyến lưu",
        totalDistanceKm: 410.2,
        estimatedDurationMinutes: 372,
        pathPolyline: encodeGooglePolyline(optionTwo.points),
      };
      vi.mocked(getOperatorRoutes).mockResolvedValue({
        ...emptyPage,
        items: [routeWithSaved],
        totalItems: 1,
        totalPages: 1,
      });
      vi.mocked(getOperatorRoute).mockResolvedValue(routeWithSaved);

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến lưu")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      // Phương án trùng đường lưu (index 1) đậm, các phương án khác mờ — KHÔNG dirty
      expect(
        screen.getByTestId("map-polyline-route-option-1"),
      ).toHaveAttribute("data-opacity", "1");
      expect(
        Number(
          screen
            .getByTestId("map-polyline-route-option-0")
            .getAttribute("data-opacity"),
        ),
      ).toBeLessThan(1);
      expect(
        screen.queryByText("routes.unsavedChanges"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /routes.saveRoute/ }),
      ).toBeDisabled();

      // Đổi sang phương án 1 → dirty; bấm lại phương án trùng đường lưu →
      // khôi phục trạng thái sạch (không còn gì để lưu)
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      expect(
        await screen.findByText("routes.unsavedChanges"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("map-polyline-route-option-1"));
      await waitFor(() =>
        expect(
          screen.queryByText("routes.unsavedChanges"),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: /routes.saveRoute/ }),
      ).toBeDisabled();
      // Số liệu quay về đúng số đã lưu của tuyến (sidebar cũng hiện km nên
      // có thể match nhiều chỗ)
      expect(screen.getAllByText(/410\.2/).length).toBeGreaterThan(0);
    });

    // Feedback owner: overlay đè bản đồ che logo/attribution Google (vi phạm
    // TOS) — toolbar + cụm Lưu giờ là thanh ngang NGOÀI bản đồ, ngay trên map
    it("renders geometry controls and the save button outside the map shell", async () => {
      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

      const toolbar = screen.getByTestId("geometry-toolbar");
      const mapShell = screen.getByTestId("route-map-shell");
      expect(mapShell).not.toContainElement(toolbar);
      expect(toolbar).toContainElement(screen.getByTestId("travel-mode-truck"));
      expect(toolbar).toContainElement(
        screen.getByRole("button", { name: /routes.saveRoute/ }),
      );
    });

    it("dedupes near-identical options before drawing them", async () => {
      // Bản sao lệch <1% km và cùng số phút với phương án 1 → bị bỏ, chỉ còn 2 đường
      vi.mocked(requestRoadGeometry).mockResolvedValue([
        optionOne,
        { ...optionOne, totalDistanceKm: 309.5, description: undefined },
        optionTwo,
      ]);

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

      await waitForOptionPolylines(2);
      expect(
        screen.queryByTestId("map-polyline-route-option-2"),
      ).not.toBeInTheDocument();
    });

    it("adds a via point from the applied line and recomputes with intermediates", async () => {
      const reroutedOption = {
        points: [
          { latitude: 10.77, longitude: 106.69 },
          { latitude: 11.05, longitude: 107.4 },
          { latitude: 11.94, longitude: 108.44 },
        ],
        totalDistanceKm: 320.5,
        estimatedDurationMinutes: 330,
      };

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      // Click 1: áp phương án 1 (đường chưa áp → click là chọn)
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      expect(
        await screen.findByText("routes.unsavedChanges"),
      ).toBeInTheDocument();

      // Click 2 lên đường ĐANG CHỌN đã áp → cắm điểm nắn + tính lại với
      // intermediates (mode mặc định TRUCK, kèm 1 request DRIVE so sánh)
      vi.mocked(requestRoadGeometry).mockResolvedValueOnce([reroutedOption]);
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));

      await waitFor(() =>
        expect(requestRoadGeometry).toHaveBeenCalledWith(
          expect.any(Array),
          "routes.routingFailed",
          {
            travelMode: "TRUCK",
            intermediates: [{ latitude: 11.05, longitude: 107.4 }],
          },
        ),
      );
      // Bộ phương án bị thay bằng 1 đường mới, marker điểm nắn hiện ra
      expect(
        await screen.findByTestId("map-pointmarker-via-point-0"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("map-polyline-route-option-1"),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/320\.5/)).toBeInTheDocument();

      // Thả điểm nắn ở chỗ khác (dragend) → tính lại với tọa độ MỚI thay tọa độ cũ
      vi.mocked(requestRoadGeometry).mockResolvedValueOnce([reroutedOption]);
      fireEvent.click(screen.getByTestId("map-pointmarker-drag-via-point-0"));
      await waitFor(() =>
        expect(requestRoadGeometry).toHaveBeenCalledWith(
          expect.any(Array),
          "routes.routingFailed",
          {
            travelMode: "TRUCK",
            intermediates: [{ latitude: 11.31, longitude: 107.61 }],
          },
        ),
      );
    });

    it("removes a via point and recalculates without intermediates", async () => {
      const reroutedOption = {
        points: [
          { latitude: 10.77, longitude: 106.69 },
          { latitude: 11.05, longitude: 107.4 },
          { latitude: 11.94, longitude: 108.44 },
        ],
        totalDistanceKm: 320.5,
        estimatedDurationMinutes: 330,
      };

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      // Áp phương án 1 rồi cắm điểm nắn lên đường đã áp
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      expect(
        await screen.findByText("routes.unsavedChanges"),
      ).toBeInTheDocument();
      vi.mocked(requestRoadGeometry).mockResolvedValueOnce([reroutedOption]);
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      expect(
        await screen.findByTestId("map-pointmarker-via-point-0"),
      ).toBeInTheDocument();

      // Bấm điểm nắn → xoá và tính lại KHÔNG intermediates; các phương án trở lại
      fireEvent.click(
        screen.getByTestId("map-pointmarker-click-via-point-0"),
      );
      // Lượt xoá tính lại không kèm intermediates — request cuối là DRIVE so sánh
      // của lượt đó, cũng không có intermediates
      await waitFor(() =>
        expect(requestRoadGeometry).toHaveBeenLastCalledWith(
          expect.any(Array),
          "routes.routingFailed",
          { travelMode: "DRIVE" },
        ),
      );
      await waitForOptionPolylines(3);
      expect(
        screen.queryByTestId("map-pointmarker-via-point-0"),
      ).not.toBeInTheDocument();
    });

    it("saves the polyline of the option picked on the map without manualMetrics", async () => {
      vi.mocked(updateOperatorRouteFull).mockResolvedValue({
        ...routeA,
        totalDistanceKm: optionTwo.totalDistanceKm,
        estimatedDurationMinutes: optionTwo.estimatedDurationMinutes,
        pathPolyline: encodeGooglePolyline(optionTwo.points),
        stops: [],
      });

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      // Bấm đường phương án 2 → chọn, km/thời lượng form đổi theo
      fireEvent.click(screen.getByTestId("map-polyline-route-option-1"));
      await waitFor(() =>
        expect(
          screen.getByTestId("map-polyline-route-option-1"),
        ).toHaveAttribute("data-opacity", "1"),
      );
      expect(screen.getByText(/410\.2/)).toBeInTheDocument();

      // Lưu tuyến → polyline gửi lên server là của PHƯƠNG ÁN 2, không kèm manualMetrics
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));
      await waitFor(() => expect(updateOperatorRouteFull).toHaveBeenCalled());
      expect(updateOperatorRouteFull).toHaveBeenCalledWith(
        routeA.id,
        expect.objectContaining({
          pathPolyline: encodeGooglePolyline(optionTwo.points),
          manualMetrics: undefined,
        }),
      );
    });

    // Đổi loại xe → TỰ tính lại với mode mới; toggle ngược lại ăn cache phiên,
    // không gọi thêm Google (chống đốt quota)
    it("recomputes when toggling the travel mode and reuses the session cache when toggling back", async () => {
      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      expect(screen.getByTestId("travel-mode-truck")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const callsAfterAutoFetch =
        vi.mocked(requestRoadGeometry).mock.calls.length;

      // Đổi sang xe nhỏ → tự tính lại bằng DRIVE, đúng 1 request thêm (DRIVE
      // không cần request so sánh)
      fireEvent.click(screen.getByTestId("travel-mode-drive"));
      await waitFor(
        () =>
          expect(vi.mocked(requestRoadGeometry).mock.calls.length).toBe(
            callsAfterAutoFetch + 1,
          ),
        { timeout: 2000 },
      );
      expect(requestRoadGeometry).toHaveBeenLastCalledWith(
        expect.any(Array),
        "routes.routingFailed",
        { travelMode: "DRIVE" },
      );
      expect(screen.getByTestId("travel-mode-drive")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // Toggle ngược về xe lớn → kết quả TRUCK đã cache trong phiên, không gọi lại
      fireEvent.click(screen.getByTestId("travel-mode-truck"));
      await waitFor(() =>
        expect(screen.getByTestId("travel-mode-truck")).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );
      await waitForOptionPolylines(3);
      expect(vi.mocked(requestRoadGeometry).mock.calls.length).toBe(
        callsAfterAutoFetch + 1,
      );
    });

    // Cache theo tuyến: chọn qua lại các tuyến không gọi lại Google
    it("does not refetch options when re-selecting a route already fetched this session", async () => {
      const routeB: OperatorRoute = {
        ...routeA,
        id: "route-2",
        name: "Tuyến B",
      };
      vi.mocked(getOperatorRoutes).mockResolvedValue({
        ...emptyPage,
        items: [routeA, routeB],
        totalItems: 2,
        totalPages: 1,
      });
      vi.mocked(getOperatorRoute).mockImplementation(async (routeId) =>
        routeId === routeB.id ? routeB : routeA,
      );

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);
      // Lượt fetch đầu cho tuyến A: TRUCK + DRIVE so sánh
      expect(vi.mocked(requestRoadGeometry).mock.calls.length).toBe(2);

      // Chọn tuyến B → fetch bộ phương án cho tuyến B (key khác)
      const routeBButtons = screen.getAllByRole("button", { name: /Tuyến B/ });
      fireEvent.click(routeBButtons[routeBButtons.length - 1]);
      await waitFor(() =>
        expect(screen.getByDisplayValue("Tuyến B")).toBeInTheDocument(),
      );
      await waitFor(
        () =>
          expect(vi.mocked(requestRoadGeometry).mock.calls.length).toBe(4),
        { timeout: 2000 },
      );

      // Chọn lại tuyến A → ăn cache phiên, KHÔNG request thêm
      const routeAButtons = screen.getAllByRole("button", { name: /Tuyến A/ });
      fireEvent.click(routeAButtons[routeAButtons.length - 1]);
      await waitFor(() =>
        expect(screen.getByDisplayValue("Tuyến A")).toBeInTheDocument(),
      );
      await waitForOptionPolylines(3);
      expect(vi.mocked(requestRoadGeometry).mock.calls.length).toBe(4);
    });

    it("shows the amber warning when the TRUCK route is much longer than DRIVE", async () => {
      // TRUCK 355.4km/350p vs DRIVE 308km/310p → vượt ngưỡng >10% km và >10 phút
      vi.mocked(requestRoadGeometry).mockImplementation(
        async (_points, _message, opts) =>
          opts?.travelMode === "DRIVE"
            ? [
                {
                  points: optionOne.points,
                  totalDistanceKm: 308,
                  estimatedDurationMinutes: 310,
                },
              ]
            : [
                {
                  points: optionTwo.points,
                  totalDistanceKm: 355.4,
                  estimatedDurationMinutes: 350,
                },
              ],
      );

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

      // Cảnh báo hiện ngay sau auto-fetch — không cần bấm gì
      expect(
        await screen.findByTestId("truck-detour-warning"),
      ).toBeInTheDocument();
      // Auto-fetch chỉ vẽ để so — vẫn không dirty
      expect(
        screen.queryByText("routes.unsavedChanges"),
      ).not.toBeInTheDocument();
    });

    it("shows the red warning when no TRUCK route exists but DRIVE finds one", async () => {
      vi.mocked(requestRoadGeometry).mockImplementation(
        async (_points, _message, opts) => {
          if (opts?.travelMode === "DRIVE") {
            return [optionOne];
          }

          throw new Error("routes.routingFailed");
        },
      );

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

      expect(
        await screen.findByTestId("truck-unavailable-warning"),
      ).toBeInTheDocument();
      // Không áp đường DRIVE (mode đang là xe lớn) và không hiện lỗi chung
      expect(
        screen.queryAllByTestId(/map-polyline-route-option-/),
      ).toHaveLength(0);
      expect(
        screen.queryByText("routes.routingFailed"),
      ).not.toBeInTheDocument();
    });

    // Kéo tới đâu tính tới đó: event drag liên tục bị throttle (~350ms + dịch tối
    // thiểu ~50m), preview về muộn hơn phát chốt dragend phải bị bỏ theo seq
    it("recomputes while dragging with throttling and drops stale preview results", async () => {
      const reroutedOption = {
        points: [
          { latitude: 10.77, longitude: 106.69 },
          { latitude: 11.05, longitude: 107.4 },
          { latitude: 11.94, longitude: 108.44 },
        ],
        totalDistanceKm: 320.5,
        estimatedDurationMinutes: 330,
      };

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      await waitForOptionPolylines(3);

      // Áp phương án 1 rồi cắm điểm nắn lên đường đang chọn
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      expect(
        await screen.findByText("routes.unsavedChanges"),
      ).toBeInTheDocument();
      vi.mocked(requestRoadGeometry).mockResolvedValueOnce([reroutedOption]);
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      expect(
        await screen.findByTestId("map-pointmarker-via-point-0"),
      ).toBeInTheDocument();

      const callCount = () => vi.mocked(requestRoadGeometry).mock.calls.length;
      const baseline = callCount();
      let resolveStalePreview: (value: RoadRouteOption[]) => void = () => {};

      vi.useFakeTimers({ now: Date.now() });
      try {
        const dragButton = screen.getByTestId(
          "map-pointmarker-dragmove-via-point-0",
        );

        // 3 event drag dồn dập trong cửa sổ throttle → đúng 1 request preview,
        // là request TRUCK đơn lẻ (preview không kèm request DRIVE so sánh)
        fireEvent.click(dragButton);
        fireEvent.click(dragButton);
        fireEvent.click(dragButton);
        expect(callCount()).toBe(baseline + 1);
        expect(requestRoadGeometry).toHaveBeenLastCalledWith(
          expect.any(Array),
          "routes.routingFailed",
          expect.objectContaining({ travelMode: "TRUCK" }),
        );
        // Trong lúc chờ preview → map hiện chỉ báo "đang tính..."
        expect(
          screen.getByTestId("reroute-computing-indicator"),
        ).toBeInTheDocument();

        // Qua cửa sổ throttle + đã dịch đủ xa → được thêm đúng 1 request nữa;
        // request này treo để giả lập kết quả preview VỀ MUỘN sau khi thả chuột
        await act(async () => {
          await vi.advanceTimersByTimeAsync(900);
        });
        vi.mocked(requestRoadGeometry).mockImplementationOnce(
          () =>
            new Promise<RoadRouteOption[]>((resolve) => {
              resolveStalePreview = resolve;
            }),
        );
        fireEvent.click(dragButton);
        expect(callCount()).toBe(baseline + 2);
      } finally {
        vi.useRealTimers();
      }

      // Thả chuột (dragend) → phát chốt số chính xác, kết quả này phải thắng
      vi.mocked(requestRoadGeometry).mockResolvedValueOnce([
        {
          points: reroutedOption.points,
          totalDistanceKm: 321.7,
          estimatedDurationMinutes: 335,
        },
      ]);
      fireEvent.click(screen.getByTestId("map-pointmarker-drag-via-point-0"));
      await waitFor(() =>
        expect(screen.getByText(/321\.7/)).toBeInTheDocument(),
      );

      // Preview cũ về muộn với số liệu khác → bị bỏ theo seq, không đè phát chốt
      await act(async () => {
        resolveStalePreview([
          {
            points: reroutedOption.points,
            totalDistanceKm: 999.9,
            estimatedDurationMinutes: 999,
          },
        ]);
      });
      expect(screen.queryByText(/999\.9/)).not.toBeInTheDocument();
      expect(screen.getByText(/321\.7/)).toBeInTheDocument();
      expect(
        screen.queryByTestId("reroute-computing-indicator"),
      ).not.toBeInTheDocument();
    });
  });
});
