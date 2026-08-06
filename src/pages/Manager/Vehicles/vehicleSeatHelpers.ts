import type { OperatorVehicle, SeatLayoutJson, VehicleSeat } from "../../../api/vietride";
import { isRecord } from "../../../utils/typeGuards";

export type VehicleSeatStats = {
  totalPositions: number;
  passengerSeats: number;
  activePassengerSeats: number;
  disabledPassengerSeats: number;
  driverAreas: number;
};

function isSeatLayoutJson(value: unknown): value is SeatLayoutJson {
  return (
    isRecord(value) &&
    typeof value.totalSeats === "number" &&
    Array.isArray(value.seats)
  );
}

export function parseVehicleSeatLayout(
  value: OperatorVehicle["seatLayoutJson"],
): SeatLayoutJson | null {
  if (!value) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isSeatLayoutJson(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getVehicleSeatStats(
  layout: SeatLayoutJson | null,
  fallbackTotalSeats = 0,
): VehicleSeatStats {
  const seats = layout?.seats ?? [];
  const passengerSeats = seats.filter((seat) => seat.type !== "DRIVER_AREA");
  const activePassengerSeats = passengerSeats.filter((seat) => !seat.disabled);
  const passengerSeatCount = layout ? passengerSeats.length : fallbackTotalSeats;

  return {
    totalPositions: layout?.totalSeats ?? fallbackTotalSeats,
    passengerSeats: passengerSeatCount,
    activePassengerSeats: layout ? activePassengerSeats.length : fallbackTotalSeats,
    disabledPassengerSeats: passengerSeats.length - activePassengerSeats.length,
    driverAreas: seats.filter((seat) => seat.type === "DRIVER_AREA").length,
  };
}

export function toggleVehicleSeat(
  layout: SeatLayoutJson,
  seatNumber: string,
): SeatLayoutJson {
  return {
    ...layout,
    seats: layout.seats.map((seat) =>
      seat.seatNumber === seatNumber
        ? { ...seat, disabled: !seat.disabled }
        : seat,
    ),
  };
}

export function getSeatColumnCount(layout: SeatLayoutJson): number {
  return (
    layout.cols ||
    Math.max(...layout.seats.map((seat) => seat.col), 1)
  );
}

export function isPassengerSeat(seat: VehicleSeat): boolean {
  return seat.type !== "DRIVER_AREA";
}
