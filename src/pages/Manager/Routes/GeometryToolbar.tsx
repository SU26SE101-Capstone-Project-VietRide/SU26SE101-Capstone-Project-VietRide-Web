// Thanh điều khiển hình học tuyến — thanh ngang mỏng NGOÀI bản đồ, đặt ngay
// trên map (dưới hàng tab). Không còn overlay đè lên bản đồ: che logo/attribution
// Google là vi phạm TOS Google Maps, và cụm nút đè mép dưới cũng khó thao tác.
// Trái: toggle loại xe + icon Vẽ thủ công + spinner "Đang tìm đường…";
// phải: slot `trailing` (badge "Chưa lưu thay đổi" + nút "Lưu tuyến" do
// RouteMapWorkspace truyền vào). Cảnh báo TRUCK dài xuống dòng riêng dưới thanh.
import { useTranslation } from "react-i18next";
import { FiCornerUpLeft, FiEdit2, FiLoader } from "react-icons/fi";
import type { ReactNode } from "react";
import type { UseRouteGeometryResult } from "./useRouteGeometry";

type GeometryToolbarProps = {
  canManageRoutes: boolean;
  geometry: UseRouteGeometryResult;
  // Cụm bên phải của thanh (badge chưa lưu + nút Lưu tuyến)
  trailing?: ReactNode;
};

export default function GeometryToolbar({
  canManageRoutes,
  geometry,
  trailing,
}: GeometryToolbarProps) {
  const { t } = useTranslation("manager");
  const {
    routePathPoints,
    travelMode,
    truckWarning,
    isRerouting,
    isFetchingOptions,
    autoRouteUnavailable,
    allOptionsExcluded,
    isEditingGeometry,
    handleSetTravelMode,
    handleStartManualGeometry,
    handleUndoGeometryPoint,
  } = geometry;

  // Toolbar chỉ dành cho người sửa được tuyến — viewer thuần xem bản đồ
  if (!canManageRoutes) {
    return null;
  }

  // Toggle loại xe: 2 nút nhỏ dạng segmented — TRUCK (xe khách lớn, mặc định)
  // và DRIVE (xe nhỏ <16 chỗ); đổi mode thì effect trong hook tự tính lại
  const travelModeButtonClass = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-vr-500 text-white"
        : "bg-white text-gray-600 hover:bg-gray-50"
    }`;

  const iconButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      data-testid="geometry-toolbar"
      className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t("routes.travelModeLabel")}
          className="inline-flex divide-x divide-gray-200 overflow-hidden rounded-lg border border-gray-200"
        >
          <button
            type="button"
            data-testid="travel-mode-truck"
            aria-pressed={travelMode === "TRUCK"}
            onClick={() => handleSetTravelMode("TRUCK")}
            className={travelModeButtonClass(travelMode === "TRUCK")}
          >
            {t("routes.travelModeCoach")}
          </button>
          <button
            type="button"
            data-testid="travel-mode-drive"
            aria-pressed={travelMode === "DRIVE"}
            onClick={() => handleSetTravelMode("DRIVE")}
            className={travelModeButtonClass(travelMode === "DRIVE")}
          >
            {t("routes.travelModeSmall")}
          </button>
        </div>

        {/* Vẽ thủ công (fallback khi Google không tính được) — icon có tooltip */}
        <button
          type="button"
          aria-label={t("routes.drawGeometryFallback")}
          title={t("routes.drawGeometryFallback")}
          onClick={handleStartManualGeometry}
          className={iconButtonClass}
        >
          <FiEdit2 size={14} />
        </button>
        {/* Badge trạng thái chỉ hiện KHI đang tính (auto-fetch/reroute) */}
        {(isFetchingOptions || isRerouting) && (
          <span
            data-testid="finding-routes-indicator"
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
          >
            <FiLoader className="animate-spin" size={12} />
            {t("routes.findingRoutes")}
          </span>
        )}

        {/* Auto-fetch lỗi (thiếu key/Google lỗi) → text nhỏ, vẫn vẽ tay được */}
        {autoRouteUnavailable && !isFetchingOptions && !isEditingGeometry && (
          <span
            data-testid="auto-route-unavailable"
            className="text-xs text-gray-500"
          >
            {t("routes.autoRouteUnavailable")}
          </span>
        )}

        {/* Google có trả phương án nhưng tất cả đều trùng tuyến chính (bị lọc
            khỏi bộ phương án thay thế) → hint kéo điểm nắn để tự tạo đường khác */}
        {allOptionsExcluded && !isFetchingOptions && !isEditingGeometry && (
          <span
            data-testid="all-options-excluded"
            className="text-xs text-amber-600"
          >
            {t("routes.allOptionsMatchMainRoute")}
          </span>
        )}

        {/* Đang vẽ tay: badge amber + nút hoàn tác điểm vừa cắm */}
        {isEditingGeometry && (
          <>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {t("routes.geometryDrawing")}
            </span>
            <button
              type="button"
              aria-label={t("routes.undoGeometryPoint")}
              title={t("routes.undoGeometryPoint")}
              onClick={handleUndoGeometryPoint}
              disabled={routePathPoints.length === 0}
              className={iconButtonClass}
            >
              <FiCornerUpLeft size={14} />
            </button>
          </>
        )}

        {trailing && (
          <div className="ml-auto flex items-center gap-2">{trailing}</div>
        )}
      </div>

      {/* Cảnh báo đường hạn chế xe lớn (tính bằng TRUCK) — dòng riêng dưới thanh:
          amber = TRUCK phải đi vòng đáng kể so với DRIVE; đỏ = TRUCK bí đường
          mà DRIVE vẫn đi được */}
      {truckWarning === "detour" && (
        <p
          data-testid="truck-detour-warning"
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
        >
          {t("routes.truckDetourWarning")}
        </p>
      )}
      {truckWarning === "unavailable" && (
        <p
          data-testid="truck-unavailable-warning"
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700"
        >
          {t("routes.truckRouteUnavailable")}
        </p>
      )}
    </div>
  );
}
