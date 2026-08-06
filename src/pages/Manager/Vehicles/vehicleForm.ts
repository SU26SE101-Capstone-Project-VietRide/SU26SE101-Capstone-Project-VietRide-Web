import type {
  OperatorVehicle,
  OperatorVehicleRequest,
  SeatLayoutJson,
  VehicleDeck,
  VehicleSeat,
  VehicleType,
} from "../../../api/vietride";
import { toNumber } from "../../../utils/number";

// Hằng class + helper thuần dùng chung cho index / VehicleModal / VehicleDetailModal
export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";

// alt là key i18n namespace manager, dịch bằng t() tại nơi render (VehicleDetailModal)
export const vehiclePhotos = [
  {
    src: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80",
    alt: "vehicles.stockPhotoAlt1",
  },
  {
    src: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=900&q=80",
    alt: "vehicles.stockPhotoAlt2",
  },
  {
    src: "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=900&q=80",
    alt: "vehicles.stockPhotoAlt3",
  },
  {
    src: "https://images.unsplash.com/photo-1509749837427-ac94a2553d0e?auto=format&fit=crop&w=900&q=80",
    alt: "vehicles.stockPhotoAlt4",
  },
  {
    src: "https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=900&q=80",
    alt: "vehicles.stockPhotoAlt5",
  },
];

export type VehicleForm = {
  vehicleTypeId: string;
  licensePlate: string;
  totalSeats: string;
  maxCargoWeightKg: string;
  maxCargoVolumeM3: string;
  imageUrls: string;
  status: string;
  deckCount: string;
  rowsPerDeck: string;
  columnsPerRow: string;
  aisleAfterCol: string;
  seatPrefix: string;
};

export const emptyVehicleForm: VehicleForm = {
  vehicleTypeId: "",
  licensePlate: "",
  totalSeats: "40",
  maxCargoWeightKg: "500",
  maxCargoVolumeM3: "5",
  imageUrls: "",
  status: "ACTIVE",
  deckCount: "1",
  rowsPerDeck: "10",
  columnsPerRow: "4",
  aisleAfterCol: "2",
  seatPrefix: "A",
};

export function getVehicleSeatLimit(vehicleTypes: VehicleType[], vehicleTypeId: string) {
  return vehicleTypes.find((type) => type.id === vehicleTypeId)?.defaultSeatCount ?? 0;
}

export function normalizeSeatLayout(form: Pick<VehicleForm, "deckCount" | "rowsPerDeck" | "columnsPerRow">, seatLimit: number) {
  const limit = Math.max(1, Math.floor(seatLimit));
  const deckCount = Math.min(Math.max(Math.floor(Number(form.deckCount)) || 1, 1), 2);
  const columnsPerRow = Math.max(1, Math.floor(Number(form.columnsPerRow)) || 1);
  const rowsPerDeck = Math.max(1, Math.floor(Number(form.rowsPerDeck)) || 1);
  const seatsPerDeck = Math.max(1, Math.floor(limit / deckCount));
  if (rowsPerDeck * columnsPerRow <= seatsPerDeck) return { deckCount, rowsPerDeck, columnsPerRow };
  if (columnsPerRow > seatsPerDeck) return { deckCount, rowsPerDeck: 1, columnsPerRow: seatsPerDeck };
  return { deckCount, rowsPerDeck: Math.max(1, Math.floor(seatsPerDeck / columnsPerRow)), columnsPerRow };
}

export function toSeatLayoutOptions(form: VehicleForm, seatLimit = Number.MAX_SAFE_INTEGER) {
  const normalized = normalizeSeatLayout(form, seatLimit);
  const aisleAfterCol = Math.min(Math.max(1, Math.floor(Number(form.aisleAfterCol)) || 1), Math.max(normalized.columnsPerRow - 1, 1));
  return { ...normalized, aisleAfterCol, seatPrefix: form.seatPrefix.trim() || "A" };
}

export function createDecks(form: VehicleForm, seatLimit = Number.MAX_SAFE_INTEGER): VehicleDeck[] {
  const options = toSeatLayoutOptions(form, seatLimit);
  let remainingSeats = Math.max(0, Math.floor(seatLimit));
  return Array.from({ length: options.deckCount }, (_, deckIndex) => {
    const seatsInDeck = Math.min(options.rowsPerDeck * options.columnsPerRow, remainingSeats);
    remainingSeats -= seatsInDeck;
    const seats = Array.from({ length: seatsInDeck }, (_, seatIndex) => {
      const row = Math.floor(seatIndex / options.columnsPerRow) + 1;
      const col = (seatIndex % options.columnsPerRow) + 1;
      const number = seatIndex + 1;
      return { seatNumber: options.deckCount > 1 ? `${options.seatPrefix}${deckIndex + 1}-${number}` : `${options.seatPrefix}${number}`, row, col, deck: deckIndex + 1, type: "STANDARD", isWindow: col === 1 || col === options.columnsPerRow, isAisle: false, disabled: false };
    });
    return { deck: deckIndex + 1, seats };
  });
}
export function countSeats(decks: VehicleDeck[]) {
  return decks.reduce((total, deck) => total + deck.seats.length, 0);
}

function toSeatLayoutJson(
  form: VehicleForm,
  vehicleTypes: VehicleType[] = [],
  seatLimit = Number.MAX_SAFE_INTEGER,
): SeatLayoutJson {
  const decks = createDecks(form, seatLimit);
  const options = toSeatLayoutOptions(form, seatLimit);
  const seats = decks.flatMap((deck) => deck.seats);
  const vehicleType = vehicleTypes.find(
    (type) => type.id === form.vehicleTypeId,
  );

  return {
    version: 1,
    vehicleTypeCode: vehicleType?.code ?? "",
    totalSeats: seats.length,
    rows: options.rowsPerDeck,
    cols: options.columnsPerRow,
    decks: options.deckCount,
    aisles: [{ afterCol: options.aisleAfterCol }],
    seats,
  };
}

function groupSeatsByDeck(seats: VehicleSeat[]): VehicleDeck[] {
  const grouped = seats.reduce<Record<number, VehicleSeat[]>>((acc, seat) => {
    const deck = seat.deck ?? 1;
    acc[deck] = [...(acc[deck] ?? []), seat];
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([deck, deckSeats]) => ({
      deck: Number(deck),
      seats: deckSeats,
    }))
    .sort((left, right) => left.deck - right.deck);
}

export function getLayoutShape(vehicle: OperatorVehicle) {
  const decks = vehicle.decks ?? parseSeatLayoutDecks(vehicle.seatLayoutJson);
  const firstDeck = decks[0];

  if (!firstDeck) {
    return {
      deckCount: "1",
      rowsPerDeck: String(Math.max(1, Math.ceil(vehicle.totalSeats / 4))),
      columnsPerRow: "4",
    };
  }

  const maxRow = Math.max(...firstDeck.seats.map((seat) => seat.row), 1);
  const maxColumn = Math.max(...firstDeck.seats.map((seat) => seat.col), 1);

  return {
    deckCount: String(Math.max(decks.length, 1)),
    rowsPerDeck: String(maxRow),
    columnsPerRow: String(maxColumn),
  };
}

export function parseSeatLayoutDecks(layout: OperatorVehicle["seatLayoutJson"]) {
  if (!layout) {
    return [];
  }

  if (typeof layout !== "string") {
    return groupSeatsByDeck(layout.seats);
  }

  try {
    const parsed = JSON.parse(layout) as Partial<SeatLayoutJson> & {
      decks?: VehicleDeck[] | number;
    };

    if (Array.isArray(parsed.seats)) {
      return groupSeatsByDeck(parsed.seats);
    }

    return Array.isArray(parsed.decks) ? parsed.decks : [];
  } catch {
    return [];
  }
}

export function toVehicleRequest(
  form: VehicleForm,
  vehicleTypes: VehicleType[],
  imageUrls = getUniquePublicImageUrls(getImageEntries(form.imageUrls)),
): OperatorVehicleRequest {
  const seatLimit = getVehicleSeatLimit(vehicleTypes, form.vehicleTypeId) || Number.MAX_SAFE_INTEGER;
  const seatLayoutJson = toSeatLayoutJson(form, vehicleTypes, seatLimit);

  return {
    vehicleTypeId: form.vehicleTypeId,
    licensePlate: form.licensePlate,
    totalSeats: seatLayoutJson.totalSeats,
    maxCargoWeightKg: toNumber(form.maxCargoWeightKg),
    maxCargoVolumeM3: toNumber(form.maxCargoVolumeM3),
    seatLayoutJson,
    imageUrls,
  };
}

export function getImageEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function isPublicImageUrl(value: string) {
  return /^https:\/\//i.test(value);
}

export function getUniquePublicImageUrls(urls: string[]) {
  const seen = new Set<string>();

  return urls.filter((url) => {
    const normalizedUrl = url.trim();
    const key = normalizedUrl.toLowerCase();

    if (!isPublicImageUrl(normalizedUrl) || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getVehicleId(vehicle: OperatorVehicle) {
  return vehicle.vehicleId || vehicle.id || "";
}

export function getVehicleTypeLabel(
  vehicle: Pick<
    OperatorVehicle,
    "vehicleTypeId" | "vehicleTypeName" | "vehicleTypeCode"
  >,
  vehicleTypes: VehicleType[],
) {
  const matchedType = vehicleTypes.find(
    (type) => type.id === vehicle.vehicleTypeId,
  );

  return (
    vehicle.vehicleTypeName ||
    matchedType?.displayName ||
    vehicle.vehicleTypeCode ||
    matchedType?.code ||
    "-"
  );
}

export function getVehiclePhoto(vehicle: OperatorVehicle) {
  const firstImageUrl = vehicle.imageUrls?.find((url) => url.trim());

  if (firstImageUrl) {
    return {
      src: firstImageUrl,
      alt: vehicle.licensePlate,
    };
  }

  const key = getVehicleId(vehicle) || vehicle.licensePlate;
  const hash = Array.from(key).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );

  return vehiclePhotos[hash % vehiclePhotos.length];
}

export function getVehiclePhotos(vehicle: OperatorVehicle) {
  const apiPhotos =
    vehicle.imageUrls?.filter(Boolean).map((url) => ({
      src: url,
      alt: vehicle.licensePlate,
    })) ?? [];

  return apiPhotos.length > 0 ? apiPhotos : vehiclePhotos;
}
