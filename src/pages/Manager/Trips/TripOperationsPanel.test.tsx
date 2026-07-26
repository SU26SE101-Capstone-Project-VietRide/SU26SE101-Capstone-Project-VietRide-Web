import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disruptOperatorTripNoSubstitution,
  getOperatorTripCargoCapacity,
  getOperatorUsers,
  getOperatorVehicles,
  substituteOperatorTripVehicle,
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
  getOperatorUsers: vi.fn(),
  getOperatorVehicles: vi.fn(),
  substituteOperatorTripVehicle: vi.fn(),
}));

describe("TripOperationsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorVehicles).mockResolvedValue({
      items: [
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
          userId: "driver-2",
          email: "driver@operator.vn",
          displayName: "Driver Two",
          role: "DRIVER",
          status: "ACTIVE",
          operatorId: "operator-1",
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads cargo capacity for an operator trip", async () => {
    const user = userEvent.setup();
    render(<TripOperationsPanel />);

    await user.type(
      screen.getByPlaceholderText("tripOperations.tripPlaceholder"),
      "trip-1",
    );
    await user.click(
      screen.getByRole("button", { name: "tripOperations.loadCapacity" }),
    );

    expect(getOperatorTripCargoCapacity).toHaveBeenCalledWith("trip-1");
    expect(await screen.findByText("500 kg")).toBeInTheDocument();
  });

  it("substitutes a vehicle with the selected crew and reason", async () => {
    const user = userEvent.setup();
    render(<TripOperationsPanel />);

    await waitFor(() => expect(getOperatorVehicles).toHaveBeenCalled());
    await user.type(
      screen.getByPlaceholderText("tripOperations.tripPlaceholder"),
      "trip-1",
    );
    await user.click(screen.getByLabelText("tripOperations.vehicle"));
    await user.click(screen.getByRole("option", { name: "51B-999.99" }));
    await user.click(screen.getByLabelText("tripOperations.driver"));
    await user.click(screen.getByRole("option", { name: "Driver Two" }));
    await user.type(screen.getByLabelText("tripOperations.reason"), "Breakdown");
    await user.click(
      screen.getByRole("button", { name: "tripOperations.substitute" }),
    );

    expect(substituteOperatorTripVehicle).toHaveBeenCalledWith("trip-1", {
      newVehicleId: "vehicle-2",
      newDriverUserId: "driver-2",
      newAssistantUserId: undefined,
      reason: "Breakdown",
    });
  });
});
