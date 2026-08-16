import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeOperatorTripRoute,
  disruptOperatorTripNoSubstitution,
  getAlternativeRoutes,
  getOperatorTripCargoCapacity,
  substituteOperatorTripVehicle,
  type AlternativeRoute,
  type OperatorTripListItem,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import TripActionsPanel from "./TripActionsPanel";
import { useToastFeedback } from "../../../hooks/useToastFeedback";

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  changeOperatorTripRoute: vi.fn(),
  disruptOperatorTripNoSubstitution: vi.fn(),
  getAlternativeRoutes: vi.fn(),
  getOperatorTripCargoCapacity: vi.fn(),
  substituteOperatorTripVehicle: vi.fn(),
}));

// Chuyến giờ do map/list của Trung tâm vận hành chọn và truyền xuống qua props
const tripProp: OperatorTripListItem = {
  tripId: "trip-1",
  status: "SCHEDULED",
  route: {
    routeId: "route-1",
    name: "Hồ Chí Minh - Đà Lạt",
    originName: "Hồ Chí Minh",
    destinationName: "Đà Lạt",
  },
  vehicle: {
    vehicleId: "vehicle-1",
    licensePlate: "51B-123.45",
    status: "ACTIVE",
  },
  driver: null,
  assistant: null,
  departureAt: "2026-08-01T08:00:00+07:00",
  arrivalEstimate: "2026-08-01T15:00:00+07:00",
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
  trip: OperatorTripListItem | null = tripProp,
) {
  render(
    <MemoryRouter>
      <TripActionsPanel
        tripId="trip-1"
        trip={trip}
        vehicles={vehiclesProp}
        staff={staffProp}
        canMutate
        onTripReplaced={onTripReplaced}
      />
    </MemoryRouter>,
  );
  return onTripReplaced;
}

describe("TripActionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    await user.click(screen.getByRole("option", { name: "51B-999.99" }));
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
    expect(useToastFeedback).toHaveBeenCalledWith({ message: "tripOperations.changeRouteSuccess", error: "" });
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

      expect(screen.getByText("tripOperations.notEditable")).toBeInTheDocument();
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
      screen.queryByText("tripOperations.notEditable"),
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
      screen.queryByText("tripOperations.notEditable"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tripOperations.changeRoute" }),
    ).toBeInTheDocument();
  });
});
