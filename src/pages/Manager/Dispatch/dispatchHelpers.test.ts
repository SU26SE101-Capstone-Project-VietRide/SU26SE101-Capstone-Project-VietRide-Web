import { describe, expect, it } from "vitest";
import type {
  OperatorShuttleContext,
  OperatorShuttleTripListItem,
  ShuttleBookingGroup,
  ShuttleRequestGroup,
} from "../../../api/vietride";
import {
  SHUTTLE_SIGNAL_TTL_MS,
  bookingPassengerPhones,
  bookingTicketCount,
  findNotifiedStop,
  findStopByPickupOrder,
  isStaleSignal,
  nextPickupLabel,
  pickNewerEta,
  pickNewerLatest,
  toRequestPickupMarkers,
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

describe("isStaleSignal", () => {
  it("chỉ báo cũ khi điểm GPS vượt TTL của BE", () => {
    expect(isStaleSignal(latestAt(SHUTTLE_SIGNAL_TTL_MS - 1_000), now)).toBe(
      false,
    );
    expect(isStaleSignal(latestAt(SHUTTLE_SIGNAL_TTL_MS + 1_000), now)).toBe(
      true,
    );
  });

  it("không có điểm hoặc mốc thời gian hỏng thì không báo mất tín hiệu", () => {
    expect(isStaleSignal(null, now)).toBe(false);
    expect(isStaleSignal(undefined, now)).toBe(false);
    // Báo "mất tín hiệu" cho một chuyến vừa gửi dữ liệu còn tệ hơn im lặng.
    expect(
      isStaleSignal({ ...latestAt(0), recordedAt: "không-phải-ngày" }, now),
    ).toBe(false);
  });
});

function bookingWith(
  passengers: ShuttleBookingGroup["passengers"],
): ShuttleBookingGroup {
  return {
    bookingId: "36000000-0000-4000-8000-000000000301",
    passengerCount: passengers.length,
    pickupAddress: "123 Nguyễn Huệ, Quận 1",
    pickupLat: 10.7731,
    pickupLng: 106.7032,
    distanceToStationMeters: 9500,
    roadDistanceMeters: 9500,
    requestedAt: "2026-08-11T16:30:00+07:00",
    passengers,
  };
}

describe("bookingPassengerPhones", () => {
  it("bỏ số trùng và số rỗng", () => {
    const booking = bookingWith([
      {
        passengerUserId: "u1",
        displayName: "A",
        phone: "0900000000",
        ticketIds: ["t1"],
      },
      {
        passengerUserId: "u2",
        displayName: "B",
        // Cả nhà đi chung thường đăng ký cùng một số — hiện hai lần là thừa.
        phone: " 0900000000 ",
        ticketIds: ["t2"],
      },
      {
        passengerUserId: "u3",
        displayName: "C",
        phone: null,
        ticketIds: ["t3"],
      },
    ]);

    expect(bookingPassengerPhones(booking)).toEqual(["0900000000"]);
  });
});

describe("bookingTicketCount", () => {
  it("gộp vé của mọi hành khách trong lượt đặt và bỏ trùng", () => {
    const booking = bookingWith([
      {
        passengerUserId: "u1",
        displayName: "A",
        phone: "0900000000",
        ticketIds: ["t1", "t2"],
      },
      {
        passengerUserId: "u2",
        displayName: "B",
        phone: "0900000001",
        ticketIds: ["t2", "t3"],
      },
    ]);

    expect(bookingTicketCount(booking)).toBe(3);
  });
});

describe("toRequestPickupMarkers", () => {
  const requestGroup: ShuttleRequestGroup = {
    mainTripId: "36000000-0000-4000-8000-000000000101",
    routeName: "Sài Gòn - Đà Lạt",
    direction: "INBOUND_TO_STATION",
    departureDateTime: "2026-08-12T23:00:00+07:00",
    hardCutoffAt: "2026-08-12T22:30:00+07:00",
    stationId: "36000000-0000-4000-8000-000000000201",
    stationName: "Bến xe Miền Đông",
    pendingPassengerCount: 3,
    bookingGroups: [
      { ...bookingWith([]), bookingId: "booking-b", pickupLat: 10.8, pickupLng: 106.7 },
      { ...bookingWith([]), bookingId: "booking-a", pickupLat: 10.7, pickupLng: 106.6 },
    ],
    suggestedBookingOrder: ["booking-a", "booking-b"],
  };

  it("đánh số marker theo thứ tự đề xuất, không theo thứ tự mảng BE trả", () => {
    const markers = toRequestPickupMarkers(requestGroup);

    expect(markers.map((marker) => marker.id)).toEqual([
      "pickup:booking-a",
      "pickup:booking-b",
    ]);
    expect(markers.map((marker) => marker.orderIndex)).toEqual([1, 2]);
    expect(markers[0].position).toEqual({ lat: 10.7, lng: 106.6 });
    // Nhóm chờ chưa có chuyến nên chưa điểm nào được đi qua.
    expect(markers.every((marker) => marker.passed === undefined)).toBe(true);
  });
});

describe("findNotifiedStop", () => {
  const stops = [
    {
      pickupOrder: 1,
      bookingId: "booking-a",
      latitude: 10.7,
      longitude: 106.6,
      status: "PENDING",
      isStation: false,
    },
    {
      pickupOrder: 2,
      bookingId: "booking-b",
      latitude: 10.75,
      longitude: 106.65,
      status: "PENDING",
      isStation: false,
    },
    {
      pickupOrder: 3,
      bookingId: null,
      latitude: 10.8,
      longitude: 106.7,
      status: "PENDING",
      isStation: true,
    },
  ];

  it("ưu tiên khớp cả bookingId lẫn pickupOrder", () => {
    expect(
      findNotifiedStop(stops, { bookingId: "booking-b", pickupOrder: 2 }),
    ).toBe(stops[1]);
  });

  it("lệch pickupOrder thì vẫn bám theo bookingId", () => {
    // Điểm bị dời thứ tự sau khi điều phối lại — bookingId mới là thứ ổn định
    expect(
      findNotifiedStop(stops, { bookingId: "booking-a", pickupOrder: 99 }),
    ).toBe(stops[0]);
  });

  it("thông báo chỉ có pickupOrder thì khớp theo số thứ tự", () => {
    expect(findNotifiedStop(stops, { pickupOrder: 3 })).toBe(stops[2]);
  });

  it("không có gì để khớp thì KHÔNG tô sáng bừa một điểm", () => {
    // Khác app hành khách (lùi về phần tử đầu): console nhà xe nhìn cả chuyến,
    // tô nhầm điểm của khách khác còn tệ hơn là không tô.
    expect(findNotifiedStop(stops, {})).toBeNull();
    expect(findNotifiedStop(stops, { bookingId: "booking-x" })).toBeNull();
    expect(findNotifiedStop([], { bookingId: "booking-a" })).toBeNull();
    expect(findNotifiedStop(undefined, { pickupOrder: 1 })).toBeNull();
  });
});
