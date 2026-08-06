import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import {
  createOperatorRouteFull,
  getAlternativeRoutes,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStops,
  getPublicLocations,
  updateOperatorRouteFull,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStop,
  type AdminLocation,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { getAuthUser } from "../../../auth";
import {
  encodeGooglePolyline,
  estimateCoachDurationMinutes,
  type RouteCoordinate,
} from "./polyline";
import { distanceKmBetween, requestRoadGeometry } from "./geometry";
import {
  detailStopsToDrafts,
  draftRouteId,
  draftsToFullStops,
  emptyRouteForm,
  isGuid,
  mergeStations,
  parseRouteTab,
  routeToForm,
  toStationOption,
  type RouteTab,
} from "./routeFormUtils";
import type { FeedbackScope, StationOption } from "./types";
import { useRouteGeometry } from "./useRouteGeometry";
import { useAlternativeRoutes } from "./useAlternativeRoutes";
import { useStationManagement } from "./useStationManagement";
import { useStopForm } from "./useStopForm";
import { useRouteStopEditor } from "./useRouteStopEditor";
import { useRouteMapPoints } from "./useRouteMapPoints";
import RouteListSidebar from "./RouteListSidebar";
import RouteDetailHeader from "./RouteDetailHeader";
import RouteFormSection from "./RouteFormSection";
import AlternativeRoutesSection from "./AlternativeRoutesSection";
import RouteStopsSection from "./RouteStopsSection";
import GeometryPanel from "./GeometryPanel";
import RouteEmptyState from "./RouteEmptyState";
import StationManagementModal from "./StationManagementModal";
import CreateRouteModal, { type CreateRouteBasics } from "./CreateRouteModal";
import RemoveRouteStopModal from "./RemoveRouteStopModal";

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseRouteTab(searchParams.get("tab"));
  const canManageRoutes = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [routeForm, setRouteForm] =
    useState<OperatorRouteRequest>(emptyRouteForm);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [message, setMessage] = useState("");
  const [messageScope, setMessageScope] = useState<FeedbackScope>("global");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Đang tải chi tiết tuyến vừa chọn (backend có thể spike 3-10s) → overlay mờ
  // trên panel phải để user biết dữ liệu đang hiển thị là của tuyến cũ
  const [isLoadingRouteDetail, setIsLoadingRouteDetail] = useState(false);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [isCreateRouteModalOpen, setIsCreateRouteModalOpen] = useState(false);
  // Trạng thái "chưa lưu" của tuyến đang chọn (form/stops) — geometry có cờ dirty riêng
  const [isRouteDirty, setIsRouteDirty] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  // 409 ROUTE_DUPLICATED khi lưu → id tuyến có sẵn để hiện nút điều hướng
  const [duplicateRouteId, setDuplicateRouteId] = useState("");
  // Auto-fill km/thời lượng theo Google Routes khi chọn đủ 2 bến có tọa độ
  const [isAutoCalculatingMetrics, setIsAutoCalculatingMetrics] =
    useState(false);
  const [autoMetricsFallback, setAutoMetricsFallback] = useState(false);
  // "Sửa tay": lưu identity mảng điểm đường đi đang được mở khóa — khi geometry đổi
  // (tính lại/vẽ lại/tải tuyến khác) mảng mới khác identity nên tự khóa lại, không cần effect
  const [unlockedGeometryPoints, setUnlockedGeometryPoints] = useState<
    RouteCoordinate[] | null
  >(null);
  // Chống race khi chọn tuyến: mỗi lần chọn/tải mở một "phiên" mới (tăng seq);
  // response về muộn của phiên cũ so seq thấy lệch thì bỏ qua, không đè form/geometry
  // của tuyến đang chọn hiện tại
  const selectRouteSeqRef = useRef(0);
  const lastEstimatedRoutePairRef = useRef("");
  // Cặp bến đã thử gọi tính đường tự động — tránh gọi lặp khi request lỗi mà số liệu vẫn 0
  const autoCalcAttemptedPairRef = useRef("");
  // Ref giữ giá trị mới nhất để loadData không phải phụ thuộc vào
  // selectedRouteId/selectedStopId/t — tránh refetch toàn bộ khi chọn tuyến/điểm dừng
  const tRef = useRef(t);
  const selectedRouteIdRef = useRef(selectedRouteId);
  const selectedStopIdRef = useRef(selectedStopId);
  // Ref phá vòng phụ thuộc stopEditor → geometry → mapPoints → stopEditor:
  // handler chỉ chạy sau render nên tham chiếu qua ref là an toàn
  const invalidateGeometryRef = useRef<(routeId?: string) => void>(() => {});
  // Ref tương tự cho effect auto-fill — không đưa object geometry vào deps
  const applyComputedGeometryRef = useRef<(points: RouteCoordinate[]) => void>(
    () => {},
  );

  useEffect(() => {
    tRef.current = t;
    selectedRouteIdRef.current = selectedRouteId;
    selectedStopIdRef.current = selectedStopId;
  });

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );
  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === selectedStopId) ?? null,
    [selectedStopId, stops],
  );
  const selectedOriginStation = useMemo(
    () => stations.find((station) => station.id === routeForm.originStationId),
    [routeForm.originStationId, stations],
  );
  const selectedDestinationStation = useMemo(
    () =>
      stations.find((station) => station.id === routeForm.destinationStationId),
    [routeForm.destinationStationId, stations],
  );
  const activeRouteKey = selectedRoute?.id ?? draftRouteId;
  const activeRouteName =
    selectedRoute?.name || routeForm.name.trim() || t("routes.draftRoute");

  const stopEditor = useRouteStopEditor({
    selectedRoute,
    selectedStop,
    stations,
    originStationId: routeForm.originStationId,
    activeRouteKey,
    activeRouteName,
    invalidateLocalGeometry: (routeId) => invalidateGeometryRef.current(routeId),
    markRouteDirty: () => setIsRouteDirty(true),
    setError,
    showMessage,
    t,
  });
  const { routeMapPoints, routeWaypoints } = useRouteMapPoints({
    stations,
    originStationId: routeForm.originStationId,
    destinationStationId: routeForm.destinationStationId,
    currentRouteStops: stopEditor.currentRouteStops,
    t,
  });
  const geometry = useRouteGeometry({
    selectedRouteId,
    routeWaypoints,
    setRouteForm,
    setRoutes,
    setError,
    showMessage,
    t,
  });
  invalidateGeometryRef.current = geometry.invalidateLocalGeometry;
  applyComputedGeometryRef.current = geometry.applyComputedGeometry;
  const alternatives = useAlternativeRoutes({
    selectedRouteId,
    originStationId: routeForm.originStationId,
    stops,
    setError,
    showMessage,
    t,
  });
  const stationManager = useStationManagement({
    stations,
    setStations,
    updateRoute,
    setError,
    showMessage,
    t,
  });
  const stopFormControl = useStopForm({
    selectedStopId,
    setSelectedStopId,
    setStops,
    setError,
    showMessage,
    t,
  });
  const { applySavedGeometry } = geometry;
  const { applyAlternatives } = alternatives;
  const { setStopForm } = stopFormControl;
  const { setRouteStopDrafts } = stopEditor;

  // Đồng bộ drafts điểm dừng của một tuyến từ response server (detail có stops).
  // Bắt buộc trước khi lưu replace-all (8.7) — thiếu bước này thì PUT /full sẽ
  // xóa các stop server có mà state cục bộ chưa biết.
  const syncRouteStopsFromServer = useCallback(
    (route: OperatorRoute) => {
      setRouteStopDrafts((prev) => [
        ...prev.filter((item) => item.routeId !== route.id),
        ...detailStopsToDrafts(route),
      ]);
    },
    [setRouteStopDrafts],
  );

  const loadData = useCallback(async () => {
    // Refresh cũng mở phiên chọn mới: response chọn tuyến đang chờ trở thành stale,
    // và ngược lại nếu user chọn tuyến trong lúc refresh thì kết quả refresh bị bỏ qua
    const seq = ++selectRouteSeqRef.current;
    setIsLoading(true);
    setError("");

    try {
      const [routeResult, stopResult, stationResult, locationResult] =
        await Promise.all([
          getOperatorRoutes({ page: 1, pageSize: 50 }),
          getOperatorStops({ page: 1, pageSize: 50 }),
          getOperatorStations({ page: 1, pageSize: 100 }),
          getPublicLocations(),
        ]);
      const nextRouteSummary =
        routeResult.items.find(
          (item) => item.id === selectedRouteIdRef.current,
        ) ?? routeResult.items[0];
      const nextRoute = nextRouteSummary
        ? await getOperatorRoute(nextRouteSummary.id)
        : undefined;
      const alternativeResult = nextRoute
        ? await getAlternativeRoutes(nextRoute.id, { page: 1, pageSize: 2 })
        : undefined;
      const nextStop =
        stopResult.items.find((item) => item.id === selectedStopIdRef.current) ??
        stopResult.items[0];

      // User đã chọn tuyến khác trong lúc refresh → bỏ qua toàn bộ kết quả phiên này
      if (seq !== selectRouteSeqRef.current) {
        return;
      }

      setRoutes(
        nextRoute
          ? routeResult.items.map((route) =>
              route.id === nextRoute.id ? nextRoute : route,
            )
          : routeResult.items,
      );
      setStops(stopResult.items);
      setStations(
        mergeStations([], stationResult.items.map(toStationOption)).filter(
          (station) => station.id && station.name,
        ),
      );
      setLocations(locationResult.filter((location) => location.isActive));
      setSelectedRouteId(nextRoute?.id ?? "");
      setSelectedStopId(nextStop?.id ?? "");
      applyAlternatives(alternativeResult?.items ?? []);

      setIsRouteDirty(false);
      setDuplicateRouteId("");

      if (nextRoute) {
        lastEstimatedRoutePairRef.current = `${nextRoute.originStationId}:${nextRoute.destinationStationId}`;
        setRouteForm(routeToForm(nextRoute));
        applySavedGeometry(nextRoute);
        syncRouteStopsFromServer(nextRoute);
      } else {
        applySavedGeometry(null);
      }

      if (nextStop) {
        setStopForm({
          name: nextStop.name,
          latitude: nextStop.latitude,
          longitude: nextStop.longitude,
          description: nextStop.description ?? "",
          address: nextStop.address ?? "",
          googlePlaceId: nextStop.googlePlaceId,
        });
      }
    } catch (err) {
      // Lỗi của phiên stale cũng bỏ qua — không báo lỗi cho dữ liệu không còn dùng
      if (seq === selectRouteSeqRef.current) {
        setError(
          err instanceof Error ? err.message : tRef.current("routes.loadFailed"),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyAlternatives, applySavedGeometry, setStopForm, syncRouteStopsFromServer]);

  // Chỉ chạy khi mount — chi tiết tuyến/điểm dừng đang chọn do handleSelectRoute/handleSelectStop đảm nhiệm
  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  // Deep-link ?routeId=: sau khi danh sách tuyến đã tải, nếu URL trỏ tới tuyến tồn tại
  // thì chọn tuyến đó. Chỉ chạy khi URL/danh sách tuyến ĐỔI (không phải mỗi render):
  // setSearchParams cập nhật async nên có render trung gian param cũ ≠ selected mới —
  // chạy mỗi render sẽ chọn NGƯỢC lại tuyến cũ (một phần bug "bấm không ăn").
  // So sánh qua ref để không cần đưa selectedRouteId vào deps. Id không tồn tại → bỏ qua.
  useEffect(() => {
    const paramRouteId = searchParams.get("routeId");

    if (
      !paramRouteId ||
      paramRouteId === selectedRouteIdRef.current ||
      !routes.some((route) => route.id === paramRouteId)
    ) {
      return;
    }

    runAction(() => handleSelectRoute(paramRouteId));
    // runAction/handleSelectRoute là function component-scope, identity đổi mỗi render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, searchParams]);

  // Chọn đủ 2 bến → tự gọi Google Routes lấy polyline + km + thời lượng và auto-fill
  // form. Guard bằng ref cặp bến để chỉ gọi khi CẶP bến đổi (hoặc số liệu còn 0 mà
  // chưa từng thử). Lỗi/thiếu key/thiếu tọa độ → fallback ước lượng haversine như cũ,
  // 2 ô vẫn nhập tay được kèm hint — flow không được gãy khi môi trường không có key.
  useEffect(() => {
    if (
      !canManageRoutes ||
      !selectedOriginStation ||
      !selectedDestinationStation ||
      selectedOriginStation.id === selectedDestinationStation.id
    ) {
      return;
    }

    const origin = selectedOriginStation;
    const destination = selectedDestinationStation;
    const routePairKey = `${origin.id}:${destination.id}`;

    if (
      !origin.latitude ||
      !origin.longitude ||
      !destination.latitude ||
      !destination.longitude
    ) {
      // Bến thiếu tọa độ → không tính tự động được, chỉ hiện hint nhập tay
      if (lastEstimatedRoutePairRef.current !== routePairKey) {
        setAutoMetricsFallback(true);
      }
      return;
    }

    const shouldEstimate =
      lastEstimatedRoutePairRef.current !== routePairKey ||
      ((routeForm.totalDistanceKm === 0 ||
        routeForm.estimatedDurationMinutes === 0) &&
        autoCalcAttemptedPairRef.current !== routePairKey);

    if (!shouldEstimate) {
      return;
    }

    lastEstimatedRoutePairRef.current = routePairKey;
    autoCalcAttemptedPairRef.current = routePairKey;

    const applyMetrics = (
      totalDistanceKm: number,
      estimatedDurationMinutes: number,
    ) => {
      setRouteForm((current) => {
        if (
          current.originStationId !== origin.id ||
          current.destinationStationId !== destination.id
        ) {
          return current;
        }

        return { ...current, totalDistanceKm, estimatedDurationMinutes };
      });
    };

    let cancelled = false;
    setIsAutoCalculatingMetrics(true);
    setAutoMetricsFallback(false);
    void (async () => {
      try {
        const result = await requestRoadGeometry(
          [
            { latitude: origin.latitude, longitude: origin.longitude },
            {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          ],
          tRef.current("routes.routingFailed"),
        );

        if (cancelled) {
          return;
        }

        applyComputedGeometryRef.current(result.points);
        applyMetrics(result.totalDistanceKm, result.estimatedDurationMinutes);
      } catch {
        if (cancelled) {
          return;
        }

        // Fallback: giữ ước lượng đường chim bay như trước, ô số vẫn editable
        const distance = distanceKmBetween(origin, destination);
        applyMetrics(
          Number(distance.toFixed(1)),
          estimateCoachDurationMinutes(distance),
        );
        setAutoMetricsFallback(true);
      } finally {
        if (!cancelled) {
          setIsAutoCalculatingMetrics(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canManageRoutes,
    routeForm.estimatedDurationMinutes,
    routeForm.totalDistanceKm,
    selectedDestinationStation,
    selectedOriginStation,
  ]);

  function runAction(action: () => Promise<void>) {
    setError("");
    setMessage("");
    setMessageScope("global");
    setDuplicateRouteId("");
    void action().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t("routes.actionFailed"));
    });
  }

  function showMessage(scope: FeedbackScope, nextMessage: string) {
    setMessageScope(scope);
    setMessage(nextMessage);
  }

  function selectTab(tab: RouteTab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        if (tab === "info") {
          next.delete("tab");
        } else {
          next.set("tab", tab);
        }

        return next;
      },
      { replace: true },
    );
  }

  function updateRoute<K extends keyof OperatorRouteRequest>(
    key: K,
    value: OperatorRouteRequest[K],
  ) {
    if (
      (key === "originStationId" || key === "destinationStationId") &&
      routeForm[key] !== value
    ) {
      // Bến đi/bến đến bất biến sau khi tạo (PUT /full trả ROUTE_STATION_IMMUTABLE)
      // → chặn đổi khi đang edit tuyến; muốn đổi bến phải tạo tuyến mới
      if (selectedRouteId) {
        setError(t("routes.stationsLockedHint"));
        return;
      }

      geometry.invalidateLocalGeometry();
    }

    if (selectedRouteId && routeForm[key] !== value) {
      setIsRouteDirty(true);
    }

    setRouteForm((prev) => ({ ...prev, [key]: value }));
  }

  // Tạo tuyến từ modal qua POST /routes/full (atomic, một request): gửi kèm
  // pathPolyline auto-tính (không manualMetrics — server tự tính, contract 12.1)
  // hoặc manualMetrics khi fallback. Ném Error để modal hiển thị lỗi trong hộp thoại
  // (kể cả 409 ROUTE_DUPLICATED — modal đọc code + fields để hiện nút mở tuyến cũ).
  async function handleCreateRoute(basics: CreateRouteBasics) {
    if (!basics.name.trim()) {
      throw new Error(t("routes.routeNameRequired"));
    }

    if (!basics.originStationId || !basics.destinationStationId) {
      throw new Error(t("routes.routeStationsRequired"));
    }

    if (!isGuid(basics.originStationId) || !isGuid(basics.destinationStationId)) {
      throw new Error(t("routes.routeStationIdsInvalid"));
    }

    if (basics.originStationId === basics.destinationStationId) {
      throw new Error(t("routes.originDestinationDifferent"));
    }

    const pendingStops = stopEditor.routeStopDrafts.filter(
      (item) => item.routeId === draftRouteId,
    );
    const created = await createOperatorRouteFull({
      name: basics.name,
      originStationId: basics.originStationId,
      destinationStationId: basics.destinationStationId,
      returnRouteId: null,
      baseFare: emptyRouteForm.baseFare,
      isActive: emptyRouteForm.isActive,
      pathPolyline: basics.pathPolyline || undefined,
      // Create không polyline bắt buộc manualMetrics (contract 8.6) — chưa có
      // ước lượng thì gửi 0/0, chỉnh lại sau trong tab Thông tin
      manualMetrics: basics.pathPolyline
        ? undefined
        : (basics.manualMetrics ?? {
            totalDistanceKm: 0,
            estimatedDurationMinutes: 0,
          }),
      stops: draftsToFullStops(pendingStops),
    });

    // Response là detail đầy đủ (kèm stops + metrics server tính) → dùng luôn,
    // không gọi lại GET
    setRoutes((prev) => [created, ...prev]);
    setSelectedRouteId(created.id);
    setRouteForm(routeToForm(created));
    alternatives.resetAlternatives();
    applySavedGeometry(created);
    setIsRouteDirty(false);
    lastEstimatedRoutePairRef.current = `${created.originStationId}:${created.destinationStationId}`;
    // Cho phép effect auto-fill thử tính lại nếu tuyến mới chưa có số liệu
    autoCalcAttemptedPairRef.current = "";
    setAutoMetricsFallback(false);
    setRouteStopDrafts((prev) => [
      ...prev.filter(
        (item) =>
          item.routeId !== draftRouteId && item.routeId !== created.id,
      ),
      ...detailStopsToDrafts(created),
    ]);
    // Auto-select tuyến mới và chuyển sang tab Điểm dừng để bổ sung tiếp
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        next.set("routeId", created.id);
        next.set("tab", "stops");

        return next;
      },
      { replace: true },
    );
    showMessage("global", t("routes.routeCreated"));
  }

  async function handleSelectRoute(routeId: string) {
    // Chụp seq phiên chọn hiện tại — nếu user chọn tuyến khác trong lúc chờ
    // backend (spike 3-10s) thì response phiên này bị bỏ qua ở các check bên dưới
    const seq = ++selectRouteSeqRef.current;
    setSelectedRouteId(routeId);
    // Đổi tuyến → reset trạng thái auto-fill + cờ "chưa lưu" của tuyến trước
    autoCalcAttemptedPairRef.current = "";
    setAutoMetricsFallback(false);
    setUnlockedGeometryPoints(null);
    setIsRouteDirty(false);
    setDuplicateRouteId("");
    // Đồng bộ ?routeId= lên URL để share deep-link; replace để không spam history
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        if (routeId) {
          next.set("routeId", routeId);
        } else {
          next.delete("routeId");
        }

        return next;
      },
      { replace: true },
    );

    if (!routeId) {
      lastEstimatedRoutePairRef.current = "";
      setRouteForm(emptyRouteForm);
      alternatives.resetAlternatives();
      applySavedGeometry(null);
      setIsLoadingRouteDetail(false);
      return;
    }

    setIsLoadingRouteDetail(true);

    try {
      const [route, alternativeResult] = await Promise.all([
        getOperatorRoute(routeId),
        getAlternativeRoutes(routeId, { page: 1, pageSize: 2 }),
      ]);

      // Trong lúc chờ user đã chọn tuyến khác → bỏ qua response cũ,
      // không đè form/alternatives/geometry của tuyến đang chọn
      if (seq !== selectRouteSeqRef.current) {
        return;
      }

      applyAlternatives(alternativeResult.items);
      alternatives.setAlternativeStopId("");
      setRoutes((prev) =>
        prev.some((item) => item.id === route.id)
          ? prev.map((item) => (item.id === route.id ? route : item))
          : [route, ...prev],
      );
      lastEstimatedRoutePairRef.current = `${route.originStationId}:${route.destinationStationId}`;
      setRouteForm(routeToForm(route));
      applySavedGeometry(route);
      syncRouteStopsFromServer(route);
    } catch (err) {
      // Lỗi của phiên stale cũng nuốt — không hiện error cho tuyến không còn chọn
      if (seq !== selectRouteSeqRef.current) {
        return;
      }

      throw err;
    } finally {
      // Chỉ phiên hiện hành mới được tắt overlay (phiên mới hơn đang tự quản lý nó)
      if (seq === selectRouteSeqRef.current) {
        setIsLoadingRouteDetail(false);
      }
    }
  }

  // Lưu tuyến atomic qua PUT /routes/{id}/full: gửi TOÀN BỘ form + stops hiện tại
  // (replace-all, orderIndex chuẩn hóa 1..N) + polyline trong MỘT request.
  async function handleSaveRoute() {
    if (!selectedRouteId) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    if (!routeForm.name.trim()) {
      setError(t("routes.routeNameRequired"));
      return;
    }

    const stops = draftsToFullStops(stopEditor.currentRouteStops);

    if (stops.some((stop) => !stop.allowPickup && !stop.allowDropoff)) {
      setError(t("routes.stopNeedsPickupOrDropoff"));
      return;
    }

    const hasPolyline = geometry.routePathPoints.length >= 2;
    // Chụp seq (không tăng): nếu user chọn tuyến khác trong lúc lưu thì response
    // save không được đè form của tuyến mới — chỉ cập nhật list + báo đã lưu
    const seq = selectRouteSeqRef.current;
    setIsSavingRoute(true);

    try {
      const saved = await updateOperatorRouteFull(selectedRouteId, {
        name: routeForm.name,
        originStationId: routeForm.originStationId,
        destinationStationId: routeForm.destinationStationId,
        returnRouteId: routeForm.returnRouteId || null,
        baseFare: routeForm.baseFare,
        isActive: routeForm.isActive,
        pathPolyline: hasPolyline
          ? encodeGooglePolyline(geometry.routePathPoints)
          : null,
        // Có polyline → KHÔNG gửi manualMetrics, server tự tính (contract 12.1);
        // không polyline → gửi số nhập tay từ form
        manualMetrics: hasPolyline
          ? undefined
          : {
              totalDistanceKm: routeForm.totalDistanceKm,
              estimatedDurationMinutes: routeForm.estimatedDurationMinutes,
            },
        stops,
      });

      // Đồng bộ toàn bộ state từ response — metrics server tính (round 2 số,
      // ceil phút) là nguồn sự thật, có thể khác số client ước lượng
      setRoutes((prev) =>
        prev.map((item) => (item.id === saved.id ? saved : item)),
      );
      syncRouteStopsFromServer(saved);

      // Vẫn đang ở tuyến vừa lưu → sync form/geometry theo response server
      if (seq === selectRouteSeqRef.current) {
        lastEstimatedRoutePairRef.current = `${saved.originStationId}:${saved.destinationStationId}`;
        setRouteForm(routeToForm(saved));
        applySavedGeometry(saved);
        setIsRouteDirty(false);
        setUnlockedGeometryPoints(null);
      }

      showMessage("global", t("routes.routeSaved"));
    } catch (err) {
      // 409 ROUTE_DUPLICATED (vd đổi tên trùng tuyến khác) → hiện nút mở tuyến cũ
      if (err instanceof ApiRequestError && err.code === "ROUTE_DUPLICATED") {
        setDuplicateRouteId(
          err.fields?.find((field) => field.field === "existingRouteId")
            ?.message ?? "",
        );
      }

      throw err;
    } finally {
      setIsSavingRoute(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("routes.manageTitle")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            {t("routes.manageSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => runAction(loadData)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw size={16} />
          {tc("refresh")}
        </button>
      </div>

      {message && messageScope === "global" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {duplicateRouteId && (
            <button
              type="button"
              onClick={() => {
                const routeId = duplicateRouteId;
                runAction(() => handleSelectRoute(routeId));
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              {t("routes.openExistingRoute")}
            </button>
          )}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <RouteListSidebar
          routes={routes}
          selectedRouteId={selectedRouteId}
          canManageRoutes={canManageRoutes}
          onSelectRoute={(routeId) =>
            runAction(() => handleSelectRoute(routeId))
          }
          onCreateRoute={() => setIsCreateRouteModalOpen(true)}
        />

        {selectedRoute ? (
          <main className="min-w-0">
            <RouteDetailHeader
              routeName={selectedRoute.name}
              activeTab={activeTab}
              onSelectTab={selectTab}
              onOpenStationManagement={() => setIsStationModalOpen(true)}
              canManageRoutes={canManageRoutes}
              isDirty={isRouteDirty || geometry.isGeometryDirty}
              isSaving={isSavingRoute}
              onSaveRoute={() => runAction(handleSaveRoute)}
            />

            {/* Vùng nội dung tab: relative để overlay loading phủ lên khi đang
                tải chi tiết tuyến khác — data cũ mờ đi thay vì trông như "bấm không ăn" */}
            <div aria-busy={isLoadingRouteDetail} className="relative mt-4 space-y-4">
              {isLoadingRouteDetail && (
                <div className="absolute inset-0 z-10 flex justify-center rounded-xl bg-gray-50/70 pt-16">
                  <span
                    role="status"
                    className="inline-flex h-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm"
                  >
                    <FiRefreshCw className="animate-spin" size={15} />
                    {t("routes.loadingRouteDetail")}
                  </span>
                </div>
              )}

              {activeTab === "info" && (
                <div className="grid items-start gap-5 xl:grid-cols-2">
                  <RouteFormSection
                    canManageRoutes={canManageRoutes}
                    routes={routes}
                    stations={stations}
                    selectedRouteId={selectedRouteId}
                    form={routeForm}
                    onUpdateField={updateRoute}
                    feedbackMessage={messageScope === "route" ? message : ""}
                    isAutoCalculatingMetrics={isAutoCalculatingMetrics}
                    autoMetricsFallback={autoMetricsFallback}
                    metricsLocked={
                      geometry.routePathPoints.length >= 2 &&
                      !geometry.isEditingGeometry &&
                      unlockedGeometryPoints !== geometry.routePathPoints
                    }
                    onUnlockMetrics={() =>
                      setUnlockedGeometryPoints(geometry.routePathPoints)
                    }
                  />
                  <GeometryPanel
                    canManageRoutes={canManageRoutes}
                    geometry={geometry}
                    points={routeMapPoints}
                    waypointCount={routeWaypoints.length}
                    hasSelectedRoute={Boolean(selectedRouteId)}
                    hasSavedPolyline={Boolean(selectedRoute.pathPolyline)}
                    onRunAction={runAction}
                    feedbackMessage={messageScope === "geometry" ? message : ""}
                  />
                </div>
              )}
  
              {activeTab === "stops" && (
                <RouteStopsSection
                  canManageRoutes={canManageRoutes}
                  stops={stops}
                  selectedStopId={selectedStopId}
                  stopFormControl={stopFormControl}
                  routeStopOrder={stopEditor.routeStopOrder}
                  onChangeRouteStopOrder={stopEditor.setRouteStopOrder}
                  routeStopDuration={stopEditor.routeStopDuration}
                  onChangeRouteStopDuration={stopEditor.setRouteStopDuration}
                  routeStopDistance={stopEditor.routeStopDistance}
                  onChangeRouteStopDistance={stopEditor.setRouteStopDistance}
                  allowPickup={stopEditor.allowPickup}
                  onChangeAllowPickup={stopEditor.setAllowPickup}
                  allowDropoff={stopEditor.allowDropoff}
                  onChangeAllowDropoff={stopEditor.setAllowDropoff}
                  canEstimate={Boolean(routeForm.originStationId)}
                  activeRouteName={activeRouteName}
                  currentRouteStops={stopEditor.currentRouteStops}
                  onAddRouteStop={() => runAction(stopEditor.handleAddRouteStop)}
                  onEstimateRouteStopMetrics={() =>
                    runAction(stopEditor.handleEstimateRouteStopMetrics)
                  }
                  onRequestRemove={stopEditor.setRouteStopPendingRemoval}
                  onRunAction={runAction}
                  stopFeedbackMessage={messageScope === "stop" ? message : ""}
                  routeStopFeedbackMessage={
                    messageScope === "routeStop" ? message : ""
                  }
                />
              )}
  
              {activeTab === "alternatives" && (
                <AlternativeRoutesSection
                  canManageRoutes={canManageRoutes}
                  hasSelectedRoute={Boolean(selectedRouteId)}
                  stations={stations}
                  stops={stops}
                  alternatives={alternatives}
                  onRunAction={runAction}
                  feedbackMessage={
                    messageScope === "alternative" ? message : ""
                  }
                />
              )}
            </div>
          </main>
        ) : (
          <RouteEmptyState
            canManageRoutes={canManageRoutes}
            onCreateRoute={() => setIsCreateRouteModalOpen(true)}
            onOpenStationManagement={() => setIsStationModalOpen(true)}
          />
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500">{t("routes.loading")}</p>
      )}

      <StationManagementModal
        open={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
        canManageRoutes={canManageRoutes}
        stations={stations}
        locations={locations}
        manager={stationManager}
        onRunAction={runAction}
        feedbackMessage={messageScope === "station" ? message : ""}
      />

      <CreateRouteModal
        open={isCreateRouteModalOpen}
        onClose={() => setIsCreateRouteModalOpen(false)}
        stations={stations}
        onSubmit={handleCreateRoute}
        onOpenExistingRoute={(routeId) =>
          runAction(() => handleSelectRoute(routeId))
        }
      />

      <RemoveRouteStopModal
        item={stopEditor.routeStopPendingRemoval}
        onClose={() => stopEditor.setRouteStopPendingRemoval(null)}
        onConfirm={(item) =>
          runAction(() => stopEditor.handleRemoveRouteStop(item))
        }
      />
    </div>
  );
}
