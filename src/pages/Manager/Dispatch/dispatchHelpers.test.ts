import { describe, expect, it } from "vitest";
import type {
  OperatorShuttleContext,
  OperatorShuttleTripListItem,
} from "../../../api/vietride";
import {
  SHUTTLE_SIGNAL_TTL_MS,
  findStopByPickupOrder,
  nextPickupLabel,
  pickNewerEta,
  pickNewerLatest,
  toShuttleMapPoint,
} from "./dispatchHelpers";
import { toShuttleRouteMarkers } from "../../../components/fleetMapPoint";

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

// BE trả điểm đón qua `operator-context` (FE-REQUEST-shuttle-operator-tracking-
// RESPONSE.md §1). Ghép ETA phải dùng `pickupOrder` — thứ tự nghiệp vụ — chứ
// không dùng index mảng, vì hai giá trị này lệch nhau khi có điểm bị bỏ.
describe("operator shuttle context", () => {
  const context: OperatorShuttleContext = {
    shuttleTripId: trip.shuttleTripId,
    mainTripId: trip.mainTripId,
    direction: "INBOUND_TO_STATION",
    status: "IN_PROGRESS",
    stops: [
      {
        pickupOrder: 2,
        bookingId: "booking-2",
        latitude: 10.7901,
        longitude: 106.6802,
        status: "PICKED_UP",
        isStation: false,
        serviceAddress: "45 Điện Biên Phủ, Bình Thạnh",
      },
      {
        pickupOrder: 3,
        bookingId: "booking-3",
        latitude: 10.7731,
        longitude: 106.7032,
        status: "PENDING",
        isStation: false,
        serviceAddress: "123 Nguyễn Huệ, Quận 1",
      },
      {
        pickupOrder: 4,
        bookingId: null,
        latitude: 10.81,
        longitude: 106.63,
        status: "PENDING",
        isStation: true,
        serviceAddress: "Bến xe Miền Đông",
      },
    ],
    station: {
      stationId: "station-1",
      name: "Bến xe Miền Đông",
      latitude: 10.81,
      longitude: 106.63,
      pickupOrder: 4,
    },
  };

  const eta = (nextPickupOrder: number) => ({
    shuttleTripId: trip.shuttleTripId,
    nextPickupOrder,
    etaMinutes: 8,
    estimatedArrivalTime: "2026-08-12T21:40:00+07:00",
    distanceMeters: 2_400,
    updatedAt: "2026-08-12T21:32:00+07:00",
  });

  it("tìm điểm đón theo pickupOrder chứ không theo vị trí trong mảng", () => {
    // pickupOrder 3 nằm ở index 1 — lấy theo index sẽ ra nhầm điểm
    expect(findStopByPickupOrder(context, 3)?.serviceAddress).toBe(
      "123 Nguyễn Huệ, Quận 1",
    );
    expect(findStopByPickupOrder(context, 99)).toBeNull();
    expect(findStopByPickupOrder(null, 3)).toBeNull();
  });

  it("hiện địa chỉ điểm đón kế tiếp, thiếu thì lùi về số thứ tự", () => {
    const fallback = (order: number) => `Thứ tự #${order}`;

    expect(nextPickupLabel(context, eta(3), fallback)).toBe(
      "123 Nguyễn Huệ, Quận 1",
    );
    // Chưa nạp được context thì vẫn phải có nhãn, không để trống
    expect(nextPickupLabel(null, eta(3), fallback)).toBe("Thứ tự #3");
    expect(nextPickupLabel(context, null, fallback)).toBeNull();
  });

  it("dựng marker: bến là điểm cuối khi chạy vào bến, điểm đã qua bị đánh dấu", () => {
    const markers = toShuttleRouteMarkers(context, "Bến xe");

    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({
      kind: "stop",
      orderIndex: 2,
      passed: true,
    });
    expect(markers[1]).toMatchObject({ kind: "stop", passed: false });
    // isStation + INBOUND_TO_STATION => điểm cuối hành trình
    expect(markers[2]).toMatchObject({
      kind: "destination",
      name: "Bến xe Miền Đông",
      orderIndex: undefined,
    });
  });

  it("chuyến rời bến thì bến là điểm đầu", () => {
    const markers = toShuttleRouteMarkers(
      { ...context, direction: "OUTBOUND_FROM_STATION" },
      "Bến xe",
    );

    expect(markers[2]).toMatchObject({ kind: "origin" });
  });

  it("station null không làm vỡ danh sách marker", () => {
    const markers = toShuttleRouteMarkers(
      {
        ...context,
        station: null,
        stops: [
          {
            pickupOrder: 1,
            bookingId: null,
            latitude: 10.81,
            longitude: 106.63,
            status: "PENDING",
            isStation: true,
          },
        ],
      },
      "Bến xe",
    );

    expect(markers).toHaveLength(1);
    expect(markers[0].name).toBe("Bến xe");
  });

  it("không có context thì không vẽ marker nào", () => {
    expect(toShuttleRouteMarkers(null, "Bến xe")).toEqual([]);
  });
});
