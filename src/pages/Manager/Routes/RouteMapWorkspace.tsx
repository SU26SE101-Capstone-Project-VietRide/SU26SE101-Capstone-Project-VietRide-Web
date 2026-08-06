// Tab gộp "Thông tin + Điểm dừng" dạng map-first: thanh điều khiển hình học
// nằm NGOÀI bản đồ (thanh ngang mỏng ngay trên map — không che logo/attribution
// Google, không đè thao tác kéo), gồm cả badge "Chưa lưu thay đổi" + nút "Lưu
// tuyến" ở mép phải. Bản đồ full-bleed bên dưới, chỉ còn panel nổi bên trái +
// bubble/marker. Thuần bố cục — logic API/hook giữ nguyên.
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
import type { RouteMapPoint, StationOption } from "./types";
import type { UseRouteGeometryResult } from "./useRouteGeometry";
import type { UseRouteStopEditorResult } from "./useRouteStopEditor";
import type { UseStopFormResult } from "./useStopForm";

type RouteMapWorkspaceProps = {
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
  stopFormControl: UseStopFormResult;
  stopEditor: UseRouteStopEditorResult;
  canEstimate: boolean;
  stopFeedbackMessage: string;
  routeStopFeedbackMessage: string;
  isDirty: boolean;
  isSaving: boolean;
  onSaveRoute: () => void;
  onRunAction: (action: () => Promise<void>) => void;
};

export default function RouteMapWorkspace({
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
  stopFormControl,
  stopEditor,
  canEstimate,
  stopFeedbackMessage,
  routeStopFeedbackMessage,
  isDirty,
  isSaving,
  onSaveRoute,
  onRunAction,
}: RouteMapWorkspaceProps) {
  const { t } = useTranslation("manager");
  // Có đường đi (tính/vẽ) → khóa 2 ô số liệu form (server bỏ qua manualMetrics)
  const metricsLocked =
    geometry.routePathPoints.length >= 2 && !geometry.isEditingGeometry;
  // Marker đánh số 1..N theo orderIndex — memo để mảng pointMarkers của map
  // không đổi identity vô cớ (GoogleMapCanvas gỡ + vẽ lại overlay theo identity)
  const stopMarkers = useMemo<RouteStopMarker[]>(
    () =>
      stopEditor.currentRouteStops.map((stop) => ({
        stopId: stop.stopId,
        orderIndex: stop.orderIndex,
        name: stop.stopName,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    [stopEditor.currentRouteStops],
  );

  return (
    <div>
      {/* Thanh điều khiển NGOÀI bản đồ, ngay trên map: trái = điều khiển hình
          học, phải = badge chưa lưu + nút Lưu; cảnh báo TRUCK xuống dòng riêng.
          Mobile: thanh xếp trên map như một khối tĩnh. Viewer thuần → ẩn hẳn. */}
      <GeometryToolbar
        canManageRoutes={canManageRoutes}
        geometry={geometry}
        hasSelectedRoute={Boolean(selectedRouteId)}
        trailing={
          canManageRoutes ? (
            <>
              {isDirty && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  {t("routes.unsavedChanges")}
                </span>
              )}
              <button
                type="button"
                onClick={onSaveRoute}
                disabled={!isDirty || isSaving}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                  isDirty
                    ? "bg-vr-500 text-white shadow-sm hover:bg-vr-600 disabled:opacity-70"
                    : "border border-gray-200 bg-white text-gray-400"
                }`}
              >
                <FiSave size={16} />
                {isSaving ? t("routes.savingRoute") : t("routes.saveRoute")}
              </button>
            </>
          ) : undefined
        }
      />

      <div className="lg:relative">
        {/* Panel nổi: desktop absolute trên map, mobile khối tĩnh phía trên */}
        <RouteFloatingPanel>
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
        <RoutePanelStopsSection
          canManageRoutes={canManageRoutes}
          stops={stops}
          selectedStopId={selectedStopId}
          onSelectStop={onSelectStop}
          stopFormControl={stopFormControl}
          stopEditor={stopEditor}
          canEstimate={canEstimate}
          onRunAction={onRunAction}
          stopFeedbackMessage={stopFeedbackMessage}
          routeStopFeedbackMessage={routeStopFeedbackMessage}
        />
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
            routeOptions={geometry.routeOptions}
            selectedOptionIndex={geometry.selectedOptionIndex}
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
            isEditing={geometry.isEditingGeometry}
            onAppendPoint={geometry.handleAppendGeometryPoint}
            emptyText={t("routes.mapNoPoints")}
          />
        </div>
      </div>
    </div>
  );
}
