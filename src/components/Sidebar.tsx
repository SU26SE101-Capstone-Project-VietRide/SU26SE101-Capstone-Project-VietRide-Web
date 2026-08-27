import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import logo from "../assets/Login/logo.svg";
import { AiOutlineLogout } from "react-icons/ai";
import { logout, type AuthRole } from "../auth";
import {
  adminMenuConfig,
  operatorAdminMenuConfig,
  type MenuSection,
} from "./sidebarMenu";
import { useOperatorSubscription } from "../contexts/operatorSubscriptionContext";
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from "../hooks/useMediaQuery";

type SidebarProps = {
  role: AuthRole;
  isOpen: boolean;
  onClose: () => void;
};

const sectionHeadingClass =
  "px-3 pb-2.5 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-600";

const itemBaseClass =
  "flex items-center gap-3.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors";

const iconWrapClass =
  "flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:stroke-[1.75]";

export default function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(["nav", "common"]);
  const { hasModule } = useOperatorSubscription();
  // Từ `lg` trở lên sidebar là cột cố định (`lg:translate-x-0`) nên luôn hiển
  // thị bất kể `isOpen`. Chỉ dưới mốc đó nó mới là drawer trượt ra ngoài màn
  // hình — và chỉ khi đó mới được `inert`, nếu không desktop mất hẳn menu.
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const isOffscreenDrawer = !isDesktop && !isOpen;
  const menuConfigByRole: Record<AuthRole, MenuSection[]> = {
    SYSTEM_ADMIN: adminMenuConfig,
    OPERATOR_ADMIN: operatorAdminMenuConfig,
  };
  const menus = menuConfigByRole[role]
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.requiredModule || hasModule(item.requiredModule),
      ),
    }))
    .filter((section) => section.items.length > 0);

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
        // Drawer đóng vẫn nằm trong DOM để giữ hiệu ứng trượt, nhưng `inert`
        // kéo nó khỏi tab order — trước đó người dùng bàn phím phải Tab qua 19
        // phần tử vô hình ngoài màn hình mới tới được nội dung (WCAG 2.4.3).
        inert={isOffscreenDrawer || undefined}
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
                {/* Không dùng <h1>: mỗi page đã có <h1> riêng cho tiêu đề màn,
                    để ở đây nữa là 2 <h1> trên mọi trang (WCAG 1.3.1). */}
                <p className="truncate text-lg font-bold tracking-tight text-slate-900">
                  {t("common:brand")}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {/* common:roles là nguồn duy nhất cho tên vai trò — nav có
                      bản sao riêng nên cùng một người đọc được hai tên khác
                      nhau giữa sidebar và các màn khác. */}
                  {t(`common:roles.${role}`)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-50 hover:text-slate-800 lg:hidden"
              aria-label={t("closeMenu")}
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Trang có nhiều <nav> (menu chính + tab trong nội dung) nên mỗi cái
            phải có tên riêng, nếu không trình đọc màn hình đọc ra hai
            "navigation" giống hệt nhau. */}
        <nav
          aria-label={t("mainNavigation")}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
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
                          className={`${iconWrapClass} ${active ? "text-vr-900" : "text-slate-700"}`}
                        >
                          {item.icon}
                        </span>
                        {/* Menu có mục dài hơn bề ngang sidebar ("Điều phối
                            xe trung chuyển") nên `truncate` cắt mất đuôi. Tên
                            đầy đủ chỉ còn ở `title` — trình duyệt hiện tooltip
                            khi hover, không cần thư viện tooltip. Đặt trên
                            chính `span` bị cắt chứ không phải trên `Link`, để
                            vùng hover trùng đúng phần chữ bị cắt. */}
                        <span className="truncate" title={t(item.labelKey)}>
                          {t(item.labelKey)}
                        </span>
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
            className="w-full flex items-center rounded-lg cursor-pointer px-3 py-2.5 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 hover:text-rose-800"
          >
            <AiOutlineLogout className="mr-2" /> {t("common:logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
