import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAlternativeRoute,
  createOperatorRouteFull,
  createOperatorStation,
  createOperatorStop,
  getAlternativeRoutes,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStop,
  getOperatorStops,
  getPublicLocations,
  searchStations,
  updateAlternativeRoute,
  updateAlternativeRouteGeometry,
  updateOperatorRouteFull,
  type AlternativeRoute,
  type OperatorRoute,
  type OperatorRouteDetail,
  type OperatorStation,
  type OperatorStop,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import {
  distanceKmBetween,
  requestRoadGeometry,
  type RoadRouteOption,
} from "./geometry";
import { encodeGooglePolyline } from "./polyline";
import { searchPlacesAlongRoute } from "../../../lib/googlePlacesSearch";
import type { PlaceAlongRoute } from "../../../lib/googlePlacesSearch";
import ToastProvider from "../../../components/toast/ToastProvider";
import { __clearPlacesCacheForTest } from "./useRouteStopSuggestions";
import RoutesPage from "./index";

// Mock riêng requestRoadGeometry (gọi Google Routes) — các helper thuần giữ bản thật
vi.mock("./geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geometry")>();

  return { ...actual, requestRoadGeometry: vi.fn() };
});

// Mock riêng searchPlacesAlongRoute (gọi Google Places) — dùng để khẳng định hook
// gợi ý điểm dừng gọi Google bằng polyline ĐÚNG của tuyến đang chọn, không phải
// polyline "mồ côi" của tuyến vừa rời đi
vi.mock("../../../lib/googlePlacesSearch", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/googlePlacesSearch")>();

  return { ...actual, searchPlacesAlongRoute: vi.fn() };
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
          name: "Bến Xe Đà Lạt",
          address: "Xuân Hương - Đà Lạt, Lâm Đồng, Việt Nam",
          city: "Đà Lạt",
          ward: "Phường Xuân Hương - Đà Lạt",
          latitude: 11.9416,
          longitude: 108.4383,
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
    anchorContent,
    markers = [],
    pointMarkers = [],
    polylines = [],
  }: {
    anchorContent?: ReactNode;
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
      {/* Card neo (popup gợi ý điểm dừng) thật render qua OverlayView — mock
          render thẳng anchorContent để assertion popup cũ vẫn tìm thấy được */}
      {anchorContent ? (
        <div data-testid="map-anchor">{anchorContent}</div>
      ) : null}
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
  updateAlternativeRouteGeometry: vi.fn(),
  updateOperatorRouteFull: vi.fn(),
  updateOperatorStop: vi.fn(),
}));

// RoutesPage dùng useSearchParams nên phải render trong Router context; RoutesPage
// cũng gọi useToast nên phải render trong ToastProvider như trên App thật.
function renderRoutesPage(initialEntries: string[] = ["/manager/routes"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <RoutesPage />
      </ToastProvider>
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
    // Xóa riêng implementation/once queue của geometry để response từ test lỗi
    // sớm không rò sang test kế tiếp (clearAllMocks chỉ xóa call history).
    vi.mocked(requestRoadGeometry).mockReset();
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
    vi.mocked(searchPlacesAlongRoute).mockResolvedValue([]);
    // Cache module-level của useRouteStopSuggestions không tự reset giữa các
    // test (biến ngoài component) — dọn để routeKey của test này không dính
    // kết quả cache từ test trước
    __clearPlacesCacheForTest();
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

  it("shows the info tab active by default with the route form and no stops section", async () => {
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage();
    await waitForLoaded();

    // 3 tab riêng: Thông tin / Điểm dừng / Tuyến thay thế
    expect(await screen.findByText("routes.tabs.info")).toBeInTheDocument();
    expect(screen.getByText("routes.tabs.stops")).toBeInTheDocument();
    expect(screen.getByText("routes.tabs.alternatives")).toBeInTheDocument();
    // Tab Thông tin: panel nổi chỉ còn form tuyến, mục điểm dừng đã dời sang
    // tab riêng nên KHÔNG còn hiện ở đây nữa
    expect(screen.getByTestId("route-floating-panel")).toBeInTheDocument();
    expect(screen.getByText("routes.routeManagement")).toBeInTheDocument();
    expect(
      screen.queryByText("routes.panelStopsTitle"),
    ).not.toBeInTheDocument();
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

  it("opens the dedicated stops tab via the ?tab=stops deep link (no longer redirected to info)", async () => {
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage(["/manager/routes?routeId=route-1&tab=stops"]);
    await waitForLoaded();

    // Tab Điểm dừng: mục điểm dừng hiện, form tuyến (routeManagement) KHÔNG hiện
    expect(
      await screen.findByText("routes.panelStopsTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText("routes.noStopsAttached")).toBeInTheDocument();
    expect(
      screen.queryByText("routes.routeManagement"),
    ).not.toBeInTheDocument();
  });

  // Bug owner báo qua screenshot: F5 khi đang ở tuyến + tab "Điểm dừng"
  // (?routeId=...&tab=stops) với cache danh sách tuyến còn "ấm" từ phiên
  // trước (sessionStorage) → pill "Đang tải chi tiết tuyến…" hiện MÃI không
  // tắt. Nguyên nhân: effect deep-link đọc `routes` (đã có sẵn từ cache ngay
  // ở lần render đầu) và gọi handleSelectRoute NGAY trong cùng lượt effect
  // đồng bộ (bump selectRouteSeqRef → seq A, set isLoadingRouteDetail=true),
  // rồi effect mount loadData() chạy qua queueMicrotask ngay sau đó cũng bump
  // seq (→ seq B) trước khi Promise.all của handleSelectRoute kịp resolve.
  // Response của phiên A về muộn thấy seq lệch nên bỏ qua luôn nhánh finally
  // clear cờ — isLoadingRouteDetail bị "mồ côi" ở true vĩnh viễn.
  it("does not get stuck on the loading pill after F5 with a warm route-list cache and ?routeId+tab=stops", async () => {
    // Cache "ấm" từ phiên trước F5 — làm routes đã có sẵn NGAY ở lần render
    // đầu tiên (không phải rỗng), đây là điều kiện kích hoạt race
    sessionStorage.setItem(
      "vietride:routeList:anonymous",
      JSON.stringify({ ts: Date.now(), data: [routeA] }),
    );
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage(["/manager/routes?routeId=route-1&tab=stops"]);
    await waitForLoaded();

    // Dữ liệu tuyến đã lên (tab Điểm dừng hiện đúng nội dung)...
    expect(
      await screen.findByText("routes.panelStopsTitle"),
    ).toBeInTheDocument();
    // ...nhưng pill loading chi tiết tuyến phải TẮT, không được kẹt mãi
    await waitFor(() =>
      expect(
        screen.queryByText("routes.loadingRouteDetail"),
      ).not.toBeInTheDocument(),
    );
  });

  // Bug mới cùng vùng code F5: đang ở tab Điểm dừng, CHỌN TUYẾN KHÁC trong
  // sidebar (không F5) → chấm gợi ý Google không hiện, chỉ F5 mới hiện.
  // Nguyên nhân: click chọn tuyến mới cập nhật `activeRouteKey` (routeKey của
  // useRouteStopSuggestions) NGAY trong cùng lượt render đồng bộ, nhưng
  // `geometry.routePathPoints` (pathPoints truyền cho hook) vẫn còn polyline
  // của tuyến CŨ cho tới khi `applySavedGeometry` chạy sau khi
  // `getOperatorRoute` của tuyến mới resolve. Hook fetch Google Places bằng
  // polyline SAI (của tuyến cũ) rồi cache kết quả dưới cacheKey = routeKey
  // MỚI; khi polyline đúng về sau, cacheKey không đổi nữa nên không refetch —
  // gợi ý Google của tuyến mới bị "mồ côi" vĩnh viễn cho tới F5.
  it("fetches Google place suggestions with the NEWLY selected route's polyline when switching routes from the sidebar while on the stops tab", async () => {
    const pathPointsA = [
      { latitude: 10, longitude: 106 },
      { latitude: 10, longitude: 107 },
    ];
    // Tuyến B cách xa tuyến A (không dây dưa toạ độ) — nếu hook lỡ gọi Google
    // bằng polyline A thì kết quả mock trả về [] (không khớp encodedPolyline),
    // gợi ý sẽ không bao giờ hiện — đúng triệu chứng bug.
    const pathPointsB = [
      { latitude: 20, longitude: 106 },
      { latitude: 20, longitude: 107 },
    ];
    const routeADetail: OperatorRouteDetail = {
      ...routeA,
      pathPolyline: encodeGooglePolyline(pathPointsA),
      stops: [],
    };
    const routeB: OperatorRouteDetail = {
      ...routeA,
      id: "route-2",
      name: "Tuyến B",
      pathPolyline: encodeGooglePolyline(pathPointsB),
      stops: [],
    };
    const placeNearB: PlaceAlongRoute = {
      placeId: "google-place-near-b",
      name: "Trạm dừng gần tuyến B",
      address: "Đâu đó",
      latitude: 20,
      longitude: 106.5,
      types: ["rest_stop"],
    };

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA, routeB],
      totalItems: 2,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockImplementation(async (routeId) =>
      routeId === routeB.id ? routeB : routeADetail,
    );
    vi.mocked(searchPlacesAlongRoute).mockImplementation(
      async (encodedPolyline) =>
        encodedPolyline === encodeGooglePolyline(pathPointsB)
          ? [placeNearB]
          : [],
    );

    renderRoutesPage(["/manager/routes?routeId=route-1&tab=stops"]);
    await waitForLoaded();
    // Đợi tuyến A lên xong (polyline A đã áp) trước khi đổi tuyến
    await waitFor(() => expect(getOperatorRoute).toHaveBeenCalledWith("route-1"));

    fireEvent.click(screen.getByRole("button", { name: /Tuyến B/ }));

    // Gợi ý Google của tuyến B phải hiện — đúng polyline B được gọi tới Google
    expect(
      await screen.findByTestId(
        `map-pointmarker-suggest-googlePlace-${placeNearB.placeId}`,
      ),
    ).toBeInTheDocument();
  });

  // Hành vi #3 owner: rời tab Điểm dừng → chấm GỢI Ý biến mất, nhưng marker
  // stop ĐÃ GẮN (đánh số 1..N) vẫn hiện ở mọi tab có map (kể cả tab Thông tin).
  it("hides suggestion markers but keeps attached stop markers when leaving the stops tab", async () => {
    const routeWithPath: OperatorRouteDetail = {
      ...routeA,
      pathPolyline: encodeGooglePolyline([
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ]),
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
    // Nằm gần đường thẳng bến A → bến B (fraction ~0.5) → lọt ngưỡng gợi ý
    // (cách đường <= 3km), chưa gắn vào tuyến nên vẫn là gợi ý (không phải stop-9)
    const midStop: OperatorStop = {
      id: "stop-along-route",
      operatorId: "operator-1",
      name: "Trạm dừng chân giữa tuyến",
      description: null,
      latitude: 11.355,
      longitude: 107.565,
      address: "Quốc lộ 20",
      googlePlaceId: null,
      isActive: true,
    };

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeWithPath);
    vi.mocked(getOperatorStops).mockResolvedValue({
      ...emptyPage,
      items: [midStop],
      totalItems: 1,
      totalPages: 1,
    });

    renderRoutesPage();
    await waitForLoaded();

    // Tab Thông tin (mặc định): marker stop đã gắn hiện, chưa có chấm gợi ý nào
    expect(
      await screen.findByTestId("map-pointmarker-route-stop-stop-9"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(
        "map-pointmarker-suggest-operatorStop-stop-along-route",
      ),
    ).not.toBeInTheDocument();

    // Mở tab Điểm dừng → chấm gợi ý hiện, marker stop đã gắn vẫn còn
    fireEvent.click(
      screen.getByRole("button", { name: "routes.tabs.stops" }),
    );
    expect(
      await screen.findByTestId(
        "map-pointmarker-suggest-operatorStop-stop-along-route",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("map-pointmarker-route-stop-stop-9"),
    ).toBeInTheDocument();

    // Rời tab Điểm dừng, về tab Thông tin → chấm gợi ý biến mất, marker stop
    // đã gắn vẫn còn nguyên trên map
    fireEvent.click(screen.getByRole("button", { name: "routes.tabs.info" }));
    await waitFor(() =>
      expect(
        screen.queryByTestId(
          "map-pointmarker-suggest-operatorStop-stop-along-route",
        ),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("map-pointmarker-route-stop-stop-9"),
    ).toBeInTheDocument();
  });

  // Owner báo qua screenshot: thêm "Trạm dừng chân An Bình" vào tuyến Sài Gòn -
  // Buôn Ma Thuột ở tab Điểm dừng → polyline biến thành đường thẳng chim bay
  // thay vì tính lại đường đi qua điểm dừng mới.
  // Nguyên nhân: addStopFromSuggestion gọi invalidateLocalGeometry (đúng — đường
  // cũ không còn đi qua stop mới), nhưng effect auto-fetch phương án đường trong
  // useRouteGeometry bị gate `isWorkspaceActive: activeTab === "info"` (từ hồi
  // tab Điểm dừng chưa tách riêng) → ở tab "stops" auto-fetch không bao giờ chạy,
  // map rơi về fallback nối thẳng các điểm (RouteDesignMap: displayedPath =
  // pathPoints.length > 0 ? pathPoints : points).
  it("re-computes the road geometry (auto-fetch) instead of falling back to a straight line after adding a stop from a suggestion on the stops tab", async () => {
    const routeWithPath: OperatorRouteDetail = {
      ...routeA,
      pathPolyline: encodeGooglePolyline([
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ]),
      stops: [],
    };
    // Nằm gần đường thẳng bến A → bến B (fraction ~0.5) → lọt ngưỡng gợi ý,
    // chưa gắn vào tuyến nên hiện thành chấm gợi ý ở tab Điểm dừng
    const midStop: OperatorStop = {
      id: "stop-an-binh",
      operatorId: "operator-1",
      name: "Trạm dừng chân An Bình",
      description: null,
      latitude: 11.355,
      longitude: 107.565,
      address: "Quốc lộ 20",
      googlePlaceId: null,
      isActive: true,
    };
    const recomputedOption = {
      points: [
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.355, longitude: 107.565 },
        { latitude: 11.94, longitude: 108.44 },
      ],
      totalDistanceKm: 315,
      estimatedDurationMinutes: 320,
    };

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeWithPath);
    vi.mocked(getOperatorStops).mockResolvedValue({
      ...emptyPage,
      items: [midStop],
      totalItems: 1,
      totalPages: 1,
    });
    // routeWaypoints (bến đi/bến đến) chỉ dựng được khi có toạ độ bến — thiếu
    // mock này thì stations rỗng, routeWaypoints < 2 điểm, effect auto-fetch bị
    // chặn bởi guard "đủ waypoint" chứ không phải bởi gate đang test
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });

    renderRoutesPage(["/manager/routes?routeId=route-1&tab=stops"]);
    await waitForLoaded();

    const suggestionMarkerButton = await screen.findByTestId(
      "map-pointmarker-click-suggest-operatorStop-stop-an-binh",
    );
    fireEvent.click(suggestionMarkerButton);

    // Auto-fetch bây giờ có thể chạy ở tab Điểm dừng → cho resolve với đường đi
    // thật qua điểm dừng mới (thay vì mock mặc định reject của cả describe)
    vi.mocked(requestRoadGeometry).mockResolvedValue([recomputedOption]);

    fireEvent.click(screen.getByRole("button", { name: "routes.suggestAdd" }));
    expect(
      await screen.findByText("routes.routeStopDraftAdded"),
    ).toBeInTheDocument();

    // Waypoint gửi lên Google Routes phải gồm CẢ điểm dừng mới thêm (không chỉ
    // bến đi/bến đến) — xác nhận useRouteMapPoints đã đưa currentRouteStops vào
    // routeWaypoints và auto-fetch nhận đúng bộ waypoint này
    await waitFor(() =>
      expect(requestRoadGeometry).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            latitude: midStop.latitude,
            longitude: midStop.longitude,
          }),
        ]),
        "routes.routingFailed",
        expect.anything(),
      ),
    );

    // Đường đi tính lại thật sự phải lên bản đồ — không còn kẹt ở fallback
    // nối thẳng các điểm (đường thẳng chim bay)
    expect(
      await screen.findByTestId("map-polyline-route-option-0"),
    ).toBeInTheDocument();
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

    // Mở lại: form quay về (tab Thông tin không còn mục điểm dừng)
    fireEvent.click(screen.getByRole("button", { name: "routes.expandPanel" }));
    expect(screen.getByText("routes.routeManagement")).toBeInTheDocument();
  });

  it("searches and attaches a platform station outside the preloaded list", async () => {
    const platformStation = {
      id: "station-page-8",
      name: "Bến xe Miền Đông mới",
      city: "Thành phố Hồ Chí Minh",
      ward: "Phường Long Bình",
      latitude: 10.877,
      longitude: 106.814,
      supportsShuttle: false,
    };
    vi.mocked(searchStations).mockResolvedValue([platformStation]);
    vi.mocked(createOperatorStation).mockResolvedValue({
      id: "operator-station-1",
      operatorId: "operator-1",
      stationId: platformStation.id,
      station: platformStation,
    });

    renderRoutesPage();
    await waitForLoaded();
    fireEvent.click(
      screen.getByRole("button", { name: /routes.stationManagement/ }),
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "routes.searchStations" }),
      { target: { value: "Miền Đông" } },
    );
    await waitFor(() =>
      expect(searchStations).toHaveBeenCalledWith({ q: "Miền Đông" }),
    );
    fireEvent.click(
      await screen.findByRole("option", {
        name: /Bến xe Miền Đông mới/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "routes.attachStation" }),
    );

    await waitFor(() =>
      expect(createOperatorStation).toHaveBeenCalledWith({
        stationId: platformStation.id,
      }),
    );
  });

  // Bug owner báo qua screenshot: chọn "Dùng làm bến đi" rồi bấm "Gắn bến" khi
  // ĐANG mở sẵn một tuyến (route-1) hiện ra 2 toast trái ngược cùng lúc — báo
  // gắn bến thành công (đúng) VÀ báo lỗi "bến đi/đến không đổi được sau khi
  // tạo" (vì updateRoute chặn đổi originStationId của tuyến đã tạo). Fix: ẩn
  // hẳn dropdown vai trò khi đã có tuyến chọn sẵn — gán vai trò chỉ còn ý nghĩa
  // lúc CHƯA tạo tuyến (xem useStationManagement.ts, StationManagementPanel.tsx).
  it("hides the origin/destination role picker and never shows the locked-route error toast when a route is already selected", async () => {
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

    const platformStation = {
      id: "station-page-9",
      name: "Bến xe Miền Đông mới",
      city: "Thành phố Hồ Chí Minh",
      ward: "Phường Long Bình",
      latitude: 10.877,
      longitude: 106.814,
      supportsShuttle: false,
    };
    vi.mocked(searchStations).mockResolvedValue([platformStation]);
    vi.mocked(createOperatorStation).mockResolvedValue({
      id: "operator-station-9",
      operatorId: "operator-1",
      stationId: platformStation.id,
      station: platformStation,
    });

    renderRoutesPage(["/manager/routes?routeId=route-1"]);
    await waitForLoaded();
    // waitForLoaded() chỉ đợi skeleton biến mất — route detail (deep-link
    // ?routeId=) tải bất đồng bộ riêng, phải đợi nó xong (form hiện đúng tên
    // tuyến) thì hasSelectedRoute mới chắc chắn true khi mở modal bến.
    await screen.findByDisplayValue(routeA.name);

    fireEvent.click(
      screen.getByRole("button", { name: /routes.stationManagement/ }),
    );
    const dialog = await screen.findByRole("dialog");

    // Không còn dropdown "Dùng làm bến đi/đến" khi đã có tuyến chọn sẵn
    expect(
      within(dialog).queryByRole("option", { name: "routes.useAsOrigin" }),
    ).not.toBeInTheDocument();

    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "routes.searchStations" }),
      { target: { value: "Miền Đông" } },
    );
    fireEvent.click(
      await within(dialog).findByRole("option", {
        name: /Bến xe Miền Đông mới/,
      }),
    );
    expect(
      within(dialog).queryByRole("checkbox", {
        name: "routes.supportsShuttle",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "routes.confirmShuttle",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "routes.attachStation" }),
    );

    // Chỉ hiện toast gắn bến thành công — KHÔNG hiện toast lỗi khoá bến đi/đến.
    // "routes.stationsLockedHint" cũng là hint tĩnh cố định dưới ô chọn bến
    // đi/đến trong form tuyến (RouteFormSection.tsx) nên không dùng
    // queryByText suông — phải soi đúng trong khu vực toast (data-testid="toast").
    expect(
      await screen.findByText("routes.stationAttached"),
    ).toBeInTheDocument();
    const toastTexts = screen
      .getAllByTestId("toast")
      .map((toast) => toast.textContent);
    expect(
      toastTexts.some((text) => text?.includes("routes.stationsLockedHint")),
    ).toBe(false);
  });

  it("gợi ý sẵn tỉnh từ địa chỉ rồi bắt chọn phường/xã trước khi tạo bến", async () => {
    const provinces = [
      {
        id: "location-kha",
        code: "56",
        name: "Khanh Hoa",
        sortOrder: 1,
        type: "PROVINCE",
        isActive: true,
      },
      {
        id: "location-ldg",
        code: "68",
        name: "Lam Dong",
        sortOrder: 2,
        type: "PROVINCE",
        isActive: true,
      },
    ];
    const lamDongWards = [
      {
        id: "location-ward-xh",
        code: "68001",
        name: "Phường Xuân Hương - Đà Lạt",
        parentCode: "68",
        parentName: "Lam Dong",
        sortOrder: 0,
        type: "WARD",
        isActive: true,
      },
    ];
    // Bến chỉ nhận Location leaf: dropdown phường/xã phải là một request riêng
    // theo parentCode, không lấy từ danh sách tỉnh đã tải sẵn.
    vi.mocked(getPublicLocations).mockImplementation((params) =>
      Promise.resolve(params?.parentCode === "68" ? lamDongWards : provinces),
    );
    vi.mocked(createOperatorStation).mockResolvedValue({
      operatorId: "operator-1",
      stationId: "station-1",
      station: {
        id: "station-1",
        name: "Bến Xe Đà Lạt",
        city: "Lâm Đồng",
        ward: "Phường Xuân Hương - Đà Lạt",
        latitude: 11.9416,
        longitude: 108.4383,
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

    // Địa chỉ Google chứa "Lâm Đồng" nên tỉnh được chọn sẵn
    const provinceSelect = await screen.findByRole("button", {
      name: "routes.stationProvince",
    });
    await waitFor(() => expect(provinceSelect).toHaveTextContent("Lam Dong"));

    const wardSelect = screen.getByRole("button", {
      name: "routes.stationWard",
    });
    await waitFor(() => expect(wardSelect).not.toBeDisabled());
    fireEvent.click(wardSelect);
    fireEvent.change(screen.getByRole("combobox", { name: "searchOptions" }), {
      target: { value: "xuan huong" },
    });
    fireEvent.click(
      screen.getByRole("option", { name: "Phường Xuân Hương - Đà Lạt" }),
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: /routes\.supportsShuttle/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "routes.createAndAttachStation" }),
    );

    await waitFor(() =>
      expect(createOperatorStation).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: "location-ward-xh",
          supportsShuttle: true,
        }),
      ),
    );
    // city/ward do BE suy ra từ hierarchy — FE không được gửi lên
    const payload = vi.mocked(createOperatorStation).mock.calls[0][0];
    expect(payload).not.toHaveProperty("city");
    expect(payload).not.toHaveProperty("ward");
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

  it("creates a route with every API field through POST /routes/full and opens the merged workspace", async () => {
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
    vi.mocked(createOperatorRouteFull).mockResolvedValue({
      ...routeA,
      id: "route-new",
      name: "Tuyến mới",
      returnRouteId: routeA.id,
      baseFare: 275_000,
      totalDistanceKm: 315.5,
      estimatedDurationMinutes: 375,
      isActive: false,
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
    const dialog = screen.getByRole("dialog");
    for (const sectionKey of [
      "routes.createRouteJourneySection",
      "routes.createRouteOperationsSection",
      "routes.createRouteMetricsSection",
    ]) {
      expect(within(dialog).getByText(sectionKey)).toBeInTheDocument();
    }

    fireEvent.change(within(dialog).getByPlaceholderText("routes.namePlaceholder"), {
      target: { value: "Tuyến mới" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "routes.selectOriginStation",
      }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: "Bến A · Hồ Chí Minh" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "routes.selectDestinationStation",
      }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "routes.returnRouteId" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Tuyến A" }));

    const baseFareInput = within(dialog)
      .getByText("routes.baseFare")
      .parentElement?.querySelector("input");
    expect(baseFareInput).not.toBeNull();
    fireEvent.change(baseFareInput as HTMLInputElement, {
      target: { value: "275000" },
    });
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: "routes.activeRoute" }),
    );
    // Google Routes lỗi (mặc định môi trường test) → chờ fallback haversine
    // rồi cho phép chỉnh tay km/thời lượng trước khi gửi manualMetrics.
    expect(
      await within(dialog).findByText("routes.autoMetricsFallbackHint"),
    ).toBeInTheDocument();
    const distanceInput = within(dialog)
      .getByText("routes.totalDistance")
      .parentElement?.querySelector("input");
    expect(distanceInput).not.toBeNull();
    fireEvent.change(distanceInput as HTMLInputElement, {
      target: { value: "315.5" },
    });
    const durationInputs = within(dialog)
      .getByText("routes.durationMinutes")
      .parentElement?.querySelectorAll("input");
    expect(durationInputs).toHaveLength(2);
    fireEvent.change(durationInputs?.[0] as HTMLInputElement, {
      target: { value: "6" },
    });
    fireEvent.change(durationInputs?.[1] as HTMLInputElement, {
      target: { value: "15" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /routes.createRoute/ }),
    );

    await waitFor(() =>
      expect(createOperatorRouteFull).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tuyến mới",
          originStationId,
          destinationStationId,
          returnRouteId: routeA.id,
          baseFare: 275_000,
          isActive: false,
          stops: [],
          manualMetrics: {
            totalDistanceKm: 315.5,
            estimatedDurationMinutes: 375,
          },
        }),
      ),
    );
    // Có fallback → KHÔNG gửi pathPolyline (contract 12.1)
    expect(
      vi.mocked(createOperatorRouteFull).mock.calls[0][0].pathPolyline,
    ).toBeUndefined();
    // Tạo xong → auto-select tuyến mới, về tab Thông tin (mặc định) với form
    // của tuyến vừa tạo
    expect(await screen.findByDisplayValue("Tuyến mới")).toBeInTheDocument();
    // Chuyển sang tab Điểm dừng để bổ sung tiếp — mục điểm dừng hiển thị ngay
    fireEvent.click(screen.getByText("routes.tabs.stops"));
    expect(
      await screen.findByText("routes.panelStopsTitle"),
    ).toBeInTheDocument();
  });

  it("keeps auto-calculated hour and minute values visible when the duration inputs are locked", async () => {
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(requestRoadGeometry).mockResolvedValue([
      {
        points: [
          { latitude: 10.77, longitude: 106.69 },
          { latitude: 11.94, longitude: 108.44 },
        ],
        totalDistanceKm: 94,
        estimatedDurationMinutes: 245,
      },
    ]);

    renderRoutesPage();
    await waitForLoaded();
    fireEvent.click(
      screen.getAllByRole("button", { name: /routes.newRoute/ })[0],
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "routes.selectOriginStation",
      }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: "Bến A · Hồ Chí Minh" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "routes.selectDestinationStation",
      }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
      }),
    );

    expect(
      await within(dialog).findByText("routes.autoMetricsBadge"),
    ).toBeInTheDocument();
    const durationInputs = within(dialog)
      .getByText("routes.durationMinutes")
      .parentElement?.querySelectorAll("input");
    const hourInput = durationInputs?.[0];
    const minuteInput = durationInputs?.[1];

    expect(hourInput).toHaveValue(4);
    expect(minuteInput).toHaveValue(5);
    expect(hourInput).toBeDisabled();
    expect(minuteInput).toBeDisabled();
    expect(hourInput).toHaveClass("text-center", "tabular-nums");
    expect(minuteInput).toHaveClass("text-center", "tabular-nums");
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

    // Dòng điểm dừng trong panel giờ chỉ hiện ở tab "Điểm dừng" riêng — marker
    // đánh số trên map thì hiện ở MỌI tab (kể cả tab Thông tin mặc định)
    fireEvent.click(screen.getByText("routes.tabs.stops"));

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
    await screen.findByText("routes.autoMetricsFallbackHint");
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

    // Chờ bộ phương án auto-fetch vẽ xong trên bản đồ (debounce 400ms) — loại
    // các lớp "-hit" (vùng bắt click rộng vô hình của đường mờ, xem
    // RouteDesignMap.tsx) vì chúng không phải phương án riêng, chỉ tăng vùng
    // bấm cho đường đã có trong danh sách.
    async function waitForOptionPolylines(count: number) {
      await waitFor(
        () =>
          expect(
            screen
              .getAllByTestId(/map-polyline-route-option-/)
              .filter((el) => !el.dataset.testid?.endsWith("-hit")),
          ).toHaveLength(count),
        { timeout: 2000 },
      );
    }

    async function applyRouteOption(index: number) {
      fireEvent.click(
        screen.getByTestId(`map-polyline-route-option-${index}`),
      );
      await waitFor(
        () => {
          expect(
            screen.getByTestId(`map-polyline-route-option-${index}`),
          ).toHaveAttribute("data-opacity", "1");
          expect(
            screen.getByRole("button", { name: /routes.saveRoute/ }),
          ).toBeEnabled();
        },
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
      await applyRouteOption(1);
      expect(screen.getByText(/410\.2/)).toBeInTheDocument();
      // Việc chọn phương án được phản ánh trên map; trạng thái lưu được kiểm tra sau khi chọn lại phương án đã lưu.
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
      // Việc chọn phương án được phản ánh trên map; trạng thái lưu được kiểm tra sau khi chọn lại phương án đã lưu.
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
      expect(
        screen.queryByRole("button", { name: "routes.clearGeometry" }),
      ).not.toBeInTheDocument();
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
      await applyRouteOption(0);

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
      await applyRouteOption(0);
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
      await applyRouteOption(1);
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
      await applyRouteOption(0);
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

  // Task 7: nối dây chế độ "thêm điểm dừng" — chấm gợi ý trên map → popup xác
  // nhận → thêm vào tuyến → lưu tuyến gửi đúng metrics (chiếu lên polyline).
  // m-2: thêm 2 gợi ý theo thứ tự XA rồi GẦN bến đi hơn → re-index phải chèn
  // gợi ý gần vào orderIndex 1 (không phải chỉ append cuối danh sách). Gợi ý thứ
  // 2 thêm qua Ô SEARCH (không qua chấm map): sau lần thêm đầu, đường đi cục bộ
  // bị invalidate (thiết kế có chủ đích — điểm dừng đổi thì đường đã lưu không
  // còn khớp) nên map tạm thời không còn chấm gợi ý nào cho tới khi tính lại
  // đường; ô search không phụ thuộc polyline nên vẫn dùng được ngay.
  it("adds suggested stops from the map popup and search box, re-indexing by distance when saving", async () => {
    const routeWithPath: OperatorRouteDetail = {
      ...routeA,
      pathPolyline: encodeGooglePolyline([
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ]),
      stops: [],
    };
    // Nằm gần như đúng trên đường thẳng bến A → bến B, ở khoảng GIỮA tuyến
    // (fraction ~0.5) → lọt ngưỡng gợi ý (cách đường <= 3km)
    const midStop: OperatorStop = {
      id: "stop-along-route",
      operatorId: "operator-1",
      name: "Trạm dừng chân giữa tuyến",
      description: null,
      latitude: 11.355,
      longitude: 107.565,
      address: "Quốc lộ 20",
      googlePlaceId: null,
      isActive: true,
    };
    // Gần bến đi hơn (fraction ~0.2) — thêm SAU midStop nhưng phải được re-index
    // đứng TRƯỚC (orderIndex 1), chứng minh re-index không chỉ append cuối
    const nearOriginStop: OperatorStop = {
      id: "stop-near-origin",
      operatorId: "operator-1",
      name: "Trạm gần bến đi",
      description: null,
      latitude: 11.004,
      longitude: 107.04,
      address: "Quốc lộ 20",
      googlePlaceId: null,
      isActive: true,
    };

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeWithPath);
    vi.mocked(getOperatorStops).mockResolvedValue({
      ...emptyPage,
      items: [midStop, nearOriginStop],
      totalItems: 2,
      totalPages: 1,
    });
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(updateOperatorRouteFull).mockResolvedValue(routeWithPath);

    renderRoutesPage();
    await waitForLoaded();
    expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

    // Mở tab "Điểm dừng" → vào tab là bật luôn chấm gợi ý trên bản đồ (không
    // còn nút bật/tắt riêng)
    fireEvent.click(
      screen.getByRole("button", { name: "routes.tabs.stops" }),
    );

    // 1) Thêm trước gợi ý XA bến đi hơn (giữa tuyến)
    const midMarker = await screen.findByTestId(
      "map-pointmarker-click-suggest-operatorStop-stop-along-route",
    );
    fireEvent.click(midMarker);
    expect(
      await screen.findByTestId("stop-suggestion-popup"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /routes.suggestAdd/ }));
    expect(
      await screen.findByTestId("route-stop-row-stop-along-route"),
    ).toHaveTextContent("#1 · Trạm dừng chân giữa tuyến");

    // 2) Thêm SAU gợi ý GẦN bến đi hơn qua Ô SEARCH — phải được chèn lên
    // orderIndex 1, đẩy gợi ý giữa tuyến xuống orderIndex 2 (re-index theo
    // khoảng cách thật, không phải theo thứ tự bấm thêm)
    const searchInput = await screen.findByPlaceholderText(
      "routes.stopSearchPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "gần bến" } });
    fireEvent.click(await screen.findByText("Trạm gần bến đi"));
    expect(
      await screen.findByTestId("stop-suggestion-popup"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /routes.suggestAdd/ }));

    expect(
      await screen.findByTestId("route-stop-row-stop-near-origin"),
    ).toHaveTextContent("#1 · Trạm gần bến đi");
    expect(
      screen.getByTestId("route-stop-row-stop-along-route"),
    ).toHaveTextContent("#2 · Trạm dừng chân giữa tuyến");

    // Lưu tuyến → payload gửi đúng cả 2 stop kèm metrics tính từ polyline (>0)
    // và orderIndex đúng thứ tự khoảng cách (không phải thứ tự bấm thêm)
    fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));
    await waitFor(() => expect(updateOperatorRouteFull).toHaveBeenCalled());

    const [, savedBody] = vi.mocked(updateOperatorRouteFull).mock.calls[0];
    const savedNearStop = savedBody.stops?.find(
      (stop) => stop.stopId === "stop-near-origin",
    );
    const savedMidStop = savedBody.stops?.find(
      (stop) => stop.stopId === "stop-along-route",
    );
    expect(savedNearStop).toBeDefined();
    expect(savedMidStop).toBeDefined();
    expect(savedNearStop?.orderIndex).toBe(1);
    expect(savedMidStop?.orderIndex).toBe(2);
    expect(savedNearStop?.distanceFromOriginKm).toBeGreaterThan(0);
    expect(savedNearStop?.estimatedDurationFromOriginMinutes).toBeGreaterThan(0);
    expect(savedMidStop?.distanceFromOriginKm).toBeGreaterThan(0);
    expect(savedMidStop?.estimatedDurationFromOriginMinutes).toBeGreaterThan(0);
    expect(savedNearStop?.distanceFromOriginKm).toBeLessThan(
      savedMidStop?.distanceFromOriginKm ?? Number.POSITIVE_INFINITY,
    );
  });

  // C-1 regression: gợi ý chọn từ ô search KHÔNG nhất thiết nằm trong danh sách
  // chấm gợi ý trên map (chỉ gồm gợi ý cách polyline <= 3km) — ô search không lọc
  // theo khoảng cách. Trước fix, popup mở rồi tự đóng ngay vì guard "không còn
  // trong suggestions" — test này phải xanh sau khi merge pickedSuggestion vào
  // mảng suggestions truyền xuống map (+ guard chừa externalActiveSuggestion).
  it("pick-from-search: mở được popup và thêm vào tuyến dù gợi ý cách xa polyline", async () => {
    const routeWithPath: OperatorRouteDetail = {
      ...routeA,
      pathPolyline: encodeGooglePolyline([
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ]),
      stops: [],
    };
    // Cách xa polyline (>3km, khác hẳn khu vực tuyến) → KHÔNG lọt danh sách chấm
    // gợi ý trên map, nhưng vẫn tìm được qua ô search (search không lọc khoảng cách)
    const farStop: OperatorStop = {
      id: "stop-far-away",
      operatorId: "operator-1",
      name: "Trạm xa tuyến",
      description: null,
      latitude: 21.03,
      longitude: 105.85,
      address: "Hà Nội",
      googlePlaceId: null,
      isActive: true,
    };

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeWithPath);
    vi.mocked(getOperatorStops).mockResolvedValue({
      ...emptyPage,
      items: [farStop],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(updateOperatorRouteFull).mockResolvedValue(routeWithPath);

    renderRoutesPage();
    await waitForLoaded();
    expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "routes.tabs.stops" }),
    );

    // Chấm gợi ý trên map KHÔNG có stop này (quá xa polyline)
    expect(
      screen.queryByTestId(
        "map-pointmarker-click-suggest-operatorStop-stop-far-away",
      ),
    ).not.toBeInTheDocument();

    const searchInput = await screen.findByPlaceholderText(
      "routes.stopSearchPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "Trạm xa" } });
    fireEvent.click(await screen.findByText("Trạm xa tuyến"));

    expect(
      await screen.findByTestId("stop-suggestion-popup"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /routes.suggestAdd/ }));

    expect(
      await screen.findByTestId("route-stop-row-stop-far-away"),
    ).toBeInTheDocument();
  });

  // F-2 regression: sau khi thêm thành công gợi ý chọn từ ô search, chấm gợi ý
  // đó không được nằm lại trên bản đồ ("chấm ma") — trước fix, pickedSuggestion
  // không được dọn nên vẫn bị merge lại vào `suggestions` dù đã gắn vào tuyến
  // (bị lọc khỏi nearbySuggestions do trùng attachedStopIds), bấm lại báo lỗi
  // duplicate.
  it("pick-from-search: sau khi thêm thành công, chấm gợi ý không còn lại trên bản đồ", async () => {
    const routeWithPath: OperatorRouteDetail = {
      ...routeA,
      pathPolyline: encodeGooglePolyline([
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ]),
      stops: [],
    };
    const farStop: OperatorStop = {
      id: "stop-far-away",
      operatorId: "operator-1",
      name: "Trạm xa tuyến",
      description: null,
      latitude: 21.03,
      longitude: 105.85,
      address: "Hà Nội",
      googlePlaceId: null,
      isActive: true,
    };

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeWithPath);
    vi.mocked(getOperatorStops).mockResolvedValue({
      ...emptyPage,
      items: [farStop],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(updateOperatorRouteFull).mockResolvedValue(routeWithPath);

    renderRoutesPage();
    await waitForLoaded();
    expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "routes.tabs.stops" }),
    );

    const searchInput = await screen.findByPlaceholderText(
      "routes.stopSearchPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "Trạm xa" } });
    fireEvent.click(await screen.findByText("Trạm xa tuyến"));

    expect(
      await screen.findByTestId("stop-suggestion-popup"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /routes.suggestAdd/ }));

    await screen.findByTestId("route-stop-row-stop-far-away");

    // Chấm gợi ý cho stop vừa gắn không còn hiện lại trên bản đồ (không phải
    // thành viên "ma" của suggestions nữa)
    expect(
      screen.queryByTestId(
        "map-pointmarker-suggest-operatorStop-stop-far-away",
      ),
    ).not.toBeInTheDocument();
  });

  // Phụ lục spec 2026-08-07: tab "Tuyến thay thế" chuyển map-first — form nhập
  // tay km/phút/stop bị bỏ, thay bằng chính workspace bản đồ (reuse máy geometry).
  describe("alternative routes tab (map-first)", () => {
    const altDestinationStationId = "33333333-3333-3333-3333-333333333333";
    const altStations: OperatorStation[] = [
      ...operatorStations,
      {
        id: "op-station-3",
        operatorId: "operator-1",
        stationId: altDestinationStationId,
        station: {
          id: altDestinationStationId,
          name: "Bến C",
          city: "Đồng Nai",
          ward: null,
          latitude: 11.2,
          longitude: 107.0,
        },
      },
    ];

    const altStop: OperatorStop = {
      id: "alt-stop-1",
      operatorId: "operator-1",
      name: "Trạm phụ",
      description: null,
      latitude: 11.0,
      longitude: 106.9,
      address: "QL20",
      googlePlaceId: null,
      isActive: true,
    };
    // Nằm gần đúng trên đoạn giữa altOne (bến A → bến C) — lọt ngưỡng chấm gợi ý
    const altSuggestionStop: OperatorStop = {
      id: "alt-suggest-stop",
      operatorId: "operator-1",
      name: "Trạm gợi ý tuyến thay thế",
      description: null,
      latitude: 10.98,
      longitude: 106.84,
      address: "QL20",
      googlePlaceId: null,
      isActive: true,
    };

    const altOnePoints = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 11.2, longitude: 107.0 },
    ];
    const altTwoPoints = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 10.9, longitude: 106.8 },
      { latitude: 11.2, longitude: 107.0 },
    ];

    const altOne: AlternativeRoute = {
      id: "alt-1",
      routeId: routeA.id,
      name: "Alt One",
      description: "Phương án 1",
      destinationStationId: altDestinationStationId,
      pathPolyline: encodeGooglePolyline(altOnePoints),
      totalDistanceKm: 55,
      estimatedDurationMinutes: 75,
      isActive: true,
      stops: [
        {
          alternativeRouteId: "alt-1",
          stopId: altStop.id,
          orderIndex: 1,
          estimatedDurationFromOriginMinutes: 15,
          distanceFromOriginKm: 12,
        },
      ],
    };
    const altTwo: AlternativeRoute = {
      id: "alt-2",
      routeId: routeA.id,
      name: "Alt Two",
      description: "",
      destinationStationId: altDestinationStationId,
      pathPolyline: encodeGooglePolyline(altTwoPoints),
      totalDistanceKm: 60,
      estimatedDurationMinutes: 80,
      isActive: false,
      stops: [],
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
        items: altStations,
        totalItems: altStations.length,
        totalPages: 1,
        pageSize: 100,
      });
      vi.mocked(getOperatorStops).mockResolvedValue({
        ...emptyPage,
        items: [altStop, altSuggestionStop],
        totalItems: 2,
        totalPages: 1,
      });
      vi.mocked(getAlternativeRoutes).mockResolvedValue({
        ...emptyPage,
        items: [altOne, altTwo],
        totalItems: 2,
        totalPages: 1,
        pageSize: 2,
      });
    });

    async function openAlternativesTab() {
      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "routes.tabs.alternatives" }),
      );
      // Chờ danh sách + form tuyến thay thế đầu tiên nạp xong
      await screen.findByDisplayValue("Alt One");
    }

    it("renders a map-first workspace with no manual km/duration inputs", async () => {
      await openAlternativesTab();

      expect(screen.getByTestId("route-map-shell")).toBeInTheDocument();
      expect(screen.getByTestId("route-map")).toBeInTheDocument();
      // Km/phút chỉ đọc — không còn ô nhập tay (bỏ NumberInput/DurationInput)
      expect(
        screen.getByTestId("alternative-metrics-readout"),
      ).toBeInTheDocument();
      expect(screen.queryByText("routes.totalDistance")).not.toBeInTheDocument();
      expect(screen.queryByText("routes.durationMinutes")).not.toBeInTheDocument();
      // Danh sách 2 tuyến thay thế hiện đủ
      expect(screen.getByText("Alt One")).toBeInTheDocument();
      expect(screen.getByText("Alt Two")).toBeInTheDocument();
    });

    it("loads the selected alternative's polyline (orange) and stop markers onto the map", async () => {
      await openAlternativesTab();

      // Mặc định chọn Alt One (phần tử đầu) — có polyline + 1 stop
      await waitFor(() =>
        expect(
          screen.getByTestId("map-polyline-route-geometry"),
        ).toHaveAttribute("data-color", "#f59e0b"),
      );
      expect(
        screen.getByTestId("map-pointmarker-route-stop-alt-stop-1"),
      ).toBeInTheDocument();

      // Chọn Alt Two (không có stop) → map đổi theo: marker của Alt One biến mất
      fireEvent.click(screen.getByText("Alt Two"));
      await screen.findByDisplayValue("Alt Two");
      expect(
        screen.queryByTestId("map-pointmarker-route-stop-alt-stop-1"),
      ).not.toBeInTheDocument();
    });

    it("adds a stop to the alternative from a map suggestion dot with auto-computed metrics", async () => {
      await openAlternativesTab();

      const suggestionMarker = await screen.findByTestId(
        "map-pointmarker-click-suggest-operatorStop-alt-suggest-stop",
      );
      fireEvent.click(suggestionMarker);
      expect(
        await screen.findByTestId("stop-suggestion-popup"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /routes.suggestAdd/ }));

      // Stop mới xuất hiện trong danh sách panel — km/phút tự tính từ polyline
      // (không phải số nhập tay), orderIndex tự re-index cùng stop có sẵn
      expect(
        await screen.findByTestId(
          "alternative-stop-row-alt-suggest-stop",
        ),
      ).toBeInTheDocument();
      // createOperatorStop KHÔNG được gọi — đây là gợi ý từ kho nhà xe, không phải Google
      expect(createOperatorStop).not.toHaveBeenCalled();
      expect(
        screen.getAllByText("routes.unsavedChanges").length,
      ).toBeGreaterThan(0);
    });

    // Review finding #6: gỡ stop tuyến thay thế (panel hoặc card trên map)
    // phải qua modal xác nhận, nhất quán với gỡ stop tuyến chính.
    it("requires confirmation before removing a stop from the alternative", async () => {
      await openAlternativesTab();

      const row = await screen.findByTestId("alternative-stop-row-alt-stop-1");
      fireEvent.click(
        within(row).getByRole("button", {
          name: "routes.removeAlternativeStop",
        }),
      );

      // Bấm gỡ chỉ MỞ modal xác nhận — stop chưa bị xoá khỏi danh sách
      expect(
        await screen.findByText("routes.removeRouteStopTitle"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("alternative-stop-row-alt-stop-1"),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "delete" }));

      await waitFor(() =>
        expect(
          screen.queryByTestId("alternative-stop-row-alt-stop-1"),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByText("routes.alternativeNoStops")).toBeInTheDocument();
    });

    it("saves the alternative with auto-computed metrics and syncs the geometry", async () => {
      vi.mocked(updateAlternativeRoute).mockResolvedValue(altOne);
      vi.mocked(updateAlternativeRouteGeometry).mockResolvedValue(altOne);

      await openAlternativesTab();

      // Sửa tên → đánh dấu chưa lưu, bật nút Lưu
      fireEvent.change(screen.getByDisplayValue("Alt One"), {
        target: { value: "Alt One (sửa)" },
      });
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));

      await waitFor(() => expect(updateAlternativeRoute).toHaveBeenCalled());
      expect(updateAlternativeRoute).toHaveBeenCalledWith(
        "alt-1",
        expect.objectContaining({
          name: "Alt One (sửa)",
          destinationStationId: altDestinationStationId,
          totalDistanceKm: altOne.totalDistanceKm,
          estimatedDurationMinutes: altOne.estimatedDurationMinutes,
          stops: [
            {
              stopId: altStop.id,
              orderIndex: 1,
              estimatedDurationFromOriginMinutes: 15,
              distanceFromOriginKm: 12,
            },
          ],
        }),
      );
      // Đường đi (polyline) lưu qua call RIÊNG updateAlternativeRouteGeometry —
      // không atomic như /routes/full (đúng phụ lục mục 4)
      await waitFor(() =>
        expect(updateAlternativeRouteGeometry).toHaveBeenCalledWith("alt-1", {
          pathPolyline: encodeGooglePolyline(altOnePoints),
        }),
      );
      expect(
        await screen.findByText("routes.alternativeUpdated"),
      ).toBeInTheDocument();
    });

    it("disables creating a new alternative once the limit of two is reached", async () => {
      await openAlternativesTab();

      expect(
        screen.getByRole("button", { name: /routes.newAlternative/ }),
      ).toBeDisabled();
    });

    it("creates a new alternative route via the map-first form when under the limit", async () => {
      vi.mocked(getAlternativeRoutes).mockResolvedValue({
        ...emptyPage,
        items: [altOne],
        totalItems: 1,
        totalPages: 1,
      });
      const createdAlt: AlternativeRoute = {
        ...altTwo,
        id: "alt-3",
        name: "Alt Three",
      };
      vi.mocked(createAlternativeRoute).mockResolvedValue(createdAlt);
      vi.mocked(updateAlternativeRouteGeometry).mockResolvedValue(createdAlt);
      vi.mocked(requestRoadGeometry).mockResolvedValue([
        {
          points: altOnePoints,
          totalDistanceKm: 55,
          estimatedDurationMinutes: 75,
        },
      ]);

      await openAlternativesTab();

      expect(
        screen.getByRole("button", { name: /routes.newAlternative/ }),
      ).not.toBeDisabled();
      fireEvent.click(
        screen.getByRole("button", { name: /routes.newAlternative/ }),
      );

      fireEvent.change(
        screen.getByPlaceholderText("routes.alternativeNamePlaceholder"),
        { target: { value: "Alt Three" } },
      );
      // Nháp mới được prefill bến đến = bến đến tuyến chính (Bến B) — đổi
      // sang bến khác qua chính select đó (chờ effect prefill chạy xong)
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
        }),
      );
      fireEvent.click(
        screen.getByRole("option", { name: "Bến C · Đồng Nai" }),
      );

      // Chọn 1 phương án đường trên map (bắt buộc trước khi lưu — không còn ô
      // nhập km/phút tay)
      await waitFor(
        () =>
          expect(
            screen.getByTestId("map-polyline-route-option-0"),
          ).toBeInTheDocument(),
        { timeout: 2000 },
      );
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));

      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));

      await waitFor(() => expect(createAlternativeRoute).toHaveBeenCalled());
      expect(createAlternativeRoute).toHaveBeenCalledWith(
        routeA.id,
        expect.objectContaining({
          name: "Alt Three",
          destinationStationId: altDestinationStationId,
          totalDistanceKm: 55,
          estimatedDurationMinutes: 75,
        }),
      );
      await waitFor(() =>
        expect(updateAlternativeRouteGeometry).toHaveBeenCalledWith(
          "alt-3",
          { pathPolyline: encodeGooglePolyline(altOnePoints) },
        ),
      );
      expect(
        await screen.findByText("routes.alternativeCreated"),
      ).toBeInTheDocument();
    });

    // Regression từ fix #4 (round 2 review): guard giới hạn 0/2 trước đây chỉ
    // xét `selectedAlternativeRouteId` — kịch bản "đã có 1 alt, tạo alt MỚI,
    // create thành công (list → 2) nhưng lưu geometry lỗi" giữ id vừa tạo
    // trong `pendingAlternativeIdRef` chứ KHÔNG gán selectedAlternativeRouteId
    // (cố ý, xem fix #4) → bấm Lưu retry bị guard hiểu nhầm là "tạo thêm 1 alt
    // nữa" trong khi đủ 2/2 → chặn oan, user kẹt vĩnh viễn không lưu lại được.
    // Guard giờ xét targetAlternativeId (gồm cả pendingAlternativeIdRef).
    it("lets a retry save update the pending alternative instead of hitting the 0/2 limit after a geometry failure", async () => {
      // Sẵn có đúng 1 alt (route A) — soạn thêm 1 alt MỚI sẽ đưa danh sách lên
      // đúng 2/2 sau khi create thành công (bối cảnh guard dễ hiểu nhầm nhất).
      vi.mocked(getAlternativeRoutes).mockResolvedValue({
        ...emptyPage,
        items: [altOne],
        totalItems: 1,
        totalPages: 1,
      });
      const createdAlt: AlternativeRoute = {
        ...altTwo,
        id: "alt-3",
        name: "Alt Three",
      };
      vi.mocked(createAlternativeRoute).mockResolvedValue(createdAlt);
      vi.mocked(updateAlternativeRouteGeometry).mockRejectedValueOnce(
        new Error("geometry save failed"),
      );
      vi.mocked(requestRoadGeometry).mockResolvedValue([
        {
          points: altOnePoints,
          totalDistanceKm: 55,
          estimatedDurationMinutes: 75,
        },
      ]);

      await openAlternativesTab();
      fireEvent.click(
        screen.getByRole("button", { name: /routes.newAlternative/ }),
      );
      fireEvent.change(
        screen.getByPlaceholderText("routes.alternativeNamePlaceholder"),
        { target: { value: "Alt Three" } },
      );
      // Nháp mới được prefill bến đến = bến đến tuyến chính (Bến B) — đổi
      // sang bến khác qua chính select đó (chờ effect prefill chạy xong)
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
        }),
      );
      fireEvent.click(
        screen.getByRole("option", { name: "Bến C · Đồng Nai" }),
      );
      await waitFor(
        () =>
          expect(
            screen.getByTestId("map-polyline-route-option-0"),
          ).toBeInTheDocument(),
        { timeout: 2000 },
      );
      fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));

      // Lượt 1: create thành công (list → 2/2) nhưng geometry lỗi
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));
      await waitFor(() => expect(createAlternativeRoute).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(updateAlternativeRouteGeometry).toHaveBeenCalledTimes(1),
      );
      expect(
        await screen.findByText("geometry save failed"),
      ).toBeInTheDocument();
      // KHÔNG bị toast giới hạn — đây chính là regression cần chặn
      expect(
        screen.queryByText("routes.alternativeLimitReached"),
      ).not.toBeInTheDocument();

      // Lượt 2 (retry): phải UPDATE đúng "alt-3" vừa tạo — không create lần 2,
      // không bị chặn bởi guard 0/2
      vi.mocked(updateAlternativeRouteGeometry).mockResolvedValueOnce(createdAlt);
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));

      await waitFor(() => expect(updateAlternativeRoute).toHaveBeenCalled());
      expect(updateAlternativeRoute).toHaveBeenCalledWith(
        "alt-3",
        expect.objectContaining({ name: "Alt Three" }),
      );
      expect(createAlternativeRoute).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText("routes.alternativeLimitReached"),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByText("routes.alternativeUpdated"),
      ).toBeInTheDocument();
    });

    // Review finding #1: khoá cache geometry/suggestions của tuyến thay thế
    // NHÁP (chưa lưu) trước đây là hằng số "alt:draft" — soạn nháp ở tuyến A
    // rồi qua tuyến B soạn nháp khác dính cache Google Places của hành lang
    // tuyến A (lọc theo polyline tuyến A, gần như luôn ngoài bán kính 1km của
    // polyline tuyến B) → 0 chấm gợi ý vĩnh viễn tới khi F5. Khoá giờ gồm cả
    // selectedRouteId + destinationStationId (xem alternativeGeometryKey).
    it("does not reuse the Google Places cache between draft alternatives of different main routes", async () => {
      const routeB: OperatorRoute = { ...routeA, id: "route-2", name: "Tuyến B" };

      vi.mocked(getOperatorRoutes).mockResolvedValue({
        ...emptyPage,
        items: [routeA, routeB],
        totalItems: 2,
        totalPages: 1,
      });
      vi.mocked(getOperatorRoute).mockImplementation((id: string) =>
        Promise.resolve(id === routeB.id ? routeB : routeA),
      );
      // Cả 2 tuyến đều CHƯA có tuyến thay thế nào lưu — soạn nháp cả hai lần
      vi.mocked(getAlternativeRoutes).mockResolvedValue(emptyPage);
      vi.mocked(requestRoadGeometry).mockResolvedValue([
        {
          points: altOnePoints,
          totalDistanceKm: 55,
          estimatedDurationMinutes: 75,
        },
      ]);

      async function draftAlternativeAndApplyPath() {
        fireEvent.click(
          screen.getByRole("button", { name: "routes.tabs.alternatives" }),
        );
        // Nháp mới được prefill bến đến = bến đến tuyến chính (Bến B)
        fireEvent.click(
          await screen.findByRole("button", {
            name: "Bến B · Phường Xuân Hương - Đà Lạt, Lâm Đồng",
          }),
        );
        fireEvent.click(
          screen.getByRole("option", { name: "Bến C · Đồng Nai" }),
        );
        await waitFor(
          () =>
            expect(
              screen.getByTestId("map-polyline-route-option-0"),
            ).toBeInTheDocument(),
          { timeout: 2000 },
        );
        fireEvent.click(screen.getByTestId("map-polyline-route-option-0"));
      }

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();

      await draftAlternativeAndApplyPath();
      // 2 query nhóm ("bến xe" / "trạm dừng chân") gọi song song mỗi lượt fetch
      await waitFor(() =>
        expect(searchPlacesAlongRoute).toHaveBeenCalledTimes(2),
      );

      // Đổi sang tuyến B (đợi list tuyến thay thế rỗng nạp xong) rồi soạn nháp
      // với CÙNG bến đến thay thế — nếu còn dính cache thì searchPlacesAlongRoute
      // sẽ KHÔNG được gọi thêm.
      fireEvent.click(screen.getByRole("button", { name: /Tuyến B/ }));
      await screen.findByText("routes.alternativeEmpty");
      await draftAlternativeAndApplyPath();

      await waitFor(() =>
        expect(searchPlacesAlongRoute).toHaveBeenCalledTimes(4),
      );
    });

    // Review finding #2: user đổi tuyến chính trong lúc save/xoá tuyến thay
    // thế đang bay (await) → response về muộn phải bị BỎ QUA, không được ghi
    // đè state đã thuộc tuyến MỚI (index.tsx đã tự nạp lại qua applyAlternatives).
    it("ignores a stale save response after switching the main route mid-flight", async () => {
      const routeB: OperatorRoute = { ...routeA, id: "route-2", name: "Tuyến B" };

      vi.mocked(getOperatorRoutes).mockResolvedValue({
        ...emptyPage,
        items: [routeA, routeB],
        totalItems: 2,
        totalPages: 1,
      });
      vi.mocked(getOperatorRoute).mockImplementation((id: string) =>
        Promise.resolve(id === routeB.id ? routeB : routeA),
      );
      vi.mocked(getAlternativeRoutes).mockImplementation((routeId: string) =>
        Promise.resolve(
          routeId === routeA.id
            ? { ...emptyPage, items: [altOne, altTwo], totalItems: 2, totalPages: 1 }
            : emptyPage,
        ),
      );

      let resolveUpdate!: (value: AlternativeRoute) => void;
      vi.mocked(updateAlternativeRoute).mockImplementation(
        () =>
          new Promise<AlternativeRoute>((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      renderRoutesPage();
      await waitForLoaded();
      expect(await screen.findByDisplayValue("Tuyến A")).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "routes.tabs.alternatives" }),
      );
      await screen.findByDisplayValue("Alt One");

      fireEvent.change(screen.getByDisplayValue("Alt One"), {
        target: { value: "Alt One (đang lưu)" },
      });
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));
      await waitFor(() => expect(updateAlternativeRoute).toHaveBeenCalled());

      // Đổi sang tuyến B NGAY TRONG LÚC save của tuyến A còn đang treo — đợi
      // list tuyến thay thế của tuyến B (rỗng) nạp xong hẳn
      fireEvent.click(screen.getByRole("button", { name: /Tuyến B/ }));
      await screen.findByText("routes.alternativeEmpty");

      // Phát chốt response cũ của tuyến A về MUỘN, sau khi đã đổi tuyến
      await act(async () => {
        resolveUpdate({ ...altOne, name: "Alt One (đang lưu)" });
      });

      // Response cũ bị bỏ qua hoàn toàn: KHÔNG gọi tiếp updateAlternativeRouteGeometry,
      // danh sách tuyến B vẫn rỗng (không bị chèn bản ghi của tuyến A)
      expect(updateAlternativeRouteGeometry).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Alt One (đang lưu)"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("routes.alternativeEmpty")).toBeInTheDocument();
    });

    // Review finding #3 (spec mục 4): lỗi ở bước lưu geometry (sau khi
    // metrics/stops đã lưu thành công) phải GIỮ NGUYÊN draft trên UI — không
    // reset form/stop/dirty, không gọi loadAlternativeIntoWorkspace.
    it("keeps the draft intact when saving the geometry fails after metrics/stops were saved", async () => {
      vi.mocked(updateAlternativeRoute).mockResolvedValue(altOne);
      vi.mocked(updateAlternativeRouteGeometry).mockRejectedValue(
        new Error("geometry save failed"),
      );

      await openAlternativesTab();

      fireEvent.change(screen.getByDisplayValue("Alt One"), {
        target: { value: "Alt One (sửa)" },
      });
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));

      await waitFor(() => expect(updateAlternativeRoute).toHaveBeenCalled());
      await waitFor(() =>
        expect(updateAlternativeRouteGeometry).toHaveBeenCalled(),
      );

      // Toast báo lỗi geometry, KHÔNG gọi loadAlternativeIntoWorkspace: form
      // vẫn giữ tên vừa sửa, badge "chưa lưu" vẫn còn nguyên
      expect(
        await screen.findByText("geometry save failed"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Alt One (sửa)")).toBeInTheDocument();
      expect(
        screen.getAllByText("routes.unsavedChanges").length,
      ).toBeGreaterThan(0);

      // Bấm Lưu LẦN NỮA (retry) — phải gọi UPDATE đúng bản ghi "alt-1", không
      // tạo trùng bản ghi mới (createAlternativeRoute không được gọi)
      vi.mocked(updateAlternativeRouteGeometry).mockResolvedValueOnce(altOne);
      fireEvent.click(screen.getByRole("button", { name: /routes.saveRoute/ }));
      await waitFor(() =>
        expect(updateAlternativeRoute).toHaveBeenCalledTimes(2),
      );
      expect(updateAlternativeRoute).toHaveBeenLastCalledWith(
        "alt-1",
        expect.objectContaining({ name: "Alt One (sửa)" }),
      );
      expect(createAlternativeRoute).not.toHaveBeenCalled();
    });
  });
});
