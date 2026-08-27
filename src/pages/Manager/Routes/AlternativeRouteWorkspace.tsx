// Khung bản đồ MAP-FIRST cho tab "Tuyến thay thế" (phụ lục spec 2026-08-07) —
// cùng bố cục với RouteMapWorkspace (toolbar hình học ngoài map + panel nổi +
// map full-bleed) nhưng tách riêng file vì nguồn dữ liệu khác hẳn: geometry/
// stops/suggestions của TUYẾN THAY THẾ đang soạn (useAlternativeRouteWorkspace),
// không phải tuyến chính. Tuyến chính vẽ mờ làm nền (referencePath), tuyến
// thay thế vẽ cam (#f59e0b, activeColor) — tách file giữ RouteMapWorkspace
// (tab Thông tin/Điểm dừng) không phải nhận thêm props không liên quan.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { OperatorStop } from "../../../api/vietride";
import RouteDesignMap, { type RouteStopMarker } from "./RouteDesignMap";
import {
  alternativeRouteColor,
  dimRouteColor,
  mainRouteColor,
} from "./routeColors";
import RouteFloatingPanel from "./RouteFloatingPanel";
import GeometryToolbar from "./GeometryToolbar";
import AlternativeRoutesSection from "./AlternativeRoutesSection";
import type { RouteCoordinate } from "./polyline";
import type { RouteStopDraft, StationOption, StopSuggestion } from "./types";
import type { UseAlternativeRouteWorkspaceResult } from "./useAlternativeRouteWorkspace";

// Hai màu nhận diện của tab này (routeColors.ts): tuyến chính teal (đứt nét,
// chỉ xem) — tuyến thay thế đang soạn cam. Phương án đường chưa chọn = cùng
// tông cam nhưng nhạt, dùng ĐÚNG hàm RouteDesignMap dùng nên chú giải luôn
// khớp màu thật trên map.
const dimmedAlternativeColor = dimRouteColor(alternativeRouteColor);

type AlternativeRouteWorkspaceProps = {
  canManageRoutes: boolean;
  hasSelectedRoute: boolean;
  stations: StationOption[];
  stops: OperatorStop[];
  workspace: UseAlternativeRouteWorkspaceResult;
  // Polyline tuyến CHÍNH đang lưu/soạn — vẽ đứt nét làm nền tham chiếu (mục 1
  // phụ lục) để thấy tuyến thay thế lệch khỏi tuyến chính ở đoạn nào
  referencePath: RouteCoordinate[];
  // Điểm dừng tuyến CHÍNH — chấm nhỏ teal trên map, cho biết tuyến chính đã set
  // up qua những đâu (chỉ xem, không bấm được)
  referenceStops: RouteStopDraft[];
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
  referenceStops,
  onRequestWardConfirm,
}: AlternativeRouteWorkspaceProps) {
  const { t } = useTranslation("manager");
  const { altGeometry } = workspace;

  // Điểm dừng tuyến chính rút gọn về đúng field map cần — memo để RouteDesignMap
  // không reconcile lại marker mỗi render của trang cha
  const mainRouteStopMarkers = useMemo(
    () =>
      referenceStops.map((stop) => ({
        stopId: stop.stopId,
        orderIndex: stop.orderIndex,
        name: stop.stopName,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    [referenceStops],
  );

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

  return (
    <div>
      {/* Nút lưu + badge "chưa lưu" của tab này nằm ở RouteDetailHeader, chung
          chỗ với hai tab kia — đổi tab không làm nút lưu nhảy đi đâu cả. */}
      <GeometryToolbar
        canManageRoutes={canManageRoutes}
        geometry={altGeometry}
      />

      {/* Chú giải: không có nó thì đường teal đứt nét trên map chỉ là "một đường
          nữa", user không biết đó là tuyến chính đã lưu để mà so */}
      <aside
        aria-label={t("routes.mapLegend")}
        data-testid="alternative-map-legend"
        className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
      >
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            aria-hidden="true"
            className="h-1 w-6 rounded-full"
            style={{
              backgroundImage: `repeating-linear-gradient(to right, ${mainRouteColor} 0 4px, transparent 4px 8px)`,
            }}
          />
          {t("routes.legendMainRoute")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            aria-hidden="true"
            className="h-1 w-6 rounded-full"
            style={{ backgroundColor: alternativeRouteColor }}
          />
          {t("routes.legendAlternativeRoute")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span
            aria-hidden="true"
            className="h-1 w-6 rounded-full"
            style={{ backgroundColor: dimmedAlternativeColor }}
          />
          {t("routes.legendAlternativeOptions")}
        </span>
      </aside>

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
            canRequestPlaces={workspace.canScanAltPlaces}
            onRequestPlaces={workspace.requestAltPlaces}
          />
        </RouteFloatingPanel>

        <div
          data-testid="route-map-shell"
          className="relative h-105 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:h-[calc(100vh-16rem)] lg:min-h-140"
        >
          <RouteDesignMap
            // Camera chỉ canh khung khi đổi tuyến thay thế đang soạn, không
            // canh theo từng nhịp nắn (xem `fitKey` của GoogleMapCanvas)
            viewportKey={`alt:${workspace.selectedAlternativeRouteId}`}
            points={workspace.altMapPoints}
            pathPoints={altGeometry.routePathPoints}
            stopMarkers={altStopMarkers}
            onRequestRemoveStop={
              canManageRoutes ? (stopId) => workspace.removeAltStop(stopId) : undefined
            }
            routeOptions={altGeometry.routeOptions}
            selectedOptionIndex={altGeometry.selectedOptionIndex}
            selectedPathDurationMinutes={
              workspace.altMetrics.estimatedDurationMinutes
            }
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
            activeColor={alternativeRouteColor}
            referencePath={referencePath}
            referenceColor={mainRouteColor}
            referenceStops={mainRouteStopMarkers}
            showPickupDropoffOptions={false}
          />
        </div>
      </div>
    </div>
  );
}
