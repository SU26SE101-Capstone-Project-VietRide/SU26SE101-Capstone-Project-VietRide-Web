import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  checkDriverScheduleAvailability,
  createOperatorDriverSchedule,
  deleteOperatorDriverSchedule,
  getOperatorDriverSchedules,
  getOperatorRoutes,
  getOperatorUsers,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorDriverSchedule,
  updateOperatorDriverScheduleCrew,
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
// getAuthUser dùng vi.fn() (không phải arrow cố định) để test STAFF override
// được role riêng bằng mockReturnValueOnce mà không ảnh hưởng test khác.
const authMock = vi.hoisted(() => ({
  getAuthUser: vi.fn(() => ({ id: "operator-admin-1", role: "OPERATOR_ADMIN" })),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: authMock.getAuthUser,
  getAuthSession: () => null,
  refreshAuthSession: async () => null,
}));

vi.mock("../../../api/vietride", () => ({
  activateOperatorDriverSchedule: vi.fn(),
  checkDriverScheduleAvailability: vi.fn(),
  createOperatorDriverSchedule: vi.fn(),
  deactivateOperatorDriverSchedule: vi.fn(),
  deleteOperatorDriverSchedule: vi.fn(),
  getOperatorDriverSchedules: vi.fn(),
  getOperatorRoutes: vi.fn(),
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
  getVehicleTypes: vi.fn(),
  updateOperatorDriverSchedule: vi.fn(),
  updateOperatorDriverScheduleCrew: vi.fn(),
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
  afterEach(() => {
    // clearAllMocks() không xoá implementation set bằng mockReturnValue —
    // phải tự khôi phục ADMIN mặc định để không rò rỉ role STAFF sang test khác.
    authMock.getAuthUser.mockReturnValue({
      id: "operator-admin-1",
      role: "OPERATOR_ADMIN",
    });
  });

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
          totalSeats: 16,
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
      items: [{ id: "type-1", code: "SHUTTLE_16_SEAT", displayName: "Xe trung chuyển 16 chỗ", defaultSeatCount: 16, estimatedPassengerLuggageKgPerSeat: 10, isSystemDefined: true, isActive: true }],
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
          userId: "driver-secondary",
          email: "secondary@operator.vn",
          displayName: "Tài xế dự phòng",
          role: "DRIVER",
          status: "ACTIVE",
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
          // BE luôn trả dayOfWeek (validator NotEmpty) — mock phải phản ánh đúng
          dayOfWeek: [1, 2, 3, 4, 5, 6, 7],
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

    // 3 thẻ KPI đều là skeleton, không thẻ nào hiện số 0
    expect(screen.getAllByTestId("stat-card-skeleton")).toHaveLength(3);
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

    // Ba KPI đều lấy từ API schedules, nên chờ query thống kê hoàn tất.
    // Thẻ "lịch chạy một lần" đã bỏ: BE không có `isOneTime`, query đó từng bị
    // nuốt im lặng nên thẻ hiển thị đúng bằng tổng số lịch.
    await waitFor(() => {
      for (const labelKey of [
        "trips.totalSchedules",
        "trips.openSchedules",
        "trips.draftSchedules",
      ]) {
        const card = screen.getByText(labelKey).parentElement?.parentElement?.parentElement as HTMLElement;
        expect(within(card).getByText("1")).toBeInTheDocument();
        expect(within(card).queryByTestId("stat-card-skeleton")).not.toBeInTheDocument();
      }
    });

    // Schedules không cache — vẫn load bình thường rồi hiện dữ liệu
    expect(await screen.findByText("Hồ Chí Minh - Đà Lạt")).toBeInTheDocument();
    const openCard = screen.getByText("trips.openSchedules")
      .parentElement as HTMLElement;
    expect(
      within(openCard).queryByTestId("stat-card-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("counts ACTIVE driver accounts instead of only AVAILABLE resources", async () => {
    renderPage();

    const label = await screen.findByText("trips.draftSchedules");
    const card = label.parentElement?.parentElement?.parentElement;
    expect(card).not.toBeNull();
    await waitFor(() => {
      expect(within(card as HTMLElement).getByText("1")).toBeInTheDocument();
    });
  });

  it("opens the schedule form modal from the create button", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
    expect(screen.getByText("250.000 đ")).toBeInTheDocument();
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

  it("searches and selects a route in the schedule form", async () => {
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
        {
          id: "route-2",
          operatorId: "operator-1",
          name: "Hà Nội - Hải Phòng",
          originStationId: "origin-2",
          destinationStationId: "destination-2",
          totalDistanceKm: 120,
          estimatedDurationMinutes: 150,
          baseFare: 180_000,
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Hồ Chí Minh - Đà Lạt");
    await user.click(
      screen.getByRole("button", { name: "trips.createScheduleTitle" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /Hồ Chí Minh - Đà Lạt/ }),
    );
    await user.type(
      screen.getByRole("combobox", { name: "searchOptions" }),
      "hai phong",
    );

    expect(
      screen.queryByRole("option", { name: /Hồ Chí Minh - Đà Lạt/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("option", { name: /Hà Nội - Hải Phòng/ }),
    );
    expect(
      within(dialog).getByRole("button", { name: /Hà Nội - Hải Phòng/ }),
    ).toBeInTheDocument();
  });

  // 2026-08-21 là Thứ 6 (ISO 5)
  function stubCreateFlow(departure: Date) {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date(2026, 7, 19, 12).getTime());
    const nextDepartureSpy = vi
      .spyOn(tripHelpers, "getNextSuggestedDeparture")
      .mockReturnValue(departure);
    vi.mocked(createOperatorDriverSchedule).mockResolvedValue({
      id: "schedule-created",
      operatorId: "operator-1",
      routeId: "route-1",
      vehicleId: "vehicle-1",
      driverUserId: "driver-active",
      assistantUserId: null,
      baseFare: null,
      departureTime: "01:00:00",
      effectiveFrom: "2026-08-21",
      validFrom: "2026-08-21",
      validUntil: null,
      dayOfWeek: [5],
      isActive: false,
    });
    return () => {
      nowSpy.mockRestore();
      nextDepartureSpy.mockRestore();
    };
  }

  it("sends the exact weekday chips the user picked, including combos no preset covers", async () => {
    const restore = stubCreateFlow(new Date(2026, 7, 21, 1));

    try {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Hồ Chí Minh - Đà Lạt");
      await user.click(
        screen.getByRole("button", { name: "trips.createScheduleTitle" }),
      );

      const dialog = await screen.findByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", {
          name: "trips.suggestNextDeparture",
        }),
      );

      // Mặc định bật cả 7 thứ -> tắt hết rồi bật T2/T4/T6 ([1,3,5]).
      // Tổ hợp này 4 preset cũ KHÔNG thể biểu diễn được.
      await user.click(
        within(dialog).getByRole("button", { name: "trips.weekdayPreset.daily" }),
      );
      for (const day of ["tue", "thu", "sat", "sun"]) {
        await user.click(
          within(dialog).getByRole("button", {
            name: `trips.weekdaysShort.${day}`,
          }),
        );
      }

      await user.click(
        within(dialog).getByRole("button", { name: "trips.saveDraftAction" }),
      );

      await waitFor(() => {
        expect(createOperatorDriverSchedule).toHaveBeenCalledWith({
          routeId: "route-1",
          vehicleId: "vehicle-1",
          driverUserId: "driver-active",
          assistantUserId: null,
          baseFare: null,
          departureTime: "01:00:00",
          validFrom: "2026-08-21",
          validUntil: null,
          dayOfWeek: [1, 3, 5],
          isActive: false,
        });
      });
    } finally {
      restore();
    }
  });

  // Preview gửi ĐÚNG draft sắp submit (trừ isActive/baseFare chỉ có ở create),
  // vì thứ tự/nội dung payload quyết định kết quả availability (handoff mục 11.1).
  it("previews availability with the same draft that create would send", async () => {
    const restore = stubCreateFlow(new Date(2026, 7, 21, 1));

    try {
      vi.mocked(checkDriverScheduleAvailability).mockResolvedValue({
        available: true,
        turnaroundMinutes: 30,
        conflicts: [],
        hasMore: false,
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Hồ Chí Minh - Đà Lạt");
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
        within(dialog).getByRole("button", { name: "resourceConflict.check" }),
      );

      await waitFor(() => {
        expect(checkDriverScheduleAvailability).toHaveBeenCalledWith({
          routeId: "route-1",
          vehicleId: "vehicle-1",
          driverUserId: "driver-active",
          assistantUserId: null,
          departureTime: "01:00:00",
          validFrom: "2026-08-21",
          validUntil: null,
          dayOfWeek: [1, 2, 3, 4, 5, 6, 7],
        });
      });
      // Preview không tự lưu — create chỉ chạy khi bấm nút lưu.
      expect(createOperatorDriverSchedule).not.toHaveBeenCalled();
      expect(
        await within(dialog).findByText("resourceConflict.previewOk"),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  // available=false vẫn là HTTP 200 — nếu không render thì user không hề biết
  // có xung đột (handoff mục 6.1 và checklist 14.3).
  it("renders conflicts returned by a successful preview response", async () => {
    const restore = stubCreateFlow(new Date(2026, 7, 21, 1));

    try {
      vi.mocked(checkDriverScheduleAvailability).mockResolvedValue({
        available: false,
        turnaroundMinutes: 30,
        conflicts: [
          {
            resourceRole: "ASSISTANT",
            resourceId: "assistant-1",
            reason: "REPOSITION_REQUIRED",
            conflictingSourceType: "TRIP",
            conflictingSourceId: "trip-9",
            sampleRequestedStartAt: "2026-08-21T10:01:00+07:00",
            blockingUntil: "2026-08-21T12:30:00+07:00",
            earliestFeasibleStartAt: null,
            requiredTravelMinutes: 120,
            turnaroundMinutes: 30,
          },
        ],
        hasMore: false,
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Hồ Chí Minh - Đà Lạt");
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
        within(dialog).getByRole("button", { name: "resourceConflict.check" }),
      );

      expect(
        await within(dialog).findByText(/resourceConflict\.summary/),
      ).toBeInTheDocument();
      // Role phải lấy từ conflict, không suy từ error code (ASSISTANT dùng
      // chung code TRIP_DRIVER_CONFLICT với DRIVER).
      expect(
        within(dialog).getByText(/resourceConflict\.role\.ASSISTANT/),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText("resourceConflict.noFeasibleStart"),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  // Alias /crew luôn chạy applyTo=ALL_PENDING nên đổi crew ở đây cascade sang
  // các chuyến đã sinh; modal sửa mặc định FUTURE_ONLY thì không (mục 7.5).
  it("đổi crew qua alias /crew và gửi null khi bỏ phụ xe", async () => {
    vi.mocked(updateOperatorDriverScheduleCrew).mockResolvedValue({
      id: "schedule-12345678",
      driverUserId: "driver-active",
    } as never);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Hồ Chí Minh - Đà Lạt");

    await user.click(screen.getByRole("button", { name: "trips.changeCrew" }));

    const dialog = await screen.findByRole("dialog");
    // Cảnh báo cascade phải hiện, nếu không operator tưởng chỉ đổi lịch tương lai.
    expect(
      within(dialog).getByText("trips.changeCrewCascadeNotice"),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "trips.changeCrewAction" }),
    );

    await waitFor(() => {
      expect(updateOperatorDriverScheduleCrew).toHaveBeenCalledWith(
        "schedule-12345678",
        { driverUserId: "driver-active", assistantUserId: null },
      );
    });
    // Không được đi qua endpoint update thường.
    expect(updateOperatorDriverSchedule).not.toHaveBeenCalled();
  });

  it("pins a one-time schedule to the departure weekday and closes the date range", async () => {
    const restore = stubCreateFlow(new Date(2026, 7, 21, 1));

    try {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Hồ Chí Minh - Đà Lạt");
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
        within(dialog).getByRole("button", {
          name: "trips.scheduleKindRepeat",
        }),
      );
      await user.click(
        screen.getByRole("option", { name: "trips.scheduleKindOnce" }),
      );

      // Chọn "một lần" thì không còn ô chọn thứ / ngày kết thúc
      expect(
        within(dialog).queryByText("trips.weekdaysLabel"),
      ).not.toBeInTheDocument();
      expect(
        within(dialog).queryByText("trips.validUntil"),
      ).not.toBeInTheDocument();

      await user.click(
        within(dialog).getByRole("button", { name: "trips.saveDraftAction" }),
      );

      await waitFor(() => {
        expect(createOperatorDriverSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            validFrom: "2026-08-21",
            // Chặn hai đầu cùng ngày + đúng thứ của ngày đó (Thứ 6 = ISO 5)
            validUntil: "2026-08-21",
            dayOfWeek: [5],
          }),
        );
      });
    } finally {
      restore();
    }
  });

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

    await screen.findAllByText("Hồ Chí Minh - Đà Lạt");
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

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
    await user.click(screen.getByRole("button", { name: "trips.edit" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("trips.editScheduleTitle"),
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
      driverUserId: "driver-secondary",
      assistantUserId: null,
      baseFare: null,
      departureTime: "08:00:00",
      effectiveFrom: "2026-09-01",
      validFrom: "2026-09-01",
      isActive: true,
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
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
      screen.getAllByRole("option", { name: /Tài xế dự phòng/ })[0],
    );

    await user.click(
      within(dialog).getByRole("button", { name: "trips.openForOperation" }),
    );

    // Patch chỉ chứa field đã đổi (driverUserId), không gửi field giữ nguyên
    await waitFor(() => {
      expect(updateOperatorDriverSchedule).toHaveBeenCalledWith(
        "schedule-12345678",
        "ALL_PENDING",
        { driverUserId: "driver-secondary" },
      );
    });
    // Feedback thành công hiện dạng toast (portal vào body), không còn banner inline
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent("trips.scheduleUpdated");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });


  it("sends only the changed weekday chips in the patch", async () => {
    // Lịch gốc: chạy hằng tuần vào Thứ 2 (dayOfWeek [1]), không giới hạn ngày kết thúc
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
          effectiveFrom: "2026-08-17",
          validFrom: "2026-08-17",
          validUntil: null,
          dayOfWeek: [1],
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
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(updateOperatorDriverSchedule).mockResolvedValue({
      id: "schedule-12345678",
      operatorId: "operator-1",
      routeId: "route-1",
      vehicleId: "vehicle-1",
      driverUserId: "driver-active",
      assistantUserId: null,
      baseFare: null,
      departureTime: "01:00:00",
      effectiveFrom: "2026-08-17",
      validFrom: "2026-08-17",
      validUntil: null,
      dayOfWeek: [5],
      isActive: true,
    });

    // Trước ngày khởi hành 17-08 để lịch còn hợp lệ (không rơi vào quá khứ)
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date(2026, 7, 15, 12).getTime());

    try {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText("Hồ Chí Minh - Đà Lạt");
      await user.click(screen.getByRole("button", { name: "trips.edit" }));
      const dialog = await screen.findByRole("dialog");

      // Lịch gốc chạy Thứ 2 -> chỉ chip T2 đang bật
      expect(
        within(dialog).getByRole("button", { name: "trips.weekdaysShort.mon" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(dialog).getByRole("button", { name: "trips.weekdaysShort.fri" }),
      ).toHaveAttribute("aria-pressed", "false");

      // Chuyển sang chạy Thứ 6: tắt T2, bật T6
      await user.click(
        within(dialog).getByRole("button", { name: "trips.weekdaysShort.mon" }),
      );
      await user.click(
        within(dialog).getByRole("button", { name: "trips.weekdaysShort.fri" }),
      );

      await user.click(
        within(dialog).getByRole("button", { name: "trips.openForOperation" }),
      );

      await waitFor(() => {
        expect(updateOperatorDriverSchedule).toHaveBeenCalledWith(
          "schedule-12345678",
          "FUTURE_ONLY",
          { dayOfWeek: [5] },
        );
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("leaves the optional assistant empty instead of auto-picking the first one", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
    await user.click(
      screen.getByRole("button", { name: "trips.createScheduleTitle" }),
    );

    const dialog = await screen.findByRole("dialog");
    const assistantField = within(dialog)
      .getByText("trips.assistant")
      .parentElement as HTMLElement;

    // assistantUserId là nullable ở BE — form không được tự gán người đầu danh
    // sách, nếu không mọi lịch đều âm thầm có phụ xe người tạo chưa hề chọn.
    expect(
      within(assistantField).getByText("trips.noAssistant"),
    ).toBeInTheDocument();
  });

  it("sends the schedule end date as validUntil and keeps the arrival estimate read-only", async () => {
    // Lịch gốc chạy hằng ngày, kết thúc 30-09-2026
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
          validUntil: "2026-09-30",
          dayOfWeek: [1, 2, 3, 4, 5, 6, 7],
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
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(updateOperatorDriverSchedule).mockResolvedValue({
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
      validUntil: "2026-09-25",
      dayOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isActive: true,
    });

    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date(2026, 7, 19, 12).getTime());

    try {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText("Hồ Chí Minh - Đà Lạt");
      await user.click(screen.getByRole("button", { name: "trips.edit" }));
      const dialog = await screen.findByRole("dialog");

      // "Dự kiến đến" là giá trị hệ thống tự tính — hiển thị thuần, không có
      // control nào để bấm/nhập (trước đây là input cho sửa rồi âm thầm bỏ đi)
      const arrivalField = within(dialog)
        .getByText("trips.arrivalEstimate")
        .parentElement as HTMLElement;
      expect(arrivalField.querySelector("button")).toBeNull();
      expect(arrivalField.querySelector("input")).toBeNull();
      // Giờ đến suy ra từ 08:00 + 420 phút thời lượng tuyến, viết cùng thứ tự
      // yyyy-MM-dd HH:mm với ô "Ngày & giờ khởi hành" ngay bên cạnh
      expect(
        within(arrivalField).getByText("2026-09-01 15:00"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText("trips.arrivalEstimateHint"),
      ).toBeInTheDocument();

      // Ô ngày kết thúc phải hiện sẵn giá trị đang lưu
      const validUntilField = within(dialog)
        .getByText("trips.validUntil")
        .parentElement as HTMLElement;
      expect(within(validUntilField).getByText("2026-09-30")).toBeInTheDocument();

      // Đổi sang 25-09-2026 qua lịch (lịch mở đúng tháng 9 vì đã có giá trị).
      // Ô ngày dùng aria-label ISO nên tên khả truy cập là "2026-09-25", không phải "25".
      await user.click(validUntilField.querySelector("button") as HTMLElement);
      await user.click(await screen.findByRole("button", { name: "2026-09-25" }));

      await user.click(
        within(dialog).getByRole("button", { name: "trips.openForOperation" }),
      );

      await waitFor(() => {
        expect(updateOperatorDriverSchedule).toHaveBeenCalledWith(
          "schedule-12345678",
          "FUTURE_ONLY",
          { validUntil: "2026-09-25" },
        );
      });
    } finally {
      nowSpy.mockRestore();
    }
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

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
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

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
    await user.click(
      screen.getByRole("button", { name: "trips.deleteSchedule" }),
    );

    // Modal confirm hiện mã lịch — chưa gọi API cho tới khi xác nhận
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("trips.deleteScheduleConfirm"),
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
    expect(screen.queryByText("Hồ Chí Minh - Đà Lạt")).not.toBeInTheDocument();
  });

  it("shows the has-trips message when delete fails with 409 SCHEDULE_HAS_TRIPS", async () => {
    vi.mocked(deleteOperatorDriverSchedule).mockRejectedValue(
      new ApiRequestError("Schedule has generated trips", 409, "SCHEDULE_HAS_TRIPS"),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Hồ Chí Minh - Đà Lạt");
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
    expect(screen.getByText("Hồ Chí Minh - Đà Lạt")).toBeInTheDocument();
  });

  // routeId + driverUserId BE nhận sẵn từ đầu, màn chỉ thiếu ô chọn.
  it("gửi routeId và driverUserId khi lọc theo tuyến / tài xế", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Hồ Chí Minh - Đà Lạt");

    // Tên tuyến/tài xế còn xuất hiện ở các select của form tạo lịch — chỉ tìm
    // trong listbox đang mở, nếu không sẽ khớp nhiều phần tử.
    async function pickOption(filterLabel: string, optionName: string) {
      await user.click(screen.getByRole("button", { name: filterLabel }));
      const listbox = screen.getByRole("listbox");
      await user.click(within(listbox).getByRole("option", { name: optionName }));
    }

    await pickOption("trips.filterRoute", "Hồ Chí Minh - Đà Lạt");

    await waitFor(() =>
      expect(getOperatorDriverSchedules).toHaveBeenLastCalledWith(
        expect.objectContaining({ routeId: "route-1", page: 1 }),
      ),
    );

    // Bộ lọc tài xế nằm trong panel lọc nâng cao, phải mở panel trước.
    await user.click(screen.getByRole("button", { name: /trips\.advancedFilters/ }));
    await pickOption("trips.filterDriver", "Tài xế đang hoạt động");

    await waitFor(() =>
      expect(getOperatorDriverSchedules).toHaveBeenLastCalledWith(
        // Hai bộ lọc cộng dồn theo AND
        expect.objectContaining({
          routeId: "route-1",
          driverUserId: "driver-active",
        }),
      ),
    );
  });
});
