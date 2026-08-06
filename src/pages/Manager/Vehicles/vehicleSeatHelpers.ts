import type {
  OperatorVehicle,
  SeatLayoutJson,
  VehicleSeat,
  VehicleSeatType,
} from "../../../api/vietride";
import { isRecord } from "../../../utils/typeGuards";

export type VehicleSeatStats = {
  totalPositions: number;
  passengerSeats: number;
  activePassengerSeats: number;
  disabledPassengerSeats: number;
  driverAreas: number;
};

export type VehicleSeatCoordinate = {
  deck: number;
  row: number;
  col: number;
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

export function getSeatCoordinateKey(
  coordinate: VehicleSeatCoordinate | VehicleSeat,
): string {
  return `${coordinate.deck ?? 1}:${coordinate.row}:${coordinate.col}`;
}

export function setVehicleSeatType(
  layout: SeatLayoutJson,
  coordinateKey: string,
  type: VehicleSeatType,
): SeatLayoutJson {
  return {
    ...layout,
    seats: layout.seats.map((seat) =>
      getSeatCoordinateKey(seat) === coordinateKey
        ? { ...seat, type, disabled: type === "DRIVER_AREA" ? false : seat.disabled }
        : seat,
    ),
  };
}

export function countSeatChanges(
  current: SeatLayoutJson | null,
  baseline: SeatLayoutJson | null,
): number {
  if (!current || !baseline) {
    return 0;
  }

  const baselineByKey = new Map(
    baseline.seats.map((seat) => [getSeatCoordinateKey(seat), seat]),
  );

  return current.seats.reduce((count, seat) => {
    const original = baselineByKey.get(getSeatCoordinateKey(seat));
    if (!original) {
      return count + 1;
    }

    return count + (original.disabled !== seat.disabled ? 1 : 0);
  }, 0);
}

export function getSeatColumnCount(layout: SeatLayoutJson): number {
  return (
    layout.cols ||
    Math.max(...layout.seats.map((seat) => seat.col), 1)
  );
}

export function getSeatRowCount(layout: SeatLayoutJson, deck: number): number {
  return Math.max(
    Number.isFinite(layout.rows) ? layout.rows : 0,
    ...layout.seats
      .filter((seat) => (seat.deck ?? 1) === deck)
      .map((seat) => seat.row),
    1,
  );
}

export function getDeckNumbers(layout: SeatLayoutJson): number[] {
  const decks = new Set(
    layout.seats.map((seat) => seat.deck ?? 1),
  );

  const deckCount = Number.isFinite(layout.decks) ? layout.decks : 1;
  for (let deck = 1; deck <= Math.max(deckCount, 1); deck += 1) {
    decks.add(deck);
  }

  return [...decks].sort((left, right) => left - right);
}

export function isPassengerSeat(seat: VehicleSeat): boolean {
  return seat.type !== "DRIVER_AREA";
}
