// Hook cục bộ: state + thao tác gắn/gỡ điểm dừng vào tuyến (kể cả bản nháp).
// Thêm/gỡ chỉ sửa state cục bộ và đánh dấu "chưa lưu" — lưu thật đi qua nút
// "Lưu tuyến" (PUT /routes/{id}/full, replace-all stops), không gọi API lẻ nữa.
// Sau khi dọn dead code: chỉ còn addStopFromSuggestion (thêm qua chấm gợi ý/
// search) + handleRemoveRouteStop — flow nhập tay số liệu (order/km/phút, nút
// "Tự tính") đã bị thay hoàn toàn bởi bảng gợi ý điểm dừng trên bản đồ.
import { useMemo, useState } from "react";
import {
  createOperatorStop,
  type OperatorRoute,
  type OperatorStop,
} from "../../../api/vietride";
import { distanceKmBetween } from "./geometry";
import {
  estimateCoachDurationMinutes,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";
import { draftRouteId } from "./routeFormUtils";
import type {
  FeedbackScope,
  RouteStopDraft,
  StationOption,
  StopSuggestion,
  TranslateFn,
} from "./types";

type UseRouteStopEditorParams = {
  selectedRoute: OperatorRoute | null;
  stations: StationOption[];
  originStationId: string;
  activeRouteKey: string;
  activeRouteName: string;
  invalidateLocalGeometry: (
    routeId?: string,
    options?: { keepViaPoints?: boolean },
  ) => void;
  // Đánh dấu tuyến đang chọn có thay đổi chưa lưu (bật nút "Lưu tuyến")
  markRouteDirty: () => void;
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
  // Getter đọc polyline đang hiển thị của tuyến TẠI THỜI ĐIỂM GỌI (không phải
  // giá trị chụp lúc hook khởi tạo/render) — dùng để tính distanceFromStartKm khi
  // thêm stop từ gợi ý/search. Bắt buộc dùng getter vì `pathPoints` (nếu truyền
  // trực tiếp) sẽ là giá trị của LẦN RENDER khi hook này được gọi, có thể trễ so
  // với polyline mới nhất (vd caller có vòng phụ thuộc phải đọc qua ref cập nhật
  // sau). Optional để không gãy nơi gọi cũ chưa truyền.
  getPathPoints?: () => RouteCoordinate[];
  // Gọi lại khi addStopFromSuggestion tạo OperatorStop mới (kind googlePlace) —
  // để nơi gọi (index.tsx) thêm vào state `stops` chung.
  onStopCreated?: (stop: OperatorStop) => void;
};

// Khoá sort khi re-index: ưu tiên distanceFromStartKm (chỉ có ở draft vừa thêm
// qua addStopFromSuggestion, đã chiếu lên polyline). Draft nạp từ server (tuyến
// sẵn có) không có field này nhưng luôn có distanceFromOriginKm — cùng ngữ nghĩa
// km-từ-bến-đi — nên fallback sang field đó (dùng ?? để giữ đúng giá trị 0, không
// bị coi là "thiếu"). Draft nào cũng thiếu cả hai (hiếm, lỗi dữ liệu) thì rơi về
// +Infinity, xếp cuối.
function reindexSortKey(draft: RouteStopDraft): number {
  return (
    draft.distanceFromStartKm ??
    draft.distanceFromOriginKm ??
    Number.POSITIVE_INFINITY
  );
}

// Sắp xếp lại toàn bộ draft của một tuyến theo khoá km-từ-bến-đi tăng dần rồi
// gán orderIndex = i + 1 liên tục 1..N. Trùng khoá thì dùng orderIndex hiện có
// làm khoá sort phụ (tie-break), không đổi thứ tự tương đối một cách ngẫu nhiên.
function reindexRouteDrafts(
  drafts: RouteStopDraft[],
  routeId: string,
): RouteStopDraft[] {
  const routeDrafts = drafts.filter((item) => item.routeId === routeId);
  const otherDrafts = drafts.filter((item) => item.routeId !== routeId);

  const sorted = [...routeDrafts].sort((a, b) => {
    const keyA = reindexSortKey(a);
    const keyB = reindexSortKey(b);

    return keyA !== keyB ? keyA - keyB : a.orderIndex - b.orderIndex;
  });

  const reindexed = sorted.map((item, index) => ({
    ...item,
    orderIndex: index + 1,
  }));

  return [...otherDrafts, ...reindexed];
}

export function useRouteStopEditor({
  selectedRoute,
  stations,
  originStationId,
  activeRouteKey,
  activeRouteName,
  invalidateLocalGeometry,
  markRouteDirty,
  setError,
  showMessage,
  t,
  getPathPoints,
  onStopCreated,
}: UseRouteStopEditorParams) {
  const [routeStopDrafts, setRouteStopDrafts] = useState<RouteStopDraft[]>([]);
  const [routeStopPendingRemoval, setRouteStopPendingRemoval] =
    useState<RouteStopDraft | null>(null);

  const currentRouteStops = useMemo(
    () =>
      routeStopDrafts
        .filter((item) => item.routeId === activeRouteKey)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [activeRouteKey, routeStopDrafts],
  );

  // Thêm stop từ chấm gợi ý/search (bảng gợi ý hoặc kết quả tìm kiếm trên bản đồ):
  // kind googlePlace → tạo OperatorStop trước; metrics + orderIndex tự tính từ
  // polyline (chiếu điểm lên đường đi); toàn bộ draft của tuyến được re-index lại.
  async function addStopFromSuggestion(
    suggestion: StopSuggestion,
    options: { allowPickup: boolean; allowDropoff: boolean },
  ) {
    // Hoist điều kiện kind ra ngoài .some — operatorStop dedupe theo stopId
    // (đúng như cũ); googlePlace dedupe theo googlePlaceId (nit): chấm Google
    // trùng vị trí một draft googlePlace đã thêm trước đó (kể cả từ chấm khác)
    // → báo trùng thay vì gọi createOperatorStop tạo thêm một OperatorStop thứ hai.
    const isOperatorStopSuggestion = suggestion.kind === "operatorStop";
    const duplicateStop = isOperatorStopSuggestion
      ? routeStopDrafts.some(
          (item) =>
            item.routeId === activeRouteKey && item.stopId === suggestion.id,
        )
      : Boolean(suggestion.googlePlaceId) &&
        routeStopDrafts.some(
          (item) =>
            item.routeId === activeRouteKey &&
            item.googlePlaceId === suggestion.googlePlaceId,
        );

    if (duplicateStop) {
      setError(t("routes.duplicateStopInRoute"));
      return;
    }

    let stopId = suggestion.id;
    let stopName = suggestion.name;
    let latitude = suggestion.latitude;
    let longitude = suggestion.longitude;

    if (suggestion.kind === "googlePlace") {
      const createdStop = await createOperatorStop({
        name: suggestion.name,
        address: suggestion.address,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        googlePlaceId: suggestion.googlePlaceId,
        description: "",
      });

      stopId = createdStop.id;
      stopName = createdStop.name;
      latitude = createdStop.latitude;
      longitude = createdStop.longitude;
      onStopCreated?.(createdStop);
    }

    // Ưu tiên chiếu điểm lên polyline đang hiển thị của tuyến (đọc TƯƠI tại đây,
    // không phải giá trị chụp lúc hook render); thiếu polyline (dưới 2 điểm) thì
    // fallback đường chim bay từ bến đi, giống flow nhập tay cũ.
    const pathPoints = getPathPoints?.();
    let distanceFromStartKm: number;
    if (pathPoints && pathPoints.length >= 2) {
      distanceFromStartKm = projectPointOntoPolyline(pathPoints, {
        latitude,
        longitude,
      }).distanceFromStartKm;
    } else {
      const origin = stations.find(
        (station) => station.id === originStationId,
      );
      distanceFromStartKm = origin
        ? distanceKmBetween(origin, { latitude, longitude })
        : 0;
    }

    const durationMinutes = estimateCoachDurationMinutes(distanceFromStartKm);

    // Chỉ thao tác cục bộ: điểm dừng đổi → đường đi đã lưu không còn khớp
    if (selectedRoute) {
      // Giữ điểm nắn user đã kéo — chỉ điểm dừng đổi, không phải đổi bến/tuyến;
      // auto-fetch kế tiếp tự áp lại đường ngay (xem useRouteGeometry.ts) nên
      // vẫn kéo nắn tiếp được luôn, không phải bấm chọn lại phương án.
      invalidateLocalGeometry(selectedRoute.id, { keepViaPoints: true });
      markRouteDirty();
    }

    setRouteStopDrafts((prev) => {
      const newDraft: RouteStopDraft = {
        stopId,
        // Placeholder — reindexRouteDrafts gán lại orderIndex thật theo distance
        orderIndex: prev.length + 1,
        estimatedDurationFromOriginMinutes: durationMinutes,
        distanceFromOriginKm: Number(distanceFromStartKm.toFixed(1)),
        allowPickup: options.allowPickup,
        allowDropoff: options.allowDropoff,
        routeId: activeRouteKey,
        routeName: activeRouteName,
        stopName,
        latitude,
        longitude,
        distanceFromStartKm,
        // Lưu lại để dedupe googlePlace ở lần thêm sau (xem duplicateStop ở trên)
        googlePlaceId: suggestion.googlePlaceId,
      };

      return reindexRouteDrafts([...prev, newDraft], activeRouteKey);
    });

    showMessage("routeStop", t("routes.routeStopDraftAdded"));
  }

  async function handleRemoveRouteStop(item: RouteStopDraft) {
    // Thao tác cục bộ cho cả bản nháp lẫn tuyến đã chọn — lưu thật qua "Lưu tuyến"
    const targetRouteId = item.routeId ?? draftRouteId;

    if (targetRouteId !== draftRouteId) {
      if (!selectedRoute) {
        setError(t("routes.selectRouteFirst"));
        return;
      }

      // Giữ điểm nắn user đã kéo — chỉ điểm dừng đổi, không phải đổi bến/tuyến;
      // auto-fetch kế tiếp tự áp lại đường ngay (xem useRouteGeometry.ts) nên
      // vẫn kéo nắn tiếp được luôn, không phải bấm chọn lại phương án.
      invalidateLocalGeometry(selectedRoute.id, { keepViaPoints: true });
      markRouteDirty();
    }

    setRouteStopDrafts((prev) => {
      const remaining = prev.filter(
        (draft) =>
          draft.routeId !== targetRouteId ||
          draft.stopId !== item.stopId ||
          draft.orderIndex !== item.orderIndex,
      );

      return reindexRouteDrafts(remaining, targetRouteId);
    });
    setRouteStopPendingRemoval(null);
    showMessage("routeStop", t("routes.routeStopRemoved"));
  }

  return {
    routeStopDrafts,
    setRouteStopDrafts,
    currentRouteStops,
    routeStopPendingRemoval,
    setRouteStopPendingRemoval,
    addStopFromSuggestion,
    handleRemoveRouteStop,
  };
}

export type UseRouteStopEditorResult = ReturnType<typeof useRouteStopEditor>;
