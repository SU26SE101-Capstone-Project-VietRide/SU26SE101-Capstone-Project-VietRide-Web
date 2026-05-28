import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiBell, FiUser, FiLogOut, FiSearch } from "react-icons/fi";

type TopbarProps = {
  onMenuToggle: () => void;
  userName?: string;
  unreadNotifications?: number;
};

export default function Topbar({
  onMenuToggle,
  userName = "Quản lý nhà xe",
  unreadNotifications = 0,
}: TopbarProps) {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const isAdmin = location.pathname.startsWith("/admin");
  const profilePath = isAdmin ? "/admin/profile" : "/manager/profile";
  const logoutPath = "/login";

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 z-30">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden text-gray-600 hover:text-gray-900 transition"
          >
            <FiMenu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 hidden sm:block">
            {userName}
          </h2>
        </div>

        {/* Center - Search (hidden on mobile) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm chuyến, booking, parcel..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100 transition"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
            >
              <FiBell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">Thông báo</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    2 chuyến đang trễ ETA
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    Xe ABC-001 mất GPS tín hiệu
                  </div>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                    5 parcel chưa giao
                  </div>
                </div>
                <button className="w-full text-center text-sm text-vr-600 hover:text-vr-700 py-2">
                  Xem tất cả
                </button>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition p-2 hover:bg-gray-100 rounded-lg"
            >
              <FiUser size={20} />
              <span className="hidden sm:block text-sm">Tôi</span>
            </button>

            {/* Profile Dropdown */}
            {showProfile && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <p className="font-semibold text-gray-900">Tài khoản</p>
                  <p className="text-xs text-gray-500">manager@vietride.vn</p>
                </div>
                <div className="space-y-1 p-2">
                  <Link
                    to={profilePath}
                    onClick={() => setShowProfile(false)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition block"
                  >
                    Hồ sơ
                  </Link>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition">
                    Cài đặt
                  </button>
                  <Link
                    to={logoutPath}
                    onClick={() => setShowProfile(false)}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100 rounded transition flex items-center gap-2 block"
                  >
                    <FiLogOut size={16} /> Đăng xuất
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
