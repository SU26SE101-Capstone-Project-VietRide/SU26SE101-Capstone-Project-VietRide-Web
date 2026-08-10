// Khung bản đồ MAP-FIRST cho tab "Tuyến thay thế" (phụ lục spec 2026-08-07) —
// cùng bố cục với RouteMapWorkspace (toolbar hình học ngoài map + panel nổi +
// map full-bleed) nhưng tách riêng file vì nguồn dữ liệu khác hẳn: geometry/
// stops/suggestions của TUYẾN THAY THẾ đang soạn (useAlternativeRouteWorkspace),
// không phải tuyến chính. Tuyến chính vẽ mờ làm nền (referencePath), tuyến
// thay thế vẽ cam (#f59e0b, activeColor) — tách file giữ RouteMapWorkspace
// (tab Thông tin/Điểm dừng) không phải nhận thêm props không liên quan.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiSave } from "react-icons/fi";
import type { OperatorStop } from "../../../api/vietride";
import RouteDesignMap, { type RouteStopMarker } from "./RouteDesignMap";
import RouteFloatingPanel from "./RouteFloatingPanel";
import GeometryToolbar from "./GeometryToolbar";
import AlternativeRoutesSection from "./AlternativeRoutesSection";
import type { RouteCoordinate } from "./polyline";
import type { StationOption, StopSuggestion } from "./types";
import type { UseAlternativeRouteWorkspaceResult } from "./useAlternativeRouteWorkspace";

type AlternativeRouteWorkspaceProps = {
  canManageRoutes: boolean;
  hasSelectedRoute: boolean;
  stations: StationOption[];
  stops: OperatorStop[];
  workspace: UseAlternativeRouteWorkspaceResult;
  // Polyline tuyến CHÍNH đang lưu/soạn — vẽ mờ làm nền tham chiếu (mục 1 phụ lục)
  referencePath: RouteCoordinate[];
  // Điểm mới từ Google phải xác nhận phường/xã trước khi tạo Stop — modal do
  // trang Routes sở hữu vì cả tuyến chính lẫn tuyến thay thế đều dùng chung.
  onRequestWardConfirm: (
    suggestion: StopSuggestion,
    add: (locationId: string) => void,
  ) => void;
};

export default function AlternativeRouteWorkspace({
  canManageRoutes,
  hasSelectedRoute,
  stations,
  stops,
  workspace,
  referencePath,
  onRequestWardConfirm,
}: AlternativeRouteWorkspaceProps) {
  const { t } = useTranslation("manager");
  const { altGeometry } = workspace;

  // Marker đánh số 1..N cho stop nháp của tuyến thay thế — cùng cấu trúc
  // RouteStopMarker của tuyến chính (đủ để RouteDesignMap dựng card chi tiết).
  const altStopMarkers = useMemo<RouteStopMarker[]>(
    () =>
      workspace.altStopDrafts.map((stop) => {
        const catalogStop = stops.find((item) => item.id === stop.stopId);

        return {
          stopId: stop.stopId,
          orderIndex: stop.orderIndex,
          name: stop.stopName,
          latitude: stop.latitude,
          longitude: stop.longitude,
          address: catalogStop?.address ?? null,
          googlePlaceId: catalogStop?.googlePlaceId ?? null,
          distanceFromOriginKm: stop.distanceFromOriginKm,
          estimatedDurationFromOriginMinutes:
            stop.estimatedDurationFromOriginMinutes,
        };
      }),
    [stops, workspace.altStopDrafts],
  );

  const isDirty = workspace.isAltDirty || altGeometry.isGeometryDirty;

  return (
    <div>
      <GeometryToolbar
        canManageRoutes={canManageRoutes}
        geometry={altGeometry}
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
                onClick={() => void workspace.handleSaveAlternative()}
                disabled={!isDirty || workspace.isSavingAlternative}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                  isDirty
                    ? "bg-vr-500 text-white shadow-sm hover:bg-vr-600 disabled:opacity-70"
                    : "border border-gray-200 bg-white text-gray-400"
                }`}
              >
                <FiSave size={16} />
                {workspace.isSavingAlternative
                  ? t("routes.savingRoute")
                  : t("routes.saveRoute")}
              </button>
            </>
          ) : undefined
        }
      />

      <div className="lg:relative">
        <RouteFloatingPanel>
          <AlternativeRoutesSection
            canManageRoutes={canManageRoutes}
            hasSelectedRoute={hasSelectedRoute}
            stations={stations}
            stops={stops}
            workspace={workspace}
            onPickSearchResult={workspace.handlePickAltSearchResult}
            isLoadingSuggestions={workspace.isLoadingAltSuggestions}
          />
        </RouteFloatingPanel>

        <div
          data-testid="route-map-shell"
          className="relative h-105 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:h-[calc(100vh-16rem)] lg:min-h-140"
        >
          <RouteDesignMap
            points={workspace.altMapPoints}
            pathPoints={altGeometry.routePathPoints}
            stopMarkers={altStopMarkers}
            onRequestRemoveStop={
              canManageRoutes ? (stopId) => workspace.removeAltStop(stopId) : undefined
            }
            routeOptions={altGeometry.routeOptions}
            selectedOptionIndex={altGeometry.selectedOptionIndex}
            onSelectOption={
              canManageRoutes ? altGeometry.handleSelectRouteOption : undefined
            }
            viaPoints={altGeometry.viaPoints}
            onAddViaPoint={canManageRoutes ? altGeometry.handleAddViaPoint : undefined}
            onBeginViaDrag={
              canManageRoutes ? altGeometry.handleBeginViaPointDrag : undefined
            }
            onMoveViaPoint={
              canManageRoutes ? altGeometry.handleMoveViaPoint : undefined
            }
            onDragViaPoint={
              canManageRoutes ? altGeometry.handleDragViaPoint : undefined
            }
            onRemoveViaPoint={
              canManageRoutes ? altGeometry.handleRemoveViaPoint : undefined
            }
            isRerouting={altGeometry.isRerouting}
            emptyText={t("routes.mapNoPoints")}
            suggestions={canManageRoutes ? workspace.altSuggestions : undefined}
            onAddSuggestion={(suggestion) => {
              if (suggestion.kind === "googlePlace") {
                onRequestWardConfirm(suggestion, (locationId) => {
                  void workspace.addAltStopFromSuggestion(
                    suggestion,
                    locationId,
                  );
                });
                return;
              }
              void workspace.addAltStopFromSuggestion(suggestion);
            }}
            isAddingSuggestion={workspace.isAddingAltSuggestion}
            externalActiveSuggestion={workspace.pickedAltSuggestion}
            activeColor="#f59e0b"
            referencePath={referencePath}
            showPickupDropoffOptions={false}
          />
        </div>
      </div>
    </div>
  );
}
