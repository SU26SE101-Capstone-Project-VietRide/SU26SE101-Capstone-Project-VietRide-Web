// Empty-state cột phải khi chưa chọn tuyến: hướng dẫn chọn/tạo tuyến.
// Nút "Quản lý bến" nằm ở hàng header góc phải — ĐÚNG vị trí và markup như khi
// đã chọn tuyến (RouteDetailHeader), để chỗ bấm không nhảy giữa hai trạng thái.
// Chỉ render đúng một nút này trên màn: đừng lặp lại nó trong thẻ hướng dẫn.
import { useTranslation } from "react-i18next";
import { FiMap, FiPlus } from "react-icons/fi";
import StationManagementButton from "./StationManagementButton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Button } from "../../../components/ui/Button";

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
    <div className="min-w-0 space-y-4">
      {/* Cùng khung với RouteDetailHeader: hàng ngang, nút dạt phải. Không có
          tên tuyến để hiển thị nên chỉ còn nút. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <StationManagementButton onClick={onOpenStationManagement} />
      </div>

      <div className="flex min-h-96 items-center justify-center">
        <EmptyState
          icon={<FiMap size={26} />}
          title={t("routes.emptyStateTitle")}
          description={t("routes.emptyStateHint")}
          action={
            canManageRoutes ? (
              <Button variant="primary" onClick={onCreateRoute}>
                <FiPlus size={16} />
                {t("routes.newRoute")}
              </Button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
