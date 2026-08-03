import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStops,
  getPublicLocations,
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
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: () => <div data-testid="route-map" />,
}));

vi.mock("../../../api/vietride", () => ({
  addRouteStop: vi.fn(),
  createOperatorRoute: vi.fn(),
  createOperatorStation: vi.fn(),
  createOperatorStop: vi.fn(),
  getOperatorRoute: vi.fn(),
  getOperatorRoutes: vi.fn(),
  getOperatorStations: vi.fn(),
  getOperatorStop: vi.fn(),
  getOperatorStops: vi.fn(),
  getPublicLocations: vi.fn(),
  removeRouteStop: vi.fn(),
  searchStations: vi.fn(),
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
    vi.mocked(getOperatorStops).mockResolvedValue(emptyPage);
    vi.mocked(getOperatorStations).mockResolvedValue({
      ...emptyPage,
      pageSize: 100,
    });
    vi.mocked(getPublicLocations).mockResolvedValue([]);
  });

  it("presents the route setup as five understandable steps", async () => {
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
});
