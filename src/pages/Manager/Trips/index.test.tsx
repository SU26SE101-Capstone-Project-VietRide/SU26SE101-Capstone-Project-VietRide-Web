import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  createOperatorDriverSchedule,
  deleteOperatorDriverSchedule,
  getOperatorDriverSchedules,
  getOperatorRoutes,
  getOperatorUsers,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorDriverSchedule,
} from "../../../api/vietride";
import ToastProvider from "../../../components/toast/ToastProvider";
import TripsPage from "./index";
import * as tripHelpers from "./tripHelpers";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.code ? `${key} ${values.code}` : key,
  }),
}));

// client.ts cũng import auth — mock đủ export để import chain không vỡ.
vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ id: "operator-admin-1", role: "OPERATOR_ADMIN" }),
  getAuthSession: () => null,
  refreshAuthSession: async () => null,
}));

vi.mock("../../../api/vietride", () => ({
  activateOperatorDriverSchedule: vi.fn(),
  createOperatorDriverSchedule: vi.fn(),
  deactivateOperatorDriverSchedule: vi.fn(),
  deleteOperatorDriverSchedule: vi.fn(),
  getOperatorDriverSchedules: vi.fn(),
  getOperatorRoutes: vi.fn(),
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
  getVehicleTypes: vi.fn(),
  updateOperatorDriverSchedule: vi.fn(),
}));

// TripsPage gọi useToast — phải render trong ToastProvider như trên App thật.
function renderPage() {
  return render(
    <ToastProvider>
      <TripsPage />
    </ToastProvider>,
  );
}

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
    vi.mocked(getVehicleTypes).mockResolvedValue({
      items: [{ id: "type-1", code: "SLEEPER", displayName: "Xe giường nằm", defaultSeatCount: 40, estimatedPassengerLuggageKgPerSeat: 10, isSystemDefined: true, isActive: true }],
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
          baseFare: null,
          departureTime: "08:00:00",
          effectiveFrom: "2026-09-01",
          validFrom: "2026-09-01",
          isActive: true,
          // Route đính kèm để màn tính được giá vé + giờ đến (điều kiện lưu khi sửa)
          route: {
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

    renderPage();

    // 4 thẻ KPI đều là skeleton, không thẻ nào hiện số 0
    expect(screen.getAllByTestId("stat-card-skeleton")).toHaveLength(4);
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

    renderPage();

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

    renderPage();

    // 3 thẻ danh mục hiện số từ cache ngay, không skeleton
    for (const labelKey of [
      "trips.activeRoutes",
      "trips.availableVehicles",
      "trips.availableDrivers",
    ]) {
      const card = screen.getByText(labelKey).parentElement?.parentElement?.parentElement as HTMLElement;
      expect(within(card).getByText("1")).toBeInTheDocument();
      expect(
        within(card).queryByTestId("stat-card-skeleton"),
      ).not.toBeInTheDocument();
    }

    // Schedules không cache — vẫn load bình thường rồi hiện dữ liệu
    expect(await screen.findByText("SCH-SCHEDULE")).toBeInTheDocument();
    const openCard = screen.getByText("trips.openSchedules")
      .parentElement as HTMLElement;
    expect(
      within(openCard).queryByTestId("stat-card-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("counts ACTIVE driver accounts instead of only AVAILABLE resources", async () => {
    renderPage();

    const label = await screen.findByText("trips.availableDrivers");
    const card = label.parentElement?.parentElement?.parentElement;
    expect(card).not.toBeNull();
    await waitFor(() => {
      expect(within(card as HTMLElement).getByText("1")).toBeInTheDocument();
    });
  });

  it("opens the schedule form modal from the create button", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SCH-SCHEDULE");
    expect(screen.getByText("trips.routeFareFallback")).toBeInTheDocument();
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
    expect(
      within(dialog).queryByText("trips.ticketPrice"),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      frequency: "once",
      optionName: "trips.recurrenceOnce",
      departure: new Date(2026, 7, 21, 1),
      date: "2026-08-21",
      weekday: 5,
      validUntil: "2026-08-21",
    },
    {
      frequency: "weekly",
      optionName: "trips.recurrenceWeekly",
      departure: new Date(2026, 7, 20, 1),
      date: "2026-08-20",
      weekday: 4,
      validUntil: null,
    },
  ])(
    "maps $frequency to the selected weekday and correct validity",
    async ({ frequency, optionName, departure, date, weekday, validUntil }) => {
      const nowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(2026, 7, 19, 12).getTime());
      const nextDepartureSpy = vi
        .spyOn(tripHelpers, "getNextSuggestedDeparture")
        .mockReturnValue(departure);
      const user = userEvent.setup();
      vi.mocked(createOperatorDriverSchedule).mockResolvedValue({
        id: `schedule-${frequency}`,
        operatorId: "operator-1",
        routeId: "route-1",
        vehicleId: "vehicle-1",
        driverUserId: "driver-active",
        assistantUserId: null,
        baseFare: null,
        departureTime: "01:00:00",
        effectiveFrom: date,
        validFrom: date,
        validUntil,
        dayOfWeek: [weekday],
        isActive: false,
      });

      try {
        renderPage();
        await screen.findByText("SCH-SCHEDULE");
        await user.click(
          screen.getByRole("button", { name: "trips.createScheduleTitle" }),
        );

        const dialog = await screen.findByRole("dialog");
        await user.click(
          within(dialog).getByRole("button", {
            name: "trips.suggestNextDeparture",
          }),
        );
        expect(
          within(dialog).getByText(`${date} 01:00`),
        ).toBeInTheDocument();

        await user.click(
          within(dialog).getByRole("button", {
            name: "trips.recurrenceDaily",
          }),
        );
        await user.click(screen.getByRole("option", { name: optionName }));
        await user.click(
          within(dialog).getByRole("button", { name: "trips.saveDraft" }),
        );

        await waitFor(() => {
          expect(createOperatorDriverSchedule).toHaveBeenCalledWith({
            routeId: "route-1",
            vehicleId: "vehicle-1",
            driverUserId: "driver-active",
            assistantUserId: null,
            baseFare: null,
            departureTime: "01:00:00",
            validFrom: date,
            validUntil,
            dayOfWeek: [weekday],
            isActive: false,
          });
        });
      } finally {
        nowSpy.mockRestore();
        nextDepartureSpy.mockRestore();
      }
    },
  );

  it("lets the backend enforce subscription limits when six schedules already exist", async () => {
    vi.mocked(getOperatorDriverSchedules).mockResolvedValue({
      items: Array.from({ length: 6 }, (_, index) => ({
        id: `schedule-${index}`,
        operatorId: "operator-1",
        routeId: "route-1",
        vehicleId: "vehicle-1",
        driverUserId: "driver-active",
        assistantUserId: null,
        baseFare: null,
        departureTime: `${String(index).padStart(2, "0")}:00:00`,
        effectiveFrom: "2026-09-01",
        validFrom: "2026-09-01",
        isActive: true,
        route: {
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
      })),
      page: 1,
      pageSize: 100,
      totalItems: 6,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(createOperatorDriverSchedule).mockRejectedValue(
      new ApiRequestError(
        "Đã đạt giới hạn chuyến trong tháng của gói Enterprise.",
        409,
        "SUBSCRIPTION_LIMIT_EXCEEDED",
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText("SCH-SCHEDULE");
    await user.click(
      screen.getByRole("button", { name: "trips.createScheduleTitle" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "trips.suggestNextDeparture",
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "trips.openForOperation" }),
    );

    await waitFor(() => {
      expect(createOperatorDriverSchedule).toHaveBeenCalledOnce();
    });
    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "Đã đạt giới hạn chuyến trong tháng của gói Enterprise.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the modal prefilled with the schedule when edit is selected", async () => {
    const user = userEvent.setup();
    renderPage();

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

  it("saves an edited schedule through the PATCH API with applyTo and a diff-only patch", async () => {
    vi.mocked(updateOperatorDriverSchedule).mockResolvedValue({
      id: "schedule-12345678",
      operatorId: "operator-1",
      routeId: "route-1",
      vehicleId: "vehicle-1",
      driverUserId: "driver-inactive",
      assistantUserId: null,
      baseFare: null,
      departureTime: "08:00:00",
      effectiveFrom: "2026-09-01",
      validFrom: "2026-09-01",
      isActive: true,
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SCH-SCHEDULE");
    await user.click(screen.getByRole("button", { name: "trips.edit" }));
    const dialog = await screen.findByRole("dialog");

    // Đổi phạm vi áp dụng sang ALL_PENDING
    await user.click(
      within(dialog).getByRole("radio", { name: /trips\.applyToAllPending/ }),
    );

    // Đổi tài xế — field duy nhất thay đổi so với bản gốc
    await user.click(
      within(dialog).getByRole("button", { name: /Tài xế đang hoạt động/ }),
    );
    await user.click(
      screen.getByRole("option", { name: /Tài xế ngừng hoạt động/ }),
    );

    await user.click(
      within(dialog).getByRole("button", { name: "trips.openForOperation" }),
    );

    // Patch chỉ chứa field đã đổi (driverUserId), không gửi field giữ nguyên
    await waitFor(() => {
      expect(updateOperatorDriverSchedule).toHaveBeenCalledWith(
        "schedule-12345678",
        "ALL_PENDING",
        { driverUserId: "driver-inactive" },
      );
    });
    // Feedback thành công hiện dạng toast (portal vào body), không còn banner inline
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent("trips.scheduleUpdated");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });


  it("forces FUTURE_ONLY and sends only baseFare when the schedule fare changes", async () => {
    vi.mocked(updateOperatorDriverSchedule).mockResolvedValue({
      id: "schedule-12345678",
      operatorId: "operator-1",
      routeId: "route-1",
      vehicleId: "vehicle-1",
      driverUserId: "driver-active",
      assistantUserId: null,
      baseFare: 300_000,
      departureTime: "08:00:00",
      effectiveFrom: "2026-09-01",
      validFrom: "2026-09-01",
      isActive: true,
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SCH-SCHEDULE");
    await user.click(screen.getByRole("button", { name: "trips.edit" }));
    const dialog = await screen.findByRole("dialog");
    const allPending = within(dialog).getByRole("radio", {
      name: /trips\.applyToAllPending/,
    });
    await user.click(allPending);
    await user.type(
      within(dialog).getByPlaceholderText("trips.scheduleBaseFarePlaceholder"),
      "300000",
    );

    expect(allPending).toBeDisabled();
    expect(
      within(dialog).getByRole("radio", {
        name: /trips\.applyToFutureOnly/,
      }),
    ).toBeChecked();

    await user.click(
      within(dialog).getByRole("button", { name: "trips.openForOperation" }),
    );

    await waitFor(() => {
      expect(updateOperatorDriverSchedule).toHaveBeenCalledWith(
        "schedule-12345678",
        "FUTURE_ONLY",
        { baseFare: 300_000 },
      );
    });
  });
  it("deletes a schedule after confirming in the modal", async () => {
    vi.mocked(deleteOperatorDriverSchedule).mockResolvedValue({
      deleted: true,
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SCH-SCHEDULE");
    await user.click(
      screen.getByRole("button", { name: "trips.deleteSchedule" }),
    );

    // Modal confirm hiện mã lịch — chưa gọi API cho tới khi xác nhận
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("trips.deleteScheduleConfirm SCH-SCHEDULE"),
    ).toBeInTheDocument();
    expect(deleteOperatorDriverSchedule).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: "trips.deleteSchedule" }),
    );

    await waitFor(() => {
      expect(deleteOperatorDriverSchedule).toHaveBeenCalledWith(
        "schedule-12345678",
      );
    });
    // Toast xác nhận xoá thành công thay cho banner inline
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent("trips.scheduleDeleted");
    expect(screen.queryByText("SCH-SCHEDULE")).not.toBeInTheDocument();
  });

  it("shows the has-trips message when delete fails with 409 SCHEDULE_HAS_TRIPS", async () => {
    vi.mocked(deleteOperatorDriverSchedule).mockRejectedValue(
      new ApiRequestError("Schedule has generated trips", 409, "SCHEDULE_HAS_TRIPS"),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("SCH-SCHEDULE");
    await user.click(
      screen.getByRole("button", { name: "trips.deleteSchedule" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "trips.deleteSchedule" }),
    );

    // Toast lỗi rõ ràng: lịch đã sinh chuyến — gợi ý tắt thay vì xoá; lịch vẫn còn
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent("trips.deleteHasTrips");
    expect(toast).toHaveAttribute("role", "alert");
    expect(screen.getByText("SCH-SCHEDULE")).toBeInTheDocument();
  });
});
