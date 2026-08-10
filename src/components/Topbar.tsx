import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { io } from "socket.io-client";
import {
  FiMenu,
  FiBell,
  FiUser,
  FiLogOut,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";
import LanguageSwitcher from "./LanguageSwitcher";
import OperatorAnnouncementModal from "./OperatorAnnouncementModal";
import {
  getAuthSession,
  getAuthUser,
  logout,
  refreshAuthSession,
} from "../auth";
import {
  getNotifications,
  markNotificationRead,
  type NotificationItem,
} from "../api/vietride";
import { getNotificationActionPath } from "../utils/notificationActions";

type TopbarProps = {
  onMenuToggle: () => void;
  userName?: string;
};

type NotificationRefreshOptions = {
  silent?: boolean;
};

const NOTIFICATION_REFRESH_INTERVAL_MS = 15_000;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const NOTIFICATION_SOCKET_URL =
  import.meta.env.VITE_NOTIFICATION_SOCKET_URL || API_BASE_URL;
const NOTIFICATION_SOCKET_PATH = "/notification/socket.io";

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
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const notificationRefreshInFlightRef = useRef(false);

  const isAdmin = location.pathname.startsWith("/admin");
  const profilePath = isAdmin ? "/admin/profile" : "/manager/profile";
  const authUser = getAuthUser();
  const canSendOperatorNotification =
    authUser?.role === "OPERATOR_ADMIN" || authUser?.role === "OPERATOR_STAFF";
  const settingsPath =
    authUser?.role === "OPERATOR_ADMIN" ? "/manager/settings" : null;

  const loadNotifications = useCallback(
    async ({ silent = false }: NotificationRefreshOptions = {}) => {
      if (notificationRefreshInFlightRef.current) return;

      notificationRefreshInFlightRef.current = true;
      if (!silent) {
        setNotificationsLoading(true);
        setNotificationsError("");
      }

      try {
        const [latest, unread] = await Promise.all([
          getNotifications({
            page: 1,
            pageSize: 20,
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
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    let socketAuthRecoveryAttempted = false;

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
      NOTIFICATION_REFRESH_INTERVAL_MS,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently();
    };

    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const accessToken = getAuthSession()?.accessToken;
    const notificationSocket = accessToken
      ? io(NOTIFICATION_SOCKET_URL || undefined, {
          path: NOTIFICATION_SOCKET_PATH,
          auth: { token: accessToken },
          transports: ["websocket"],
        })
      : null;

    notificationSocket?.on("notification:created", refreshSilently);
    notificationSocket?.on("connect", () => {
      socketAuthRecoveryAttempted = false;
      refreshSilently();
    });
    notificationSocket?.on("connect_error", (error: Error) => {
      if (
        cancelled ||
        error.message !== "UNAUTHORIZED" ||
        socketAuthRecoveryAttempted
      ) {
        return;
      }

      socketAuthRecoveryAttempted = true;
      void refreshAuthSession().then((session) => {
        if (cancelled || !session?.accessToken) return;
        notificationSocket.auth = { token: session.accessToken };
        notificationSocket.connect();
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-5 text-white">
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
                  <button
                    type="button"
                    aria-label={t("refresh")}
                    title={t("refresh")}
                    disabled={notificationsLoading}
                    onClick={() => void loadNotifications()}
                    className="cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiRefreshCw
                      className={notificationsLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>
                {canSendOperatorNotification && (
                  <div className="border-b border-gray-100 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        setShowAnnouncement(true);
                      }}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-sm font-semibold text-vr-800 hover:bg-vr-100"
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
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {notification.title}
                          </span>
                          <span className="mt-0.5 block text-sm text-gray-600">
                            {notification.body}
                          </span>
                          <span className="mt-1 block text-xs text-gray-400">
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

