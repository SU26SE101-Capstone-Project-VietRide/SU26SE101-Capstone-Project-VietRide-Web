import { Link, useLocation } from "react-router-dom";
import {
  FiLayout,
  FiTruck,
  FiBookOpen,
  FiPackage,
  FiMapPin,
  FiBarChart2,
  FiSettings,
  FiX,
  FiUsers,
  FiNavigation,
  FiDollarSign,
  FiAlertTriangle,
} from "react-icons/fi";
import logo from "../assets/login/logo.svg";
import { AiOutlineLogout } from "react-icons/ai";
type MenuSection = {
  title: string;
  items: {
    label: string;
    path: string;
    icon: React.ReactNode;
  }[];
};

/** Cùng nội dung route/label, chỉ nhóm lại theo MENU · SUPPORT · OTHERS */
const managerMenus: MenuSection[] = [
  {
    title: "MENU",
    items: [
      { label: "Dashboard", path: "/manager/dashboard", icon: <FiLayout /> },
      { label: "Chuyến", path: "/manager/trips", icon: <FiTruck /> },
      {
        label: "Đổi lộ trình & cập nhật ETA",
        path: "/manager/route-eta",
        icon: <FiAlertTriangle />,
      },
      {
        label: "Tuyến & điểm dừng",
        path: "/manager/routes",
        icon: <FiNavigation />,
      },
      { label: "Phương tiện", path: "/manager/vehicles", icon: <FiTruck /> },
      { label: "Nhân sự", path: "/manager/staff", icon: <FiUsers /> },
      { label: "Đặt vé", path: "/manager/bookings", icon: <FiBookOpen /> },
      { label: "Hàng hóa", path: "/manager/parcels", icon: <FiPackage /> },
      { label: "GPS Tracking", path: "/manager/gps", icon: <FiMapPin /> },
      {
        label: "Điều phối (Dispatch)",
        path: "/manager/dispatch",
        icon: <FiNavigation />,
      },
      { label: "Voucher", path: "/manager/vouchers", icon: <FiPackage /> },
      { label: "Gói dịch vụ", path: "/manager/packages", icon: <FiPackage /> },
    ],
  },
  {
    title: "SUPPORT",
    items: [
      { label: "Doanh thu", path: "/manager/reports", icon: <FiBarChart2 /> },
      { label: "Ví quản lý", path: "/manager/wallet", icon: <FiDollarSign /> },
    ],
  },
];

const adminMenus: MenuSection[] = [
  {
    title: "MENU",
    items: [
      { label: "Dashboard", path: "/admin/dashboard", icon: <FiLayout /> },
      { label: "Nhà xe", path: "/admin/operators", icon: <FiTruck /> },
      { label: "Người dùng", path: "/admin/users", icon: <FiBookOpen /> },
      { label: "Voucher", path: "/admin/vouchers", icon: <FiPackage /> },
      { label: "Gói dịch vụ", path: "/admin/packages", icon: <FiPackage /> },
      {
        label: "Phê duyệt Payout",
        path: "/admin/payouts",
        icon: <FiDollarSign />,
      },
    ],
  },
  {
    title: "SUPPORT",
    items: [
      { label: "Doanh thu", path: "/admin/revenue", icon: <FiBarChart2 /> },
      { label: "Báo cáo", path: "/admin/reports", icon: <FiBarChart2 /> },
      { label: "Cấu hình", path: "/admin/settings", icon: <FiSettings /> },
    ],
  },
];

type SidebarProps = {
  role: "manager" | "admin";
  isOpen: boolean;
  onClose: () => void;
};

const sectionHeadingClass =
  "px-3 pb-2.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400";

const itemBaseClass =
  "flex items-center gap-3.5 rounded-lg px-3 py-3 text-[13px] font-medium transition-colors";

const iconWrapClass =
  "flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:stroke-[1.75]";

export default function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const menus = (role === "manager" ? managerMenus : adminMenus).filter(
    (s) => s.items.length > 0,
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/10 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-100 bg-white
          transform transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0
          ${isOpen ? "translate-x-0 shadow-xl lg:shadow-none" : "-translate-x-full"}
        `}
      >
        <div className="shrink-0 border-b border-gray-100 px-5 pb-5 pt-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-vr-600 text-sm font-bold text-white ">
                <img src={logo} alt="VietRide Logo" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">
                  VietRide
                </h1>
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  {role === "manager" ? "Quản lý nhà xe" : "Quản trị hệ thống"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-slate-800 lg:hidden"
              aria-label="Đóng menu"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {menus.map((section, sectionIndex) => (
            <div key={section.title} className={sectionIndex > 0 ? "mt-6" : ""}>
              <p
                className={`${sectionHeadingClass} ${sectionIndex === 0 ? "pt-0" : ""}`}
              >
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={onClose}
                        className={`
                          ${itemBaseClass} border-l-4
                          ${
                            active
                              ? "border-vr-500 bg-vr-100 text-vr-900"
                              : "border-transparent text-slate-800 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900"
                          }
                        `}
                      >
                        <span
                          className={`${iconWrapClass} ${active ? "text-vr-700" : "text-slate-700"}`}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-gray-100 px-3 py-4">
          <button
            type="button"
            className="w-full flex items-center rounded-lg cursor-pointer px-3 py-2.5 text-left text-[13px] font-medium text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <AiOutlineLogout className="mr-2" /> Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}
