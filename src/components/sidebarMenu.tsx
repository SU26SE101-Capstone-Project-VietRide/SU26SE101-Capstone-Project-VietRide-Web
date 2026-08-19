// Cấu hình menu + tra cứu tên trang theo path.
//
// Tách khỏi Sidebar.tsx vì layout cũng cần `menuLabelKeyFor` để đặt
// `document.title`, mà export hàm từ một file component làm hỏng Fast Refresh
// (rule `react-refresh/only-export-components`).
import {
  FiLayout,
  FiList,
  FiTruck,
  FiBookOpen,
  FiPackage,
  FiMap,
  FiMapPin,
  FiBarChart2,
  FiSettings,
  FiUsers,
  FiNavigation,
  FiDollarSign,
  FiFileText,
  FiDatabase,
  FiCreditCard,
  FiAlertTriangle,
  FiGlobe,
  FiLayers,
  FiActivity,
} from "react-icons/fi";
import type { AuthRole } from "../auth";
import type { SubscriptionModule } from "../contexts/operatorSubscriptionContext";

export type MenuItem = {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  requiredModule?: SubscriptionModule;
};

export type MenuSection = {
  titleKey: string;
  items: MenuItem[];
};

export const operatorAdminMenuConfig: MenuSection[] = [
  {
    titleKey: "sections.menu",
    items: [
      {
        labelKey: "manager.dashboard",
        path: "/manager/dashboard",
        icon: <FiLayout />,
      },
      { labelKey: "manager.trips", path: "/manager/trips", icon: <FiTruck /> },
      // "Lịch chạy" (ở trên) quản lý LỊCH định kỳ; mục này chỉ tra cứu các chuyến
      // đã sinh ra từ lịch đó — hai màn khác nhau, đừng gộp.
      {
        labelKey: "manager.tripList",
        path: "/manager/trip-list",
        icon: <FiList />,
      },
      {
        labelKey: "manager.routes",
        path: "/manager/routes",
        icon: <FiNavigation />,
      },
      {
        labelKey: "manager.routeManagement",
        path: "/manager/route-management",
        icon: <FiMap />,
      },
      {
        labelKey: "manager.stations",
        path: "/manager/stations",
        icon: <FiMapPin />,
      },
      {
        labelKey: "manager.vehicles",
        path: "/manager/vehicles",
        icon: <FiTruck />,
      },
      { labelKey: "manager.staff", path: "/manager/staff", icon: <FiUsers /> },
      {
        labelKey: "manager.bookings",
        path: "/manager/bookings",
        icon: <FiBookOpen />,
      },
      {
        labelKey: "manager.parcels",
        path: "/manager/parcels",
        icon: <FiPackage />,
        requiredModule: "enableParcel",
      },
      {
        labelKey: "manager.operations",
        path: "/manager/operations",
        icon: <FiMap />,
      },
      {
        labelKey: "manager.dispatch",
        path: "/manager/dispatch",
        icon: <FiNavigation />,
        requiredModule: "enableShuttle",
      },
      {
        labelKey: "manager.incidents",
        path: "/manager/incidents",
        icon: <FiAlertTriangle />,
      },
      {
        labelKey: "manager.vouchers",
        path: "/manager/vouchers",
        icon: <FiPackage />,
      },
      {
        labelKey: "manager.packages",
        path: "/manager/packages",
        icon: <FiCreditCard />,
      },
      {
        labelKey: "manager.policies",
        path: "/manager/policies",
        icon: <FiFileText />,
        requiredModule: "enableRag",
      },
    ],
  },
  {
    titleKey: "sections.support",
    items: [
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

export const adminMenuConfig: MenuSection[] = [
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
      {
        // FiMapPin đã dùng cho "Bến nền tảng" ngay phía trên — hai mục
        // cạnh nhau cùng icon thì icon mất hẳn tác dụng phân biệt.
        labelKey: "admin.locations",
        path: "/admin/locations",
        icon: <FiGlobe />,
      },
      // FiBookOpen (quyển sách) cho mục quản lý người dùng là sai ngữ nghĩa.
      { labelKey: "admin.users", path: "/admin/users", icon: <FiUsers /> },
      {
        labelKey: "admin.vouchers",
        path: "/admin/vouchers",
        icon: <FiPackage />,
      },
      {
        // FiPackage đã dùng cho "Mã giảm giá" ngay phía trên.
        labelKey: "admin.packages",
        path: "/admin/packages",
        icon: <FiLayers />,
      },
      {
        labelKey: "admin.policies",
        path: "/admin/policies",
        icon: <FiFileText />,
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
        labelKey: "admin.reports",
        path: "/admin/reports",
        icon: <FiBarChart2 />,
      },
      {
        labelKey: "admin.ragAudit",
        path: "/admin/rag-audit",
        icon: <FiDatabase />,
      },
      {
        labelKey: "admin.activityLogs",
        path: "/admin/activity-logs",
        icon: <FiActivity />,
      },

],
  },
];

/**
 * Khoá dịch tên trang theo path — dùng cho `document.title`.
 *
 * Đọc thẳng từ chính config menu để tên trên tab trình duyệt luôn khớp nhãn
 * người dùng thấy trong menu, không phải bảng ánh xạ thứ hai dễ lệch.
 */
export function menuLabelKeyFor(role: AuthRole, pathname: string): string | null {
  const sections =
    role === "SYSTEM_ADMIN" ? adminMenuConfig : operatorAdminMenuConfig;

  for (const section of sections) {
    for (const item of section.items) {
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
        return item.labelKey;
      }
    }
  }

  return null;
}

