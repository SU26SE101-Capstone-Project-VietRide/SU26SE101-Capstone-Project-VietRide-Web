// Empty-state cột phải khi chưa chọn tuyến: hướng dẫn chọn/tạo tuyến.
// Nút "Quản lý bến" nằm ở hàng header góc phải — ĐÚNG vị trí và markup như khi
// đã chọn tuyến (RouteDetailHeader), để chỗ bấm không nhảy giữa hai trạng thái.
// Chỉ render đúng một nút này trên màn: đừng lặp lại nó trong thẻ hướng dẫn.
import { useTranslation } from "react-i18next";
import { FiMap, FiPlus } from "react-icons/fi";
import StationManagementButton from "./StationManagementButton";

type RouteEmptyStateProps = {
  canManageRoutes: boolean;
  onCreateRoute: () => void;
  onOpenStationManagement: () => void;
};

export default function RouteEmptyState({
  canManageRoutes,
  onCreateRoute,
  onOpenStationManagement,
}: RouteEmptyStateProps) {
  const { t } = useTranslation("manager");

  return (
    <main className="min-w-0 space-y-4">
      {/* Cùng khung với RouteDetailHeader: hàng ngang, nút dạt phải. Không có
          tên tuyến để hiển thị nên chỉ còn nút. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <StationManagementButton onClick={onOpenStationManagement} />
      </div>

      <div className="flex min-h-96 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vr-50 text-vr-900">
          <FiMap size={26} />
        </span>
        <h2 className="text-lg font-bold text-gray-900">
          {t("routes.emptyStateTitle")}
        </h2>
        <p className="max-w-md text-sm text-gray-500">
          {t("routes.emptyStateHint")}
        </p>
        {canManageRoutes && (
          <button
            type="button"
            onClick={onCreateRoute}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-900"
          >
            <FiPlus size={16} />
            {t("routes.newRoute")}
          </button>
        )}
      </div>
    </main>
  );
}
