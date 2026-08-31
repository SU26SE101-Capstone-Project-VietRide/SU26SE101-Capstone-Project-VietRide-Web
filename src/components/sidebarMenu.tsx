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
  FiHelpCircle,
  FiSettings,
  FiShield,
  FiUsers,
  FiNavigation,
  FiDollarSign,
  FiFileText,
  FiDatabase,
  FiCreditCard,
  FiAlertTriangle,
  FiAlertOctagon,
  FiCheckSquare,
  FiRotateCcw,
  FiGlobe,
  FiLayers,
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

// Menu nhà xe có hơn 20 mục. Gom hết vào một nhóm "CHỨC NĂNG" thì người dùng
// phải quét cả danh sách mới tìm ra mục cần — chia theo nhóm nghiệp vụ để mắt
// chỉ phải quét trong một nhóm 2-6 mục.
export const operatorAdminMenuConfig: MenuSection[] = [
  {
    titleKey: "sections.operations",
    items: [
      {
        labelKey: "manager.dashboard",
        path: "/manager/dashboard",
        icon: <FiLayout />,
      },
      {
        labelKey: "manager.operations",
        path: "/manager/operations",
        icon: <FiMap />,
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
    ],
  },
  {
    titleKey: "sections.routes",
    items: [
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
    ],
  },
  {
    titleKey: "sections.fleet",
    items: [
      {
        labelKey: "manager.vehicles",
        path: "/manager/vehicles",
        icon: <FiTruck />,
      },
      { labelKey: "manager.staff", path: "/manager/staff", icon: <FiUsers /> },
    ],
  },
  {
    titleKey: "sections.sales",
    items: [
      {
        labelKey: "manager.bookings",
        path: "/manager/bookings",
        icon: <FiBookOpen />,
      },
      {
        labelKey: "manager.vouchers",
        path: "/manager/vouchers",
        icon: <FiPackage />,
      },
    ],
  },
  {
    // Cả nhóm đều thuộc module `enableParcel`: nhà xe không mua module thì bộ
    // lọc trong Sidebar bỏ hết mục, và nhóm rỗng cũng biến mất theo.
    titleKey: "sections.parcel",
    items: [
      {
        labelKey: "manager.parcels",
        path: "/manager/parcels",
        icon: <FiPackage />,
        requiredModule: "enableParcel",
      },
      {
        labelKey: "manager.parcelIncidents",
        path: "/manager/parcel-incidents",
        icon: <FiAlertOctagon />,
        requiredModule: "enableParcel",
      },
      {
        labelKey: "manager.stopDepartureApprovals",
        path: "/manager/stop-departure-approvals",
        icon: <FiCheckSquare />,
        requiredModule: "enableParcel",
      },
      {
        labelKey: "manager.unidentifiedPackages",
        path: "/manager/unidentified-packages",
        icon: <FiHelpCircle />,
        requiredModule: "enableParcel",
      },
      {
        labelKey: "manager.claims",
        path: "/manager/claims",
        icon: <FiShield />,
        requiredModule: "enableParcel",
      },
      {
        labelKey: "manager.claimAppeals",
        path: "/manager/claim-appeals",
        icon: <FiRotateCcw />,
        requiredModule: "enableParcel",
      },
    ],
  },
  {
    titleKey: "sections.finance",
    items: [
      {
        labelKey: "manager.wallet",
        path: "/manager/wallet",
        icon: <FiDollarSign />,
      },
      {
        labelKey: "manager.packages",
        path: "/manager/packages",
        icon: <FiCreditCard />,
      },
    ],
  },
  {
    titleKey: "sections.system",
    items: [
      {
        labelKey: "manager.policies",
        path: "/manager/policies",
        icon: <FiFileText />,
        requiredModule: "enableRag",
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
    titleKey: "sections.analytics",
    items: [
      {
        labelKey: "admin.dashboard",
        path: "/admin/dashboard",
        icon: <FiLayout />,
      },
      {
        labelKey: "admin.reports",
        path: "/admin/reports",
        icon: <FiBarChart2 />,
      },
    ],
  },
  {
    // Ba màn đều xoay quanh quan hệ với nhà xe: hồ sơ nhà xe, gói họ mua và
    // tiền phải trả cho họ.
    titleKey: "sections.operators",
    items: [
      {
        labelKey: "admin.operators",
        path: "/admin/operators",
        icon: <FiTruck />,
      },
      {
        // FiPackage đã dùng cho "Mã giảm giá" bên nhóm Người dùng.
        labelKey: "admin.packages",
        path: "/admin/packages",
        icon: <FiLayers />,
      },
      {
        labelKey: "admin.walletSettlement",
        path: "/admin/wallet-settlement",
        icon: <FiDollarSign />,
      },
    ],
  },
  {
    titleKey: "sections.stations",
    items: [
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
    ],
  },
  {
    titleKey: "sections.users",
    items: [
      // FiBookOpen (quyển sách) cho mục quản lý người dùng là sai ngữ nghĩa.
      { labelKey: "admin.users", path: "/admin/users", icon: <FiUsers /> },
      {
        labelKey: "admin.vouchers",
        path: "/admin/vouchers",
        icon: <FiPackage />,
      },
    ],
  },
  {
    titleKey: "sections.system",
    items: [
      {
        labelKey: "admin.policies",
        path: "/admin/policies",
        icon: <FiFileText />,
      },
      {
        labelKey: "admin.ragAudit",
        path: "/admin/rag-audit",
        icon: <FiDatabase />,
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
