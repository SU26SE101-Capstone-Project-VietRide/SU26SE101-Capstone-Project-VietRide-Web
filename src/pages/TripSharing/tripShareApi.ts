/**
 * Public shared-trip HTTP client (anonymous capability token).
 * Does not use Identity JWT. Never logs the raw token.
 */

import { apiRequest, ApiRequestError } from "../../api/client";
import { isRecord } from "../../utils/typeGuards";

export type SharedTripVehicleLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedKph: number | null;
  recordedAt: string;
};

/**
 * Điểm dừng giữa tuyến. CHỈ tên + toạ độ + thứ tự chạy — public DTO không được
 * mang stopId/stationId (contract §GET /v1/tracking/shared-trip/context).
 */
export type SharedTripStop = {
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
};

/**
 * Toạ độ hai bến đầu cuối. Tách khỏi `geometry` vì tuyến chưa lưu polyline vẫn
 * phải chấm được bến lên bản đồ — trước đây bản đồ suy hai bến từ hai đầu
 * geometry nên `geometry: null` là mất sạch marker.
 *
 * `null` khi BE không có toạ độ cho bến đó; khi ấy không vẽ marker chứ không
 * lùi về một toạ độ đoán.
 */
export type SharedTripEndpoint = {
  latitude: number;
  longitude: number;
};

export type SharedTripContext = {
  status: string;
  expiresAt: string;
  lastUpdatedAt: string | null;
  vehicle: {
    location: SharedTripVehicleLocation | null;
  };
  route: {
    originName: string;
    destinationName: string;
    origin: SharedTripEndpoint | null;
    destination: SharedTripEndpoint | null;
    stops: SharedTripStop[];
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    } | null;
  };
  eta: {
    estimatedArrivalAt: string | null;
    remainingSeconds: number | null;
    delayMinutes: number | null;
    updatedAt: string | null;
  } | null;
};

const MAX_ROUTE_COORDINATES = 20_000;
const MAX_ROUTE_STOPS = 200;
const MAX_PUBLIC_LABEL_LENGTH = 180;

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown, maxLength = MAX_PUBLIC_LABEL_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function asIsoDate(value: unknown): string | null {
  const candidate = asString(value, 64);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : null;
}

function isCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function parseLocation(value: unknown): SharedTripVehicleLocation | null {
  if (!isRecord(value)) return null;
  const latitude = asNumber(value.latitude);
  const longitude = asNumber(value.longitude);
  const recordedAt = asIsoDate(value.recordedAt);
  if (
    latitude === null ||
    longitude === null ||
    !isCoordinate(latitude, longitude) ||
    !recordedAt
  ) return null;
  return {
    latitude,
    longitude,
    heading: asNumber(value.heading),
    speedKph: asNumber(value.speedKph),
    recordedAt,
  };
}

function parseGeometry(
  value: unknown,
): SharedTripContext["route"]["geometry"] {
  if (!isRecord(value) || value.type !== "LineString" || !Array.isArray(value.coordinates)) {
    return null;
  }
  const coordinates: [number, number][] = [];
  for (const pair of value.coordinates.slice(0, MAX_ROUTE_COORDINATES)) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = asNumber(pair[0]);
    const lat = asNumber(pair[1]);
    if (lng === null || lat === null || !isCoordinate(lat, lng)) continue;
    coordinates.push([lng, lat]);
  }
  return coordinates.length >= 2 ? { type: "LineString", coordinates } : null;
}

function parseEndpoint(value: unknown): SharedTripEndpoint | null {
  if (!isRecord(value)) return null;
  const latitude = asNumber(value.latitude);
  const longitude = asNumber(value.longitude);
  if (latitude === null || longitude === null || !isCoordinate(latitude, longitude)) {
    return null;
  }
  return { latitude, longitude };
}

function parseStops(value: unknown): SharedTripStop[] {
  if (!Array.isArray(value)) return [];

  const stops: SharedTripStop[] = [];
  for (const entry of value.slice(0, MAX_ROUTE_STOPS)) {
    if (!isRecord(entry)) continue;
    const name = asString(entry.name);
    const latitude = asNumber(entry.latitude);
    const longitude = asNumber(entry.longitude);
    if (!name || latitude === null || longitude === null) continue;
    if (!isCoordinate(latitude, longitude)) continue;
    stops.push({
      name,
      latitude,
      longitude,
      // Thiếu `sequence` thì giữ nguyên thứ tự BE trả về.
      sequence: asNumber(entry.sequence) ?? stops.length + 1,
    });
  }

  return stops.sort((left, right) => left.sequence - right.sequence);
}

export function parseSharedTripContext(data: unknown): SharedTripContext {
  if (!isRecord(data)) {
    throw new ApiRequestError("Shared trip context is invalid.", 500, "INVALID_API_RESPONSE");
  }

  const status = asString(data.status, 32) ?? "UNKNOWN";
  const expiresAt = asIsoDate(data.expiresAt);
  if (!expiresAt) {
    throw new ApiRequestError("Shared trip context is invalid.", 500, "INVALID_API_RESPONSE");
  }

  const vehicleRecord = isRecord(data.vehicle) ? data.vehicle : {};
  const routeRecord = isRecord(data.route) ? data.route : {};
  const etaRecord = isRecord(data.eta) ? data.eta : null;

  return {
    status,
    expiresAt,
    lastUpdatedAt: asIsoDate(data.lastUpdatedAt),
    vehicle: {
      location: parseLocation(vehicleRecord.location),
    },
    route: {
      originName: asString(routeRecord.originName) ?? "—",
      destinationName: asString(routeRecord.destinationName) ?? "—",
      origin: parseEndpoint(routeRecord.origin),
      destination: parseEndpoint(routeRecord.destination),
      stops: parseStops(routeRecord.stops),
      geometry: parseGeometry(routeRecord.geometry),
    },
    eta: etaRecord
      ? {
          estimatedArrivalAt: asIsoDate(etaRecord.estimatedArrivalAt),
          remainingSeconds: asNumber(etaRecord.remainingSeconds),
          delayMinutes: asNumber(etaRecord.delayMinutes),
          updatedAt: asIsoDate(etaRecord.updatedAt),
        }
      : null,
  };
}

/**
 * GET /v1/tracking/shared-trip/context
 * Auth: X-Trip-Share-Token only (public gateway subpath).
 */
export async function fetchSharedTripContext(
  shareToken: string,
  signal?: AbortSignal,
): Promise<SharedTripContext> {
  const data = await apiRequest<unknown>("/v1/tracking/shared-trip/context", {
    method: "GET",
    authenticated: false,
    cache: "no-store",
    signal,
    headers: {
      "X-Trip-Share-Token": shareToken,
      // Prefer no referrer on outbound API calls from this page.
      // (Header is not standard for all browsers; meta on document also set.)
    },
  });

  return parseSharedTripContext(data);
}

export { ApiRequestError };
