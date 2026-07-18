import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiMenu,
  FiBell,
  FiUser,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import LanguageSwitcher from "./LanguageSwitcher";
import { getAuthUser, logout } from "../auth";
import {
  getNotifications,
  markNotificationRead,
  type NotificationItem,
} from "../api/vietride";

type TopbarProps = {
  onMenuToggle: () => void;
  userName?: string;
};

export default function Topbar({
  onMenuToggle,
}: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");

  const isAdmin = location.pathname.startsWith("/admin");
  const profilePath = isAdmin ? "/admin/profile" : "/manager/profile";
  const authUser = getAuthUser();

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError("");

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
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : t("topbar.notificationLoadFailed"),
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadNotifications();
    });

    return () => {
      cancelled = true;
    };
  }, [loadNotifications]);

  async function handleNotificationClick(notification: NotificationItem) {
    if (notification.readAt) return;

    try {
      await markNotificationRead(notification.id);
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      setUnreadNotifications((current) => Math.max(0, current - 1));
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : t("topbar.notificationReadFailed"),
      );
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

        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("topbar.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100 transition"
            />
          </div>
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
              <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
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
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
            >
              <FiUser size={20} />
              <span className="hidden sm:block text-sm">{t("me")}</span>
            </button>

            {showProfile && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <p className="font-semibold text-gray-900">{t("account")}</p>
                  <p className="text-xs text-gray-500">
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
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition"
                  >
                    {t("settings")}
                  </button>
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
