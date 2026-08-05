// Panel bản đồ: trạng thái hình học tuyến + RouteDesignMap + các nút thao tác
import { useTranslation } from "react-i18next";
import {
  FiCornerUpLeft,
  FiEdit2,
  FiNavigation,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import RouteDesignMap from "./RouteDesignMap";
import type { UseRouteGeometryResult } from "./useRouteGeometry";
import type { RouteMapPoint } from "./types";

type GeometryPanelProps = {
  canManageRoutes: boolean;
  geometry: UseRouteGeometryResult;
  points: RouteMapPoint[];
  waypointCount: number;
  hasSelectedRoute: boolean;
  hasSavedPolyline: boolean;
  onRunAction: (action: () => Promise<void>) => void;
  feedbackMessage: string;
};

export default function GeometryPanel({
  canManageRoutes,
  geometry,
  points,
  waypointCount,
  hasSelectedRoute,
  hasSavedPolyline,
  onRunAction,
  feedbackMessage,
}: GeometryPanelProps) {
  const { t } = useTranslation("manager");
  const {
    routePathPoints,
    isEditingGeometry,
    isGeometryDirty,
    handleCalculateGeometry,
    handleStartManualGeometry,
    handleAppendGeometryPoint,
    handleUndoGeometryPoint,
    handleSaveGeometry,
    handleClearGeometry,
  } = geometry;

  return (
    <section className="min-w-0 xl:sticky xl:top-6 xl:self-start">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <FiNavigation className="text-vr-700" size={16} />
            {t("routes.geometryTitle")}
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              isEditingGeometry
                ? "bg-amber-50 text-amber-700"
                : isGeometryDirty
                  ? "bg-blue-50 text-blue-700"
                  : hasSavedPolyline
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
            }`}
          >
            {isEditingGeometry
              ? t("routes.geometryDrawing")
              : isGeometryDirty
                ? t("routes.geometryUnsaved")
                : hasSavedPolyline
                  ? t("routes.geometrySavedStatus")
                  : t("routes.geometryMissing")}
          </span>
        </div>

        <div className="h-105 xl:h-[calc(100vh-19rem)] xl:min-h-120">
          <RouteDesignMap
            points={points}
            pathPoints={routePathPoints}
            isEditing={isEditingGeometry}
            onAppendPoint={handleAppendGeometryPoint}
            emptyText={t("routes.mapNoPoints")}
          />
        </div>

        {canManageRoutes && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => onRunAction(handleCalculateGeometry)}
              disabled={waypointCount < 2}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-3 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiNavigation size={16} />
              {t("routes.calculateGeometry")}
            </button>
            <button
              type="button"
              onClick={handleStartManualGeometry}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <FiEdit2 size={16} />
              {t("routes.drawGeometry")}
            </button>
            {isEditingGeometry && (
              <button
                type="button"
                onClick={handleUndoGeometryPoint}
                disabled={routePathPoints.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCornerUpLeft size={16} />
                {t("routes.undoGeometryPoint")}
              </button>
            )}
            <button
              type="button"
              onClick={() => onRunAction(handleSaveGeometry)}
              disabled={
                !hasSelectedRoute ||
                routePathPoints.length < 2 ||
                !isGeometryDirty
              }
              className="inline-flex items-center gap-2 rounded-lg border border-vr-200 px-3 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSave size={16} />
              {t("routes.saveGeometry")}
            </button>
            <button
              type="button"
              onClick={() => onRunAction(handleClearGeometry)}
              disabled={!hasSelectedRoute || routePathPoints.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiTrash2 size={16} />
              {t("routes.clearGeometry")}
            </button>
          </div>
        )}
        {feedbackMessage && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedbackMessage}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
