import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disruptOperatorTripNoSubstitution,
  getOperatorTripCargoCapacity,
  getOperatorTrips,
  substituteOperatorTripVehicle,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import TripOperationsPanel from "./TripOperationsPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

vi.mock("../../../api/vietride", () => ({
  disruptOperatorTripNoSubstitution: vi.fn(),
  getOperatorTripCargoCapacity: vi.fn(),
  getOperatorTrips: vi.fn(),
  substituteOperatorTripVehicle: vi.fn(),
}));

// Xe và nhân sự giờ do trang cha truyền xuống qua props
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

describe("TripOperationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorTrips).mockResolvedValue({
      items: [
        {
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
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });    vi.mocked(getOperatorTripCargoCapacity).mockResolvedValue({
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads cargo capacity for an operator trip", async () => {
    const user = userEvent.setup();
    render(<TripOperationsPanel vehicles={vehiclesProp} staff={staffProp} />);

    await waitFor(() => expect(getOperatorTrips).toHaveBeenCalled());
    await user.click(screen.getByLabelText("tripOperations.tripSelect"));
    await user.click(
      screen.getByRole("option", {
        name: /Hồ Chí Minh - Đà Lạt · 51B-123\.45/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "tripOperations.loadCapacity" }),
    );

    expect(getOperatorTripCargoCapacity).toHaveBeenCalledWith("trip-1");
    expect(await screen.findByText("500 kg")).toBeInTheDocument();
  });

  it("substitutes a vehicle with the selected crew and reason", async () => {
    const user = userEvent.setup();
    render(<TripOperationsPanel vehicles={vehiclesProp} staff={staffProp} />);

    await waitFor(() => expect(getOperatorTrips).toHaveBeenCalled());
    await user.click(screen.getByLabelText("tripOperations.tripSelect"));
    await user.click(
      screen.getByRole("option", {
        name: /Hồ Chí Minh - Đà Lạt · 51B-123\.45/,
      }),
    );
    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(screen.getByRole("option", { name: "51B-999.99" }));
    await user.click(screen.getByLabelText("tripOperations.driver"));
    await user.click(screen.getByRole("option", { name: "Driver Two" }));
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );

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
  });
});


