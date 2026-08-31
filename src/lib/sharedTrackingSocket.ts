/**
 * Public Socket.IO namespace `/shared` for trip-share guests.
 * Identity JWT is intentionally omitted — only capability shareToken.
 */

import { io, type Socket } from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const TRACKING_SOCKET_PATH = "/tracking/socket.io";

export type SharedGpsUpdateEvent = {
  latitude?: number;
  longitude?: number;
  heading?: number | null;
  speedKph?: number | null;
  recordedAt?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    heading?: number | null;
    speedKph?: number | null;
    recordedAt?: string;
  };
};

export type SharedEtaUpdateEvent = {
  eta?: {
    estimatedArrivalAt?: string | null;
    remainingSeconds?: number | null;
    delayMinutes?: number | null;
    updatedAt?: string | null;
  };
};

export type SharedTripStatusChangedEvent = {
  status?: string;
  updatedAt?: string;
};

export type SharedTripVehicleSubstitutedEvent = {
  status?: "VEHICLE_REPLACEMENT_PENDING";
  occurredAt?: string;
};

export type SharedAccessRevokedEvent = {
  reason?: "EXPIRED" | "REVOKED" | "TRIP_ENDED" | "ACCESS_UNAVAILABLE" | string;
};

/**
 * Connect as a share guest. Server joins rooms; client must not emit join events.
 * @see VietRide_API_Contract_v1.md — Public Socket.IO `/shared`
 */
export function createSharedTrackingSocket(shareToken: string): Socket {
  const base = API_BASE_URL.replace(/\/$/, "");
  return io(`${base}/shared`, {
    path: TRACKING_SOCKET_PATH,
    auth: { shareToken },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1200,
    withCredentials: false,
  });
}
