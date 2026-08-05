// Helper thuần + type + hằng dùng chung cho màn Admin Stations
// (index, StationEditorPanel, StationScheduleFields, StationFacilityFields,
// StationMergePanel, StationTable)
import type { AdminStation } from "../../../api/vietride";
import type { PlaceSelection } from "../../../components/PlacePicker";

export const operatingDayKeys = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type OperatingDayKey = (typeof operatingDayKeys)[number];
export type OperatingDaySchedule = {
  enabled: boolean;
  open: string;
  close: string;
};
export type OperatingHoursForm = Record<OperatingDayKey, OperatingDaySchedule>;

export type StationForm = {
  name: string;
  addressStreet: string;
  locationId: string;
  city: string;
  province: string;
  latitude: string;
  longitude: string;
  contactPhone: string;
  contactEmail: string;
  operatingHours: OperatingHoursForm;
  facilities: string[];
  supportsShuttle: boolean;
};

export type AlertState = {
  tone: "success" | "error";
  message: string;
};

// Biến thể class riêng của màn Stations — khác chuỗi chuẩn trong
// src/components/form/formClasses.ts nên giữ cục bộ (xem comment file đó)
export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
export const labelClass =
  "mb-1.5 block whitespace-nowrap text-xs font-semibold text-slate-600";
export const iconButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const facilityOptions = [
  "waiting_room",
  "parking",
  "ticket_counter",
  "restroom",
  "food_court",
  "luggage_storage",
  "wifi",
  "charging_station",
] as const;

export function emptyOperatingHours(): OperatingHoursForm {
  return Object.fromEntries(
    operatingDayKeys.map((day) => [
      day,
      { enabled: false, open: "06:00", close: "22:00" },
    ]),
  ) as OperatingHoursForm;
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

// Biến thể cục bộ có !Array.isArray — giữ nguyên, không thay bằng bản shared
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function splitTimeRange(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(
    value.trim(),
  );
  return match
    ? { open: `${match[1]}:${match[2]}`, close: `${match[3]}:${match[4]}` }
    : null;
}

function toOperatingHoursForm(value: unknown): OperatingHoursForm {
  const schedule = emptyOperatingHours();
  const parsed = parseJsonValue(value);
  if (!isRecord(parsed)) return schedule;

  const sharedOpen = typeof parsed.open === "string" ? parsed.open : "";
  const sharedClose = typeof parsed.close === "string" ? parsed.close : "";
  if (sharedOpen && sharedClose) {
    operatingDayKeys.forEach((day) => {
      schedule[day] = { enabled: true, open: sharedOpen, close: sharedClose };
    });
    return schedule;
  }

  operatingDayKeys.forEach((day) => {
    const range = splitTimeRange(parsed[day]);
    if (range) {
      schedule[day] = { enabled: true, ...range };
    }
  });
  return schedule;
}

function toFacilities(value: unknown) {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (facility): facility is string =>
      typeof facility === "string" && Boolean(facility.trim()),
  );
}

export function toForm(station: AdminStation): StationForm {
  return {
    name: station.name,
    addressStreet: station.addressStreet ?? "",
    locationId: station.locationId ?? "",
    city: station.city,
    province: station.province,
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    contactPhone: station.contactPhone ?? "",
    contactEmail: station.contactEmail ?? "",
    operatingHours: toOperatingHoursForm(station.operatingHours),
    facilities: toFacilities(station.facilities),
    supportsShuttle: station.supportsShuttle,
  };
}

// Các reducer thuần trên StationForm — index bọc lại bằng setForm
export function applyPlaceToForm(
  form: StationForm,
  place: PlaceSelection,
): StationForm {
  return {
    ...form,
    name: place.name,
    addressStreet: place.address,
    city: place.city,
    province: place.province,
    latitude: String(place.latitude),
    longitude: String(place.longitude),
  };
}

export function withOperatingDay(
  form: StationForm,
  day: OperatingDayKey,
  updates: Partial<OperatingDaySchedule>,
): StationForm {
  return {
    ...form,
    operatingHours: {
      ...form.operatingHours,
      [day]: { ...form.operatingHours[day], ...updates },
    },
  };
}

export function withToggledFacility(
  form: StationForm,
  facility: string,
): StationForm {
  const selected = form.facilities.some(
    (item) => item.toLowerCase() === facility.toLowerCase(),
  );
  return {
    ...form,
    facilities: selected
      ? form.facilities.filter(
          (item) => item.toLowerCase() !== facility.toLowerCase(),
        )
      : [...form.facilities, facility],
  };
}

export function withAddedFacility(
  form: StationForm,
  facility: string,
): StationForm {
  if (
    form.facilities.some(
      (item) => item.toLowerCase() === facility.toLowerCase(),
    )
  ) {
    return form;
  }
  return { ...form, facilities: [...form.facilities, facility] };
}

export function withoutFacility(
  form: StationForm,
  facility: string,
): StationForm {
  return {
    ...form,
    facilities: form.facilities.filter((item) => item !== facility),
  };
}

export function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
