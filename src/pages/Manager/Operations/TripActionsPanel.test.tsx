import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeOperatorTripRoute,
  disruptOperatorTripNoSubstitution,
  getAlternativeRoutes,
  getOperatorTripCargoCapacity,
  getPublicTripSeatMap,
  substituteOperatorTripVehicle,
  type AlternativeRoute,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import TripActionsPanel, { type TripActionsContext } from "./TripActionsPanel";
import { useToastFeedback } from "../../../hooks/useToastFeedback";

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

// `t` phải nội suy được: nhãn xe thay giờ mang số ghế và mức thiếu, không nội
// suy thì mọi option ra cùng một chuỗi và test không phân biệt được xe nào.
// `defaultValue` bị loại vì nó là fallback của i18next, không phải biến hiển thị.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const entries = Object.entries(vars ?? {}).filter(
        ([name]) => name !== "defaultValue",
      );
      return entries.length === 0
        ? key
        : `${key} ${entries.map(([name, value]) => `${name}=${value}`).join(" ")}`;
    },
  }),
}));

vi.mock("../../../api/vietride", () => ({
  changeOperatorTripRoute: vi.fn(),
  disruptOperatorTripNoSubstitution: vi.fn(),
  getAlternativeRoutes: vi.fn(),
  getOperatorTripCargoCapacity: vi.fn(),
  getPublicTripSeatMap: vi.fn(),
  substituteOperatorTripVehicle: vi.fn(),
}));

/** Sơ đồ ghế giả: `booked` ghế BOOKED + phần còn lại AVAILABLE. */
function seatMap(booked: number, total = 40) {
  return {
    tripId: "trip-1",
    vehicleType: "SEAT_40",
    seats: Array.from({ length: total }, (_, index) => ({
      seatNumber: `A${index + 1}`,
      status: index < booked ? "BOOKED" : "AVAILABLE",
      type: "SEAT",
      row: index,
      col: 1,
      deck: 1,
    })),
  };
}

// Panel nhận đúng mảnh dữ liệu nó dùng, không nhận nguyên item danh sách chuyến
// — nhờ vậy modal Báo cáo sự cố ghép được từ nhiều nguồn và dùng lại cùng panel.
const tripProp: TripActionsContext = {
  status: "SCHEDULED",
  routeId: "route-1",
  vehicleId: "vehicle-1",
  canSubstituteVehicle: true,
};

// Xe và nhân sự do trang cha tải sẵn và truyền xuống qua props
const vehiclesProp: OperatorVehicle[] = [
  {
    id: "vehicle-2",
    operatorId: "operator-1",
    licensePlate: "51B-999.99",
    vehicleTypeId: "type-1",
    totalSeats: 40,
    maxCargoWeightKg: 500,
    maxCargoVolumeM3: 5,
    status: "ACTIVE",
  },
];

// Xe 16 chỗ dùng để dựng tình huống thiếu ghế; `usablePassengerCapacity` mới là
// con số đúng (đã trừ ghế vô hiệu + khu vực tài xế), `totalSeats` chỉ là dự phòng.
const smallVehicle: OperatorVehicle = {
  id: "vehicle-3",
  operatorId: "operator-1",
  licensePlate: "51B-111.11",
  vehicleTypeId: "type-2",
  totalSeats: 16,
  usablePassengerCapacity: 16,
  maxCargoWeightKg: 200,
  maxCargoVolumeM3: 2,
  status: "ACTIVE",
};

const staffProp: OperatorUser[] = [
  {
    userId: "driver-2",
    email: "driver@operator.vn",
    displayName: "Driver Two",
    role: "DRIVER",
    status: "ACTIVE",
    operatorId: "operator-1",
  },
];

// Tuyến thay thế trả về từ API — bản active và bản inactive (bị lọc khỏi danh sách)
const activeAlternative: AlternativeRoute = {
  id: "alt-1",
  routeId: "route-1",
  name: "Tuyến tránh đèo",
  description: "Đi quốc lộ 20",
  destinationStationId: "station-9",
  totalDistanceKm: 320,
  estimatedDurationMinutes: 480,
  isActive: true,
  stops: [],
};

const inactiveAlternative: AlternativeRoute = {
  ...activeAlternative,
  id: "alt-2",
  name: "Tuyến cũ ngưng dùng",
  isActive: false,
};

function alternativesResult(items: AlternativeRoute[]) {
  return {
    items,
    totalItems: items.length,
    page: 1,
    pageSize: 2,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function renderPanel(
  onTripReplaced = vi.fn(),
  trip: TripActionsContext | null = tripProp,
  canMutate = true,
) {
  render(
    <MemoryRouter>
      <TripActionsPanel
        tripId="trip-1"
        trip={trip}
        vehicles={vehiclesProp}
        staff={staffProp}
        canMutate={canMutate}
        onTripReplaced={onTripReplaced}
      />
    </MemoryRouter>,
  );
  return onTripReplaced;
}

describe("TripActionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mặc định: 10 khách trên xe 40 chỗ -> xe thay 40 chỗ thừa ghế, không cảnh báo
    vi.mocked(getPublicTripSeatMap).mockResolvedValue(seatMap(10));
    vi.mocked(getOperatorTripCargoCapacity).mockResolvedValue({
      tripId: "trip-1",
      maxCargoWeightKg: 500,
      reservedWeightKg: 100,
      loadedWeightKg: 50,
      percentFull: 30,
    });
    vi.mocked(substituteOperatorTripVehicle).mockResolvedValue({
      tripId: "trip-2",
      oldTripId: "trip-1",
      newTripId: "trip-2",
      status: "SCHEDULED",
    });
    vi.mocked(disruptOperatorTripNoSubstitution).mockResolvedValue({
      tripId: "trip-1",
      status: "DISRUPTED",
    });
    vi.mocked(getAlternativeRoutes).mockResolvedValue(
      alternativesResult([activeAlternative, inactiveAlternative]),
    );
    vi.mocked(changeOperatorTripRoute).mockResolvedValue({
      tripId: "trip-1",
      status: "ROUTE_CHANGED",
      alternativeRouteId: "alt-1",
      affectedBookings: [],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads cargo capacity for the selected trip", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      screen.getByRole("button", { name: "tripOperations.loadCapacity" }),
    );

    expect(getOperatorTripCargoCapacity).toHaveBeenCalledWith("trip-1");
    expect(await screen.findByText("500 kg")).toBeInTheDocument();
  });

  it("substitutes a vehicle with the selected crew and reason", async () => {
    const user = userEvent.setup();
    const onTripReplaced = renderPanel();

    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(
      screen.getByRole("option", { name: /plate=51B-999\.99 seats=40/ }),
    );
    await user.click(screen.getByLabelText("tripOperations.driver"));
    await user.click(screen.getByRole("option", { name: "Driver Two" }));
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );

    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(substituteOperatorTripVehicle).toHaveBeenCalledWith(
      "trip-1",
      expect.objectContaining({
        replacementVehicleId: "vehicle-2",
        estimatedRecoveryDepartureAt: expect.any(String),
        reason: "Breakdown",
        notifyPassengers: true,
        replacementCrew: {
          driverId: "driver-2",
          assistantId: null,
        },
      }),
    );
    // Trang cha được báo để chuyển selection + URL sang chuyến mới
    expect(onTripReplaced).toHaveBeenCalledWith("trip-2");
  });

  describe("kiểm tra đủ ghế trước khi thay xe", () => {
    // Panel tải sơ đồ ghế lúc mount; các test dưới đổi mock TRƯỚC khi render.
    function renderWithSeats(booked: number, onSubstituted = vi.fn()) {
      vi.mocked(getPublicTripSeatMap).mockResolvedValue(seatMap(booked));
      render(
        <MemoryRouter>
          <TripActionsPanel
            tripId="trip-1"
            trip={tripProp}
            vehicles={[vehiclesProp[0], smallVehicle]}
            staff={staffProp}
            canMutate
            onSubstituted={onSubstituted}
          />
        </MemoryRouter>,
      );
      return onSubstituted;
    }

    async function chooseVehicle(
      user: ReturnType<typeof userEvent.setup>,
      pattern: RegExp,
    ) {
      await user.click(screen.getByLabelText("tripOperations.vehicle"));
      await user.click(await screen.findByRole("option", { name: pattern }));
    }

    it("gắn nhãn thiếu bao nhiêu ghế và xếp xe đủ ghế lên trước", async () => {
      const user = userEvent.setup();
      renderWithSeats(30);

      await user.click(screen.getByLabelText("tripOperations.vehicle"));

      // 30 khách: xe 40 chỗ đủ, xe 16 chỗ thiếu 14
      const options = await screen.findAllByRole("option");
      const labels = options.map((option) => option.textContent ?? "");
      expect(labels[1]).toContain("vehicleSeatsOption");
      expect(labels[1]).toContain("plate=51B-999.99");
      expect(labels[2]).toContain("vehicleSeatsShortOption");
      expect(labels[2]).toContain("missing=14");
    });

    it("chặn thay xe khi thiếu ghế mà chưa tick xác nhận", async () => {
      const user = userEvent.setup();
      renderWithSeats(30);

      await chooseVehicle(user, /plate=51B-111\.11/);
      await user.click(screen.getByLabelText("tripOperations.driver"));
      await user.click(screen.getByRole("option", { name: "Driver Two" }));
      await user.type(
        screen.getByLabelText("tripOperations.reason"),
        "Breakdown",
      );

      expect(
        screen.getByText(/tripOperations\.seatShortageBody/),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "tripOperations.substitute" }),
      );

      // Không mở cả modal xác nhận, tức là chưa hề gọi API
      expect(
        screen.queryByRole("button", { name: "confirm" }),
      ).not.toBeInTheDocument();
      expect(substituteOperatorTripVehicle).not.toHaveBeenCalled();
    });

    it("cho thay xe thiếu ghế sau khi tick xác nhận", async () => {
      const user = userEvent.setup();
      renderWithSeats(30);

      await chooseVehicle(user, /plate=51B-111\.11/);
      await user.click(screen.getByLabelText("tripOperations.driver"));
      await user.click(screen.getByRole("option", { name: "Driver Two" }));
      await user.type(
        screen.getByLabelText("tripOperations.reason"),
        "Breakdown",
      );
      await user.click(
        screen.getByRole("checkbox", { name: /seatShortageAck/ }),
      );
      await user.click(
        screen.getByRole("button", { name: "tripOperations.substitute" }),
      );
      await user.click(screen.getByRole("button", { name: "confirm" }));

      expect(substituteOperatorTripVehicle).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ replacementVehicleId: "vehicle-3" }),
      );
    });

    // Tick cho xe 16 chỗ không được tính sang xe khác — đổi xe là phải cân nhắc lại
    it("xoá tick xác nhận khi đổi sang xe khác", async () => {
      const user = userEvent.setup();
      renderWithSeats(30);

      await chooseVehicle(user, /plate=51B-111\.11/);
      await user.click(
        screen.getByRole("checkbox", { name: /seatShortageAck/ }),
      );
      expect(
        screen.getByRole("checkbox", { name: /seatShortageAck/ }),
      ).toBeChecked();

      await chooseVehicle(user, /plate=51B-999\.99/);
      await chooseVehicle(user, /plate=51B-111\.11/);

      expect(
        screen.getByRole("checkbox", { name: /seatShortageAck/ }),
      ).not.toBeChecked();
    });

    it("không cảnh báo khi không đọc được sơ đồ ghế", async () => {
      const user = userEvent.setup();
      vi.mocked(getPublicTripSeatMap).mockRejectedValue(new Error("boom"));
      render(
        <MemoryRouter>
          <TripActionsPanel
            tripId="trip-1"
            trip={tripProp}
            vehicles={[vehiclesProp[0], smallVehicle]}
            staff={staffProp}
            canMutate
          />
        </MemoryRouter>,
      );

      // Nói thẳng là không kiểm được, và KHÔNG chặn thao tác
      expect(
        await screen.findByText(/tripOperations\.seatCountUnknown/),
      ).toBeInTheDocument();
      await chooseVehicle(user, /plate=51B-111\.11/);
      expect(
        screen.queryByText(/tripOperations\.seatShortageBody/),
      ).not.toBeInTheDocument();
    });

    it("đẩy kết quả thay xe lên trang cha kèm số khách chưa có ghế", async () => {
      const user = userEvent.setup();
      vi.mocked(substituteOperatorTripVehicle).mockResolvedValue({
        tripId: "trip-2",
        oldTripId: "trip-1",
        newTripId: "trip-2",
        status: "SCHEDULED",
        affectedBookingCount: 12,
        affectedPassengerCount: 30,
        pendingSeatAssignmentCount: 14,
      });
      const onSubstituted = renderWithSeats(30);

      await chooseVehicle(user, /plate=51B-111\.11/);
      await user.click(screen.getByLabelText("tripOperations.driver"));
      await user.click(screen.getByRole("option", { name: "Driver Two" }));
      await user.type(
        screen.getByLabelText("tripOperations.reason"),
        "Breakdown",
      );
      await user.click(
        screen.getByRole("checkbox", { name: /seatShortageAck/ }),
      );
      await user.click(
        screen.getByRole("button", { name: "tripOperations.substitute" }),
      );
      await user.click(screen.getByRole("button", { name: "confirm" }));

      // Trang cha phải nhận được kết quả: panel bị remount sau khi đổi chuyến
      await waitFor(() =>
        expect(onSubstituted).toHaveBeenCalledWith(
          expect.objectContaining({ pendingSeatAssignmentCount: 14 }),
        ),
      );
      expect(
        await screen.findByText(/substitutionResultPendingHint/),
      ).toBeInTheDocument();
      expect(screen.getByText("14")).toBeInTheDocument();
    });
  });

  it("disrupts the selected trip with a reason after confirm", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("tripOperations.reason"), "Storm");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.disrupt" }),
    );

    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(disruptOperatorTripNoSubstitution).toHaveBeenCalledWith("trip-1", {
      reason: "Storm",
    });
  });

  it("changes the trip route via an active alternative after confirm", async () => {
    const user = userEvent.setup();
    const onTripReplaced = renderPanel();

    // Mở section đổi lộ trình — panel tải danh sách tuyến thay thế của tuyến hiện tại
    await user.click(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    );
    expect(getAlternativeRoutes).toHaveBeenCalledWith("route-1", {
      page: 1,
      pageSize: 2,
    });

    // Chỉ tuyến active được hiển thị để chọn
    const radio = await screen.findByRole("radio", {
      name: /Tuyến tránh đèo/,
    });
    expect(screen.queryByText("Tuyến cũ ngưng dùng")).not.toBeInTheDocument();

    await user.click(radio);
    await user.click(
      screen.getByRole("button", { name: "tripOperations.changeRouteApply" }),
    );

    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(changeOperatorTripRoute).toHaveBeenCalledWith("trip-1", {
      alternativeRouteId: "alt-1",
    });
    // Trang cha re-select cùng tripId để tải lại geometry lộ trình mới + fleet
    expect(useToastFeedback).toHaveBeenCalledWith({
      message: expect.stringContaining("tripOperations.changeRouteSuccess"),
      error: "",
    });
    expect(onTripReplaced).toHaveBeenCalledWith("trip-1");
  });

  it("shows the declare-alternatives hint when the route has none active", async () => {
    const user = userEvent.setup();
    vi.mocked(getAlternativeRoutes).mockResolvedValue(
      alternativesResult([inactiveAlternative]),
    );
    renderPanel();

    await user.click(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    );

    expect(
      await screen.findByText("tripOperations.noAlternatives"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "tripOperations.declareAlternatives" }),
    ).toHaveAttribute("href", "/manager/routes?routeId=route-1&tab=alternatives");
    expect(changeOperatorTripRoute).not.toHaveBeenCalled();
  });

  // BE chặn mọi mutation trên chuyến đã kết thúc bằng 409 TRIP_NOT_EDITABLE.
  // Trước đây FE vẫn hiện đủ form nên người dùng bấm xong mới thấy lỗi.
  it.each(["COMPLETED", "CANCELLED", "DISRUPTED"])(
    "ẩn thao tác sửa chuyến khi trạng thái là %s",
    (status) => {
      renderPanel(vi.fn(), { ...tripProp, status });

      expect(screen.getByText(/tripOperations\.notEditable/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "tripOperations.changeRoute" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "tripOperations.disrupt" }),
      ).not.toBeInTheDocument();
      // Sức chứa là GET, vẫn tra cứu được trên chuyến đã xong
      expect(
        screen.getByRole("button", { name: "tripOperations.loadCapacity" }),
      ).toBeInTheDocument();
    },
  );

  it("giữ nguyên thao tác khi chuyến còn sửa được", () => {
    renderPanel();

    expect(
      screen.queryByText(/tripOperations\.notEditable/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    ).toBeInTheDocument();
  });

  // Deep-link mở panel trước khi fleet có chuyến đó: chưa biết trạng thái thì
  // không được tự khoá, thà để BE từ chối còn hơn chặn nhầm.
  it("không tự khoá khi chưa biết trạng thái chuyến", () => {
    renderPanel(vi.fn(), null);

    expect(
      screen.queryByText(/tripOperations\.notEditable/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    ).toBeInTheDocument();
  });
});
