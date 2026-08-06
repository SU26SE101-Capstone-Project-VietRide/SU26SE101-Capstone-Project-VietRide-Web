// Hook cục bộ: state + thao tác gắn/gỡ điểm dừng vào tuyến (kể cả bản nháp).
// Thêm/gỡ chỉ sửa state cục bộ và đánh dấu "chưa lưu" — lưu thật đi qua nút
// "Lưu tuyến" (PUT /routes/{id}/full, replace-all stops), không gọi API lẻ nữa.
import { useEffect, useMemo, useRef, useState } from "react";
import type { OperatorRoute, OperatorStop } from "../../../api/vietride";
import { toNumber } from "../../../utils/number";
import { distanceKmBetween } from "./geometry";
import { estimateCoachDurationMinutes } from "./polyline";
import { draftRouteId } from "./routeFormUtils";
import type {
  FeedbackScope,
  RouteStopDraft,
  StationOption,
  TranslateFn,
} from "./types";

type UseRouteStopEditorParams = {
  selectedRoute: OperatorRoute | null;
  selectedStop: OperatorStop | null;
  stations: StationOption[];
  originStationId: string;
  activeRouteKey: string;
  activeRouteName: string;
  invalidateLocalGeometry: (routeId?: string) => void;
  // Đánh dấu tuyến đang chọn có thay đổi chưa lưu (bật nút "Lưu tuyến")
  markRouteDirty: () => void;
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

export function useRouteStopEditor({
  selectedRoute,
  selectedStop,
  stations,
  originStationId,
  activeRouteKey,
  activeRouteName,
  invalidateLocalGeometry,
  markRouteDirty,
  setError,
  showMessage,
  t,
}: UseRouteStopEditorParams) {
  const [routeStopDrafts, setRouteStopDrafts] = useState<RouteStopDraft[]>([]);
  const [routeStopOrder, setRouteStopOrder] = useState("1");
  const [routeStopDuration, setRouteStopDuration] = useState("0");
  const [routeStopDistance, setRouteStopDistance] = useState("0");
  const [allowPickup, setAllowPickup] = useState(true);
  const [allowDropoff, setAllowDropoff] = useState(true);
  const [routeStopPendingRemoval, setRouteStopPendingRemoval] =
    useState<RouteStopDraft | null>(null);
  // Cặp bến đi + điểm dừng đã tự ước lượng — chỉ prefill lại khi cặp đổi
  const lastAutoEstimatedStopRef = useRef("");

  // Chọn xong điểm dừng (đủ tọa độ + đã có bến đi) → tự điền km/phút từ điểm đi
  // thay vì bắt bấm nút. Chỉ là prefill: ô số vẫn sửa tay được, nút "Tự tính" giữ
  // lại để tính lại khi cần. Thiếu dữ liệu → bỏ qua im lặng, không chặn flow.
  useEffect(() => {
    if (!selectedStop) {
      return;
    }

    const origin = stations.find((station) => station.id === originStationId);

    if (
      !origin ||
      !origin.latitude ||
      !origin.longitude ||
      !selectedStop.latitude ||
      !selectedStop.longitude
    ) {
      return;
    }

    const estimateKey = `${origin.id}:${selectedStop.id}`;

    if (lastAutoEstimatedStopRef.current === estimateKey) {
      return;
    }

    lastAutoEstimatedStopRef.current = estimateKey;
    const distance = distanceKmBetween(origin, selectedStop);
    setRouteStopDistance(distance.toFixed(1));
    setRouteStopDuration(String(estimateCoachDurationMinutes(distance)));
  }, [originStationId, selectedStop, stations]);

  const currentRouteStops = useMemo(
    () =>
      routeStopDrafts
        .filter((item) => item.routeId === activeRouteKey)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [activeRouteKey, routeStopDrafts],
  );

  async function handleAddRouteStop() {
    if (!selectedStop) {
      setError(t("routes.routeStopRequired"));
      return;
    }

    const orderIndex = toNumber(routeStopOrder);
    const duplicateOrder = routeStopDrafts.some(
      (item) =>
        item.routeId === activeRouteKey && item.orderIndex === orderIndex,
    );

    if (duplicateOrder) {
      setError(t("routes.duplicateStopOrder"));
      return;
    }

    const duplicateStop = routeStopDrafts.some(
      (item) =>
        item.routeId === activeRouteKey && item.stopId === selectedStop.id,
    );

    if (duplicateStop) {
      setError(t("routes.duplicateStopInRoute"));
      return;
    }

    if (!allowPickup && !allowDropoff) {
      setError(t("routes.stopNeedsPickupOrDropoff"));
      return;
    }

    const request = {
      stopId: selectedStop.id,
      orderIndex,
      estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
      distanceFromOriginKm: toNumber(routeStopDistance),
      allowPickup,
      allowDropoff,
    };

    // Chỉ thao tác cục bộ: điểm dừng đổi → đường đi đã lưu không còn khớp
    if (selectedRoute) {
      invalidateLocalGeometry(selectedRoute.id);
      markRouteDirty();
    }

    setRouteStopDrafts((prev) => [
      ...prev,
      {
        ...request,
        routeId: activeRouteKey,
        routeName: activeRouteName,
        stopName: selectedStop.name,
        latitude: selectedStop.latitude,
        longitude: selectedStop.longitude,
      },
    ]);
    setRouteStopOrder(String(orderIndex + 1));
    showMessage("routeStop", t("routes.routeStopDraftAdded"));
  }

  async function handleEstimateRouteStopMetrics() {
    const origin = stations.find((station) => station.id === originStationId);

    if (!origin || !selectedStop) {
      setError(t("routes.estimateRequiresOriginAndStop"));
      return;
    }

    if (
      !origin.latitude ||
      !origin.longitude ||
      !selectedStop.latitude ||
      !selectedStop.longitude
    ) {
      setError(t("routes.estimateRequiresCoordinates"));
      return;
    }

    const distance = distanceKmBetween(origin, selectedStop);
    const durationMinutes = estimateCoachDurationMinutes(distance);

    setRouteStopDistance(distance.toFixed(1));
    setRouteStopDuration(String(durationMinutes));
    showMessage("routeStop", t("routes.estimatedRouteStopMetrics"));
  }

  async function handleRemoveRouteStop(item: RouteStopDraft) {
    // Thao tác cục bộ cho cả bản nháp lẫn tuyến đã chọn — lưu thật qua "Lưu tuyến"
    const targetRouteId = item.routeId ?? draftRouteId;

    if (targetRouteId !== draftRouteId) {
      if (!selectedRoute) {
        setError(t("routes.selectRouteFirst"));
        return;
      }

      invalidateLocalGeometry(selectedRoute.id);
      markRouteDirty();
    }

    setRouteStopDrafts((prev) =>
      prev.filter(
        (draft) =>
          draft.routeId !== targetRouteId ||
          draft.stopId !== item.stopId ||
          draft.orderIndex !== item.orderIndex,
      ),
    );
    setRouteStopPendingRemoval(null);
    showMessage("routeStop", t("routes.routeStopRemoved"));
  }

  return {
    routeStopDrafts,
    setRouteStopDrafts,
    currentRouteStops,
    routeStopOrder,
    setRouteStopOrder,
    routeStopDuration,
    setRouteStopDuration,
    routeStopDistance,
    setRouteStopDistance,
    allowPickup,
    setAllowPickup,
    allowDropoff,
    setAllowDropoff,
    routeStopPendingRemoval,
    setRouteStopPendingRemoval,
    handleAddRouteStop,
    handleEstimateRouteStopMetrics,
    handleRemoveRouteStop,
  };
}

export type UseRouteStopEditorResult = ReturnType<typeof useRouteStopEditor>;
