import { io, type Socket } from "socket.io-client";
import { getAuthSession } from "../auth";
import type {
  ShuttleTrackingEta,
  ShuttleTrackingLatest,
  TrackingEta,
  TrackingLatestLocation,
} from "../api/vietride";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const TRACKING_SOCKET_PATH = "/tracking/socket.io";

export type TrackingEtaUpdateEvent = TrackingEta & { delayed: boolean };

export type TripStatusChangedEvent = {
  tripId: string;
  stopId: string;
  status: string;
  delayMinutes: number;
  updatedAt: string;
};

// BE chưa công bố JSON mẫu cho 2 event Shuttle này; suy ra field theo đúng
// shape REST latest/eta đã có (ShuttleTrackingLatest/ShuttleTrackingEta) vì
// tài liệu Phase 11 nói ETA/GPS Shuttle dùng chung provider với trip thường.
export type ShuttleGpsUpdateEvent = ShuttleTrackingLatest;
export type ShuttleEtaUpdateEvent = ShuttleTrackingEta;

export type JoinTripTrackingAck =
  | { success: true; tripId: string; room: string; scope: string }
  | { success: false; error: string; message: string };

export type JoinShuttleTrackingAck =
  | { success: true; shuttleTripId: string; room: string; scope?: string }
  | { success: false; error: string; message: string };

// Tracking service không đi qua Gateway route table cho Socket.IO; kết nối
// thẳng cùng origin với REST (Nginx proxy trực tiếp tới tracking:3001).
export function createTrackingSocket(): Socket {
  const accessToken = getAuthSession()?.accessToken ?? "";

  return io(API_BASE_URL || undefined, {
    path: TRACKING_SOCKET_PATH,
    auth: { token: accessToken },
    transports: ["websocket"],
  });
}

export function joinTripTracking(socket: Socket, tripId: string) {
  return socket.timeout(5000).emitWithAck("joinTripTracking", { tripId }) as Promise<JoinTripTrackingAck>;
}

export function joinShuttleTracking(socket: Socket, shuttleTripId: string) {
  return socket
    .timeout(5000)
    .emitWithAck("joinShuttleTracking", { shuttleTripId }) as Promise<JoinShuttleTrackingAck>;
}

export type { TrackingLatestLocation, TrackingEta };
