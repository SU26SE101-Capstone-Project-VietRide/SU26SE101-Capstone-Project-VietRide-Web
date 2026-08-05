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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.code ? `${key} ${values.code}` : key,
  }),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ id: "operator-admin-1", role: "OPERATOR_ADMIN" }),
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
    // Cache danh mục nằm trong sessionStorage — dọn giữa các test
    sessionStorage.clear();

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

  it("shows skeletons instead of zeros and empty-state while loading", () => {
    // Backend chậm: cả 4 request treo — màn phải hiện skeleton, không hiện "0"
    vi.mocked(getOperatorRoutes).mockReturnValue(new Promise<never>(() => {}));
    vi.mocked(getOperatorVehicles).mockReturnValue(
      new Promise<never>(() => {}),
    );
    vi.mocked(getOperatorUsers).mockReturnValue(new Promise<never>(() => {}));
    vi.mocked(getOperatorDriverSchedules).mockReturnValue(
      new Promise<never>(() => {}),
    );

    render(<TripsPage />);

    // 4 thẻ KPI đều là skeleton, không thẻ nào hiện số 0
    expect(screen.getAllByTestId("metric-card-skeleton")).toHaveLength(4);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // Bảng hiện hàng skeleton thay vì empty-state "chưa có lịch"
    expect(screen.getByTestId("schedules-table-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("trips.noSchedules")).not.toBeInTheDocument();
  });

  it("shows empty-state only after schedules finished loading", async () => {
    vi.mocked(getOperatorDriverSchedules).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    render(<TripsPage />);

    expect(await screen.findByText("trips.noSchedules")).toBeInTheDocument();
    expect(
      screen.queryByTestId("schedules-table-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("renders cached resources immediately without resource skeletons", async () => {
    // Cache danh mục theo user hiện tại — API danh mục treo nhưng KPI vẫn có số ngay
    sessionStorage.setItem(
      "vietride:tripResources:operator-admin-1",
      JSON.stringify({
        ts: Date.now(),
        data: {
          routes: [
            {
              id: "route-1",
              name: "Hồ Chí Minh - Đà Lạt",
              origin: "Bến xe Miền Đông",
              destination: "Bến xe Đà Lạt",
              status: "active",
              distanceKm: 300,
              durationMinutes: 420,
            },
          ],
          vehicles: [
            {
              id: "vehicle-1",
              plate: "51B-123.45",
              seats: 40,
              status: "available",
            },
          ],
          staff: [
            {
              id: "driver-active",
              name: "Tài xế đang hoạt động",
              role: "driver",
              status: "active",
            },
          ],
        },
      }),
    );
    vi.mocked(getOperatorRoutes).mockReturnValue(new Promise<never>(() => {}));
    vi.mocked(getOperatorVehicles).mockReturnValue(
      new Promise<never>(() => {}),
    );
    vi.mocked(getOperatorUsers).mockReturnValue(new Promise<never>(() => {}));

    render(<TripsPage />);

    // 3 thẻ danh mục hiện số từ cache ngay, không skeleton
    for (const labelKey of [
      "trips.activeRoutes",
      "trips.availableVehicles",
      "trips.availableDrivers",
    ]) {
      const card = screen.getByText(labelKey).parentElement as HTMLElement;
      expect(within(card).getByText("1")).toBeInTheDocument();
      expect(
        within(card).queryByTestId("metric-card-skeleton"),
      ).not.toBeInTheDocument();
    }

    // Schedules không cache — vẫn load bình thường rồi hiện dữ liệu
    expect(await screen.findByText("SCH-SCHEDULE")).toBeInTheDocument();
    const openCard = screen.getByText("trips.openSchedules")
      .parentElement as HTMLElement;
    expect(
      within(openCard).queryByTestId("metric-card-skeleton"),
    ).not.toBeInTheDocument();
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

  it("opens the schedule form modal from the create button", async () => {
    const user = userEvent.setup();
    render(<TripsPage />);

    await screen.findByText("SCH-SCHEDULE");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "trips.createScheduleTitle" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("trips.createScheduleTitle"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("trips.businessRules"),
    ).toBeInTheDocument();
  });

  it("opens the modal prefilled with the schedule when edit is selected", async () => {
    const user = userEvent.setup();
    render(<TripsPage />);

    await screen.findByText("SCH-SCHEDULE");
    await user.click(screen.getByRole("button", { name: "trips.edit" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("trips.editScheduleTitle SCH-SCHEDULE"),
    ).toBeInTheDocument();
    // Form điền sẵn giờ khởi hành của lịch đang sửa
    expect(within(dialog).getByText("2026-09-01 08:00")).toBeInTheDocument();

    // Đóng modal reset trạng thái sửa
    await user.click(within(dialog).getAllByRole("button", { name: "close" })[0]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
