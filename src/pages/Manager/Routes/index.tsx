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
import { fetchAllPages } from "../../../api/pagination";
import { getAuthUser } from "../../../auth";
import { useToast } from "../../../components/toast/useToast";
import {
  readSessionCache,
  writeSessionCache,
} from "../../../utils/sessionCache";
import {
  encodeGooglePolyline,
  estimateCoachDurationMinutes,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";
import {
  distanceKmBetween,
  findRouteGeometryWaypointMismatches,
  requestRoadGeometry,
} from "./geometry";
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
import {
  isValidRouteCode,
  routeCodePayload,
} from "../../../utils/businessCode";
import type { FeedbackScope, StationOption, StopSuggestion } from "./types";
import { useRouteGeometry } from "./useRouteGeometry";
import { useAlternativeRouteWorkspace } from "./useAlternativeRouteWorkspace";
import { useStationManagement } from "./useStationManagement";
import { useStopForm } from "./useStopForm";
import { useRouteStopEditor } from "./useRouteStopEditor";
import { useRouteStopSuggestions } from "./useRouteStopSuggestions";
import { useRouteMapPoints } from "./useRouteMapPoints";
import RouteListSidebar from "./RouteListSidebar";
import RouteDetailHeader from "./RouteDetailHeader";
import AlternativeRouteWorkspace from "./AlternativeRouteWorkspace";
import RouteMapWorkspace from "./RouteMapWorkspace";
import RouteEmptyState from "./RouteEmptyState";
import RouteDetailSkeleton from "./RouteDetailSkeleton";
import StationManagementModal from "./StationManagementModal";
import StopWardConfirmModal from "./StopWardConfirmModal";
import CreateRouteModal, { type CreateRouteBasics } from "./CreateRouteModal";
import RemoveRouteStopModal from "./RemoveRouteStopModal";
import RemoveAlternativeRouteModal from "./RemoveAlternativeRouteModal";
import RemoveAlternativeStopModal from "./RemoveAlternativeStopModal";

// Cache danh sách tuyến (summary) theo phiên — stale-while-revalidate, hạn 10 phút.
// KHÔNG cache chi tiết tuyến/stops/geometry (dữ liệu nặng + đổi thường xuyên).
const routeListCacheMaxAgeMs = 10 * 60 * 1000;

// Key chứa ID user hiện tại để đổi tài khoản không dính cache của nhà xe khác.
function routeListCacheKey(userId?: string) {
  return `vietride:routeList:${userId || "anonymous"}`;
}

// Mảng rỗng ổn định (tránh literal [] mới mỗi render) — dùng để "gate" pathPoints
// truyền cho useRouteStopSuggestions trong lúc đang tải chi tiết tuyến, xem giải
// thích ở chỗ dùng.
const emptyRoutePathPoints: RouteCoordinate[] = [];

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseRouteTab(searchParams.get("tab"));
  const authUser = getAuthUser();
  const canManageRoutes = authUser?.role === "OPERATOR_ADMIN";
  const cacheKey = routeListCacheKey(authUser?.id);
  // Đọc cache một lần khi mount (lazy initializer): có cache → sidebar hiện tên tuyến
  // ngay, không skeleton; fetch nền vẫn chạy rồi cập nhật + ghi đè cache.
  const [routes, setRoutes] = useState<OperatorRoute[]>(
    () => readSessionCache<OperatorRoute[]>(cacheKey, routeListCacheMaxAgeMs) ?? [],
  );
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  // Lỗi riêng của ô mã tuyến ở form sửa (409 trùng mã / 422 sai format).
  const [routeCodeError, setRouteCodeError] = useState("");
  const [routeForm, setRouteForm] =
    useState<OperatorRouteRequest>(emptyRouteForm);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  // Thông báo hành động INLINE gắn theo khu vực panel cụ thể (station/alternative/
  // routeStop) — vẫn đứng cạnh ngữ cảnh thao tác nên giữ nguyên dạng inline.
  // Thông báo thành công/lỗi ở PHẠM VI TOÀN MÀN (tạo/lưu tuyến, lỗi tải dữ liệu...)
  // đã chuyển qua toast (useToast) — xem handleCreateRoute/handleSaveRoute/loadData.
  const [message, setMessage] = useState("");
  const [messageScope, setMessageScope] = useState<FeedbackScope>("station");
  // Toast góc phải cho feedback hành động toàn màn (tạo/lưu tuyến, lỗi tải/thao tác).
  const toast = useToast();
  // Đang tải dữ liệu lần đầu (mount) — điều khiển skeleton sidebar + panel phải.
  // True từ đầu để không nháy empty-state "không có tuyến" trước khi load xong.
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
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
  // Chế độ "thêm điểm dừng": bật chấm gợi ý trên map + ô tìm gộp trong panel —
  // giờ gắn thẳng vào tab "Điểm dừng" (không còn nút bật/tắt riêng), vào tab
  // là bật luôn, rời tab là tắt luôn.
  const isSuggestMode = activeTab === "stops" && canManageRoutes;
  // Gợi ý được chọn từ ô tìm gộp trong panel — truyền xuống map để mở popup
  // xác nhận như bấm chấm gợi ý trực tiếp trên bản đồ (object mới mỗi lần chọn)
  const [pickedSuggestion, setPickedSuggestion] =
    useState<StopSuggestion | null>(null);
  // Đang chờ addStopFromSuggestion (tạo stop mới + thêm vào tuyến) — khoá nút
  // "Thêm vào tuyến" trong popup tránh double-submit
  const [isAddingSuggestion, setIsAddingSuggestion] = useState(false);
  // Gợi ý Google đang chờ xác nhận phường/xã (điểm dừng đã có sẵn thì bỏ qua
  // bước này vì không tạo Stop mới)
  const [pendingWardSuggestion, setPendingWardSuggestion] = useState<{
    suggestion: StopSuggestion;
    confirm: (locationId: string) => void;
  } | null>(null);
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
  const invalidateGeometryRef = useRef<
    (routeId?: string, options?: { keepViaPoints?: boolean }) => void
  >(() => {});
  // Ref tương tự cho effect auto-fill — không đưa object geometry vào deps
  const applyComputedGeometryRef = useRef<(points: RouteCoordinate[]) => void>(
    () => {},
  );
  // Ref giữ polyline đang hiển thị của tuyến (geometry.routePathPoints) — phá
  // vòng phụ thuộc stopEditor → geometry (geometry lại phụ thuộc routeWaypoints
  // dựng từ stopEditor.currentRouteStops). Gán lại mỗi render NGAY SAU khi
  // geometry được tạo. stopEditor chỉ nhận một GETTER đọc ref này (không nhận
  // giá trị trực tiếp) — addStopFromSuggestion gọi getter lúc user bấm (sau khi
  // render đã commit), nên luôn đọc được polyline mới nhất, không lệch 1 render.
  const pathPointsRef = useRef<RouteCoordinate[]>([]);

  useEffect(() => {
    tRef.current = t;
    selectedRouteIdRef.current = selectedRouteId;
    selectedStopIdRef.current = selectedStopId;
  });

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
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
    stations,
    originStationId: routeForm.originStationId,
    activeRouteKey,
    activeRouteName,
    invalidateLocalGeometry: (routeId, options) =>
      invalidateGeometryRef.current(routeId, options),
    markRouteDirty: () => setIsRouteDirty(true),
    // Lỗi validation của hành động (khi bấm thêm điểm dừng/tuyến thay thế/bến...)
    // trước đây hiện qua banner đầu màn — giờ báo qua toast (không có ô inline
    // riêng cho các lỗi này).
    setError: toast.error,
    showMessage,
    t,
    // Getter đọc pathPointsRef.current TẠI THỜI ĐIỂM addStopFromSuggestion chạy
    // (sau khi user bấm, tức sau khi render đã commit) — luôn tươi, không lệch
    // 1 render như truyền thẳng giá trị (xem giải thích ở chỗ khai báo pathPointsRef)
    getPathPoints: () => pathPointsRef.current,
    onStopCreated: (stop) => setStops((prev) => [stop, ...prev]),
  });
  const { routeMapPoints, routeWaypoints } = useRouteMapPoints({
    stations,
    originStationId: routeForm.originStationId,
    destinationStationId: routeForm.destinationStationId,
    currentRouteStops: stopEditor.currentRouteStops,
    t,
  });
  // Tab có bản đồ + form/điểm dừng thao tác được đường đi ("workspace") — Thông
  // tin và Điểm dừng đều cần auto-fetch: thêm/xoá điểm dừng ở tab Điểm dừng cũng
  // làm đường cũ (invalidateLocalGeometry) không còn khớp, phải tính lại đường
  // MỚI đi qua các waypoint hiện có (routeWaypoints đã gồm currentRouteStops —
  // xem useRouteMapPoints), không thì map rơi về fallback nối thẳng các điểm
  // (RouteDesignMap: displayedPath = pathPoints.length > 0 ? pathPoints : points).
  // Tab Tuyến thay thế KHÔNG nằm trong danh sách này — không tự fetch phương án.
  const isRouteWorkspaceTab = activeTab === "info" || activeTab === "stops";
  const geometry = useRouteGeometry({
    selectedRouteId,
    routeWaypoints,
    // Auto-fetch phương án chỉ chạy ở 2 tab workspace và user sửa được tuyến —
    // không đốt quota cho viewer hay tab Tuyến thay thế. Chặn cả lúc đang tải
    // chi tiết tuyến vừa chọn: form còn giữ bến của tuyến CŨ, fetch lúc này sẽ
    // tính đường sai cặp bến và phí một lượt request
    isWorkspaceActive:
      isRouteWorkspaceTab && canManageRoutes && !isLoadingRouteDetail,
    setRouteForm,
    setRoutes,
    // Lỗi geometry (via-point vượt giới hạn, polyline lưu không hợp lệ...) trước
    // đây hiện qua banner đầu màn — giờ báo qua toast.
    setError: toast.error,
    t,
  });
  invalidateGeometryRef.current = geometry.invalidateLocalGeometry;
  applyComputedGeometryRef.current = geometry.applyComputedGeometry;
  // Cập nhật cho lần render kế — xem giải thích ở chỗ khai báo pathPointsRef
  pathPointsRef.current = geometry.routePathPoints;
  // Gợi ý điểm dừng (kho nhà xe/Google) dọc tuyến — chỉ chạy khi đang ở tab
  // Điểm dừng và có quyền sửa tuyến (isSuggestMode đã gộp 2 điều kiện này).
  // pathPoints GATE theo isLoadingRouteDetail: chọn tuyến khác đổi activeRouteKey
  // (routeKey) NGAY trong render đồng bộ, nhưng geometry.routePathPoints vẫn còn
  // polyline của tuyến CŨ tới khi applySavedGeometry chạy sau khi fetch chi tiết
  // xong (handleSelectRoute). Nếu truyền thẳng routePathPoints, hook sẽ fetch
  // Google Places bằng polyline SAI (tuyến cũ) rồi cache kết quả dưới cacheKey =
  // routeKey MỚI — cache theo đúng thiết kế F-1 (chỉ 1 lần/tuyến, không tính
  // pathPoints vào key) nên khi polyline đúng về sau sẽ KHÔNG refetch, gợi ý
  // Google bị "mồ côi" vĩnh viễn tới khi F5. Trả [] trong lúc đang tải chi tiết
  // để hook không bao giờ thấy cặp (routeKey mới, pathPoints cũ) — khi loading
  // xong, isLoadingRouteDetail và routePathPoints cùng cập nhật đúng trong CÙNG
  // một lần render (applySavedGeometry chạy trước setIsLoadingRouteDetail(false)
  // trong handleSelectRoute) nên hook luôn thấy dữ liệu khớp tuyến.
  const {
    suggestions: nearbySuggestions,
    isLoadingPlaces,
    canRequestPlaces,
    requestPlaces,
  } = useRouteStopSuggestions({
      enabled: isSuggestMode,
      routeKey: activeRouteKey,
      pathPoints: isLoadingRouteDetail
        ? emptyRoutePathPoints
        : geometry.routePathPoints,
      stops,
      currentRouteStops: stopEditor.currentRouteStops,
    });
  // Gợi ý được chọn từ ô search (pickedSuggestion) không nhất thiết nằm trong
  // nearbySuggestions (chỉ gồm chấm ≤3km dọc tuyến) — vd kết quả Google Places
  // cách xa polyline. Merge nó vào mảng truyền xuống map để nó luôn là THÀNH
  // VIÊN hợp lệ của `suggestions`, tránh guard tự đóng popup của RouteDesignMap
  // (guard đóng popup khi gợi ý đang mở "không còn trong danh sách"). Dedupe
  // theo kind+id — tránh chấm trùng nếu picked cũng đã có sẵn trong nearby.
  const suggestions = useMemo(() => {
    if (
      !pickedSuggestion ||
      nearbySuggestions.some(
        (suggestion) =>
          suggestion.kind === pickedSuggestion.kind &&
          suggestion.id === pickedSuggestion.id,
      )
    ) {
      return nearbySuggestions;
    }

    return [...nearbySuggestions, pickedSuggestion];
  }, [nearbySuggestions, pickedSuggestion]);
  // Map-first (phụ lục spec 2026-08-07): tuyến thay thế đang soạn dùng CHÍNH
  // máy geometry như tab Thông tin, cache key riêng `alt:<id|draft>` — chỉ
  // auto-fetch/cho sửa khi đang ở tab Tuyến thay thế (và không đang tải chi
  // tiết tuyến vừa chọn, cùng lý do gate isRouteWorkspaceTab ở geometry bên trên).
  const alternatives = useAlternativeRouteWorkspace({
    selectedRouteId,
    originStationId: routeForm.originStationId,
    mainDestinationStationId: routeForm.destinationStationId,
    // Polyline tuyến chính (đúng referencePath vẽ mờ ở tab Tuyến thay thế) —
    // để lọc phương án Google trùng tuyến chính khỏi bộ phương án thay thế
    mainRoutePathPoints: geometry.routePathPoints,
    stations,
    stops,
    isWorkspaceActive: activeTab === "alternatives" && !isLoadingRouteDetail,
    canManageRoutes,
    toastError: toast.error,
    toastSuccess: toast.success,
    t,
    onStopCreated: (stop) => setStops((prev) => [stop, ...prev]),
  });
  const stationManager = useStationManagement({
    stations,
    setStations,
    // Lỗi validation của hành động (khi bấm thêm điểm dừng/tuyến thay thế/bến...)
    // trước đây hiện qua banner đầu màn — giờ báo qua toast (không có ô inline
    // riêng cho các lỗi này).
    setError: toast.error,
    showMessage,
    t,
  });
  const stopFormControl = useStopForm({
    setSelectedStopId,
    setStops,
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

    try {
      const [routeItems, stopItems, stationItems, locationResult] =
        await Promise.all([
          fetchAllPages((params) => getOperatorRoutes(params)),
          fetchAllPages((params) => getOperatorStops(params)),
          fetchAllPages((params) => getOperatorStations(params)),
          getPublicLocations(),
        ]);
      // Ghi đè cache bằng danh sách mới nhất — kể cả khi phiên này thành stale
      // (user vừa chọn tuyến khác) thì dữ liệu server vẫn tươi, cache dùng được
      writeSessionCache<OperatorRoute[]>(cacheKey, routeItems);
      const nextRouteSummary =
        routeItems.find(
          (item) => item.id === selectedRouteIdRef.current,
        ) ?? routeItems[0];
      const nextRoute = nextRouteSummary
        ? await getOperatorRoute(nextRouteSummary.id)
        : undefined;
      const alternativeResult = nextRoute
        ? await getAlternativeRoutes(nextRoute.id, { page: 1, pageSize: 100 })
        : undefined;
      const nextStop =
        stopItems.find((item) => item.id === selectedStopIdRef.current) ??
        stopItems[0];

      // User đã chọn tuyến khác trong lúc refresh → bỏ qua toàn bộ kết quả phiên này
      if (seq !== selectRouteSeqRef.current) {
        return;
      }

      setRoutes(
        nextRoute
          ? routeItems.map((route) =>
              route.id === nextRoute.id ? nextRoute : route,
            )
          : routeItems,
      );
      setStops(stopItems);
      setStations(
        mergeStations([], stationItems.map(toStationOption)).filter(
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
        toast.error(
          err instanceof Error ? err.message : tRef.current("routes.loadFailed"),
        );
      }
    } finally {
      setIsLoadingRoutes(false);
      // loadData và handleSelectRoute dùng chung selectRouteSeqRef để chống stale
      // response. Nếu deep-link (?routeId=) tự chọn tuyến NGAY khi mount (routes đã
      // có sẵn từ sessionCache ở lần render đầu) thì handleSelectRoute có thể bump
      // seq và set isLoadingRouteDetail=true TRƯỚC KHI loadData (chạy qua
      // queueMicrotask) bump seq lần nữa — response của handleSelectRoute về sau
      // thấy seq lệch nên bỏ qua luôn nhánh finally clear cờ, làm pill "Đang tải
      // chi tiết tuyến…" kẹt mãi. Phiên loadData hiện hành (seq vẫn khớp — không
      // ai chọn tuyến khác muộn hơn) đã tự tải xong chi tiết tuyến đang chọn nên
      // có trách nhiệm nhận lại việc clear cờ này.
      if (seq === selectRouteSeqRef.current) {
        setIsLoadingRouteDetail(false);
      }
    }
  }, [
    applyAlternatives,
    applySavedGeometry,
    cacheKey,
    setStopForm,
    syncRouteStopsFromServer,
    // toast API là object memo hoá ổn định — không làm effect refetch
    toast,
  ]);

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

  // Đóng popup gợi ý đang chọn (pickedSuggestion) khi đổi tuyến hoặc rời tab
  // Điểm dừng — tránh gợi ý cũ còn treo trên tuyến/tab khác (isSuggestMode giờ
  // là giá trị derive từ activeTab nên tự tắt theo tab, không cần reset ở đây).
  // Đồng bộ NGAY TRONG RENDER (không phải useEffect) theo pattern đã dùng ở
  // RouteDesignMap — setState trong effect bị lint react-hooks/set-state-in-effect chặn.
  const suggestModeResetKey = `${selectedRouteId}|${activeTab}`;
  const [prevSuggestModeResetKey, setPrevSuggestModeResetKey] = useState(
    suggestModeResetKey,
  );
  if (suggestModeResetKey !== prevSuggestModeResetKey) {
    setPrevSuggestModeResetKey(suggestModeResetKey);
    setPickedSuggestion(null);
  }

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
        // requestRoadGeometry trả mảng phương án — auto-fill lấy phương án đầu
        // (đề xuất chính của Google); các phương án khác do hook geometry tự
        // fetch và vẽ lên bản đồ, bấm đường/bubble để đổi
        const [firstOption] = await requestRoadGeometry(
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

        applyComputedGeometryRef.current(firstOption.points);
        applyMetrics(
          firstOption.totalDistanceKm,
          firstOption.estimatedDurationMinutes,
        );
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
    // Dọn feedback inline (station/alternative/routeStop) của thao tác trước —
    // lỗi/kết quả của thao tác này giờ báo qua toast (xem catch bên dưới).
    setMessage("");
    setDuplicateRouteId("");
    void action().catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : t("routes.actionFailed"));
    });
  }

  function showMessage(scope: FeedbackScope, nextMessage: string) {
    setMessageScope(scope);
    setMessage(nextMessage);
    toast.success(nextMessage);
  }

  // Kết quả chọn từ ô tìm gộp trong panel: tính lại distanceFromStartKm theo
  // polyline đang hiển thị (chiếu điểm lên đường đi) rồi mở popup xác nhận trên
  // map — object mới mỗi lần chọn để re-trigger effect đồng bộ activeSuggestion.
  // m-B: tuyến chưa có polyline (< 2 điểm, vd đang tạo tuyến mới chưa tính
  // đường) → fallback đường chim bay từ bến đi (giống addStopFromSuggestion),
  // KHÔNG giữ nguyên result.distanceFromStartKm (luôn là 0 từ StopSearchBox) —
  // để popup không in "0.0 km" sai với số sẽ lưu.
  function handlePickSearchResult(result: StopSuggestion) {
    const pathPoints = geometry.routePathPoints;
    let distanceFromStartKm: number;
    if (pathPoints.length >= 2) {
      distanceFromStartKm = projectPointOntoPolyline(
        pathPoints,
        result,
      ).distanceFromStartKm;
    } else if (
      selectedOriginStation?.latitude &&
      selectedOriginStation?.longitude
    ) {
      distanceFromStartKm = distanceKmBetween(selectedOriginStation, result);
    } else {
      distanceFromStartKm = result.distanceFromStartKm;
    }

    setPickedSuggestion({ ...result, distanceFromStartKm });
  }

  // Thêm gợi ý vào tuyến (popup trên map hoặc từ ô tìm kiếm) — dùng đúng wrapper
  // runAction/showMessage của màn để lỗi/thông báo hiển thị nhất quán
  function handleAddSuggestion(
    suggestion: StopSuggestion,
    options: { allowPickup: boolean; allowDropoff: boolean },
  ) {
    // Điểm mới từ Google phải xác nhận phường/xã trước khi tạo Stop — BE không
    // cho đổi Location sau khi tạo nên không được đoán ngầm.
    if (suggestion.kind === "googlePlace") {
      setPendingWardSuggestion({
        suggestion,
        confirm: (locationId) =>
          addSuggestionWithWard(suggestion, options, locationId),
      });
      return;
    }

    void addSuggestionWithWard(suggestion, options);
  }

  function addSuggestionWithWard(
    suggestion: StopSuggestion,
    options: { allowPickup: boolean; allowDropoff: boolean },
    locationId?: string,
  ) {
    setIsAddingSuggestion(true);
    runAction(async () => {
      try {
        await stopEditor.addStopFromSuggestion(suggestion, options, locationId);
        // F-2: dọn chấm gợi ý từ ô search sau khi thêm thành công — nếu không,
        // chấm cũ (trùng vị trí stop vừa gắn) vẫn còn trong `suggestions` (merge
        // ở trên), bấm lại sẽ báo lỗi duplicate.
        setPickedSuggestion(null);
        setPendingWardSuggestion(null);
      } finally {
        setIsAddingSuggestion(false);
      }
    });
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
        toast.error(t("routes.stationsLockedHint"));
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
      // Bỏ trắng ô mã thì `routeCodePayload` không đính field `code` vào request
      // — gửi `""` là ý định xoá mã và BE trả 422.
      ...routeCodePayload(basics.code),
      name: basics.name,
      originStationId: basics.originStationId,
      destinationStationId: basics.destinationStationId,
      returnRouteId: basics.returnRouteId || null,
      baseFare: basics.baseFare,
      isActive: true,
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
    // Auto-select tuyến mới, về tab gộp (mặc định) — điểm dừng bổ sung ngay
    // trong panel nổi của khung bản đồ
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        next.set("routeId", created.id);
        next.delete("tab");

        return next;
      },
      { replace: true },
    );
    toast.success(t("routes.routeCreated"));
  }

  async function handleSelectRoute(routeId: string) {
    // Chụp seq phiên chọn hiện tại — nếu user chọn tuyến khác trong lúc chờ
    // backend (spike 3-10s) thì response phiên này bị bỏ qua ở các check bên dưới
    const seq = ++selectRouteSeqRef.current;
    setSelectedRouteId(routeId);
    // Đổi tuyến → reset trạng thái auto-fill + cờ "chưa lưu" của tuyến trước
    autoCalcAttemptedPairRef.current = "";
    setAutoMetricsFallback(false);
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
        getAlternativeRoutes(routeId, { page: 1, pageSize: 100 }),
      ]);

      // Trong lúc chờ user đã chọn tuyến khác → bỏ qua response cũ,
      // không đè form/alternatives/geometry của tuyến đang chọn
      if (seq !== selectRouteSeqRef.current) {
        return;
      }

      applyAlternatives(alternativeResult.items);
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
      toast.error(t("routes.selectRouteFirst"));
      return;
    }

    if (!routeForm.name.trim()) {
      toast.error(t("routes.routeNameRequired"));
      return;
    }

    const stops = draftsToFullStops(stopEditor.currentRouteStops);

    if (stops.some((stop) => !stop.allowPickup && !stop.allowDropoff)) {
      toast.error(t("routes.stopNeedsPickupOrDropoff"));
      return;
    }

    const hasPolyline = geometry.routePathPoints.length >= 2;
    if (hasPolyline && geometry.isGeometryDirty) {
      const mismatches = findRouteGeometryWaypointMismatches(
        geometry.routePathPoints,
        routeMapPoints,
      );
      if (mismatches.length > 0) {
        toast.error(t("routes.routeGeometryWaypointMismatch"));
        return;
      }
    }
    // Chụp seq (không tăng): nếu user chọn tuyến khác trong lúc lưu thì response
    // save không được đè form của tuyến mới — chỉ cập nhật list + báo đã lưu
    const seq = selectRouteSeqRef.current;
    setRouteCodeError("");

    // Chặn format sai ngay ở FE: BE trả 422 thì cũng chỉ ra đúng thông báo này.
    if (
      (routeForm.code ?? "").trim() &&
      !isValidRouteCode(routeForm.code ?? "")
    ) {
      setRouteCodeError(t("routes.routeCodeInvalid"));
      return;
    }

    setIsSavingRoute(true);

    try {
      const saved = await updateOperatorRouteFull(selectedRouteId, {
        // Ô mã để trống = giữ nguyên mã hiện tại, nên field bị bỏ hẳn khỏi
        // request. BE không nhận `""`/`null` để xoá mã.
        ...routeCodePayload(routeForm.code ?? ""),
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
      }

      toast.success(t("routes.routeSaved"));
    } catch (err) {
      // Lỗi của riêng ô mã tuyến: gắn vào field, KHÔNG ném tiếp lên toast chung
      // vì người dùng cần thấy ô nào sai chứ không phải một banner đỏ ở đầu màn.
      if (
        err instanceof ApiRequestError &&
        err.code === "ROUTE_CODE_DUPLICATED"
      ) {
        setRouteCodeError(t("routes.routeCodeDuplicated"));
        return;
      }

      const codeFieldError =
        err instanceof ApiRequestError
          ? err.fields?.find((field) => field.field === "code")
          : undefined;
      if (codeFieldError) {
        setRouteCodeError(codeFieldError.message || t("routes.routeCodeInvalid"));
        return;
      }

      // 409 ROUTE_DUPLICATED (vd đổi tên trùng tuyến khác) → giữ banner tại chỗ
      // với nút mở tuyến cũ (toast không hỗ trợ nút hành động); message lỗi vẫn
      // báo qua toast ở catch chung của runAction (xem throw err bên dưới).
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
          disabled={isLoadingRoutes}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw size={16} className={isLoadingRoutes ? "animate-spin" : ""} />
          {tc("refresh")}
        </button>
      </div>

      {/* 409 ROUTE_DUPLICATED khi lưu tuyến (đổi tên trùng tuyến khác) — giữ banner
          tại chỗ (không chuyển toast) vì cần nút hành động "mở tuyến đã có" đứng
          yên cho tới khi user bấm; message lỗi tương ứng đã báo qua toast ở
          runAction (xem handleSaveRoute). */}
      {duplicateRouteId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{t("routes.duplicateRoute")}</p>
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
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <RouteListSidebar
          routes={routes}
          isLoading={isLoadingRoutes && routes.length === 0}
          selectedRouteId={selectedRouteId}
          canManageRoutes={canManageRoutes}
          onSelectRoute={(routeId) =>
            runAction(() => handleSelectRoute(routeId))
          }
          onCreateRoute={() => setIsCreateRouteModalOpen(true)}
        />

        {selectedRoute ? (
          // Không dùng <main>: layout đã có <main> bao ngoài, lồng thêm nữa là
          // hai landmark `main` trên cùng một trang.
          <div className="min-w-0">
            <RouteDetailHeader
              routeName={selectedRoute.name}
              activeTab={activeTab}
              onSelectTab={selectTab}
              onOpenStationManagement={() => setIsStationModalOpen(true)}
              canManageRoutes={canManageRoutes}
              isDirty={isRouteDirty || geometry.isGeometryDirty}
              isSaving={isSavingRoute}
              onSaveRoute={() => runAction(handleSaveRoute)}
              // Tab "Tuyến thay thế" lưu một bản ghi khác, nhưng nút lưu phải
              // đứng cùng chỗ với hai tab kia
              isAlternativeDirty={
                alternatives.isAltDirty ||
                alternatives.altGeometry.isGeometryDirty
              }
              isSavingAlternative={alternatives.isSavingAlternative}
              onSaveAlternative={() =>
                void alternatives.handleSaveAlternative()
              }
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

              {(activeTab === "info" || activeTab === "stops") && (
                <RouteMapWorkspace
                  panelMode={activeTab}
                  canManageRoutes={canManageRoutes}
                  routes={routes}
                  stations={stations}
                          selectedRouteId={selectedRouteId}
                  routeForm={routeForm}
            routeCodeError={routeCodeError}
            onRouteCodeErrorClear={() => setRouteCodeError("")}
                  onUpdateField={updateRoute}
                  routeFeedbackMessage={messageScope === "route" ? message : ""}
                  isAutoCalculatingMetrics={isAutoCalculatingMetrics}
                  autoMetricsFallback={autoMetricsFallback}
                  geometry={geometry}
                  routeMapPoints={routeMapPoints}
                  stops={stops}
                  selectedStopId={selectedStopId}
                  onSelectStop={(stopId) =>
                    runAction(() => stopFormControl.handleSelectStop(stopId))
                  }
                  stopEditor={stopEditor}
                  suggestions={suggestions}
                  onAddSuggestion={handleAddSuggestion}
                  isAddingSuggestion={isAddingSuggestion}
                  pickedSuggestion={pickedSuggestion}
                  onPickSearchResult={handlePickSearchResult}
                  isLoadingSuggestions={
                    isSuggestMode &&
                    (isLoadingPlaces || geometry.routePathPoints.length < 2)
                  }
                  suggestionCount={suggestions.length}
                  canRequestPlaces={
                    canRequestPlaces && geometry.routePathPoints.length >= 2
                  }
                  onRequestPlaces={requestPlaces}
                  routeStopFeedbackMessage={
                    messageScope === "routeStop" ? message : ""
                  }
                />
              )}

              {activeTab === "alternatives" && (
                <AlternativeRouteWorkspace
                  onRequestWardConfirm={(suggestion, add) =>
                    setPendingWardSuggestion({
                      suggestion,
                      confirm: (locationId) => {
                        add(locationId);
                        setPendingWardSuggestion(null);
                      },
                    })
                  }
                  canManageRoutes={canManageRoutes}
                  hasSelectedRoute={Boolean(selectedRouteId)}
                  stations={stations}
                          stops={stops}
                  workspace={alternatives}
                  referencePath={geometry.routePathPoints}
                  referenceStops={stopEditor.currentRouteStops}
                />
              )}
            </div>
          </div>
        ) : isLoadingRoutes ? (
          // Đang tải lần đầu mà chưa có tuyến để hiển thị → skeleton panel phải,
          // không hiện empty-state "chưa chọn tuyến" gây hiểu nhầm không có dữ liệu
          <RouteDetailSkeleton />
        ) : (
          <RouteEmptyState
            canManageRoutes={canManageRoutes}
            onCreateRoute={() => setIsCreateRouteModalOpen(true)}
            onOpenStationManagement={() => setIsStationModalOpen(true)}
          />
        )}
      </div>

      <StopWardConfirmModal
        // Remount theo gợi ý: state khởi tạo lại từ địa chỉ mới, không cần effect reset
        key={pendingWardSuggestion?.suggestion.id ?? "none"}
        suggestion={pendingWardSuggestion?.suggestion ?? null}
        provinces={locations}
        isSubmitting={isAddingSuggestion || alternatives.isAddingAltSuggestion}
        onCancel={() => setPendingWardSuggestion(null)}
        onConfirm={(locationId) => pendingWardSuggestion?.confirm(locationId)}
      />

      <StationManagementModal
        open={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
        canManageRoutes={canManageRoutes}
        locations={locations}
        manager={stationManager}
        onRunAction={runAction}
      />

      <CreateRouteModal
        open={isCreateRouteModalOpen}
        onClose={() => setIsCreateRouteModalOpen(false)}
        routes={routes}
        stations={stations}
        onSubmit={handleCreateRoute}
        onOpenExistingRoute={(routeId) => {
          setIsCreateRouteModalOpen(false);
          runAction(() => handleSelectRoute(routeId));
        }}
      />

      <RemoveRouteStopModal
        item={stopEditor.routeStopPendingRemoval}
        onClose={() => stopEditor.setRouteStopPendingRemoval(null)}
        onConfirm={(item) =>
          runAction(() => stopEditor.handleRemoveRouteStop(item))
        }
      />

      <RemoveAlternativeRouteModal
        item={alternatives.pendingDeleteAlternative}
        onClose={() => alternatives.setPendingDeleteAlternative(null)}
        onConfirm={(item) =>
          void alternatives.handleDeleteAlternativeRoute(item)
        }
        busy={alternatives.isDeletingAlternative}
      />

      <RemoveAlternativeStopModal
        item={alternatives.pendingRemoveAltStop}
        onClose={() => alternatives.setPendingRemoveAltStop(null)}
        onConfirm={(item) => alternatives.confirmRemoveAltStop(item)}
      />
    </div>
  );
}
