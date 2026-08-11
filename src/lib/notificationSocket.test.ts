import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationSocket,
  NOTIFICATION_CREATED_EVENT,
  parseNotificationCreatedEvent,
} from "./notificationSocket";

const socketIoMock = vi.hoisted(() => ({
  io: vi.fn(() => ({ id: "socket-1" })),
}));

vi.mock("socket.io-client", () => ({ io: socketIoMock.io }));

describe("notification socket", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("connects to the public origin with the Nginx socket path and no /v1 prefix", () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );

    expect(createNotificationSocket()).not.toBeNull();
    expect(socketIoMock.io).toHaveBeenCalledWith("https://api.vietride.online", {
      path: "/notification/socket.io",
      auth: { token: "access-token" },
      transports: ["websocket"],
    });
  });

  it("does not open a socket without an access token", () => {
    expect(createNotificationSocket()).toBeNull();
    expect(socketIoMock.io).not.toHaveBeenCalled();
  });

  it("exposes the realtime event name from the contract", () => {
    expect(NOTIFICATION_CREATED_EVENT).toBe("notification:created");
  });

  it("maps the raw DTO payload without envelope, userId or deepLink", () => {
    const notification = parseNotificationCreatedEvent({
      id: "notification-1",
      type: "BOOKING_CREATED",
      title: "Booking created",
      body: "A booking was created.",
      data: { bookingId: "booking-1" },
      action: { type: "OPEN_BOOKING_DETAIL", params: { bookingId: "booking-1" } },
      readAt: null,
      createdAt: "2026-08-11T10:30:00+07:00",
    });

    expect(notification).toEqual({
      id: "notification-1",
      type: "BOOKING_CREATED",
      title: "Booking created",
      body: "A booking was created.",
      data: { bookingId: "booking-1" },
      action: { type: "OPEN_BOOKING_DETAIL", params: { bookingId: "booking-1" } },
      readAt: null,
      createdAt: "2026-08-11T10:30:00+07:00",
    });
    expect(notification).not.toHaveProperty("userId");
    expect(notification).not.toHaveProperty("deepLink");
  });

  it("rejects payloads the inbox cannot deduplicate", () => {
    // Payload cũ chỉ có notificationId, và mọi shape không dùng được đều phải
    // lùi về REST inbox thay vì dựng item nửa vời.
    expect(parseNotificationCreatedEvent({ notificationId: "n-1" })).toBeNull();
    expect(parseNotificationCreatedEvent({ id: "   " })).toBeNull();
    expect(parseNotificationCreatedEvent(null)).toBeNull();
    expect(parseNotificationCreatedEvent("notification")).toBeNull();
  });

  it("keeps an unusable action out of the item instead of guessing", () => {
    const notification = parseNotificationCreatedEvent({
      id: "notification-2",
      type: "SYSTEM",
      title: "Announcement",
      body: "Read me.",
      action: { type: "OPEN_TRIP_DETAIL", params: {} },
      readAt: null,
      createdAt: "2026-08-11T10:30:00+07:00",
    });

    expect(notification?.action).toBeNull();
    expect(notification?.data).toBeNull();
  });
});
