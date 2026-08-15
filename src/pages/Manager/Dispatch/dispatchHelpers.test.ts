import { describe, expect, it } from "vitest";
import type { OperatorShuttleTripListItem } from "../../../api/vietride";
import {
  SHUTTLE_SIGNAL_TTL_MS,
  pickNewerEta,
  pickNewerLatest,
  toShuttleMapPoint,
} from "./dispatchHelpers";

const labels = {
  unknownVehicle: "Chưa gán xe",
  unassignedDriver: "Chưa gán tài xế",
  route: "Đón khách",
};

const trip: OperatorShuttleTripListItem = {
  shuttleTripId: "36000000-0000-4000-8000-000000000401",
  mainTripId: "36000000-0000-4000-8000-000000000101",
  direction: "INBOUND_TO_STATION",
  status: "IN_PROGRESS",
  scheduledDepartureTime: "2026-08-12T21:30:00+07:00",
  scheduledEndTime: "2026-08-12T22:20:00+07:00",
  actualDepartureTime: null,
  completedAt: null,
  vehicle: { id: "vehicle-1", licensePlate: "51B-123.45" },
  driver: { id: "driver-1", displayName: "Trần Văn B", phone: "0900000001" },
  passengerCount: 2,
  stopCount: 1,
};

const now = new Date("2026-08-12T21:40:00+07:00").getTime();

function latestAt(offsetMs: number, extra: Record<string, number> = {}) {
  return {
    shuttleTripId: trip.shuttleTripId,
    latitude: 10.7626,
    longitude: 106.6601,
    recordedAt: new Date(now - offsetMs).toISOString(),
    ...extra,
  };
}

describe("toShuttleMapPoint", () => {
  it("trả null khi chuyến chưa có toạ độ nên không dựng marker", () => {
    expect(toShuttleMapPoint(trip, undefined, labels, now)).toBeNull();
    expect(
      toShuttleMapPoint(trip, { isRefreshing: false, latest: null }, labels, now),
    ).toBeNull();
  });

  it("map `heading` của shuttle sang `headingDeg` của marker", () => {
    const point = toShuttleMapPoint(
      trip,
      { isRefreshing: false, latest: latestAt(0, { heading: 210, speedKmh: 30 }) },
      labels,
      now,
    );

    expect(point).toMatchObject({
      id: trip.shuttleTripId,
      plate: "51B-123.45",
      driver: "Trần Văn B",
      status: "moving",
      headingDeg: 210,
      position: { lat: 10.7626, lng: 106.6601 },
    });
  });

  it("đánh dấu mất tín hiệu khi điểm cuối cũ hơn TTL của BE", () => {
    const stale = toShuttleMapPoint(
      trip,
      {
        isRefreshing: false,
        latest: latestAt(SHUTTLE_SIGNAL_TTL_MS + 1_000, { speedKmh: 40 }),
      },
      labels,
      now,
    );
    const fresh = toShuttleMapPoint(
      trip,
      {
        isRefreshing: false,
        latest: latestAt(SHUTTLE_SIGNAL_TTL_MS - 1_000, { speedKmh: 40 }),
      },
      labels,
      now,
    );

    expect(stale?.status).toBe("lost");
    expect(fresh?.status).toBe("moving");
  });

  it("lùi về nhãn thay thế khi thiếu biển số hoặc tên tài xế", () => {
    const point = toShuttleMapPoint(
      {
        ...trip,
        vehicle: { id: "vehicle-1", licensePlate: "  " },
        driver: { id: "driver-1", displayName: null, phone: null },
      },
      { isRefreshing: false, latest: latestAt(0) },
      labels,
      now,
    );

    expect(point?.plate).toBe(labels.unknownVehicle);
    expect(point?.driver).toBe(labels.unassignedDriver);
  });
});

describe("chọn bản mới giữa socket và REST", () => {
  const older = latestAt(60_000);
  const newer = latestAt(0);

  it("giữ điểm GPS mới hơn bất kể thứ tự tới", () => {
    expect(pickNewerLatest(newer, older)).toBe(newer);
    expect(pickNewerLatest(older, newer)).toBe(newer);
  });

  it("giữ bản đang có khi REST trả null", () => {
    expect(pickNewerLatest(newer, null)).toBe(newer);
    expect(pickNewerLatest(null, null)).toBeNull();
  });

  it("so ETA theo updatedAt", () => {
    const eta = (updatedAt: string) => ({
      shuttleTripId: trip.shuttleTripId,
      nextPickupOrder: 1,
      etaMinutes: 5,
      estimatedArrivalTime: updatedAt,
      distanceMeters: 1_200,
      updatedAt,
    });
    const first = eta("2026-08-12T21:35:00+07:00");
    const second = eta("2026-08-12T21:38:00+07:00");

    expect(pickNewerEta(first, second)).toBe(second);
    expect(pickNewerEta(second, first)).toBe(second);
  });
});
