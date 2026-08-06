// Hook cục bộ: state + thao tác hình học tuyến (polyline) của màn Routes.
// Mọi thao tác chỉ sửa state cục bộ + đánh dấu "chưa lưu" — polyline được lưu
// atomic cùng form/stops qua nút "Lưu tuyến" (PUT /routes/{id}/full).
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  OperatorRoute,
  OperatorRouteRequest,
} from "../../../api/vietride";
import { decodeGooglePolyline, type RouteCoordinate } from "./polyline";
import { requestRoadGeometry } from "./geometry";
import type { FeedbackScope, TranslateFn } from "./types";

type UseRouteGeometryParams = {
  selectedRouteId: string;
  routeWaypoints: RouteCoordinate[];
  setRouteForm: Dispatch<SetStateAction<OperatorRouteRequest>>;
  setRoutes: Dispatch<SetStateAction<OperatorRoute[]>>;
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

export function useRouteGeometry({
  selectedRouteId,
  routeWaypoints,
  setRouteForm,
  setRoutes,
  setError,
  showMessage,
  t,
}: UseRouteGeometryParams) {
  const [routePathPoints, setRoutePathPoints] = useState<RouteCoordinate[]>([]);
  const [isEditingGeometry, setIsEditingGeometry] = useState(false);
  const [isGeometryDirty, setIsGeometryDirty] = useState(false);
  // Ref giữ t mới nhất để applySavedGeometry giữ được identity ổn định (loadData phụ thuộc nó)
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  });

  const applySavedGeometry = useCallback(
    (route: OperatorRoute | null) => {
      setIsEditingGeometry(false);
      setIsGeometryDirty(false);

      if (!route?.pathPolyline) {
        setRoutePathPoints([]);
        return;
      }

      try {
        setRoutePathPoints(decodeGooglePolyline(route.pathPolyline));
      } catch {
        setRoutePathPoints([]);
        setError(tRef.current("routes.invalidSavedGeometry"));
      }
    },
    [setError],
  );

  function invalidateLocalGeometry(routeId = selectedRouteId) {
    setRoutePathPoints([]);
    setIsEditingGeometry(false);
    setIsGeometryDirty(false);
    setRoutes((current) =>
      current.map((route) =>
        route.id === routeId ? { ...route, pathPolyline: null } : route,
      ),
    );
  }

  async function handleCalculateGeometry() {
    if (routeWaypoints.length < 2) {
      setError(t("routes.geometryRequiresEndpoints"));
      return;
    }

    const result = await requestRoadGeometry(
      routeWaypoints,
      t("routes.routingFailed"),
    );
    setRoutePathPoints(result.points);
    setRouteForm((current) => ({
      ...current,
      totalDistanceKm: result.totalDistanceKm,
      estimatedDurationMinutes: result.estimatedDurationMinutes,
    }));
    setIsEditingGeometry(false);
    setIsGeometryDirty(true);
    showMessage("geometry", t("routes.geometryCalculated"));
  }

  // Nhận kết quả đường đã tính sẵn (flow auto-fill khi chọn đủ 2 bến) — chỉ áp
  // polyline cục bộ + đánh dấu chưa lưu; số km/thời lượng do caller tự cập nhật form
  function applyComputedGeometry(points: RouteCoordinate[]) {
    setRoutePathPoints(points);
    setIsEditingGeometry(false);
    setIsGeometryDirty(true);
  }

  function handleStartManualGeometry() {
    setRoutePathPoints([]);
    setIsEditingGeometry(true);
    setIsGeometryDirty(true);
    showMessage("geometry", t("routes.manualGeometryHint"));
  }

  function handleAppendGeometryPoint(point: RouteCoordinate) {
    setRoutePathPoints((current) => [...current, point]);
    setIsGeometryDirty(true);
  }

  function handleUndoGeometryPoint() {
    setRoutePathPoints((current) => current.slice(0, -1));
    setIsGeometryDirty(true);
  }

  // Xóa đường chỉ trên state cục bộ; lưu qua "Lưu tuyến" sẽ gửi pathPolyline=null
  // kèm manualMetrics từ form (server clear geometry + set metrics — contract 8.5)
  function handleClearGeometry() {
    setRoutePathPoints([]);
    setIsEditingGeometry(false);
    setIsGeometryDirty(true);
    showMessage("geometry", t("routes.geometryCleared"));
  }

  return {
    routePathPoints,
    isEditingGeometry,
    isGeometryDirty,
    applySavedGeometry,
    applyComputedGeometry,
    invalidateLocalGeometry,
    handleCalculateGeometry,
    handleStartManualGeometry,
    handleAppendGeometryPoint,
    handleUndoGeometryPoint,
    handleClearGeometry,
  };
}

export type UseRouteGeometryResult = ReturnType<typeof useRouteGeometry>;
