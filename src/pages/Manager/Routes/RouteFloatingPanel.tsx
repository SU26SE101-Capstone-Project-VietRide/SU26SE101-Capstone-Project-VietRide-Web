// Panel nổi bên trái bản đồ (desktop: absolute w-[340px] max-h + scroll, bg
// trắng/95 + shadow; mobile <lg: khối tĩnh xếp dọc TRÊN bản đồ). Nút «/» thu
// gọn — thu thì chỉ còn nút mở lại để bản đồ chiếm trọn khung.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";

type RouteFloatingPanelProps = {
  children: ReactNode;
};

export default function RouteFloatingPanel({
  children,
}: RouteFloatingPanelProps) {
  const { t } = useTranslation("manager");
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        aria-label={t("routes.expandPanel")}
        title={t("routes.expandPanel")}
        className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 lg:absolute lg:top-4 lg:left-4 lg:z-20 lg:mb-0 lg:bg-white/95 lg:shadow-lg"
      >
        <FiChevronsRight size={18} />
      </button>
    );
  }

  return (
    <div
      data-testid="route-floating-panel"
      className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm lg:absolute lg:top-4 lg:left-4 lg:z-20 lg:mb-0 lg:flex lg:max-h-[calc(100%-7.5rem)] lg:w-85 lg:flex-col lg:bg-white/95 lg:shadow-lg lg:backdrop-blur-sm"
    >
      <div className="flex items-center justify-end border-b border-gray-100 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          aria-label={t("routes.collapsePanel")}
          title={t("routes.collapsePanel")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <FiChevronsLeft size={16} />
        </button>
      </div>
      <div className="space-y-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
