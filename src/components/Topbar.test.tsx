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

// Bắt chước i18next: khoá đã khai trả nhãn, khoá chưa khai rơi về `defaultValue`.
// Topbar dựa đúng vào hành vi đó để biết mã enum nào có bản dịch.
const notificationCodeLabels: Record<string, string> = {
  "notificationCodes.VEHICLE_BREAKDOWN": "hỏng xe",
};

const translate = (key: string, options?: { defaultValue?: string }) =>
  notificationCodeLabels[key] ?? options?.defaultValue ?? key;

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

  it("keeps a 60 second fallback poll while the tab is visible", async () => {
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
    // Polling không còn là luồng realtime chính nên 15 giây chưa có gì xảy ra.
    expect(getNotifications).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
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

  // Contract realtime BE 2026-08-11: payload là DTO thô (không envelope, không
  // userId/deepLink) nên inbox hiện được ngay, và replay cùng `id` không được
  // tạo item trùng.
  it("renders the realtime notification payload and deduplicates by id", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));

    // REST treo lại: item hiển thị được chỉ có thể đến từ payload realtime.
    vi.mocked(getNotifications).mockReturnValue(new Promise(() => {}));

    const payload = {
      id: "notification-realtime",
      type: "BOOKING_CREATED",
      title: "Realtime booking",
      body: "A new booking just arrived.",
      data: {},
      action: { type: "OPEN_BOOKING_DETAIL", params: { bookingId: "booking-9" } },
      readAt: null,
      createdAt: "2026-08-11T10:30:00+07:00",
    };

    await act(async () => {
      socketIoMock.handlers.get("notification:created")?.(payload);
      socketIoMock.handlers.get("notification:created")?.(payload);
      await Promise.resolve();
    });

    // Badge tăng ngay từ realtime và replay cùng id không được cộng lần hai,
    // kể cả REST đang treo.
    expect(
      screen.getByRole("button", { name: "notifications" }),
    ).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "notifications" }));

    expect(screen.getAllByText("Realtime booking")).toHaveLength(1);
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
      await vi.advanceTimersByTimeAsync(60_000);
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

  // BE dựng sẵn câu thông báo nhưng nhúng thẳng mã enum vào — FE phải thay bằng
  // nhãn đã dịch, và giữ nguyên mã nào chưa khai bản dịch.
  it("dịch mã enum nhúng trong nội dung thông báo", async () => {
    const user = userEvent.setup();
    const notifications: NotificationItem[] = [
      {
        id: "notification-incident",
        userId: "admin-1",
        type: "INCIDENT_REPORTED",
        title: "Có sự cố trên chuyến xe",
        body: "Chuyến xe vừa ghi nhận sự cố: VEHICLE_BREAKDOWN.",
        data: null,
        readAt: null,
        createdAt: "2026-08-16T09:48:00.000Z",
      },
      {
        id: "notification-unknown-code",
        userId: "admin-1",
        type: "TRIP_UPDATE",
        title: "Trạng thái mới",
        body: "Trạng thái: SOMETHING_NEW.",
        data: null,
        readAt: null,
        createdAt: "2026-08-16T09:49:00.000Z",
      },
    ];

    vi.mocked(getNotifications).mockResolvedValue({
      items: notifications,
      page: 1,
      pageSize: 20,
      totalItems: notifications.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    render(
      <MemoryRouter initialEntries={["/manager/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "notifications" }));

    expect(
      await screen.findByText("Chuyến xe vừa ghi nhận sự cố: hỏng xe."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/VEHICLE_BREAKDOWN/),
    ).not.toBeInTheDocument();
    // Mã chưa khai bản dịch phải hiện nguyên, không được nuốt mất
    expect(
      screen.getByText("Trạng thái: SOMETHING_NEW."),
    ).toBeInTheDocument();
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

  // Trung tâm vận hành KHÔNG đóng được sự cố, chỉ màn Báo cáo sự cố mới có nút
  // đó — nên thông báo sự cố phải mở thẳng màn sự cố dù BE gắn action mở chuyến.
  it("đưa thông báo sự cố về màn Báo cáo sự cố thay vì Trung tâm vận hành", () => {
    const baseNotification = {
      id: "notification-incident",
      userId: "admin-1",
      title: "Có sự cố trên chuyến xe",
      body: "Chuyến xe vừa ghi nhận sự cố: VEHICLE_BREAKDOWN.",
      data: null,
      readAt: null,
      createdAt: "2026-08-16T09:48:00.000Z",
    };

    // BE khai action mở chuyến — FE đổi hướng theo notificationType
    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          type: "INCIDENT_REPORTED",
          action: { type: "OPEN_TRIP_TRACKING", params: { tripId: "trip-1" } },
        },
        false,
      ),
    ).toBe("/manager/incidents?tripId=trip-1");

    // BE chỉ trả data thô (không có action) — nhánh suy luận cũng phải ra sự cố
    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          type: "INCIDENT_REPORTED",
          data: { tripId: "trip-legacy" },
        },
        false,
      ),
    ).toBe("/manager/incidents?tripId=trip-legacy");

    // Payload sự cố của BE có mang `incidentId` — dùng nó để mở thẳng modal chi
    // tiết, khỏi bắt người nhận tự mò trong danh sách đã lọc theo chuyến.
    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          type: "INCIDENT_REPORTED",
          data: { tripId: "trip-1", incidentId: "incident-9" },
          action: { type: "OPEN_TRIP_TRACKING", params: { tripId: "trip-1" } },
        },
        false,
      ),
    ).toBe("/manager/incidents?tripId=trip-1&incidentId=incident-9");

    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          type: "INCIDENT_REPORTED",
          data: { tripId: "trip-legacy", incidentId: "incident-legacy" },
        },
        false,
      ),
    ).toBe("/manager/incidents?tripId=trip-legacy&incidentId=incident-legacy");

    // Thông báo theo dõi khác vẫn về Trung tâm vận hành như cũ
    expect(
      getNotificationActionPath(
        {
          ...baseNotification,
          type: "OFF_ROUTE_ALERT",
          data: { tripId: "trip-2" },
        },
        false,
      ),
    ).toBe("/manager/operations?tripId=trip-2");
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
  it("hides the mark-all button when nothing is unread", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "notifications" }));

    // Nút không làm gì vẫn chiếm chỗ và vẫn bị bấm thử
    expect(screen.queryByTestId("mark-all-read")).not.toBeInTheDocument();
  });

  it("marks every unread notification and refreshes the badge", async () => {
    const user = userEvent.setup();
    // BE chưa có endpoint đọc-tất-cả nên FE gom từng cái: một lượt lấy danh
    // sách chưa đọc rồi bắn markNotificationRead cho từng id.
    let unreadRemaining = 2;
    vi.mocked(getNotifications).mockImplementation(async (params) => {
      const unreadIds = ["n1", "n2"].slice(0, unreadRemaining);
      const items =
        params?.unreadOnly === true
          ? unreadIds.map((id) => ({
              id,
              type: "PARCEL",
              title: id,
              body: "b",
              data: null,
              readAt: null,
              createdAt: "2026-08-22T10:00:00Z",
            }))
          : [];

      return {
        items,
        page: 1,
        pageSize: params?.pageSize ?? 20,
        totalItems: params?.unreadOnly === true ? unreadRemaining : 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    });
    vi.mocked(markNotificationRead).mockImplementation(async () => {
      unreadRemaining = 0;
      return null;
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "notifications" }));
    await user.click(await screen.findByTestId("mark-all-read"));

    await waitFor(() =>
      expect(markNotificationRead).toHaveBeenCalledWith("n1"),
    );
    expect(markNotificationRead).toHaveBeenCalledWith("n2");
    // Hết chưa đọc thì nút tự biến mất sau lượt tải lại
    await waitFor(() =>
      expect(screen.queryByTestId("mark-all-read")).not.toBeInTheDocument(),
    );
  });
});
