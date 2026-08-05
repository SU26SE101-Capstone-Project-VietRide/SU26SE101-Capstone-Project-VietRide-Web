import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperatorStation,
  getAlternativeRoutes,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStops,
  getPublicLocations,
  searchStations,
} from "../../../api/vietride";
import RoutesPage from "./index";

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
      province: string;
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
          province: "Hồ Chí Minh",
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

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 50,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

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
  });

  it("presents the route setup with backup route setup", async () => {
    render(<RoutesPage />);

    expect(
      await screen.findByRole("heading", { name: "routes.workflowTitle" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(getOperatorRoutes).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.queryByText("routes.loading")).not.toBeInTheDocument(),
    );

    const stationStep = screen.getByRole("button", {
      name: /routes.workflowStationTitle/,
    });
    expect(stationStep).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: /routes.workflowStopTitle/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.workflowRouteTitle/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.workflowAlternativeTitle/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.workflowOrderTitle/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /routes.workflowGeometryTitle/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("routes.workflowSummaryTitle")).toBeInTheDocument();
  });

  it("moves to the next step from the persistent workflow navigation", async () => {
    render(<RoutesPage />);
    await screen.findByRole("heading", { name: "routes.workflowTitle" });

    await waitFor(() =>
      expect(getOperatorRoutes).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.queryByText("routes.loading")).not.toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /routes.workflowContinue/ }),
    );

    expect(
      screen.getByRole("button", { name: /routes.workflowStopTitle/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("routes.stopManagement")).toBeInTheDocument();
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
        province: "Hồ Chí Minh",
        latitude: 10.77,
        longitude: 106.69,
        supportsShuttle: true,
      },
    });

    render(<RoutesPage />);
    await screen.findByRole("heading", { name: "routes.workflowTitle" });
    await waitFor(() =>
      expect(screen.queryByText("routes.loading")).not.toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "routes.stationName" }),
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
});
