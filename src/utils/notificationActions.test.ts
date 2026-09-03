import { describe, expect, it } from "vitest";
import type { NotificationItem } from "../api/vietride";
import {
  getNotificationActionPath,
  parseNotificationAction,
  resolveNotificationAction,
} from "./notificationActions";

function notification(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: "notification-1",
    type: "SHUTTLE_STARTED",
    title: "Xe trung chuyển đã bắt đầu chạy",
    body: "Theo dõi vị trí xe trung chuyển.",
    data: null,
    readAt: null,
    createdAt: "2026-08-22T08:00:01Z",
    ...overrides,
  };
}

describe("OPEN_SHUTTLE_TRACKING", () => {
  it("giữ bookingId và pickupOrder khi notification có đủ ba field", () => {
    const action = parseNotificationAction({
      type: "OPEN_SHUTTLE_TRACKING",
      params: {
        shuttleTripId: "shuttle-1",
        bookingId: "booking-1",
        pickupOrder: 2,
      },
    });

    expect(action).toEqual({
      type: "OPEN_SHUTTLE_TRACKING",
      params: {
        shuttleTripId: "shuttle-1",
        bookingId: "booking-1",
        pickupOrder: 2,
      },
    });
  });

  it("vẫn nhận notification cũ chỉ có shuttleTripId", () => {
    // Hai field mới là additive — thiếu KHÔNG được làm action hỏng
    expect(
      parseNotificationAction({
        type: "OPEN_SHUTTLE_TRACKING",
        params: { shuttleTripId: "shuttle-1" },
      }),
    ).toEqual({
      type: "OPEN_SHUTTLE_TRACKING",
      params: { shuttleTripId: "shuttle-1" },
    });
  });

  it("đọc được pickupOrder dạng chuỗi của payload FCM", () => {
    const action = parseNotificationAction({
      type: "OPEN_SHUTTLE_TRACKING",
      params: { shuttleTripId: "shuttle-1", pickupOrder: "3" },
    });

    expect(action?.type).toBe("OPEN_SHUTTLE_TRACKING");
    expect(action).toMatchObject({ params: { pickupOrder: 3 } });
  });

  it("bỏ qua pickupOrder rác thay vì đẩy NaN xuống URL", () => {
    const action = parseNotificationAction({
      type: "OPEN_SHUTTLE_TRACKING",
      params: { shuttleTripId: "shuttle-1", pickupOrder: "không-phải-số" },
    });

    expect(action).toEqual({
      type: "OPEN_SHUTTLE_TRACKING",
      params: { shuttleTripId: "shuttle-1" },
    });
  });

  it("parse actionParams dạng chuỗi JSON của FCM", () => {
    const action = resolveNotificationAction(
      notification({
        type: "SHUTTLE_REASSIGNED",
        actionType: "OPEN_SHUTTLE_TRACKING",
        actionParams:
          '{"shuttleTripId":"shuttle-1","bookingId":"booking-1","pickupOrder":2}',
      }),
    );

    expect(action).toEqual({
      type: "OPEN_SHUTTLE_TRACKING",
      params: {
        shuttleTripId: "shuttle-1",
        bookingId: "booking-1",
        pickupOrder: 2,
      },
    });
  });

  it("lấy được điểm đón từ data khi notification thiếu hẳn action", () => {
    const action = resolveNotificationAction(
      notification({
        data: {
          shuttleTripId: "shuttle-1",
          bookingId: "booking-1",
          pickupOrder: 2,
        },
      }),
    );

    expect(action).toEqual({
      type: "OPEN_SHUTTLE_TRACKING",
      params: {
        shuttleTripId: "shuttle-1",
        bookingId: "booking-1",
        pickupOrder: 2,
      },
    });
  });

  it("đưa cả ba field vào deep-link của màn Điều phối", () => {
    const path = getNotificationActionPath(
      notification({
        action: {
          type: "OPEN_SHUTTLE_TRACKING",
          params: {
            shuttleTripId: "shuttle-1",
            bookingId: "booking-1",
            pickupOrder: 2,
          },
        },
      }),
      false,
    );

    expect(path).toBe(
      "/manager/dispatch?shuttleTripId=shuttle-1&bookingId=booking-1&pickupOrder=2",
    );
  });

  it("notification của nhà xe chỉ có shuttleTripId vẫn mở được màn", () => {
    const path = getNotificationActionPath(
      notification({
        action: {
          type: "OPEN_SHUTTLE_TRACKING",
          params: { shuttleTripId: "shuttle-1" },
        },
      }),
      false,
    );

    expect(path).toBe("/manager/dispatch?shuttleTripId=shuttle-1");
  });
});

describe("custom plan request notifications", () => {
  it("opens the exact admin request from the declared requestId", () => {
    const item = notification({
      type: "SUBSCRIPTION_CUSTOM_REQUEST_SUBMITTED",
      action: {
        type: "OPEN_ADMIN_SUBSCRIPTION_CUSTOM_REQUEST",
        params: { requestId: "request / 1" },
      },
    });

    expect(resolveNotificationAction(item)).toEqual({
      type: "OPEN_ADMIN_SUBSCRIPTION_CUSTOM_REQUEST",
      params: { requestId: "request / 1" },
    });
    expect(getNotificationActionPath(item, true)).toBe(
      "/admin/packages?tab=requests&requestId=request+%2F+1",
    );
  });

  it("reuses the operator subscription screen for approved and rejected", () => {
    for (const type of [
      "SUBSCRIPTION_CUSTOM_REQUEST_APPROVED",
      "SUBSCRIPTION_CUSTOM_REQUEST_REJECTED",
    ]) {
      expect(
        getNotificationActionPath(
          notification({
            type,
            action: { type: "OPEN_SUBSCRIPTION", params: {} },
          }),
          false,
        ),
      ).toBe("/manager/packages");
    }
  });

  it("does not infer a destination when the contract action is missing", () => {
    expect(
      resolveNotificationAction(
        notification({
          type: "SUBSCRIPTION_CUSTOM_REQUEST_SUBMITTED",
          action: undefined,
        }),
      ),
    ).toEqual({ type: "NONE", params: {} });
  });

  it("ignores unsupported declared actions instead of guessing from type", () => {
    const item = notification({
      type: "SUBSCRIPTION_CUSTOM_REQUEST_APPROVED",
      action: {
        type: "OPEN_SOMETHING_NEW",
        params: {},
      } as unknown as NotificationItem["action"],
    });

    expect(resolveNotificationAction(item)).toEqual({
      type: "NONE",
      params: {},
    });
    expect(getNotificationActionPath(item, false)).toBeNull();
  });
});

/**
 * Hai loại thông báo mới của luồng thay xe (handoff Vehicle Substitution B1-B7
 * mục 4). Cả hai đều phải mở Trung tâm vận hành: đó là nơi duy nhất xử lý được
 * chuyến thay thế.
 */
describe("cảnh báo thay xe", () => {
  it("mở chuyến THAY THẾ chứ không phải chuyến cũ", () => {
    const path = getNotificationActionPath(
      notification({
        type: "VEHICLE_SUBSTITUTION_SEAT_SHORTAGE",
        data: { tripId: "trip-old", newTripId: "trip-new" },
      }),
      false,
    );

    expect(path).toBe("/manager/operations?tripId=trip-new");
  });

  // `BOOKING_TRANSFER_ESCALATED` mang cả `bookingId`; suy luận cũ ưu tiên
  // bookingId nên sẽ đẩy sang màn Lượt đặt vé — nơi không xác nhận chuyển được.
  it("không bị bookingId kéo sang màn Lượt đặt vé", () => {
    const path = getNotificationActionPath(
      notification({
        type: "BOOKING_TRANSFER_ESCALATED",
        data: { bookingId: "booking-9", newTripId: "trip-new" },
      }),
      false,
    );

    expect(path).toBe("/manager/operations?tripId=trip-new");
  });

  it("lùi về tripId khi payload chưa khai chuyến thay thế", () => {
    expect(
      resolveNotificationAction(
        notification({
          type: "VEHICLE_SUBSTITUTION_SEAT_SHORTAGE",
          data: { tripId: "trip-old" },
        }),
      ),
    ).toEqual({ type: "OPEN_TRIP_TRACKING", params: { tripId: "trip-old" } });
  });

  it("không đoán bừa khi payload không có chuyến nào", () => {
    expect(
      resolveNotificationAction(
        notification({
          type: "BOOKING_TRANSFER_ESCALATED",
          data: { passengerId: "passenger-1" },
        }),
      ),
    ).toEqual({ type: "NONE", params: {} });
  });
});
