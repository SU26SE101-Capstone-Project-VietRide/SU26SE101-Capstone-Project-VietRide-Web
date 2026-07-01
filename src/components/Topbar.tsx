import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMenu, FiBell, FiUser, FiLogOut, FiSearch } from "react-icons/fi";
import LanguageSwitcher from "./LanguageSwitcher";
import { getAuthUser, logout } from "../auth";

type TopbarProps = {
  onMenuToggle: () => void;
  userName?: string;
  unreadNotifications?: number;
};

export default function Topbar({
  onMenuToggle,

  unreadNotifications = 0,
}: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const isAdmin = location.pathname.startsWith("/admin");
  const profilePath = isAdmin ? "/admin/profile" : "/manager/profile";
  const authUser = getAuthUser();

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
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
            >
              <FiBell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">
                  {t("notifications")}
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    {t("topbar.notifLateTrips")}
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    {t("topbar.notifGpsLost")}
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    {t("topbar.notifUndelivered")}
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full text-center text-sm text-vr-600 hover:text-vr-700 py-2"
                >
                  {t("viewAll")}
                </button>
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
