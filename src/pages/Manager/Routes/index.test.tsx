import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperatorRoute,
  createOperatorStation,
  getAlternativeRoutes,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStops,
  getPublicLocations,
  searchStations,
  type OperatorRoute,
  type OperatorStation,
} from "../../../api/vietride";
import { distanceKmBetween, requestRoadGeometry } from "./geometry";
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

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: () => <div data-testid="route-map" />,
}));

vi.mock("../../../api/vietride", () => ({
  addRouteStop: vi.fn(),
  createOperatorRoute: vi.fn(),
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
  removeRouteStop: vi.fn(),
  searchStations: vi.fn(),
  updateAlternativeRoute: vi.fn(),
  updateOperatorRoute: vi.fn(),
  updateOperatorRouteGeometry: vi.fn(),
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
      ward: "Hồ Chí Minh",
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
      city: "Đà Lạt",
      ward: "Lâm Đồng",
      latitude: 11.94,
      longitude: 108.44,
    },
  },
];

async function waitForLoaded() {
  await screen.findByRole("heading", { name: "routes.manageTitle" });
  await waitFor(() =>
    expect(screen.queryByText("routes.loading")).not.toBeInTheDocument(),
  );
}

describe("Manager route setup workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("shows the detail tabs with the info tab active for the selected route", async () => {
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
    expect(screen.getByText("routes.tabs.stops")).toBeInTheDocument();
    expect(screen.getByText("routes.tabs.alternatives")).toBeInTheDocument();
    // Tab Thông tin mặc định: form tuyến + bản đồ, có nút cập nhật, không có nút tạo
    expect(screen.getByText("routes.routeManagement")).toBeInTheDocument();
    expect(screen.getByTestId("route-map")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.updateRoute/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /routes.createRoute/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the stops tab from the ?tab=stops deep link", async () => {
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      ...emptyPage,
      items: [routeA],
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOperatorRoute).mockResolvedValue(routeA);

    renderRoutesPage(["/manager/routes?routeId=route-1&tab=stops"]);
    await waitForLoaded();

    expect(
      await screen.findByText("routes.routeStopsTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText("routes.noStopsAttached")).toBeInTheDocument();
    // Tab Thông tin không hiển thị khi đang ở tab Điểm dừng
    expect(
      screen.queryByText("routes.routeManagement"),
    ).not.toBeInTheDocument();
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
        ward: "Hồ Chí Minh",
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
    fireEvent.click(
      screen.getByRole("option", { name: "Hồ Chí Minh · HCM" }),
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

  it("creates a route through the create modal and switches to the stops tab", async () => {
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      items: operatorStations,
      totalItems: operatorStations.length,
      totalPages: 1,
      pageSize: 100,
    });
    vi.mocked(createOperatorRoute).mockResolvedValue({
      ...routeA,
      id: "route-new",
      name: "Tuyến mới",
    });

    renderRoutesPage();
    await waitForLoaded();

    fireEvent.click(
      screen.getAllByRole("button", { name: /routes.newRoute/ })[0],
    );

    expect(
      await screen.findByText("routes.createRouteModalTitle"),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("routes.namePlaceholder"),
      { target: { value: "Tuyến mới" } },
    );
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
      screen.getByRole("option", { name: "Bến B · Đà Lạt" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /routes.createRoute/ }),
    );

    await waitFor(() =>
      expect(createOperatorRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tuyến mới",
          originStationId,
          destinationStationId,
        }),
      ),
    );
    // Tạo xong → auto-select tuyến mới và chuyển sang tab Điểm dừng
    expect(
      await screen.findByText("routes.routeStopsTitle"),
    ).toBeInTheDocument();
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
    vi.mocked(requestRoadGeometry).mockResolvedValue({
      points: [
        { latitude: 10.77, longitude: 106.69 },
        { latitude: 11.94, longitude: 108.44 },
      ],
      totalDistanceKm: 250.5,
      estimatedDurationMinutes: 300,
    });

    renderRoutesPage();
    await waitForLoaded();

    // Đủ 2 bến có tọa độ + số liệu còn 0 → tự gọi tính đường
    await waitFor(() => expect(requestRoadGeometry).toHaveBeenCalled());
    // Đã có đường → 2 ô km/thời lượng khóa lại thành số chỉ đọc kèm nút "Sửa tay"
    expect(
      await screen.findByText("routes.autoMetricsBadge"),
    ).toBeInTheDocument();
    expect(screen.getByText(/250\.5/)).toBeInTheDocument();

    // "Sửa tay" mở khóa lại 2 ô cho trường hợp đặc biệt
    fireEvent.click(
      screen.getByRole("button", { name: /routes.editMetricsManually/ }),
    );
    expect(
      screen.queryByText("routes.autoMetricsBadge"),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("250.5")).toBeEnabled();
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
});
