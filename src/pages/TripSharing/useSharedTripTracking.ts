import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import {
  ApiRequestError,
  fetchSharedTripContext,
  type SharedTripContext,
  type SharedTripVehicleLocation,
} from "./tripShareApi";
import {
  createSharedTrackingSocket,
  type SharedAccessRevokedEvent,
  type SharedEtaUpdateEvent,
  type SharedGpsUpdateEvent,
  type SharedTripStatusChangedEvent,
} from "../../lib/sharedTrackingSocket";
import { isRecord } from "../../utils/typeGuards";

export type SharedConnectionState =
  | "loading"
  | "live"
  | "connecting"
  | "offline"
  | "ended"
  | "error";

export type SharedTripViewState = {
  connection: SharedConnectionState;
  context: SharedTripContext | null;
  location: SharedTripVehicleLocation | null;
  errorCode: string | null;
  errorMessage: string | null;
  revokedReason: string | null;
};

const INITIAL: SharedTripViewState = {
  connection: "loading",
  context: null,
  location: null,
  errorCode: null,
  errorMessage: null,
  revokedReason: null,
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeGps(event: SharedGpsUpdateEvent): SharedTripVehicleLocation | null {
  const nested = isRecord(event.location) ? event.location : null;
  const latitude = asNumber(event.latitude) ?? asNumber(nested?.latitude);
  const longitude = asNumber(event.longitude) ?? asNumber(nested?.longitude);
  const recordedAt =
    asString(event.recordedAt) ?? asString(nested?.recordedAt) ?? new Date().toISOString();
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    heading: asNumber(event.heading) ?? asNumber(nested?.heading),
    speedKph: asNumber(event.speedKph) ?? asNumber(nested?.speedKph),
    recordedAt,
  };
}

function isTerminalStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s === "COMPLETED" || s === "CANCELLED" || s === "DISRUPTED" || s === "ENDED";
}

/**
 * Guest tracking session: REST context first, then Socket.IO /shared.
 * Token is passed in from the page (memory after the hash is stripped).
 * Never put the raw token in React Query keys or logs.
 */
export function useSharedTripTracking(shareToken: string | null) {
  const [state, setState] = useState<SharedTripViewState>(INITIAL);
  const socketRef = useRef<Socket | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const loadSequenceRef = useRef(0);
  const tokenRef = useRef<string | null>(null);

  const teardownSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  }, []);

  const loadContext = useCallback(async (token: string) => {
    const sequence = ++loadSequenceRef.current;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      // Keep effect-triggered loads asynchronous; this also lets rapid token
      // changes abort before committing an intermediate loading state.
      await Promise.resolve();
      if (
        controller.signal.aborted ||
        loadSequenceRef.current !== sequence ||
        tokenRef.current !== token
      ) return;

      setState((prev) => ({
        ...prev,
        connection: prev.context ? "connecting" : "loading",
        errorCode: null,
        errorMessage: null,
        revokedReason: null,
      }));

      const context = await fetchSharedTripContext(token, controller.signal);
      if (
        controller.signal.aborted ||
        loadSequenceRef.current !== sequence ||
        tokenRef.current !== token
      ) return;

      const terminal = isTerminalStatus(context.status);
      setState({
        connection: terminal ? "ended" : "connecting",
        context,
        location: context.vehicle.location,
        errorCode: null,
        errorMessage: null,
        revokedReason: null,
      });

      if (terminal) {
        teardownSocket();
        return;
      }

      teardownSocket();
      const socket = createSharedTrackingSocket(token);
      socketRef.current = socket;

      socket.on("connect", () => {
        if (tokenRef.current !== token) return;
        setState((prev) => ({
          ...prev,
          connection: prev.connection === "ended" ? "ended" : "live",
        }));
      });

      socket.on("disconnect", () => {
        if (tokenRef.current !== token) return;
        setState((prev) => ({
          ...prev,
          connection:
            prev.connection === "ended" || prev.connection === "error"
              ? prev.connection
              : "connecting",
        }));
      });

      socket.on("connect_error", (error: Error) => {
        if (tokenRef.current !== token) return;
        const errorCode = error.message;
        if (
          errorCode === "TRACKING_SHARE_TOKEN_INVALID" ||
          errorCode === "TRACKING_SHARE_LINK_UNAVAILABLE"
        ) {
          teardownSocket();
          setState({
            connection: "error",
            context: null,
            location: null,
            errorCode,
            errorMessage: null,
            revokedReason:
              errorCode === "TRACKING_SHARE_LINK_UNAVAILABLE" ? "REVOKED" : null,
          });
          return;
        }
        // Keep last context; surface soft reconnecting state (not fatal).
        setState((prev) => ({
          ...prev,
          connection: prev.context ? "connecting" : "error",
        }));
      });

      socket.on("shared:gps:update", (payload: SharedGpsUpdateEvent) => {
        if (tokenRef.current !== token) return;
        const location = normalizeGps(payload);
        if (!location) return;
        setState((prev) => ({
          ...prev,
          connection: "live",
          location,
          context: prev.context
            ? {
                ...prev.context,
                lastUpdatedAt: location.recordedAt,
                vehicle: { location },
              }
            : prev.context,
        }));
      });

      socket.on("shared:eta:update", (payload: SharedEtaUpdateEvent) => {
        if (tokenRef.current !== token) return;
        const eta = isRecord(payload.eta) ? payload.eta : null;
        if (!eta) return;
        const updatedAt = asString(eta.updatedAt) ?? new Date().toISOString();
        setState((prev) => {
          if (!prev.context) return prev;
          return {
            ...prev,
            context: {
              ...prev.context,
              lastUpdatedAt: updatedAt,
              eta: {
                estimatedArrivalAt: asString(eta.estimatedArrivalAt),
                remainingSeconds: asNumber(eta.remainingSeconds),
                delayMinutes: asNumber(eta.delayMinutes),
                updatedAt,
              },
            },
          };
        });
      });

      socket.on("shared:trip:statusChanged", (payload: SharedTripStatusChangedEvent) => {
        if (tokenRef.current !== token) return;
        const status = asString(payload.status);
        if (!status) return;
        const terminal = isTerminalStatus(status);
        if (terminal) teardownSocket();
        setState((prev) => ({
          ...prev,
          connection: terminal ? "ended" : prev.connection,
          context: prev.context
            ? { ...prev.context, status }
            : prev.context,
        }));
      });

      socket.on("shared:access:revoked", (payload: SharedAccessRevokedEvent) => {
        if (tokenRef.current !== token) return;
        teardownSocket();
        setState({
          connection: "ended",
          context: null,
          location: null,
          errorCode: null,
          errorMessage: null,
          revokedReason: asString(payload.reason) ?? "REVOKED",
        });
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        loadSequenceRef.current !== sequence ||
        tokenRef.current !== token
      ) return;
      teardownSocket();
      const apiError = error instanceof ApiRequestError ? error : null;
      setState({
        connection: "error",
        context: null,
        location: null,
        errorCode: apiError?.code ?? "UNAVAILABLE",
        errorMessage: apiError?.message ?? "Unable to open this shared journey.",
        revokedReason: null,
      });
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }, [teardownSocket]);

  useEffect(() => {
    tokenRef.current = shareToken;

    if (!shareToken) {
      teardownSocket();
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setState({
          connection: "error",
          context: null,
          location: null,
          errorCode: "TRACKING_SHARE_TOKEN_INVALID",
          errorMessage: "Missing or invalid share link.",
          revokedReason: null,
        });
      });
      return () => {
        active = false;
        tokenRef.current = null;
      };
    }

    const initialLoadTimer = window.setTimeout(() => {
      void loadContext(shareToken);
    }, 0);

    const onOffline = () => {
      setState((prev) => ({
        ...prev,
        connection: prev.connection === "ended" ? "ended" : "offline",
      }));
    };
    const onOnline = () => {
      if (tokenRef.current) {
        void loadContext(tokenRef.current);
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearTimeout(initialLoadTimer);
      loadSequenceRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      tokenRef.current = null;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      teardownSocket();
    };
  }, [loadContext, shareToken, teardownSocket]);

  const retry = useCallback(() => {
    if (!shareToken) return;
    void loadContext(shareToken);
  }, [loadContext, shareToken]);

  return { ...state, retry };
}
