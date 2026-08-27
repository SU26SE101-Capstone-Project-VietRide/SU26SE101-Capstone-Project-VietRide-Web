// Header cột phải: tên tuyến đang chọn + nút Quản lý bến + thanh tab (sticky
// theo scroll, style tab đồng bộ với WalletSettlement). Badge "chưa lưu" + nút
// "Lưu tuyến" nằm ở mép phải hàng tab: trước đây chúng ở thanh trên bản đồ
// (RouteMapWorkspace), cuộn xuống sửa điểm dừng là mất hút, sửa xong phải cuộn
// ngược lên mới bấm được. Header sticky nên đặt ở đây thì nút luôn trong tầm
// mắt. Vẫn chỉ có MỘT nút lưu: tab "Tuyến thay thế" giữ nút riêng của nó trong
// AlternativeRouteWorkspace, nên nút này chỉ hiện ở tab thông tin/điểm dừng.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiSave } from "react-icons/fi";
import StationManagementButton from "./StationManagementButton";
import { routeTabs, type RouteTab } from "./routeFormUtils";
import { Badge } from "../../../components/ui/Badge";

type RouteDetailHeaderProps = {
  routeName: string;
  activeTab: RouteTab;
  onSelectTab: (tab: RouteTab) => void;
  onOpenStationManagement: () => void;
  canManageRoutes: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSaveRoute: () => void;
  /**
   * Trạng thái lưu của tab "Tuyến thay thế". Tab đó lưu một BẢN GHI KHÁC (tuyến
   * thay thế đang soạn), nhưng nút lưu vẫn phải đứng đúng chỗ như hai tab kia —
   * người dùng không nên phải đi tìm nút lưu ở chỗ khác chỉ vì đổi tab.
   */
  isAlternativeDirty?: boolean;
  isSavingAlternative?: boolean;
  onSaveAlternative?: () => void;
};

export default function RouteDetailHeader({
  routeName,
  activeTab,
  onSelectTab,
  onOpenStationManagement,
  canManageRoutes,
  isDirty,
  isSaving,
  onSaveRoute,
  isAlternativeDirty = false,
  isSavingAlternative = false,
  onSaveAlternative,
}: RouteDetailHeaderProps) {
  const { t } = useTranslation("manager");
  // Sentinel 1px phía trên header: rời khỏi scrollport nghĩa là header đang "dính"
  // → bật shadow nhẹ để tách khỏi nội dung cuộn bên dưới. jsdom không có
  // IntersectionObserver nên guard lại (test không cần hiệu ứng này).
  const [isStuck, setIsStuck] = useState(false);
  // Nút lưu đứng CÙNG MỘT CHỖ ở cả ba tab. Trước đây tab "Tuyến thay thế" bị
  // loại khỏi đây và tự dựng nút riêng trong thanh công cụ bản đồ, nên đổi tab
  // là nút lưu nhảy sang chỗ khác. Lý do loại trừ hồi đó là "hai nút cùng nhãn
  // cạnh nhau" — nay không còn: mỗi tab chỉ hiện ĐÚNG MỘT nút, và nhãn nói rõ
  // nó lưu cái gì (tuyến chính hay tuyến thay thế), vì hai thứ đó là hai bản
  // ghi khác nhau.
  const isAlternativeTab = activeTab === "alternatives";
  const canSaveRoute =
    canManageRoutes && (!isAlternativeTab || onSaveAlternative !== undefined);
  const saveDirty = isAlternativeTab ? isAlternativeDirty : isDirty;
  const saveBusy = isAlternativeTab ? isSavingAlternative : isSaving;
  const saveLabel = isAlternativeTab
    ? saveBusy
      ? t("routes.savingAlternative")
      : t("routes.saveAlternative")
    : saveBusy
      ? t("routes.savingRoute")
      : t("routes.saveRoute");
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
        data-testid="route-detail-header"
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

        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-b border-gray-200">
          <nav
            aria-label={t("routes.manageTitle")}
            className="flex flex-wrap gap-2"
          >
            {routeTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeTab === tab}
                onClick={() => onSelectTab(tab)}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "border-vr-500 text-vr-900"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t(`routes.tabs.${tab}`)}
              </button>
            ))}
          </nav>

          {canSaveRoute && (
            <div className="flex items-center gap-2 pb-2">
              {saveDirty && (
                <Badge tone="warning" className="ring-1 ring-amber-200">
                  {t("routes.unsavedChanges")}
                </Badge>
              )}
              <button
                type="button"
                onClick={isAlternativeTab ? onSaveAlternative : onSaveRoute}
                disabled={!saveDirty || saveBusy}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                  saveDirty
                    ? "bg-vr-800 text-white shadow-sm hover:bg-vr-900 disabled:opacity-70"
                    : "border border-gray-200 bg-white text-gray-500"
                }`}
              >
                <FiSave size={16} />
                {saveLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
