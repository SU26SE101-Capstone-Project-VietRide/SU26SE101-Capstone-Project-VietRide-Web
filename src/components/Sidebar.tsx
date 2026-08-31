import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMinus, FiPlus, FiX } from "react-icons/fi";
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

// Viền focus dùng chung cho mọi thứ bấm được trong sidebar. `focus-visible`
// chứ không phải `focus`: chuột bấm xong không để lại viền, nhưng đi bằng
// Tab thì luôn thấy mình đang đứng ở đâu (WCAG 2.4.7).
const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vr-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white";

// Tiêu đề nhóm cố tình nhỏ và nhạt hơn hẳn mục menu: nó là nhãn phân vùng,
// không phải thứ để bấm vào đi đâu đó — chữ to bằng mục menu là mắt phải đọc
// lại hai lần mới biết dòng nào bấm được.
// `cursor-pointer` là bắt buộc chứ không phải trang trí: Tailwind v4 để
// `button { cursor: default }`, không thêm thì tiêu đề nhóm trông y hệt một
// dòng chữ chết, không ai biết bấm vào thu gọn được.
const sectionHeadingClass = `group flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 ${focusRingClass}`;

const itemBaseClass = `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${focusRingClass}`;

// Icon KHÔNG đặt màu riêng ở trạng thái thường: nó thừa hưởng màu chữ của
// mục, nên icon và nhãn luôn cùng độ đậm — icon xám hơn chữ làm hàng bị "gãy"
// làm đôi. Chỉ mục đang mở mới cho icon màu thương hiệu để làm điểm neo.
const iconWrapClass =
  "flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:stroke-[1.75]";

// Người dùng thu gọn nhóm nào thì lần vào sau vẫn giữ nguyên — nếu không, mỗi
// lần tải lại trang họ phải thu gọn lại từ đầu.
const COLLAPSED_SECTIONS_KEY = "vietride.sidebar.collapsedSections";

function readCollapsedSections(): string[] {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_SECTIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    // Chế độ riêng tư / localStorage bị chặn: chỉ mất phần ghi nhớ, menu vẫn
    // phải chạy bình thường nên nuốt lỗi thay vì để component crash.
    return [];
  }
}

function sectionListId(titleKey: string) {
  return `sidebar-section-${titleKey.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

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
  // Mặc định mở hết: thu gọn là lựa chọn của người dùng chứ không phải trạng
  // thái ban đầu — vào lần đầu mà nửa menu bị giấu thì còn khó tìm hơn.
  const [collapsedSections, setCollapsedSections] =
    useState<string[]>(readCollapsedSections);

  const toggleSection = (titleKey: string) => {
    setCollapsedSections((previous) => {
      const next = previous.includes(titleKey)
        ? previous.filter((key) => key !== titleKey)
        : [...previous, titleKey];
      try {
        window.localStorage.setItem(
          COLLAPSED_SECTIONS_KEY,
          JSON.stringify(next),
        );
      } catch {
        // Xem chú thích ở readCollapsedSections.
      }
      return next;
    });
  };

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
          fixed left-0 top-0 z-40 flex h-screen w-[264px] flex-col border-r border-slate-200/70 bg-white
          transform transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0
          ${isOpen ? "translate-x-0 shadow-xl lg:shadow-none" : "-translate-x-full"}
        `}
      >
        {/* Không kẻ ngang dưới logo: khoảng trắng đủ tách phần thương hiệu ra
            khỏi menu rồi, thêm nét kẻ chỉ làm cột dọc bị chặt khúc. */}
        <div className="shrink-0 px-4 pb-3 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-vr-600 text-sm font-bold text-white">
                <img src={logo} alt={t("common:brand")} />
              </div>
              <div className="min-w-0">
                {/* Không dùng <h1>: mỗi page đã có <h1> riêng cho tiêu đề màn,
                    để ở đây nữa là 2 <h1> trên mọi trang (WCAG 1.3.1). */}
                <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900">
                  {t("common:brand")}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
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
              className={`rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden ${focusRingClass}`}
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
          // Thanh cuộn mảnh + `stable`: menu dài hơn màn hình thì thanh cuộn
          // hiện ra mà không đẩy cả cột chữ lệch sang trái.
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:#e2e8f0_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]"
        >
          {menus.map((section, sectionIndex) => {
            const { titleKey } = section;
            const isCollapsed = collapsedSections.includes(titleKey);
            // Khoảng cách phải co theo trạng thái nhóm ĐỨNG TRƯỚC: nhóm trước
            // đang mở thì cần khoảng thở để tách khỏi danh sách mục của nó,
            // còn thu gọn rồi thì hai tiêu đề liền nhau — giữ nguyên 24px là
            // menu thành mấy dòng chữ rời rạc trôi giữa khoảng trắng.
            const previousCollapsed =
              sectionIndex > 0 &&
              collapsedSections.includes(menus[sectionIndex - 1].titleKey);
            const hasActiveItem = section.items.some(
              (item) => location.pathname === item.path,
            );
            return (
              <div
                key={titleKey}
                // Tách nhóm bằng khoảng trắng chứ không bằng nét kẻ: 8 nhóm là
                // 7 đường kẻ ngang, cột menu trông như bảng biểu.
                className={
                  sectionIndex === 0
                    ? undefined
                    : previousCollapsed
                      ? "mt-0.5"
                      : "mt-5"
                }
              >
                <button
                  type="button"
                  onClick={() => toggleSection(titleKey)}
                  aria-expanded={!isCollapsed}
                  aria-controls={sectionListId(titleKey)}
                  className={`${sectionHeadingClass} ${
                    isCollapsed && hasActiveItem ? "text-vr-700" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {t(titleKey)}
                  </span>
                  {/* Nhóm bị thu gọn mà đang chứa trang hiện tại thì không còn
                      mục nào sáng lên để định vị — chấm này thay cho nó. */}
                  {isCollapsed && hasActiveItem && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-vr-500"
                    />
                  )}
                  {/* Dấu −/+ thay cho mũi tên: nó nói thẳng bấm vào được gì
                      (bớt đi / thêm ra), còn mũi tên xoay thì phải nhớ quy ước.
                      Để nhạt hơn chữ tiêu đề vì đây là nút phụ, chỉ đậm lên
                      khi trỏ vào đúng nhóm đó. */}
                  {isCollapsed ? (
                    <FiPlus
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
                    />
                  ) : (
                    <FiMinus
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
                    />
                  )}
                </button>
                {/* Dùng thuộc tính `hidden` chứ không gỡ khỏi DOM, để
                    `aria-controls` ở trên luôn trỏ tới một phần tử có thật. */}
                <ul
                  id={sectionListId(titleKey)}
                  hidden={isCollapsed}
                  className="mt-0.5 space-y-0.5"
                >
                  {section.items.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          onClick={onClose}
                          // Trình đọc màn hình phải nghe được "trang hiện tại"
                          // — nền xanh chỉ là tín hiệu cho người nhìn thấy.
                          aria-current={active ? "page" : undefined}
                          className={`
                            ${itemBaseClass}
                            ${
                              active
                                ? "bg-vr-50 font-semibold text-vr-900"
                                : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                            }
                          `}
                        >
                          {/* Vạch neo sát mép trái sidebar (nav đang padding
                              12px nên `-left-3` rơi đúng vào viền): nền nhạt
                              một mình khó bắt khi liếc nhanh cả cột. */}
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-vr-500"
                            />
                          )}
                          <span
                            className={`${iconWrapClass} ${active ? "text-vr-600" : ""}`}
                          >
                            {item.icon}
                          </span>
                          {/* Menu có mục dài hơn bề ngang sidebar ("Điều phối
                              trung chuyển") nên `truncate` cắt mất đuôi. Tên
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
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-100 px-3 py-3">
          {/* Mặc định để xám như một mục menu thường, chỉ đỏ lên khi trỏ vào:
              nút đỏ chói nằm sẵn ở đó kéo mắt mạnh hơn cả mục đang mở. */}
          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 ${focusRingClass}`}
          >
            <AiOutlineLogout className="h-[18px] w-[18px] shrink-0" />
            {t("common:logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
