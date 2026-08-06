import type {
  OperatorVehicle,
  OperatorVehicleCreateRequest,
  OperatorVehicleUpdateRequest,
  SeatLayoutJson,
  VehicleDeck,
  VehicleSeat,
  VehicleStatus,
  VehicleType,
} from "../../../api/vietride";
import { toNumber } from "../../../utils/number";
import vehiclePlaceholderUrl from "./vehicle-placeholder.svg";

// Hằng class + helper thuần dùng chung cho bảng, panel và VehicleModal.
export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";

export const MAX_VEHICLE_DECKS = 2;
export const MAX_ROWS_PER_DECK = 20;
export const MAX_COLUMNS_PER_ROW = 6;
export const MAX_VEHICLE_SEATS = 120;

export const vehiclePlaceholder = {
  src: vehiclePlaceholderUrl,
  alt: "",
};

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

export type VehicleFormErrors = Partial<Record<keyof VehicleForm, string>>;

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

function toBoundedPositiveInteger(
  value: string,
  fallback: number,
  maximum: number,
) {
  const next = Math.floor(Number(value));
  return Number.isFinite(next) && next > 0
    ? Math.min(next, maximum)
    : fallback;
}

export function toSeatLayoutOptions(form: VehicleForm) {
  const seatPrefix = form.seatPrefix?.trim() || "A";
  const columnsPerRow = toBoundedPositiveInteger(
    form.columnsPerRow,
    4,
    MAX_COLUMNS_PER_ROW,
  );
  const aisleAfterCol = Math.min(
    toBoundedPositiveInteger(
      form.aisleAfterCol,
      2,
      Math.max(columnsPerRow - 1, 1),
    ),
    Math.max(columnsPerRow - 1, 1),
  );

  return {
    deckCount: toBoundedPositiveInteger(
      form.deckCount,
      1,
      MAX_VEHICLE_DECKS,
    ),
    rowsPerDeck: toBoundedPositiveInteger(
      form.rowsPerDeck,
      10,
      MAX_ROWS_PER_DECK,
    ),
    columnsPerRow,
    aisleAfterCol,
    seatPrefix,
    totalSeats: toBoundedPositiveInteger(
      form.totalSeats,
      1,
      MAX_VEHICLE_SEATS,
    ),
  };
}

export function createDecks(form: VehicleForm): VehicleDeck[] {
  const options = toSeatLayoutOptions(form);
  const seatsPerDeck = options.rowsPerDeck * options.columnsPerRow;
  const totalSeats = Math.min(
    options.totalSeats,
    options.deckCount * seatsPerDeck,
    MAX_VEHICLE_SEATS,
  );

  return Array.from({ length: options.deckCount }, (_, deckIndex) => {
    const firstSeatIndex = deckIndex * seatsPerDeck;
    const deckSeatCount = Math.max(
      0,
      Math.min(seatsPerDeck, totalSeats - firstSeatIndex),
    );
    const seats = Array.from(
      { length: deckSeatCount },
      (_, seatIndex) => {
        const row = Math.floor(seatIndex / options.columnsPerRow) + 1;
        const col = (seatIndex % options.columnsPerRow) + 1;
        const number = seatIndex + 1;

        return {
          seatNumber:
            options.deckCount > 1
              ? `${options.seatPrefix}${deckIndex + 1}-${number}`
              : `${options.seatPrefix}${number}`,
          row,
          col,
          deck: deckIndex + 1,
          type: "STANDARD",
          isWindow: col === 1 || col === options.columnsPerRow,
          isAisle: false,
          disabled: false,
        };
      },
    );

    return { deck: deckIndex + 1, seats };
  }).filter((deck) => deck.seats.length > 0);
}

export function createSeatLayoutPreview(
  form: VehicleForm,
  vehicleTypes: VehicleType[] = [],
): SeatLayoutJson {
  const decks = createDecks(form);
  const options = toSeatLayoutOptions(form);
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

export function createVehicleFormForType(
  vehicleType?: VehicleType,
): VehicleForm {
  const requestedSeatCount = Math.floor(vehicleType?.defaultSeatCount ?? 40);
  const totalSeats = Math.min(
    Math.max(Number.isFinite(requestedSeatCount) ? requestedSeatCount : 40, 1),
    MAX_VEHICLE_SEATS,
  );
  const columnsPerRow = Math.min(
    MAX_COLUMNS_PER_ROW,
    Math.max(Math.min(4, totalSeats), Math.ceil(totalSeats / MAX_ROWS_PER_DECK)),
  );
  const rowsPerDeck = Math.ceil(totalSeats / columnsPerRow);

  return {
    ...emptyVehicleForm,
    vehicleTypeId: vehicleType?.id ?? "",
    totalSeats: String(totalSeats),
    deckCount: "1",
    rowsPerDeck: String(rowsPerDeck),
    columnsPerRow: String(columnsPerRow),
    aisleAfterCol: String(Math.min(2, Math.max(columnsPerRow - 1, 1))),
  };
}

export function updateVehicleFormValue(
  form: VehicleForm,
  key: keyof VehicleForm,
  value: string,
) {
  const nextForm = { ...form, [key]: value };

  if (
    key !== "deckCount" &&
    key !== "rowsPerDeck" &&
    key !== "columnsPerRow"
  ) {
    return nextForm;
  }

  const deckCount = Math.floor(Number(nextForm.deckCount));
  const rowsPerDeck = Math.floor(Number(nextForm.rowsPerDeck));
  const columnsPerRow = Math.floor(Number(nextForm.columnsPerRow));

  if (
    !Number.isFinite(deckCount) ||
    !Number.isFinite(rowsPerDeck) ||
    !Number.isFinite(columnsPerRow) ||
    deckCount < 1 ||
    rowsPerDeck < 1 ||
    columnsPerRow < 1
  ) {
    return nextForm;
  }

  return {
    ...nextForm,
    totalSeats: String(
      Math.min(
        deckCount * rowsPerDeck * columnsPerRow,
        MAX_VEHICLE_SEATS,
      ),
    ),
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

export function toVehicleCreateRequest(
  form: VehicleForm,
  vehicleTypes: VehicleType[],
  imageUrls = getUniquePublicImageUrls(getImageEntries(form.imageUrls)),
): OperatorVehicleCreateRequest {
  const seatLayoutJson = createSeatLayoutPreview(form, vehicleTypes);

  return {
    vehicleTypeId: form.vehicleTypeId,
    licensePlate: form.licensePlate.trim(),
    totalSeats: seatLayoutJson.totalSeats,
    maxCargoWeightKg: toNumber(form.maxCargoWeightKg),
    maxCargoVolumeM3: toNumber(form.maxCargoVolumeM3),
    seatLayoutJson,
    imageUrls,
  };
}

const VEHICLE_STATUSES: readonly VehicleStatus[] = [
  "ACTIVE",
  "MAINTENANCE",
  "OFF_DUTY",
  "RETIRED",
];

export function isVehicleStatus(value: string): value is VehicleStatus {
  return VEHICLE_STATUSES.some((status) => status === value);
}

export function normalizeVehicleStatus(status: string): VehicleStatus {
  if (isVehicleStatus(status)) {
    return status;
  }

  return status === "INACTIVE" ? "OFF_DUTY" : "ACTIVE";
}

function haveSameValues(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function toVehicleUpdateRequest(
  form: VehicleForm,
  vehicle: OperatorVehicle,
  imageUrls: string[],
): OperatorVehicleUpdateRequest {
  const request: OperatorVehicleUpdateRequest = {};
  const licensePlate = form.licensePlate.trim();
  const maxCargoWeightKg = toNumber(form.maxCargoWeightKg);
  const maxCargoVolumeM3 = toNumber(form.maxCargoVolumeM3);
  const currentImageUrls = getUniquePublicImageUrls(vehicle.imageUrls ?? []);
  const status = normalizeVehicleStatus(form.status);

  if (licensePlate !== vehicle.licensePlate) {
    request.licensePlate = licensePlate;
  }

  if (form.vehicleTypeId !== vehicle.vehicleTypeId) {
    request.vehicleTypeId = form.vehicleTypeId;
  }

  if (maxCargoWeightKg !== vehicle.maxCargoWeightKg) {
    request.maxCargoWeightKg = maxCargoWeightKg;
  }

  if (maxCargoVolumeM3 !== (vehicle.maxCargoVolumeM3 ?? 0)) {
    request.maxCargoVolumeM3 = maxCargoVolumeM3;
  }

  if (!haveSameValues(imageUrls, currentImageUrls)) {
    request.imageUrls = imageUrls;
  }

  if (status !== normalizeVehicleStatus(vehicle.status)) {
    request.status = status;
  }

  return request;
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

  return {
    ...vehiclePlaceholder,
    alt: vehicle.licensePlate,
  };
}

export function getVehiclePhotos(vehicle: OperatorVehicle) {
  const apiPhotos =
    vehicle.imageUrls?.filter(Boolean).map((url) => ({
      src: url,
      alt: vehicle.licensePlate,
    })) ?? [];

  return apiPhotos.length > 0
    ? apiPhotos
    : [{ ...vehiclePlaceholder, alt: vehicle.licensePlate }];
}
