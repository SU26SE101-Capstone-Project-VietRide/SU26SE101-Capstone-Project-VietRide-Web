import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  FiFileText,
  FiGrid,
  FiDatabase,
} from "react-icons/fi";
import logo from "../assets/login/logo.svg";
import { AiOutlineLogout } from "react-icons/ai";
import { logout, type AuthRole } from "../auth";

type MenuItem = {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
};

type MenuSection = {
  titleKey: string;
  items: MenuItem[];
};

const operatorAdminMenuConfig: MenuSection[] = [
  {
    titleKey: "sections.menu",
    items: [
      {
        labelKey: "manager.dashboard",
        path: "/manager/dashboard",
        icon: <FiLayout />,
      },
      { labelKey: "manager.trips", path: "/manager/trips", icon: <FiTruck /> },
      {
        labelKey: "manager.routeEta",
        path: "/manager/route-eta",
        icon: <FiAlertTriangle />,
      },
      {
        labelKey: "manager.routes",
        path: "/manager/routes",
        icon: <FiNavigation />,
      },
      {
        labelKey: "manager.vehicles",
        path: "/manager/vehicles",
        icon: <FiTruck />,
      },
      { labelKey: "manager.staff", path: "/manager/staff", icon: <FiUsers /> },
      {
        labelKey: "manager.capacity",
        path: "/manager/capacity",
        icon: <FiGrid />,
      },
      {
        labelKey: "manager.bookings",
        path: "/manager/bookings",
        icon: <FiBookOpen />,
      },
      {
        labelKey: "manager.parcels",
        path: "/manager/parcels",
        icon: <FiPackage />,
      },
      { labelKey: "manager.gps", path: "/manager/gps", icon: <FiMapPin /> },
      {
        labelKey: "manager.dispatch",
        path: "/manager/dispatch",
        icon: <FiNavigation />,
      },
      {
        labelKey: "manager.vouchers",
        path: "/manager/vouchers",
        icon: <FiPackage />,
      },
      {
        labelKey: "manager.packages",
        path: "/manager/packages",
        icon: <FiPackage />,
      },
      {
        labelKey: "manager.policies",
        path: "/manager/policies",
        icon: <FiFileText />,
      },
    ],
  },
  {
    titleKey: "sections.support",
    items: [
      {
        labelKey: "manager.reports",
        path: "/manager/reports",
        icon: <FiBarChart2 />,
      },
      {
        labelKey: "manager.wallet",
        path: "/manager/wallet",
        icon: <FiDollarSign />,
      },
      {
        labelKey: "manager.settings",
        path: "/manager/settings",
        icon: <FiSettings />,
      },
    ],
  },
];

const operatorStaffMenuConfig: MenuSection[] = [
  {
    titleKey: "sections.menu",
    items: [
      {
        labelKey: "manager.dashboard",
        path: "/manager/dashboard",
        icon: <FiLayout />,
      },
      { labelKey: "manager.trips", path: "/manager/trips", icon: <FiTruck /> },
      {
        labelKey: "manager.routeEta",
        path: "/manager/route-eta",
        icon: <FiAlertTriangle />,
      },
      {
        labelKey: "manager.routes",
        path: "/manager/routes",
        icon: <FiNavigation />,
      },
      {
        labelKey: "manager.vehicles",
        path: "/manager/vehicles",
        icon: <FiTruck />,
      },
      {
        labelKey: "manager.bookings",
        path: "/manager/bookings",
        icon: <FiBookOpen />,
      },
      {
        labelKey: "manager.parcels",
        path: "/manager/parcels",
        icon: <FiPackage />,
      },
      { labelKey: "manager.gps", path: "/manager/gps", icon: <FiMapPin /> },
      {
        labelKey: "manager.dispatch",
        path: "/manager/dispatch",
        icon: <FiNavigation />,
      },
    ],
  },
];

const adminMenuConfig: MenuSection[] = [
  {
    titleKey: "sections.menu",
    items: [
      {
        labelKey: "admin.dashboard",
        path: "/admin/dashboard",
        icon: <FiLayout />,
      },
      {
        labelKey: "admin.operators",
        path: "/admin/operators",
        icon: <FiTruck />,
      },
      {
        labelKey: "admin.stations",
        path: "/admin/stations",
        icon: <FiMapPin />,
      },
      { labelKey: "admin.users", path: "/admin/users", icon: <FiBookOpen /> },
      {
        labelKey: "admin.vouchers",
        path: "/admin/vouchers",
        icon: <FiPackage />,
      },
      {
        labelKey: "admin.packages",
        path: "/admin/packages",
        icon: <FiPackage />,
      },
      {
        labelKey: "admin.policies",
        path: "/admin/policies",
        icon: <FiFileText />,
      },
      {
        labelKey: "admin.payouts",
        path: "/admin/payouts",
        icon: <FiDollarSign />,
      },
      {
        labelKey: "admin.walletSettlement",
        path: "/admin/wallet-settlement",
        icon: <FiDollarSign />,
      },
    ],
  },
  {
    titleKey: "sections.support",
    items: [
      {
        labelKey: "admin.revenue",
        path: "/admin/revenue",
        icon: <FiBarChart2 />,
      },
      {
        labelKey: "admin.reports",
        path: "/admin/reports",
        icon: <FiBarChart2 />,
      },
      {
        labelKey: "admin.ragAudit",
        path: "/admin/rag-audit",
        icon: <FiDatabase />,
      },
    ],
  },
];

type SidebarProps = {
  role: AuthRole;
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
  const navigate = useNavigate();
  const { t } = useTranslation(["nav", "common"]);
  const menuConfigByRole: Record<AuthRole, MenuSection[]> = {
    SYSTEM_ADMIN: adminMenuConfig,
    OPERATOR_ADMIN: operatorAdminMenuConfig,
    OPERATOR_STAFF: operatorStaffMenuConfig,
  };
  const menus = menuConfigByRole[role].filter((s) => s.items.length > 0);

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate("/login", { replace: true });
  };

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
                <img src={logo} alt={t("common:brand")} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">
                  {t("common:brand")}
                </h1>
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  {t(`roles.${role}`)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-slate-800 lg:hidden"
              aria-label={t("closeMenu")}
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {menus.map((section, sectionIndex) => (
            <div
              key={section.titleKey}
              className={sectionIndex > 0 ? "mt-6" : ""}
            >
              <p
                className={`${sectionHeadingClass} ${sectionIndex === 0 ? "pt-0" : ""}`}
              >
                {t(section.titleKey)}
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
                        <span className="truncate">{t(item.labelKey)}</span>
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
            onClick={handleLogout}
            className="w-full flex items-center rounded-lg cursor-pointer px-3 py-2.5 text-left text-[13px] font-medium text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <AiOutlineLogout className="mr-2" /> {t("common:logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
