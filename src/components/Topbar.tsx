import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiMenu,
  FiBell,
  FiUser,
  FiLogOut,
  FiCheckCircle,
  FiRefreshCw,
  FiSend,
  FiAlertTriangle,
  FiCreditCard,
  FiDollarSign,
  FiNavigation,
  FiPackage,
  FiBookOpen,
  FiTruck,
} from "react-icons/fi";
import LanguageSwitcher from "./LanguageSwitcher";
import OperatorAnnouncementModal from "./OperatorAnnouncementModal";
import { getAuthUser, logout } from "../auth";
import { attachSocketAuthRecovery } from "../lib/socketAuthRecovery";
import {
  createNotificationSocket,
  NOTIFICATION_CREATED_EVENT,
  parseNotificationCreatedEvent,
} from "../lib/notificationSocket";
import { markAllNotificationsRead } from "../utils/notificationInbox";
import {
  getNotifications,
  markNotificationRead,
  type NotificationItem,
} from "../api/vietride";
import { getNotificationActionPath } from "../utils/notificationActions";
import { localizeNotificationText } from "../utils/notificationText";
import {
  getNotificationVisualGroup,
  notificationGroupClasses,
  type NotificationVisualGroup,
} from "../utils/notificationVisuals";

type TopbarProps = {
  onMenuToggle: () => void;
  userName?: string;
};

type NotificationRefreshOptions = {
  silent?: boolean;
};

// Icon theo nhóm thông báo. Khai ngoài component: map này là hằng, dựng lại mỗi
// lần render chỉ tốn công.
const notificationGroupIcons: Record<NotificationVisualGroup, ReactNode> = {
  shuttle: <FiNavigation size={14} />,
  trip: <FiTruck size={14} />,
  parcel: <FiPackage size={14} />,
  booking: <FiBookOpen size={14} />,
  wallet: <FiDollarSign size={14} />,
  subscription: <FiCreditCard size={14} />,
  incident: <FiAlertTriangle size={14} />,
  general: <FiBell size={14} />,
};

const NOTIFICATION_PAGE_SIZE = 20;
/**
 * Realtime `notification:created` là luồng chính; polling chỉ còn là lưới an
 * toàn cho trường hợp socket chết im lặng, nên giãn ra 60 giây thay vì 15.
 */
const NOTIFICATION_FALLBACK_POLL_MS = 60_000;

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const notificationRefreshInFlightRef = useRef(false);
  // Refetch trùng lúc đang có request bay không bị bỏ hẳn mà xếp lại một lượt:
  // response cũ (chụp trước khi notification được persist) không được phép là
  // tiếng nói cuối cùng về inbox.
  const notificationRefreshQueuedRef = useRef(false);

  const isAdmin = location.pathname.startsWith("/admin");
  const profilePath = isAdmin ? "/admin/profile" : "/manager/profile";
  const authUser = getAuthUser();
  const canSendOperatorNotification = authUser?.role === "OPERATOR_ADMIN";
  const settingsPath =
    authUser?.role === "OPERATOR_ADMIN" ? "/manager/settings" : null;

  // Nhãn của một mã enum, `null` khi chưa khai bản dịch — helper dựa vào đó để
  // giữ nguyên mã lạ thay vì in ra chuỗi rỗng.
  const translateNotificationCode = useCallback(
    (code: string) =>
      t(`notificationCodes.${code}`, { defaultValue: "" }) || null,
    [t],
  );

  const loadNotificationsRef = useRef<
    (options?: NotificationRefreshOptions) => Promise<void>
  >(async () => {});

  const loadNotifications = useCallback(
    async ({ silent = false }: NotificationRefreshOptions = {}) => {
      if (notificationRefreshInFlightRef.current) {
        notificationRefreshQueuedRef.current = true;
        return;
      }

      notificationRefreshInFlightRef.current = true;
      if (!silent) {
        setNotificationsLoading(true);
        setNotificationsError("");
      }

      try {
        const [latest, unread] = await Promise.all([
          getNotifications({
            page: 1,
            pageSize: NOTIFICATION_PAGE_SIZE,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
          getNotifications({
            unreadOnly: true,
            page: 1,
            pageSize: 1,
            sortBy: "createdAt",
            sortDir: "desc",
          }),
        ]);
        setNotifications(latest.items);
        setUnreadNotifications(unread.totalItems);
        setNotificationsError("");
      } catch (error) {
        if (!silent) {
          setNotificationsError(
            error instanceof Error
              ? error.message
              : t("topbar.notificationLoadFailed"),
          );
        }
      } finally {
        notificationRefreshInFlightRef.current = false;
        if (!silent) setNotificationsLoading(false);
        if (notificationRefreshQueuedRef.current) {
          notificationRefreshQueuedRef.current = false;
          void loadNotificationsRef.current({ silent: true });
        }
      }
    },
    [t],
  );

  useEffect(() => {
    loadNotificationsRef.current = loadNotifications;
  }, [loadNotifications]);

  useEffect(() => {
    let cancelled = false;

    const refreshSilently = () => {
      if (!cancelled && document.visibilityState === "visible") {
        void loadNotifications({ silent: true });
      }
    };

    queueMicrotask(() => {
      if (!cancelled) void loadNotifications();
    });

    const intervalId = window.setInterval(
      refreshSilently,
      NOTIFICATION_FALLBACK_POLL_MS,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently();
    };

    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const notificationSocket = createNotificationSocket();

    const disposeAuthRecovery = notificationSocket
      ? attachSocketAuthRecovery(notificationSocket)
      : null;

    const handleNotificationCreated = (payload: unknown) => {
      if (cancelled) return;

      // Event mang nguyên DTO nên hiện được ngay, không phải chờ REST. Dedupe
      // theo `id` vì Socket.IO là at-least-once và event có thể được replay.
      const incoming = parseNotificationCreatedEvent(payload);
      if (incoming) {
        setNotifications((current) =>
          current.some((item) => item.id === incoming.id)
            ? current
            : [incoming, ...current].slice(0, NOTIFICATION_PAGE_SIZE),
        );
      }

      // REST inbox là nguồn bền vững: gọi lại để chốt danh sách và số chưa đọc
      // (và để phủ cả payload lạ mà parser không nhận).
      refreshSilently();
    };

    notificationSocket?.on(
      NOTIFICATION_CREATED_EVENT,
      handleNotificationCreated,
    );
    // Reconnect có thể đã bỏ lỡ event trong lúc mất kết nối — bù bằng REST.
    notificationSocket?.on("connect", refreshSilently);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      disposeAuthRecovery?.();
      notificationSocket?.disconnect();
    };
  }, [loadNotifications]);

  function handleNotificationClick(notification: NotificationItem) {
    const destination = getNotificationActionPath(notification, isAdmin);

    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      setUnreadNotifications((current) => Math.max(0, current - 1));

      void markNotificationRead(notification.id).catch((error) => {
        setNotificationsError(
          error instanceof Error
            ? error.message
            : t("topbar.notificationReadFailed"),
        );
        void loadNotifications({ silent: true });
      });
    }

    if (destination) {
      setShowNotifications(false);
      navigate(destination);
    }
  }

  // Đọc tất cả: BE chưa có endpoint gộp nên hàm helper tự gom từng cái (xem
  // utils/notificationInbox.ts). Không cập nhật lạc quan như click từng cái —
  // N request thì xác suất lẻ tẻ vài cái hỏng là có thật, tải lại mới ra số đúng.
  async function handleMarkAllRead() {
    if (isMarkingAllRead || unreadNotifications === 0) return;

    setIsMarkingAllRead(true);
    setNotificationsError("");

    try {
      const { failed } = await markAllNotificationsRead();
      if (failed > 0) {
        setNotificationsError(
          t("topbar.markAllReadPartial", { count: failed }),
        );
      }
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : t("topbar.markAllReadFailed"),
      );
    } finally {
      setIsMarkingAllRead(false);
      await loadNotifications({ silent: true });
    }
  }

  const handleLogout = async () => {
    await logout();
    setShowProfile(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 z-30">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden text-gray-600 hover:text-gray-900 transition"
          >
            <FiMenu size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />

          <div className="relative">
            <button
              type="button"
              aria-label={t("notifications")}
              onClick={() => {
                const nextOpen = !showNotifications;
                setShowNotifications(nextOpen);
                setShowProfile(false);
                if (nextOpen) void loadNotifications();
              }}
              className="relative cursor-pointer text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
            >
              <FiBell size={20} />
              {/* red-600 + 12px: chữ trắng trên red-500 chỉ đạt 3,81:1, mà đây
                  là con số người dùng phải đọc được chứ không phải chấm trang
                  trí. */}
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold leading-5 text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {t("notifications")}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {t("topbar.unreadNotifications", {
                        count: unreadNotifications,
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Chỉ hiện khi thật sự có cái chưa đọc — nút không làm gì
                        vẫn chiếm chỗ và vẫn bị bấm thử. */}
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        data-testid="mark-all-read"
                        disabled={isMarkingAllRead || notificationsLoading}
                        onClick={() => void handleMarkAllRead()}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-vr-900 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiCheckCircle size={14} />
                        {isMarkingAllRead
                          ? t("topbar.markingAllRead")
                          : t("topbar.markAllRead")}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t("refresh")}
                      title={t("refresh")}
                      disabled={notificationsLoading || isMarkingAllRead}
                      onClick={() => void loadNotifications()}
                      className="cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiRefreshCw
                        className={notificationsLoading ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                </div>
                {canSendOperatorNotification && (
                  <div className="border-b border-gray-100 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        setShowAnnouncement(true);
                      }}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-sm font-semibold text-vr-900 hover:bg-vr-100"
                    >
                      <FiSend /> {t("topbar.sendOperatorAnnouncement")}
                    </button>
                  </div>
                )}
                <div className="max-h-96 overflow-y-auto p-2">
                  {notificationsError && (
                    <p className="m-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {notificationsError}
                    </p>
                  )}
                  {notificationsLoading && notifications.length === 0 && (
                    <p className="p-6 text-center text-sm text-gray-500">
                      {t("topbar.loadingNotifications")}
                    </p>
                  )}
                  {!notificationsLoading &&
                    !notificationsError &&
                    notifications.length === 0 && (
                      <p className="p-6 text-center text-sm text-gray-500">
                        {t("topbar.noNotifications")}
                      </p>
                    )}
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void handleNotificationClick(notification)}
                      className={`mb-1 w-full cursor-pointer rounded-lg p-3 text-left transition hover:bg-gray-50 ${
                        notification.readAt ? "bg-white" : "bg-vr-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notification.readAt ? "bg-transparent" : "bg-vr-500"
                          }`}
                        />
                        {/* Icon theo nhóm: hộp thư trộn ví/chuyến/trung
                            chuyển/sự cố, không có icon thì phải đọc từng dòng
                            mới biết cái nào là cái nào. */}
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            notificationGroupClasses[
                              getNotificationVisualGroup(
                                notification.notificationType ??
                                  notification.type,
                              )
                            ]
                          }`}
                        >
                          {
                            notificationGroupIcons[
                              getNotificationVisualGroup(
                                notification.notificationType ??
                                  notification.type,
                              )
                            ]
                          }
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {localizeNotificationText(
                              notification.title,
                              translateNotificationCode,
                            )}
                          </span>
                          <span className="mt-0.5 block text-sm text-gray-600">
                            {localizeNotificationText(
                              notification.body,
                              translateNotificationCode,
                            )}
                          </span>
                          <span className="mt-1 block text-xs text-gray-600">
                            {formatNotificationDate(
                              notification.createdAt,
                              i18n.resolvedLanguage,
                            )}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const nextOpen = !showProfile;
                setShowProfile(nextOpen);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
            >
              <FiUser size={20} />
              <span className="hidden sm:block text-sm">{t("me")}</span>
            </button>

            {showProfile && (
              <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="p-4 border-b border-gray-200">
                  <p className="font-semibold text-gray-900">{t("account")}</p>
                  <p
                    className="mt-1 break-all text-xs leading-5 text-gray-500"
                    title={authUser?.email || "manager@vietride.vn"}
                  >
                    {authUser?.email || "manager@vietride.vn"}
                  </p>
                </div>
                <div className="space-y-1 p-2">
                  <Link
                    to={profilePath}
                    onClick={() => setShowProfile(false)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition block"
                  >
                    {t("profile")}
                  </Link>
                  {settingsPath && (
                    <Link
                      to={settingsPath}
                      onClick={() => setShowProfile(false)}
                      className="block w-full rounded px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                    >
                      {t("settings")}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100 rounded transition flex items-center gap-2 block"
                  >
                    <FiLogOut size={16} /> {t("logout")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <OperatorAnnouncementModal
        open={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
      />
    </header>
  );
}

function formatNotificationDate(value: string, language?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

