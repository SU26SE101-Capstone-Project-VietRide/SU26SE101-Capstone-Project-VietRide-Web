import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createSeatLayoutPreview,
  emptyVehicleForm,
} from "./vehicleForm";
import { VehicleSeatLayout } from "./VehicleSeatLayout";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("VehicleSeatLayout", () => {
  it("shows a standard-seat preview without seat-type creation controls", () => {
    const layout = createSeatLayoutPreview({
      ...emptyVehicleForm,
      totalSeats: "4",
      rowsPerDeck: "2",
      columnsPerRow: "2",
      aisleAfterCol: "1",
    });

    expect(layout.seats).toHaveLength(4);
    expect(layout.seats.every((seat) => seat.type === "STANDARD")).toBe(true);

    render(<VehicleSeatLayout layout={layout} />);

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText("vehicles.driverArea")).not.toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();
    expect(screen.getByText("A4")).toBeInTheDocument();
  });
});

