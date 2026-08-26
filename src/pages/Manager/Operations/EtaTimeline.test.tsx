import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PublicTrip,
  TrackingEstimateQuality,
  TrackingEtaTarget,
} from "../../../api/vietride";
import { EtaTimeline } from "./EtaTimeline";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

const trip: PublicTrip = {
  tripId: "trip-1",
  operatorId: "operator-1",
  routeId: "route-1",
  status: "IN_PROGRESS",
  departureTime: "08:00",
  estimatedArrivalTime: "2026-08-05T11:00:00Z",
  plannedEtaQuality: "FALLBACK",
  baseFare: 250000,
  originStation: { id: "origin-station", name: "Bến đi" },
  destinationStation: {
    id: "destination-station",
    name: "Bến đích kế hoạch",
  },
  stops: [
    {
      stopId: "stop-1",
      name: "Trạm kế hoạch",
      orderIndex: 1,
      allowPickup: true,
      allowDropoff: true,
      status: "PENDING",
      estimatedArrivalTime: "2026-08-05T09:15:00Z",
      distanceFromOriginKm: 55,
      fareFromThisStop: 180000,
    },
  ],
};

function etaTargetWithQuality(
  estimateQuality: TrackingEstimateQuality,
): TrackingEtaTarget {
  return {
    tripId: "trip-1",
    targetKind: "STOP",
    stopId: "stop-1",
    stopName: "Trạm realtime",
    sequence: 1,
    etaMinutes: 12,
    estimatedArrivalTime: "2026-08-05T09:12:00Z",
    distanceMeters: 7200,
    updatedAt: "2026-08-05T09:00:00Z",
    estimateQuality,
  };
}

describe("EtaTimeline", () => {
  it("maps realtime stop by stopId and destination by stationId", () => {
    const etaTargets: TrackingEtaTarget[] = [
      {
        tripId: "trip-1",
        targetKind: "STOP",
        stopId: "stop-1",
        stopName: "Trạm realtime",
        sequence: 1,
        etaMinutes: 12,
        estimatedArrivalTime: "2026-08-05T09:12:00Z",
        distanceMeters: 7200,
        updatedAt: "2026-08-05T09:00:00Z",
        estimateQuality: "TRAFFIC_AWARE",
      },
      {
        tripId: "trip-1",
        targetKind: "STATION",
        stationId: "destination-station",
        stopName: "Bến đích realtime",
        etaMinutes: 90,
        estimatedArrivalTime: "2026-08-05T10:30:00Z",
        distanceMeters: 105000,
        updatedAt: "2026-08-05T09:00:00Z",
        estimateQuality: "TRAFFIC_AWARE",
      },
    ];

    render(<EtaTimeline trip={trip} etaTargets={etaTargets} />);

    expect(screen.getByText("Trạm realtime")).toBeInTheDocument();
    expect(screen.getByText("Bến đích realtime")).toBeInTheDocument();
    expect(screen.getAllByText("gps.etaRealtime")).toHaveLength(2);
    expect(screen.getByText("gps.etaMinutes 12")).toBeInTheDocument();
    expect(screen.getByText("gps.etaMinutes 90")).toBeInTheDocument();

    expect(
      within(screen.getByTestId("eta-target-STOP:stop-1")).getByRole("time"),
    ).toHaveAttribute("datetime", "2026-08-05T09:12:00Z");
    expect(
      within(
        screen.getByTestId("eta-target-STATION:destination-station"),
      ).getByRole("time"),
    ).toHaveAttribute("datetime", "2026-08-05T10:30:00Z");
  });

  it("falls back to planned stop and destination times when cache is cold", () => {
    render(<EtaTimeline trip={trip} etaTargets={[]} />);

    expect(screen.getByText("Trạm kế hoạch")).toBeInTheDocument();
    expect(screen.getByText("Bến đích kế hoạch")).toBeInTheDocument();
    expect(screen.getAllByText("gps.etaPlanned")).toHaveLength(2);

    expect(
      within(screen.getByTestId("eta-target-STOP:stop-1")).getByRole("time"),
    ).toHaveAttribute("datetime", "2026-08-05T09:15:00Z");
    expect(
      within(
        screen.getByTestId("eta-target-STATION:destination-station"),
      ).getByRole("time"),
    ).toHaveAttribute("datetime", "2026-08-05T11:00:00Z");
  });

  // Chưa có ETA realtime thì chất lượng lấy từ planned ETA của chuyến.
  it("shows planned eta quality when cache is cold", () => {
    render(<EtaTimeline trip={trip} etaTargets={[]} />);

    expect(screen.getAllByTestId("eta-quality-FALLBACK")).toHaveLength(2);
    expect(screen.getAllByText("gps.etaFallbackQuality")).toHaveLength(2);
  });

  it("renders the ROUTE_BASED quality added in Day 51", () => {
    render(
      <EtaTimeline trip={trip} etaTargets={[etaTargetWithQuality("ROUTE_BASED")]} />,
    );

    const stop = within(screen.getByTestId("eta-target-STOP:stop-1"));
    expect(stop.getByTestId("eta-quality-ROUTE_BASED")).toBeInTheDocument();
    expect(stop.getByText("gps.etaRouteBased")).toBeInTheDocument();
  });

  // Enum additive: giá trị lạ chỉ được đổi nhãn, không được làm mất dòng ETA.
  it("keeps rendering the row for an unknown quality value", () => {
    render(
      <EtaTimeline
        trip={trip}
        etaTargets={[etaTargetWithQuality("SATELLITE_AWARE")]}
      />,
    );

    const stop = within(screen.getByTestId("eta-target-STOP:stop-1"));
    expect(stop.getByTestId("eta-quality-UNKNOWN")).toBeInTheDocument();
    expect(stop.getByText("gps.etaQualityUnknown")).toBeInTheDocument();
    expect(stop.getByText("gps.etaMinutes 12")).toBeInTheDocument();
    expect(stop.queryByText("SATELLITE_AWARE")).not.toBeInTheDocument();
  });
});

