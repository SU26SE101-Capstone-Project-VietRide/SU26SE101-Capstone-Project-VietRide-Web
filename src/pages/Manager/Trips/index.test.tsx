import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorDriverSchedules,
  getOperatorRoutes,
  getOperatorUsers,
  getOperatorVehicles,
} from "../../../api/vietride";
import TripsPage from "./index";

const scrollIntoViewMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.code ? `${key} ${values.code}` : key,
  }),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

vi.mock("./TripOperationsPanel", () => ({
  default: () => <div>trip-operations-panel</div>,
}));

vi.mock("../../../api/vietride", () => ({
  activateOperatorDriverSchedule: vi.fn(),
  createOperatorDriverSchedule: vi.fn(),
  getOperatorDriverSchedules: vi.fn(),
  getOperatorRoutes: vi.fn(),
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
}));

describe("TripsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scrollIntoViewMock.mockClear();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    vi.mocked(getOperatorRoutes).mockResolvedValue({
      items: [
        {
          id: "route-1",
          operatorId: "operator-1",
          name: "Hồ Chí Minh - Đà Lạt",
          originStationId: "origin-1",
          destinationStationId: "destination-1",
          totalDistanceKm: 300,
          estimatedDurationMinutes: 420,
          baseFare: 250_000,
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorVehicles).mockResolvedValue({
      items: [
        {
          vehicleId: "vehicle-1",
          operatorId: "operator-1",
          vehicleTypeId: "type-1",
          licensePlate: "51B-123.45",
          totalSeats: 40,
          maxCargoWeightKg: 1_000,
          status: "ACTIVE",
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorUsers).mockResolvedValue({
      items: [
        {
          userId: "driver-active",
          email: "active@operator.vn",
          displayName: "Tài xế đang hoạt động",
          role: "DRIVER",
          status: "ACTIVE",
          operatorId: "operator-1",
        },
        {
          userId: "driver-inactive",
          email: "inactive@operator.vn",
          displayName: "Tài xế ngừng hoạt động",
          role: "DRIVER",
          status: "INACTIVE",
          operatorId: "operator-1",
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorDriverSchedules).mockResolvedValue({
      items: [
        {
          id: "schedule-12345678",
          operatorId: "operator-1",
          routeId: "route-1",
          vehicleId: "vehicle-1",
          driverUserId: "driver-active",
          assistantUserId: null,
          departureTime: "08:00:00",
          effectiveFrom: "2026-09-01",
          validFrom: "2026-09-01",
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("counts ACTIVE driver accounts instead of only AVAILABLE resources", async () => {
    render(<TripsPage />);

    const label = await screen.findByText("trips.availableDrivers");
    const card = label.parentElement;
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByText("trips.activeDriversHelper"),
    ).toBeInTheDocument();
  });

  it("scrolls and focuses the schedule form when edit is selected", async () => {
    const user = userEvent.setup();
    render(<TripsPage />);

    await screen.findByText("SCH-SCHEDULE");
    await user.click(screen.getByRole("button", { name: "trips.edit" }));

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    const editRegion = screen.getByRole("region", {
      name: /trips\.editScheduleTitle/,
    });
    expect(editRegion).toHaveFocus();
  });
});
