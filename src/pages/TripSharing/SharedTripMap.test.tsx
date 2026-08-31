import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SharedTripMap from "./SharedTripMap";
import type { SharedTripContext, SharedTripVehicleLocation } from "./tripShareApi";

const { canvasProps } = vi.hoisted(() => ({
  canvasProps: [] as Array<{
    fallbackMapStyleUrl?: string;
    fitPoints?: Array<{ lat: number; lng: number }>;
    focusCenter?: { lat: number; lng: number } | null;
    focusZoom?: number;
    fitKey?: string;
    mapStyleUrl?: string;
    pointMarkers?: Array<{ id: string; title?: string }>;
    snapToFocusAfterZoom?: boolean;
    suspendViewportSync?: boolean;
  }>,
}));

vi.mock("../../components/GoogleMapCanvas", () => ({
  default: (props: (typeof canvasProps)[number]) => {
    canvasProps.push(props);
    return <div data-testid="google-map-canvas" />;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "map.ariaLabel": "Bản đồ",
        "map.unavailable": "Không tải được bản đồ",
        "map.legendOrigin": "Bến đi",
        "map.legendDestination": "Bến đến",
        "map.legendStop": "Điểm dừng",
        "map.vehicle": "Vị trí xe",
        "map.vehicleBeforeReplacement": "Vị trí trước khi đổi xe",
        "map.focusVehicle": "Vị trí xe",
        "map.legendVehicle": "Xe đang chạy",
        "map.legendVehicleBeforeReplacement": "Vị trí trước khi đổi xe",
        "map.waitingForReplacementVehicle": "Đang chờ vị trí xe mới",
        "map.viewWholeRoute": "Xem toàn tuyến",
      };
      return translations[key] ?? key;
    },
  }),
}));

const mockContext: SharedTripContext = {
  status: "IN_PROGRESS",
  expiresAt: "2026-08-30T12:00:00Z",
  lastUpdatedAt: "2026-08-30T09:30:00Z",
  vehicle: { location: null },
  route: {
    originName: "Bến xe Miền Đông",
    destinationName: "Bến xe Vũng Tàu",
    origin: { latitude: 10.8231, longitude: 106.6297 },
    destination: { latitude: 10.346, longitude: 107.0843 },
    geometry: null,
    stops: [
      {
        name: "Trạm dừng Long Thành",
        latitude: 10.7412,
        longitude: 106.9534,
        sequence: 1,
      },
    ],
  },
  eta: {
    remainingSeconds: 1800,
    estimatedArrivalAt: "2026-08-30T10:00:00Z",
    delayMinutes: 0,
    updatedAt: "2026-08-30T09:30:00Z",
  },
};

const mockVehicleLocation: SharedTripVehicleLocation = {
  latitude: 10.75,
  longitude: 106.85,
  speedKph: 55,
  heading: 120,
  recordedAt: "2026-08-30T09:35:00Z",
};

describe("SharedTripMap", () => {
  beforeEach(() => {
    canvasProps.length = 0;
  });

  it("does not render the follow vehicle toggle button when vehicle position is absent", () => {
    render(<SharedTripMap context={mockContext} location={null} />);

    expect(screen.getByTestId("google-map-canvas")).toBeInTheDocument();
    expect(screen.queryByTestId("follow-vehicle-toggle")).not.toBeInTheDocument();

    const lastCanvasProp = canvasProps.at(-1);
    expect(lastCanvasProp?.focusCenter).toBeNull();
    expect(lastCanvasProp?.fitPoints?.length).toBeGreaterThan(0);
    expect(lastCanvasProp?.mapStyleUrl).toBe(
      "https://tiles.goong.io/assets/goong_map_web.json",
    );
    expect(lastCanvasProp?.fallbackMapStyleUrl).toBe(
      "https://tiles.goong.io/assets/goong_light_v2.json",
    );
  });

  it("renders follow vehicle toggle button when vehicle position is available", () => {
    render(<SharedTripMap context={mockContext} location={mockVehicleLocation} />);

    const toggleBtn = screen.getByTestId("follow-vehicle-toggle");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Vị trí xe")).toBeInTheDocument();
  });

  it("toggles between focusing on vehicle and viewing the whole route on click", () => {
    const { rerender } = render(
      <SharedTripMap context={mockContext} location={mockVehicleLocation} />,
    );

    const toggleBtn = screen.getByTestId("follow-vehicle-toggle");

    // Initially: whole route view (follow is false)
    expect(canvasProps.at(-1)?.focusCenter).toBeNull();
    expect(canvasProps.at(-1)?.fitPoints?.length).toBeGreaterThan(0);
    expect(canvasProps.at(-1)?.suspendViewportSync).toBe(false);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    const initialRouteFitKey = canvasProps.at(-1)?.fitKey;

    // 1st Click: Switch to follow vehicle
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Xem toàn tuyến")).toBeInTheDocument();
    expect(canvasProps.at(-1)?.focusCenter).toEqual({
      lat: mockVehicleLocation.latitude,
      lng: mockVehicleLocation.longitude,
    });
    expect(canvasProps.at(-1)?.focusZoom).toBe(15);
    expect(canvasProps.at(-1)?.snapToFocusAfterZoom).toBe(true);
    expect(canvasProps.at(-1)?.fitPoints).toBeUndefined();
    expect(canvasProps.at(-1)?.fitKey).toBe(initialRouteFitKey);
    expect(canvasProps.at(-1)?.suspendViewportSync).toBe(true);

    // A polling/socket GPS update must only move focusCenter. Keeping the same
    // fitKey prevents the route viewport effect from resetting center/zoom.
    const nextVehicleLocation: SharedTripVehicleLocation = {
      ...mockVehicleLocation,
      latitude: 10.76,
      longitude: 106.87,
      recordedAt: "2026-08-30T09:35:10Z",
    };
    rerender(<SharedTripMap context={mockContext} location={nextVehicleLocation} />);

    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(canvasProps.at(-1)?.focusCenter).toEqual({
      lat: nextVehicleLocation.latitude,
      lng: nextVehicleLocation.longitude,
    });
    expect(canvasProps.at(-1)?.fitPoints).toBeUndefined();
    expect(canvasProps.at(-1)?.fitKey).toBe(initialRouteFitKey);
    expect(canvasProps.at(-1)?.suspendViewportSync).toBe(true);

    // 2nd Click: Switch back to view whole route
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Vị trí xe")).toBeInTheDocument();
    expect(canvasProps.at(-1)?.focusCenter).toBeNull();
    expect(canvasProps.at(-1)?.fitPoints?.length).toBeGreaterThan(0);
    expect(canvasProps.at(-1)?.fitKey).not.toBe(initialRouteFitKey);
    expect(canvasProps.at(-1)?.suspendViewportSync).toBe(false);
  });

  it("labels the retained marker as the position before vehicle replacement", () => {
    render(
      <SharedTripMap
        context={{
          ...mockContext,
          status: "VEHICLE_REPLACEMENT_PENDING",
          eta: null,
        }}
        location={mockVehicleLocation}
      />,
    );

    expect(
      screen.getAllByText("Vị trí trước khi đổi xe").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      canvasProps.at(-1)?.pointMarkers?.find((marker) => marker.id === "vehicle"),
    ).toEqual(expect.objectContaining({ title: "Vị trí trước khi đổi xe" }));
  });

  it("keeps vehicle mode visible but disabled while waiting for the new GPS", () => {
    render(
      <SharedTripMap
        context={{
          ...mockContext,
          status: "VEHICLE_REPLACEMENT_PENDING",
          eta: null,
        }}
        location={null}
      />,
    );

    const toggleBtn = screen.getByTestId("follow-vehicle-toggle");
    expect(toggleBtn).toBeDisabled();
    expect(toggleBtn).toHaveTextContent("Đang chờ vị trí xe mới");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
  });
});
