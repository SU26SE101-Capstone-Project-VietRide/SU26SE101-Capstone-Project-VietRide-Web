import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SharedTripContext } from "./tripShareApi";

const {
  createSocketMock,
  fetchContextMock,
  listeners,
  socket,
} = vi.hoisted(() => {
  const eventListeners = new Map<string, (payload?: unknown) => void>();
  const mockSocket = {
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      eventListeners.set(event, handler);
      return mockSocket;
    }),
    removeAllListeners: vi.fn(),
  };
  return {
    createSocketMock: vi.fn(() => mockSocket),
    fetchContextMock: vi.fn(),
    listeners: eventListeners,
    socket: mockSocket,
  };
});

vi.mock("./tripShareApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tripShareApi")>();
  return {
    ...actual,
    fetchSharedTripContext: fetchContextMock,
  };
});

vi.mock("../../lib/sharedTrackingSocket", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../lib/sharedTrackingSocket")
  >();
  return {
    ...actual,
    createSharedTrackingSocket: createSocketMock,
  };
});

import { useSharedTripTracking } from "./useSharedTripTracking";

const initialLocation = {
  latitude: 10.75,
  longitude: 106.85,
  speedKph: 45,
  heading: 120,
  recordedAt: "2026-08-31T08:00:00+07:00",
};

const initialContext: SharedTripContext = {
  status: "IN_PROGRESS",
  expiresAt: "2026-09-01T08:00:00+07:00",
  lastUpdatedAt: initialLocation.recordedAt,
  vehicle: { location: initialLocation },
  route: {
    originName: "Bến xe Miền Đông",
    destinationName: "Bến xe Đà Lạt",
    origin: null,
    destination: null,
    stops: [],
    geometry: null,
  },
  eta: {
    estimatedArrivalAt: "2026-08-31T12:00:00+07:00",
    remainingSeconds: 14_400,
    delayMinutes: 0,
    updatedAt: initialLocation.recordedAt,
  },
};

describe("useSharedTripTracking — vehicle substitution", () => {
  beforeEach(() => {
    listeners.clear();
    createSocketMock.mockClear();
    fetchContextMock.mockReset();
    socket.disconnect.mockClear();
    socket.on.mockClear();
    socket.removeAllListeners.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the socket and old marker, clears ETA, then resumes on new GPS", async () => {
    fetchContextMock.mockResolvedValue(initialContext);
    const { result, unmount } = renderHook(() =>
      useSharedTripTracking("v1.grant.signature"),
    );

    await waitFor(() => expect(createSocketMock).toHaveBeenCalledTimes(1));
    act(() => listeners.get("connect")?.());

    act(() =>
      listeners.get("shared:trip:vehicleSubstituted")?.({
        status: "VEHICLE_REPLACEMENT_PENDING",
        occurredAt: "2026-08-31T08:05:00+07:00",
      }),
    );

    expect(result.current.context?.status).toBe(
      "VEHICLE_REPLACEMENT_PENDING",
    );
    expect(result.current.context?.eta).toBeNull();
    expect(result.current.location).toEqual(initialLocation);
    expect(socket.disconnect).not.toHaveBeenCalled();

    act(() =>
      listeners.get("shared:eta:update")?.({
        eta: { remainingSeconds: 300, updatedAt: "2026-08-31T08:06:00+07:00" },
      }),
    );
    expect(result.current.context?.eta).toBeNull();

    act(() =>
      listeners.get("shared:gps:update")?.({
        latitude: 10.8,
        longitude: 106.9,
        speedKph: 30,
        heading: 90,
        recordedAt: "2026-08-31T08:10:00+07:00",
      }),
    );

    expect(result.current.context?.status).toBe("IN_PROGRESS");
    expect(result.current.location).toEqual(
      expect.objectContaining({ latitude: 10.8, longitude: 106.9 }),
    );
    expect(createSocketMock).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("refreshes pending context after socket reconnect with the same token", async () => {
    fetchContextMock
      .mockResolvedValueOnce(initialContext)
      .mockResolvedValueOnce({
        ...initialContext,
        status: "VEHICLE_REPLACEMENT_PENDING",
        eta: null,
      });
    const { result, unmount } = renderHook(() =>
      useSharedTripTracking("v1.grant.signature"),
    );

    await waitFor(() => expect(createSocketMock).toHaveBeenCalledTimes(1));
    act(() => listeners.get("connect")?.());
    act(() => listeners.get("connect")?.());

    await waitFor(() => expect(fetchContextMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.context?.status).toBe(
        "VEHICLE_REPLACEMENT_PENDING",
      ),
    );
    expect(createSocketMock).toHaveBeenCalledTimes(1);
    expect(fetchContextMock).toHaveBeenLastCalledWith("v1.grant.signature");

    unmount();
  });

  it("recovers a missed replacement GPS through REST without replacing the socket", async () => {
    vi.useFakeTimers();
    const replacementLocation = {
      ...initialLocation,
      latitude: 10.8,
      longitude: 106.9,
      recordedAt: "2026-08-31T08:10:00+07:00",
    };
    fetchContextMock
      .mockResolvedValueOnce(initialContext)
      .mockResolvedValueOnce({
        ...initialContext,
        status: "VEHICLE_REPLACEMENT_PENDING",
        vehicle: { location: null },
        eta: null,
      })
      .mockResolvedValueOnce({
        ...initialContext,
        status: "IN_PROGRESS",
        lastUpdatedAt: replacementLocation.recordedAt,
        vehicle: { location: replacementLocation },
      });

    const { result, unmount } = renderHook(() =>
      useSharedTripTracking("v1.grant.signature"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(createSocketMock).toHaveBeenCalledTimes(1);

    act(() =>
      listeners.get("shared:trip:vehicleSubstituted")?.({
        status: "VEHICLE_REPLACEMENT_PENDING",
        occurredAt: "2026-08-31T08:05:00+07:00",
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchContextMock).toHaveBeenCalledTimes(2);
    expect(result.current.context?.status).toBe(
      "VEHICLE_REPLACEMENT_PENDING",
    );
    expect(result.current.location).toEqual(initialLocation);
    expect(result.current.context?.vehicle.location).toEqual(initialLocation);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchContextMock).toHaveBeenCalledTimes(3);
    expect(result.current.context?.status).toBe("IN_PROGRESS");
    expect(result.current.location).toEqual(replacementLocation);
    expect(createSocketMock).toHaveBeenCalledTimes(1);

    unmount();
  });
});
