// Header cột phải: tên tuyến đang chọn + nút Quản lý bến + thanh tab (sticky
// theo scroll, style tab đồng bộ với WalletSettlement). Nút "Lưu tuyến" + badge
// "chưa lưu" đã chuyển xuống overlay góc phải-dưới bản đồ (RouteMapWorkspace)
// — bỏ ở header để không có 2 nút lưu trùng nhau.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import StationManagementButton from "./StationManagementButton";
import { routeTabs, type RouteTab } from "./routeFormUtils";

type RouteDetailHeaderProps = {
  routeName: string;
  activeTab: RouteTab;
  onSelectTab: (tab: RouteTab) => void;
  onOpenStationManagement: () => void;
};

export default function RouteDetailHeader({
  routeName,
  activeTab,
  onSelectTab,
  onOpenStationManagement,
}: RouteDetailHeaderProps) {
  const { t } = useTranslation("manager");
  // Sentinel 1px phía trên header: rời khỏi scrollport nghĩa là header đang "dính"
  // → bật shadow nhẹ để tách khỏi nội dung cuộn bên dưới. jsdom không có
  // IntersectionObserver nên guard lại (test không cần hiệu ứng này).
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(([entry]) =>
      setIsStuck(!entry.isIntersecting),
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    // Fragment: sentinel + khối sticky phải là con trực tiếp của <main> để sticky
    // chạy hết chiều cao cột phải. Bỏ hack -mx-1/px-1/pt-1 cũ — đỉnh header thẳng
    // hàng với mép trên card "Danh sách tuyến" (grid items-start), nền bg-gray-50
    // phủ kín khi cuộn, z-20 dưới dropdown/modal (z-50). -mt-px chỉ bù chiều cao
    // sentinel để giữ thẳng hàng.
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        className={`sticky top-0 z-20 -mt-px space-y-4 bg-gray-50 transition-shadow ${
          isStuck ? "shadow-[0_10px_8px_-8px_rgba(15,23,42,0.12)]" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-bold text-gray-900">
            {routeName}
          </h2>
          <StationManagementButton onClick={onOpenStationManagement} />
        </div>

        <nav
          aria-label={t("routes.manageTitle")}
          className="flex flex-wrap gap-2 border-b border-gray-200"
        >
          {routeTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => onSelectTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-vr-500 text-vr-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t(`routes.tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
