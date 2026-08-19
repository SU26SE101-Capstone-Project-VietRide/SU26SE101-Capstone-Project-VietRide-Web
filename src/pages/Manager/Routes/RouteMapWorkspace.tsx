// Khung bản đồ dùng chung cho tab "Thông tin" và tab "Điểm dừng" (map-first):
// thanh điều khiển hình học nằm NGOÀI bản đồ (thanh ngang mỏng ngay trên map —
// không che logo/attribution Google, không đè thao tác kéo), gồm cả badge
// "Chưa lưu thay đổi" + nút "Lưu tuyến" ở mép phải. Bản đồ full-bleed bên dưới,
// chỉ còn panel nổi bên trái + bubble/marker. Nội dung panel nổi đổi theo
// `panelMode`: "info" → form tuyến; "stops" → danh sách + tìm điểm dừng (chấm
// gợi ý trên map chỉ bật ở mode này). Marker số thứ tự stop đã gắn (stopMarkers)
// luôn hiện trên map ở CẢ hai mode.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiSave } from "react-icons/fi";
import type {
  OperatorRoute,
  OperatorRouteRequest,
  OperatorStop,
} from "../../../api/vietride";
import RouteDesignMap, { type RouteStopMarker } from "./RouteDesignMap";
import RouteFloatingPanel from "./RouteFloatingPanel";
import RouteFormSection from "./RouteFormSection";
import RoutePanelStopsSection from "./RoutePanelStopsSection";
import GeometryToolbar from "./GeometryToolbar";
import RouteMapLegend from "./RouteMapLegend";
import type { RouteMapPoint, StationOption, StopSuggestion } from "./types";
import type { UseRouteGeometryResult } from "./useRouteGeometry";
import type { UseRouteStopEditorResult } from "./useRouteStopEditor";
import type { RouteTab } from "./routeFormUtils";
import { Badge } from "../../../components/ui/Badge";

type RouteMapWorkspaceProps = {
  // Nội dung panel nổi hiện theo tab đang mở: "info" = form tuyến, "stops" =
  // danh sách + tìm điểm dừng. Chỉ nhận 2 giá trị này (workspace không render
  // ở tab "alternatives").
  panelMode: Extract<RouteTab, "info" | "stops">;
  canManageRoutes: boolean;
  routes: OperatorRoute[];
  stations: StationOption[];
  selectedRouteId: string;
  routeForm: OperatorRouteRequest;
  onUpdateField: <K extends keyof OperatorRouteRequest>(
    key: K,
    value: OperatorRouteRequest[K],
  ) => void;
  routeFeedbackMessage: string;
  isAutoCalculatingMetrics: boolean;
  autoMetricsFallback: boolean;
  geometry: UseRouteGeometryResult;
  routeMapPoints: RouteMapPoint[];
  stops: OperatorStop[];
  selectedStopId: string;
  onSelectStop: (stopId: string) => void;
  stopEditor: UseRouteStopEditorResult;
  // Chấm gợi ý (kho nhà xe/Google) truyền xuống map — chỉ có nội dung khi
  // panelMode === "stops" (caller đã gate theo tab), render mảng rỗng ở info
  suggestions: StopSuggestion[];
  onAddSuggestion: (
    suggestion: StopSuggestion,
    options: { allowPickup: boolean; allowDropoff: boolean },
  ) => void;
  isAddingSuggestion: boolean;
  // Gợi ý được chọn từ ô search panel — object mới mỗi lần chọn để re-trigger
  // popup trên bản đồ (RouteDesignMap prop externalActiveSuggestion)
  pickedSuggestion: StopSuggestion | null;
  onPickSearchResult: (result: StopSuggestion) => void;
  // Đang tải gợi ý Google Places dọc tuyến — hiện dòng loading nhỏ trong panel
  isLoadingSuggestions: boolean;
  routeStopFeedbackMessage: string;
  isDirty: boolean;
  isSaving: boolean;
  onSaveRoute: () => void;
};

export default function RouteMapWorkspace({
  panelMode,
  canManageRoutes,
  routes,
  stations,
  selectedRouteId,
  routeForm,
  onUpdateField,
  routeFeedbackMessage,
  isAutoCalculatingMetrics,
  autoMetricsFallback,
  geometry,
  routeMapPoints,
  stops,
  selectedStopId,
  onSelectStop,
  stopEditor,
  suggestions,
  onAddSuggestion,
  isAddingSuggestion,
  pickedSuggestion,
  onPickSearchResult,
  isLoadingSuggestions,
  routeStopFeedbackMessage,
  isDirty,
  isSaving,
  onSaveRoute,
}: RouteMapWorkspaceProps) {
  const { t } = useTranslation("manager");
  // Có đường đi (tính/vẽ) → khóa 2 ô số liệu form (server bỏ qua manualMetrics)
  const metricsLocked = geometry.routePathPoints.length >= 2;
  // Marker đánh số 1..N theo orderIndex — memo để mảng pointMarkers của map
  // không đổi identity vô cớ (GoogleMapCanvas gỡ + vẽ lại overlay theo identity).
  // Kèm dữ liệu để RouteDesignMap dựng card chi tiết kiểu Google Maps khi bấm
  // marker: googlePlaceId/địa chỉ ưu tiên lấy từ draft, thiếu thì fallback sang
  // OperatorStop cùng stopId trong kho `stops` (draft nạp từ server không có
  // field googlePlaceId — chỉ draft mới thêm qua chấm gợi ý Google mới có).
  const stopMarkers = useMemo<RouteStopMarker[]>(
    () =>
      stopEditor.currentRouteStops.map((stop) => {
        const catalogStop = stops.find((item) => item.id === stop.stopId);

        return {
          stopId: stop.stopId,
          orderIndex: stop.orderIndex,
          name: stop.stopName,
          latitude: stop.latitude,
          longitude: stop.longitude,
          address: catalogStop?.address ?? null,
          googlePlaceId: stop.googlePlaceId ?? catalogStop?.googlePlaceId ?? null,
          distanceFromOriginKm: stop.distanceFromOriginKm,
          estimatedDurationFromOriginMinutes:
            stop.estimatedDurationFromOriginMinutes,
        };
      }),
    [stopEditor.currentRouteStops, stops],
  );

  return (
    <div>
      {/* Thanh điều khiển NGOÀI bản đồ, ngay trên map: trái = điều khiển hình
          học, phải = badge chưa lưu + nút Lưu; cảnh báo TRUCK xuống dòng riêng.
          Mobile: thanh xếp trên map như một khối tĩnh. Viewer thuần → ẩn hẳn. */}
      <GeometryToolbar
        canManageRoutes={canManageRoutes}
        geometry={geometry}
        trailing={
          canManageRoutes ? (
            <>
              {isDirty && (
                <Badge tone="warning" className="ring-1 ring-amber-200">
                  {t("routes.unsavedChanges")}
                </Badge>
              )}
              <button
                type="button"
                onClick={onSaveRoute}
                disabled={!isDirty || isSaving}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                  isDirty
                    ? "bg-vr-800 text-white shadow-sm hover:bg-vr-900 disabled:opacity-70"
                    : "border border-gray-200 bg-white text-gray-500"
                }`}
              >
                <FiSave size={16} />
                {isSaving ? t("routes.savingRoute") : t("routes.saveRoute")}
              </button>
            </>
          ) : undefined
        }
      />
      <RouteMapLegend panelMode={panelMode} />

      <div className="lg:relative">
        {/* Panel nổi: desktop absolute trên map, mobile khối tĩnh phía trên.
            Nội dung đổi hẳn theo tab — mode info chỉ có form tuyến, mode stops
            chỉ có mục điểm dừng (đã tách thành tab riêng, không còn gộp chung). */}
        <RouteFloatingPanel>
        {panelMode === "info" ? (
          <RouteFormSection
            canManageRoutes={canManageRoutes}
            routes={routes}
            stations={stations}
            selectedRouteId={selectedRouteId}
            form={routeForm}
            onUpdateField={onUpdateField}
            feedbackMessage={routeFeedbackMessage}
            isAutoCalculatingMetrics={isAutoCalculatingMetrics}
            autoMetricsFallback={autoMetricsFallback}
            metricsLocked={metricsLocked}
          />
        ) : (
          <RoutePanelStopsSection
            canManageRoutes={canManageRoutes}
            stops={stops}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
            stopEditor={stopEditor}
            onPickSearchResult={onPickSearchResult}
            isLoadingSuggestions={isLoadingSuggestions}
            routeStopFeedbackMessage={routeStopFeedbackMessage}
          />
        )}
        </RouteFloatingPanel>

        {/* Bản đồ full-bleed: mobile ~420px, desktop ~viewport trừ header —
            không còn overlay điều khiển nào đè lên (logo/attribution thoáng) */}
        <div
          data-testid="route-map-shell"
          className="relative h-105 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:h-[calc(100vh-16rem)] lg:min-h-140"
        >
          <RouteDesignMap
            points={routeMapPoints}
            pathPoints={geometry.routePathPoints}
            stopMarkers={stopMarkers}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
            onRequestRemoveStop={
              canManageRoutes
                ? (stopId) => {
                    const draft = stopEditor.currentRouteStops.find(
                      (item) => item.stopId === stopId,
                    );
                    if (draft) {
                      stopEditor.setRouteStopPendingRemoval(draft);
                    }
                  }
                : undefined
            }
            routeOptions={geometry.routeOptions}
            selectedOptionIndex={geometry.selectedOptionIndex}
            selectedPathDurationMinutes={routeForm.estimatedDurationMinutes}
            onSelectOption={
              canManageRoutes ? geometry.handleSelectRouteOption : undefined
            }
            viaPoints={geometry.viaPoints}
            onAddViaPoint={
              canManageRoutes ? geometry.handleAddViaPoint : undefined
            }
            onBeginViaDrag={
              canManageRoutes ? geometry.handleBeginViaPointDrag : undefined
            }
            onMoveViaPoint={
              canManageRoutes ? geometry.handleMoveViaPoint : undefined
            }
            onDragViaPoint={
              canManageRoutes ? geometry.handleDragViaPoint : undefined
            }
            onRemoveViaPoint={
              canManageRoutes ? geometry.handleRemoveViaPoint : undefined
            }
            isRerouting={geometry.isRerouting}
            emptyText={t("routes.mapNoPoints")}
            suggestions={panelMode === "stops" ? suggestions : undefined}
            onAddSuggestion={onAddSuggestion}
            isAddingSuggestion={isAddingSuggestion}
            externalActiveSuggestion={pickedSuggestion}
          />
        </div>
      </div>
    </div>
  );
}
