import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNotifications,
  markNotificationRead,
  type NotificationItem,
} from "../api/vietride";
import { getNotificationActionPath } from "../utils/notificationActions";
import Topbar from "./Topbar";

const translate = (key: string) => key;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}
type SocketHandler = (...args: unknown[]) => void;

const socketIoMock = vi.hoisted(() => {
  const handlers = new Map<string, SocketHandler>();
  const socket = {
    auth: {} as Record<string, string>,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: SocketHandler) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
  };

  return {
    handlers,
    io: vi.fn(() => socket),
    socket,
  };
});

vi.mock("socket.io-client", () => ({
  io: socketIoMock.io,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { resolvedLanguage: "vi" },
  }),
}));

vi.mock("../auth", () => ({
  getAuthSession: () => ({ accessToken: "access-token" }),
  getAuthUser: () => ({
    id: "admin-1",
    email: "system.admin.with.a.long.account@vietride.online",
    role: "SYSTEM_ADMIN",
  }),
  logout: vi.fn(),
  refreshAuthSession: vi.fn().mockResolvedValue({
    accessToken: "refreshed-access-token",
  }),
}));

vi.mock("../api/vietride", () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("./LanguageSwitcher", () => ({
  default: () => <div data-testid="language-switcher" />,
}));

vi.mock("./OperatorAnnouncementModal", () => ({
  default: () => null,
}));

describe("Topbar dropdowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketIoMock.handlers.clear();
    vi.mocked(getNotifications).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
    vi.mocked(markNotificationRead).mockResolvedValue(null);

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("keeps the notification and profile menus mutually exclusive", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "notifications" }));
    expect(screen.getByRole("heading", { name: "notifications" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "me" }));

    expect(screen.queryByRole("heading", { name: "notifications" })).not.toBeInTheDocument();
    const email = screen.getByText("system.admin.with.a.long.account@vietride.online");
    expect(email).toHaveClass("break-all");
    expect(email).toHaveAttribute(
      "title",
      "system.admin.with.a.long.account@vietride.online",
    );
  });

  it("refreshes notifications every 15 seconds while the tab is visible", async () => {
    vi.useFakeTimers();
    const notification: NotificationItem = {
      id: "notification-1",
      userId: "admin-1",
      type: "TRIP_UPDATE",
      title: "Trip updated",
      body: "The trip schedule has changed.",
      data: null,
      action: { type: "NONE", params: {} },
      readAt: null,
      createdAt: "2026-08-09T08:00:00.000Z",
    };

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await act(async () => {
      vi.runAllTicks();
      await Promise.resolve();
    });
    expect(getNotifications).toHaveBeenCalledTimes(2);

    vi.mocked(getNotifications)
      .mockResolvedValueOnce({
        items: [notification],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      .mockResolvedValueOnce({
        items: [notification],
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(getNotifications).toHaveBeenCalledTimes(4);
    expect(
      screen.getByRole("button", { name: "notifications" }),
    ).toHaveTextContent("1");
  });

  it("refreshes notifications immediately when the realtime event arrives", async () => {
    const notification: NotificationItem = {
      id: "notification-1",
      userId: "admin-1",
      type: "INVOICE_ISSUED",
      title: "Invoice issued",
      body: "Your invoice is ready.",
      data: null,
      action: { type: "NONE", params: {} },
      readAt: null,
      createdAt: "2026-08-09T08:00:00.000Z",
    };

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
    expect(socketIoMock.io).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/notification/socket.io",
        auth: { token: "access-token" },
        transports: ["websocket"],
      }),
    );

    vi.mocked(getNotifications)
      .mockResolvedValueOnce({
        items: [notification],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })
      .mockResolvedValueOnce({
        items: [notification],
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

    await act(async () => {
      socketIoMock.handlers.get("notification:created")?.({
        notificationId: notification.id,
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(4));
    expect(
      screen.getByRole("button", { name: "notifications" }),
    ).toHaveTextContent("1");
  });

  it("pauses polling in a hidden tab and refreshes when it becomes visible", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await act(async () => {
      vi.runAllTicks();
      await Promise.resolve();
    });
    expect(getNotifications).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(getNotifications).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(getNotifications).toHaveBeenCalledTimes(4);
  });

  it("maps notification actions to their web destinations", () => {
    const baseNotification = {
      id: "notification-action",
      userId: "admin-1",
      type: "ACTION",
      title: "Action",
      body: "Open destination",
      data: null,
      readAt: null,
      createdAt: "2026-08-10T08:00:00.000Z",
    };

    const notification = (action: NotificationItem["action"]): NotificationItem => ({
      ...baseNotification,
      action,
    });

    expect(
      getNotificationActionPath(
        notification({
          type: "OPEN_CREW_TRIP_BOOKING",
          params: { tripId: "trip 1", bookingId: "booking/1" },
        }),
        false,
      ),
    ).toBe("/manager/bookings?bookingId=booking%2F1");
    expect(
      getNotificationActionPath(
        notification({
          type: "OPEN_TRIP_TRACKING",
          params: { tripId: "trip 1" },
        }),
        false,
      ),
    ).toBe("/manager/operations?tripId=trip+1");
    expect(
      getNotificationActionPath(
        notification({ type: "OPEN_WALLET", params: {} }),
        true,
      ),
    ).toBe("/admin/wallet-settlement");
    expect(
      getNotificationActionPath(
        notification({ type: "OPEN_SUBSCRIPTION", params: {} }),
        false,
      ),
    ).toBe("/manager/packages");
    expect(
      getNotificationActionPath(
        notification({
          type: "OPEN_SHUTTLE_TRACKING",
          params: { shuttleTripId: "shuttle-1" },
        }),
        false,
      ),
    ).toBe("/manager/dispatch?shuttleTripId=shuttle-1");
    expect(
      getNotificationActionPath(
        notification({ type: "NONE", params: {} }),
        false,
      ),
    ).toBeNull();
    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          type: "PARCEL_CREATED",
          data: { parcelId: "parcel-legacy" },
        },
        false,
      ),
    ).toBe("/manager/parcels?parcelId=parcel-legacy");
    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          actionType: "OPEN_TRIP_TRACKING",
          actionParams: JSON.stringify({ tripId: "trip-fcm" }),
        },
        false,
      ),
    ).toBe("/manager/operations?tripId=trip-fcm");
  });

  it("navigates immediately when the running BE only returns legacy data", async () => {
    const notification: NotificationItem = {
      id: "notification-legacy",
      userId: "admin-1",
      type: "BOOKING_CONFIRMED",
      title: "Booking ready",
      body: "Open booking",
      data: { bookingId: "booking-legacy" },
      readAt: null,
      createdAt: "2026-08-10T08:00:00.000Z",
    };
    vi.mocked(getNotifications).mockResolvedValue({
      items: [notification],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(markNotificationRead).mockReturnValue(
      new Promise<null>(() => {}),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/manager/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "notifications" }));
    await user.click(screen.getByText("Booking ready"));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/manager/bookings?bookingId=booking-legacy",
    );
  });
});
