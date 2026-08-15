// Hook cục bộ: tab "Tuyến thay thế" map-first (phụ lục spec 2026-08-07) — thay
// hoàn toàn form nhập tay km/phút/stop cũ. Tuyến thay thế đang soạn dùng CHÍNH
// máy geometry (useRouteGeometry) như tab Thông tin — cache key riêng
// `alt:<id|draft>` — nên user chọn phương án/kéo nắn y hệt, chỉ khác màu vẽ
// (cam #f59e0b, xem RouteDesignMap activeColor) và tuyến chính vẽ mờ làm nền
// (referencePath). Metrics + orderIndex của stop tự tính từ polyline, không
// còn ô nhập tay (xem addAltStopFromSuggestion).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  createAlternativeRoute,
  createOperatorStop,
  deleteAlternativeRoute,
  setAlternativeRouteActive,
  updateAlternativeRoute,
  updateAlternativeRouteGeometry,
  type AlternativeRoute,
  type AlternativeRouteRequest,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStop,
} from "../../../api/vietride";
import {
  distanceKmBetween,
  findRouteGeometryWaypointMismatches,
} from "./geometry";
import {
  encodeGooglePolyline,
  estimateCoachDurationMinutes,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";
import { emptyRouteForm } from "./routeFormUtils";
import { useRouteGeometry } from "./useRouteGeometry";
import { useRouteStopSuggestions } from "./useRouteStopSuggestions";
import type {
  AlternativeStopDraft,
  RouteMapPoint,
  StationOption,
  StopSuggestion,
  TranslateFn,
} from "./types";

// Khoá cache geometry/suggestions riêng cho tuyến thay thế đang soạn. Có id
// (đã tạo/đang sửa) → khoá theo id, ổn định như tuyến chính. CHƯA có id (đang
// soạn nháp — tạo mới hoặc vừa lưu geometry lỗi giữ nguyên nháp, xem
// pendingAlternativeIdRef) → PHẢI gồm cả selectedRouteId + destinationStationId
// đang chọn: soạn nháp alt của tuyến A rồi qua tuyến B soạn nháp alt khác mà
// dùng chung khoá "alt:draft" tĩnh sẽ HIT cache Google Places của hành lang
// tuyến A (đã lọc theo polyline tuyến A, hầu như luôn ngoài bán kính 1km của
// polyline tuyến B) → suggestions rỗng vĩnh viễn tới khi F5 (bug đã phát hiện
// qua review). Đổi destinationStationId cũng phải đổi khoá vì polyline nháp
// đổi hẳn theo bến đến mới.
function alternativeGeometryKey(params: {
  alternativeRouteId: string;
  selectedRouteId: string;
  destinationStationId: string;
}) {
  const { alternativeRouteId, selectedRouteId, destinationStationId } = params;

  return alternativeRouteId
    ? `alt:${alternativeRouteId}`
    : `alt:draft:${selectedRouteId || "none"}:${destinationStationId || "none"}`;
}

// Form gọn theo spec: chỉ còn tên/mô tả/bến đến thay thế/kích hoạt — km/phút
// bỏ hẳn (tự tính từ polyline, xem altMetrics bên dưới).
export type AlternativeRouteFormState = {
  name: string;
  description: string;
  destinationStationId: string;
  isActive: boolean;
};

const emptyAlternativeFormState: AlternativeRouteFormState = {
  name: "",
  description: "",
  destinationStationId: "",
  isActive: true,
};

const emptyAlternativeMetrics = { totalDistanceKm: 0, estimatedDurationMinutes: 0 };

// Trần 2 tuyến thay thế/tuyến chính là luật app-layer (ERD master mục 15). Đếm
// theo bản ĐANG ÁP DỤNG: bản đã ngưng vẫn nằm trong danh sách (xoá mềm) nhưng
// không được chiếm chỗ, nếu không thì ngưng xong là kẹt vĩnh viễn không tạo
// được bản thay thế mới. BE đã bỏ cap active-count từ v1.55.0 nên đây thuần
// là guard của UI.
const maxActiveAlternatives = 2;

// Re-index toàn bộ stop nháp theo khoá km-từ-bến-đi (giống reindexRouteDrafts
// của tuyến chính, xem useRouteStopEditor.ts) — trả 1..N liên tục.
function reindexAlternativeStops(
  drafts: AlternativeStopDraft[],
): AlternativeStopDraft[] {
  return [...drafts]
    .sort((a, b) => {
      const keyA = a.distanceFromStartKm ?? a.distanceFromOriginKm;
      const keyB = b.distanceFromStartKm ?? b.distanceFromOriginKm;
      return keyA !== keyB ? keyA - keyB : a.orderIndex - b.orderIndex;
    })
    .map((item, index) => ({ ...item, orderIndex: index + 1 }));
}

type UseAlternativeRouteWorkspaceParams = {
  selectedRouteId: string;
  originStationId: string;
  // Bến đến của TUYẾN CHÍNH — nháp tuyến thay thế mới mặc định lấy bến đến này
  // để map hiện ngay các phương án Google (xem effectiveDestinationStationId)
  mainDestinationStationId: string;
  // Polyline tuyến CHÍNH đang hiện hành (đúng referencePath vẽ mờ làm nền) —
  // dùng loại phương án Google trùng tuyến chính khỏi bộ phương án thay thế
  mainRoutePathPoints: RouteCoordinate[];
  stations: StationOption[];
  stops: OperatorStop[];
  // Chỉ auto-fetch phương án đường + cho phép sửa khi đang ở tab Tuyến thay thế
  isWorkspaceActive: boolean;
  canManageRoutes: boolean;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
  t: TranslateFn;
  onStopCreated?: (stop: OperatorStop) => void;
};

export function useAlternativeRouteWorkspace({
  selectedRouteId,
  originStationId,
  mainDestinationStationId,
  mainRoutePathPoints,
  stations,
  stops,
  isWorkspaceActive,
  canManageRoutes,
  toastError,
  toastSuccess,
  t,
  onStopCreated,
}: UseAlternativeRouteWorkspaceParams) {
  const [alternativeRoutes, setAlternativeRoutes] = useState<AlternativeRoute[]>([]);
  const [selectedAlternativeRouteId, setSelectedAlternativeRouteId] = useState("");
  const [altFormState, setAltFormState] = useState<AlternativeRouteFormState>(
    emptyAlternativeFormState,
  );
  const [altMetrics, setAltMetrics] = useState(emptyAlternativeMetrics);
  const [altStopDrafts, setAltStopDrafts] = useState<AlternativeStopDraft[]>([]);
  const [isAltDirty, setIsAltDirty] = useState(false);
  const [isSavingAlternative, setIsSavingAlternative] = useState(false);
  const [isDeletingAlternative, setIsDeletingAlternative] = useState(false);
  const [pendingDeleteAlternative, setPendingDeleteAlternative] =
    useState<AlternativeRoute | null>(null);

  // Ref giữ `stops` (kho nhà xe) mới nhất — loadAlternativeIntoWorkspace ĐỌC qua
  // ref thay vì nhận trực tiếp: `stops` là mảng MỚI mỗi lần loadData/handleSelectRoute
  // gọi setStops (kể cả cùng nội dung), nếu đưa vào deps của useCallback thì
  // applyAlternatives/resetAlternatives (deps theo loadAlternativeIntoWorkspace)
  // cũng đổi identity theo, kéo theo loadData (deps có applyAlternatives) đổi
  // identity → effect mount `useEffect(() => loadData(), [loadData])` chạy lại
  // → gọi lại getOperatorRoutes vô hạn. Cập nhật ref qua effect (react-compiler
  // eslint chặn ghi ref ngay trong render của custom hook) — vẫn đủ mới cho các
  // handler chỉ đọc ref SAU khi user thao tác (chạy sau commit).
  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  // Ref giữ `selectedRouteId` MỚI NHẤT — handleSaveAlternative/handleDeleteAlternativeRoute
  // chụp selectedRouteId lúc bắt đầu (qua closure của lần render đó) nhưng phải
  // đọc lại qua ref SAU MỖI await để biết user đã đổi tuyến chính hay chưa
  // (pattern selectRouteSeqRef của index.tsx, thu gọn thành so sánh id vì mỗi
  // request chỉ có 1 "phiên" alt-workspace tại một thời điểm). Đổi tuyến giữa
  // chừng → index.tsx tự gọi applyAlternatives/resetAlternatives nạp lại state
  // cho tuyến MỚI; response của request cũ về muộn phải bị bỏ qua, không được
  // ghi đè state đã thuộc về tuyến mới.
  const selectedRouteIdRef = useRef(selectedRouteId);
  useEffect(() => {
    selectedRouteIdRef.current = selectedRouteId;
  }, [selectedRouteId]);

  // Id tuyến thay thế vừa tạo/cập nhật metrics THÀNH CÔNG nhưng bước lưu
  // geometry lỗi (xem nhánh catch trong handleSaveAlternative) — dùng để lần
  // "Lưu" kế tiếp gọi ĐÚNG update thay vì tạo trùng bản ghi, mà KHÔNG đổi
  // selectedAlternativeRouteId (giữ khoá `alt:draft:...` cũ) để tránh máy
  // geometry/suggestions coi đây là một "tuyến" khác rồi fetch lại y hệt dữ
  // liệu vừa có (1 request Routes + 2 request Places lãng phí — nit #4 review).
  const pendingAlternativeIdRef = useRef("");

  // Adapter: useRouteGeometry ghi km/phút vào state kiểu OperatorRouteRequest
  // (form của tuyến chính) — chỉ trích đúng 2 field cần cho altMetrics, các
  // field OperatorRouteRequest khác không dùng tới (fake bằng emptyRouteForm).
  const setGeometryForm = useCallback<Dispatch<SetStateAction<OperatorRouteRequest>>>(
    (updater) => {
      setAltMetrics((current) => {
        const fakeCurrent: OperatorRouteRequest = { ...emptyRouteForm, ...current };
        const next =
          typeof updater === "function"
            ? (updater as (prev: OperatorRouteRequest) => OperatorRouteRequest)(
                fakeCurrent,
              )
            : updater;

        return {
          totalDistanceKm: next.totalDistanceKm,
          estimatedDurationMinutes: next.estimatedDurationMinutes,
        };
      });
    },
    [],
  );
  // useRouteGeometry chỉ dùng setRoutes để null hoá pathPolyline của MỘT route
  // trong danh sách "routes" (tuyến chính) khi invalidate — tuyến thay thế
  // không có danh sách tương ứng nên no-op là đủ, không ảnh hưởng gì.
  const noopSetRoutes = useCallback<Dispatch<SetStateAction<OperatorRoute[]>>>(
    () => {},
    [],
  );

  // Bến đến HIỆU LỰC của form: nháp MỚI chưa chọn bến đến → mặc định bến đến
  // của TUYẾN CHÍNH, để máy geometry có đủ 2 waypoint mà auto-fetch phương án
  // ngay khi mở tab (phương án trùng tuyến chính đã bị lọc — chỉ còn các đường
  // phụ thật sự, admin bấm chọn một đường rồi Lưu). Là GIÁ TRỊ DẪN XUẤT chứ
  // không ghi vào state (setState trong effect bị react-compiler lint chặn, và
  // prefill lúc loadAlternativeIntoWorkspace thì dính closure route CŨ — hàm đó
  // bị gọi đồng bộ trong handler chọn tuyến của index.tsx trước khi routeForm
  // mới commit). KHÔNG bật dirty — mặc định chưa phải thao tác của user; user
  // đổi bến khác qua dropdown thì field state hết rỗng, fallback hết hiệu lực.
  const effectiveDestinationStationId =
    altFormState.destinationStationId ||
    (selectedAlternativeRouteId ? "" : mainDestinationStationId);

  // Shape công khai của form — mọi nơi đọc destinationStationId (panel select,
  // waypoint, khoá cache, payload lưu) đều thấy bến đến hiệu lực.
  const altForm = useMemo<AlternativeRouteFormState>(
    () => ({
      ...altFormState,
      destinationStationId: effectiveDestinationStationId,
    }),
    [altFormState, effectiveDestinationStationId],
  );

  // Bản đang mở trong form (nếu là bản đã lưu) + số bản còn áp dụng — panel cần
  // cả hai để biết hiện nút "Ngưng áp dụng" hay "Khôi phục", và còn chỗ trống không.
  const selectedAlternative = useMemo(
    () =>
      alternativeRoutes.find((item) => item.id === selectedAlternativeRouteId) ??
      null,
    [alternativeRoutes, selectedAlternativeRouteId],
  );
  const activeAlternativeCount = useMemo(
    () => alternativeRoutes.filter((item) => item.isActive).length,
    [alternativeRoutes],
  );

  const originStation = useMemo(
    () => stations.find((station) => station.id === originStationId),
    [stations, originStationId],
  );
  const altDestinationStation = useMemo(
    () => stations.find((station) => station.id === altForm.destinationStationId),
    [stations, altForm.destinationStationId],
  );

  // Điểm hiển thị trên map cho tuyến thay thế đang soạn: bến đi (chung với
  // tuyến chính) → stop nháp → bến đến thay thế — cùng cấu trúc RouteMapPoint
  // như useRouteMapPoints nhưng tách riêng vì nguồn dữ liệu khác (altStopDrafts).
  const altMapPoints = useMemo<RouteMapPoint[]>(
    () =>
      [
        originStation
          ? {
              id: `origin-${originStation.id}`,
              name: `${t("routes.origin")}: ${originStation.name}`,
              latitude: originStation.latitude,
              longitude: originStation.longitude,
              color: "#0f766e",
            }
          : null,
        ...altStopDrafts.map((stop) => ({
          id: `alt-stop-${stop.stopId}-${stop.orderIndex}`,
          name: `#${stop.orderIndex} · ${stop.stopName}`,
          latitude: stop.latitude,
          longitude: stop.longitude,
          color: "#f59e0b",
        })),
        altDestinationStation
          ? {
              id: `alt-destination-${altDestinationStation.id}`,
              name: `${t("routes.alternativeDestination")}: ${altDestinationStation.name}`,
              latitude: altDestinationStation.latitude,
              longitude: altDestinationStation.longitude,
              color: "#dc2626",
            }
          : null,
      ].filter((point): point is RouteMapPoint => Boolean(point)),
    [altDestinationStation, altStopDrafts, originStation, t],
  );

  const altWaypoints = useMemo<RouteCoordinate[]>(
    () =>
      altMapPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [altMapPoints],
  );

  const altGeometryKey = alternativeGeometryKey({
    alternativeRouteId: selectedAlternativeRouteId,
    selectedRouteId,
    destinationStationId: altForm.destinationStationId,
  });
  const altGeometry = useRouteGeometry({
    selectedRouteId: altGeometryKey,
    routeWaypoints: altWaypoints,
    // Phương án Google trùng tuyến chính bị lọc khỏi bộ phương án — tuyến
    // "thay thế" phải khác đường tuyến chính đang hiện hành
    excludedPathPoints: mainRoutePathPoints,
    isWorkspaceActive:
      isWorkspaceActive &&
      canManageRoutes &&
      Boolean(originStation) &&
      Boolean(altDestinationStation),
    setRouteForm: setGeometryForm,
    setRoutes: noopSetRoutes,
    setError: toastError,
    t,
  });

  // Gợi ý điểm dừng (kho nhà xe/Google) dọc polyline TUYẾN THAY THẾ đang soạn —
  // cùng máy với tab Điểm dừng của tuyến chính (useRouteStopSuggestions), cache
  // riêng theo altGeometryKey nên không đụng cache của tuyến chính/tuyến thay
  // thế còn lại.
  const { suggestions: altNearbySuggestions, isLoadingPlaces: isLoadingAltPlaces } =
    useRouteStopSuggestions({
      enabled: isWorkspaceActive && canManageRoutes,
      routeKey: altGeometryKey,
      pathPoints: altGeometry.routePathPoints,
      stops,
      currentRouteStops: altStopDrafts,
    });

  // Gợi ý chọn từ ô search (pickedAltSuggestion) không nhất thiết nằm trong
  // altNearbySuggestions (chỉ gồm chấm ≤ ngưỡng dọc tuyến) — merge để luôn là
  // thành viên hợp lệ của mảng truyền xuống map, giống suggestions của tuyến chính.
  const [pickedAltSuggestion, setPickedAltSuggestion] =
    useState<StopSuggestion | null>(null);
  const altSuggestions = useMemo(() => {
    if (
      !pickedAltSuggestion ||
      altNearbySuggestions.some(
        (suggestion) =>
          suggestion.kind === pickedAltSuggestion.kind &&
          suggestion.id === pickedAltSuggestion.id,
      )
    ) {
      return altNearbySuggestions;
    }

    return [...altNearbySuggestions, pickedAltSuggestion];
  }, [altNearbySuggestions, pickedAltSuggestion]);
  const isLoadingAltSuggestions =
    isWorkspaceActive &&
    canManageRoutes &&
    (isLoadingAltPlaces || altGeometry.routePathPoints.length < 2);

  // Kết quả chọn từ ô tìm gộp trong panel: tính lại distanceFromStartKm theo
  // polyline TUYẾN THAY THẾ đang hiển thị rồi mở popup xác nhận trên map —
  // cùng logic handlePickSearchResult của tuyến chính (xem index.tsx).
  function handlePickAltSearchResult(result: StopSuggestion) {
    const pathPoints = altGeometry.routePathPoints;
    let distanceFromStartKm: number;
    if (pathPoints.length >= 2) {
      distanceFromStartKm = projectPointOntoPolyline(
        pathPoints,
        result,
      ).distanceFromStartKm;
    } else if (originStation) {
      distanceFromStartKm = distanceKmBetween(originStation, result);
    } else {
      distanceFromStartKm = result.distanceFromStartKm;
    }

    setPickedAltSuggestion({ ...result, distanceFromStartKm });
  }

  // Nạp một tuyến thay thế (hoặc null = tuyến nháp mới) vào toàn bộ state soạn
  // thảo: form gọn, metrics đã lưu, danh sách stop (resolve tên/tọa độ qua kho
  // `stops`), và polyline đã lưu (nếu có) qua máy geometry dùng chung.
  const loadAlternativeIntoWorkspace = useCallback(
    (alternative: AlternativeRoute | null) => {
      setSelectedAlternativeRouteId(alternative?.id ?? "");
      setAltFormState(
        alternative
          ? {
              name: alternative.name,
              description: alternative.description ?? "",
              destinationStationId: alternative.destinationStationId,
              isActive: alternative.isActive,
            }
          : emptyAlternativeFormState,
      );
      setAltMetrics(
        alternative
          ? {
              totalDistanceKm: alternative.totalDistanceKm,
              estimatedDurationMinutes: alternative.estimatedDurationMinutes,
            }
          : emptyAlternativeMetrics,
      );
      setAltStopDrafts(
        alternative
          ? reindexAlternativeStops(
              alternative.stops.map((stop) => {
                const catalogStop = stopsRef.current.find(
                  (item) => item.id === stop.stopId,
                );

                return {
                  stopId: stop.stopId,
                  orderIndex: stop.orderIndex,
                  estimatedDurationFromOriginMinutes:
                    stop.estimatedDurationFromOriginMinutes,
                  distanceFromOriginKm: stop.distanceFromOriginKm,
                  stopName: catalogStop?.name ?? stop.stopId,
                  latitude: catalogStop?.latitude ?? 0,
                  longitude: catalogStop?.longitude ?? 0,
                };
              }),
            )
          : [],
      );
      altGeometry.applySavedGeometry(alternative);
      setIsAltDirty(false);
      // Nạp lại state đầy đủ (chọn khác/tạo mới/save+geometry thành công) →
      // "id đang chờ" (nếu có, từ lần lưu geometry lỗi trước) hết hiệu lực.
      pendingAlternativeIdRef.current = "";
    },
    // altGeometry.applySavedGeometry đổi identity mỗi render, và `stops` đọc
    // qua stopsRef (xem giải thích ở chỗ khai báo ref) — không đưa vào deps để
    // loadAlternativeIntoWorkspace/applyAlternatives/resetAlternatives giữ
    // identity ổn định qua mọi render (tránh vòng lặp gọi lại loadData ở index.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Đồng bộ danh sách sau khi load tuyến chính (loadData/handleSelectRoute) —
  // identity ổn định để những nơi gọi phụ thuộc được (giống applyAlternatives cũ).
  const applyAlternatives = useCallback(
    (items: AlternativeRoute[]) => {
      setAlternativeRoutes(items);
      loadAlternativeIntoWorkspace(items[0] ?? null);
    },
    [loadAlternativeIntoWorkspace],
  );

  const resetAlternatives = useCallback(() => {
    setAlternativeRoutes([]);
    loadAlternativeIntoWorkspace(null);
  }, [loadAlternativeIntoWorkspace]);

  function startNewAlternative() {
    loadAlternativeIntoWorkspace(null);
  }

  function handleSelectAlternativeRoute(alternativeRouteId: string) {
    const alternative =
      alternativeRoutes.find((item) => item.id === alternativeRouteId) ?? null;
    loadAlternativeIntoWorkspace(alternative);
  }

  function updateAltField<K extends keyof AlternativeRouteFormState>(
    key: K,
    value: AlternativeRouteFormState[K],
  ) {
    if (key === "destinationStationId" && altForm.destinationStationId !== value) {
      // Đổi bến đến thay thế → đường đã áp không còn khớp, dọn để máy geometry
      // tự tính lại theo waypoint mới (giống updateRoute của tuyến chính)
      altGeometry.invalidateLocalGeometry(altGeometryKey);
    }

    setIsAltDirty(true);
    setAltFormState((current) => ({ ...current, [key]: value }));
  }

  function toggleAlternativeActive(isActive: boolean) {
    setIsAltDirty(true);
    setAltFormState((current) => ({ ...current, isActive }));
  }

  // Đang chờ addAltStopFromSuggestion (tạo stop mới + thêm vào tuyến thay thế)
  // — khoá nút "Thêm vào tuyến" trong popup tránh double-submit, giống isAddingSuggestion
  // của tuyến chính.
  const [isAddingAltSuggestion, setIsAddingAltSuggestion] = useState(false);

  // Thêm stop từ chấm gợi ý/search chiếu theo polyline TUYẾN THAY THẾ đang soạn
  // (không phải tuyến chính) — cùng cơ chế addStopFromSuggestion của tuyến
  // chính nhưng không có allowPickup/allowDropoff (AlternativeRouteRequest.stops
  // không có 2 field này). Tự bọc try/catch báo toast — panel gọi thẳng không
  // cần wrapper runAction như tuyến chính.
  async function addAltStopFromSuggestion(
    suggestion: StopSuggestion,
    locationId?: string,
  ) {
    setIsAddingAltSuggestion(true);
    try {
      const isOperatorStopSuggestion = suggestion.kind === "operatorStop";
      const duplicateStop = isOperatorStopSuggestion
        ? altStopDrafts.some((item) => item.stopId === suggestion.id)
        : Boolean(suggestion.googlePlaceId) &&
          altStopDrafts.some(
            (item) => item.googlePlaceId === suggestion.googlePlaceId,
          );

      if (duplicateStop) {
        toastError(t("routes.duplicateStopInRoute"));
        return;
      }

      let stopId = suggestion.id;
      let stopName = suggestion.name;
      let latitude = suggestion.latitude;
      let longitude = suggestion.longitude;

      if (suggestion.kind === "googlePlace") {
        // Xem comment trong useRouteStopEditor: phường/xã bắt buộc và bất biến
        if (!locationId) {
          toastError(t("routes.stopWardRequired"));
          return;
        }

        const createdStop = await createOperatorStop({
          name: suggestion.name,
          address: suggestion.address,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          googlePlaceId: suggestion.googlePlaceId,
          description: "",
          locationId,
        });

        stopId = createdStop.id;
        stopName = createdStop.name;
        latitude = createdStop.latitude;
        longitude = createdStop.longitude;
        onStopCreated?.(createdStop);
      }

      const pathPoints = altGeometry.routePathPoints;
      let distanceFromStartKm: number;
      if (pathPoints.length >= 2) {
        distanceFromStartKm = projectPointOntoPolyline(pathPoints, {
          latitude,
          longitude,
        }).distanceFromStartKm;
      } else if (originStation) {
        distanceFromStartKm = distanceKmBetween(originStation, {
          latitude,
          longitude,
        });
      } else {
        distanceFromStartKm = 0;
      }

      const durationMinutes = estimateCoachDurationMinutes(distanceFromStartKm);

      setIsAltDirty(true);
      setAltStopDrafts((prev) =>
        reindexAlternativeStops([
          ...prev,
          {
            stopId,
            orderIndex: prev.length + 1,
            estimatedDurationFromOriginMinutes: durationMinutes,
            distanceFromOriginKm: Number(distanceFromStartKm.toFixed(1)),
            stopName,
            latitude,
            longitude,
            distanceFromStartKm,
            googlePlaceId: suggestion.googlePlaceId,
          },
        ]),
      );
      // Dọn chấm gợi ý từ ô search sau khi thêm thành công — tránh chấm cũ
      // (trùng vị trí stop vừa gắn) còn treo trong altSuggestions (merge ở trên).
      setPickedAltSuggestion(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("routes.actionFailed"));
    } finally {
      setIsAddingAltSuggestion(false);
    }
  }

  // Bấm nút gỡ (panel hoặc card marker trên map) — mở modal xác nhận, KHÔNG
  // xoá ngay (nhất quán UX với gỡ stop tuyến chính, xem RemoveRouteStopModal).
  const [pendingRemoveAltStop, setPendingRemoveAltStop] =
    useState<AlternativeStopDraft | null>(null);

  function removeAltStop(stopId: string) {
    const item = altStopDrafts.find((draft) => draft.stopId === stopId);
    if (item) {
      setPendingRemoveAltStop(item);
    }
  }

  function confirmRemoveAltStop(item: AlternativeStopDraft) {
    setIsAltDirty(true);
    setAltStopDrafts((prev) =>
      reindexAlternativeStops(prev.filter((draft) => draft.stopId !== item.stopId)),
    );
    setPendingRemoveAltStop(null);
  }

  // Lưu tuyến thay thế: 2 call tuần tự (create/update metrics+stops rồi PUT
  // geometry) — KHÔNG atomic như /routes/full (đúng spec phụ lục mục 4). Lỗi
  // giữa chừng (bước geometry) vẫn giữ nguyên draft trên UI, chỉ đồng bộ id vừa
  // tạo (qua pendingAlternativeIdRef — KHÔNG đổi selectedAlternativeRouteId,
  // xem giải thích ở chỗ khai báo ref) để lần bấm Lưu sau đi qua nhánh update
  // (không tạo trùng bản ghi).
  async function handleSaveAlternative() {
    if (!selectedRouteId) {
      toastError(t("routes.selectRouteFirst"));
      return;
    }
    if (!altForm.name.trim()) {
      toastError(t("routes.alternativeNameRequired"));
      return;
    }
    if (!altForm.destinationStationId) {
      toastError(t("routes.alternativeDestinationRequired"));
      return;
    }
    if (altForm.destinationStationId === originStationId) {
      toastError(t("routes.alternativeDestinationInvalid"));
      return;
    }
    // Id THẬT của bản ghi sẽ update (nếu có) — ưu tiên selectedAlternativeRouteId
    // (đang mở một alt có sẵn), fallback pendingAlternativeIdRef (vừa tạo mới
    // ở lượt Lưu trước nhưng bước lưu geometry lỗi — xem nhánh catch bên dưới).
    // PHẢI tính TRƯỚC guard giới hạn 0/2: nếu chỉ xét selectedAlternativeRouteId
    // (luôn rỗng ở kịch bản "tạo mới, geometry lỗi") thì retry Lưu sau đó bị
    // guard coi là "tạo thêm 1 alt nữa" trong khi thực ra là update bản ghi
    // vừa tạo — đủ 2/2 sẽ chặn oan, user kẹt vĩnh viễn không lưu lại được
    // (regression phát hiện qua review lần 2).
    const targetAlternativeId =
      selectedAlternativeRouteId || pendingAlternativeIdRef.current;

    if (!targetAlternativeId && activeAlternativeCount >= maxActiveAlternatives) {
      toastError(t("routes.alternativeLimitReached"));
      return;
    }
    if (altGeometry.routePathPoints.length < 2) {
      toastError(t("routes.alternativeGeometryRequired"));
      return;
    }

    const geometryMismatches = altGeometry.isGeometryDirty
      ? findRouteGeometryWaypointMismatches(
          altGeometry.routePathPoints,
          altMapPoints,
        )
      : [];
    if (geometryMismatches.length > 0) {
      toastError(t("routes.routeGeometryWaypointMismatch"));
      return;
    }

    const stopsPayload = [...altStopDrafts]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((draft, index) => ({
        stopId: draft.stopId,
        orderIndex: index + 1,
        estimatedDurationFromOriginMinutes: draft.estimatedDurationFromOriginMinutes,
        distanceFromOriginKm: draft.distanceFromOriginKm,
      }));

    const request: AlternativeRouteRequest = {
      name: altForm.name,
      description: altForm.description,
      destinationStationId: altForm.destinationStationId,
      totalDistanceKm: altMetrics.totalDistanceKm,
      estimatedDurationMinutes: altMetrics.estimatedDurationMinutes,
      isActive: altForm.isActive,
      stops: stopsPayload,
    };
    // Chụp tuyến chính đang chọn LÚC BẤM LƯU — so lại với ref (giá trị mới
    // nhất) sau mỗi await để phát hiện user đã đổi tuyến chính giữa chừng.
    // Đổi tuyến giữa chừng → index.tsx đã tự nạp lại state cho tuyến MỚI (qua
    // applyAlternatives/resetAlternatives); response cũ về muộn phải bị bỏ
    // qua, không được ghi đè state đã thuộc tuyến khác (bug đã phát hiện qua review).
    const requestRouteId = selectedRouteId;
    const pathPolyline = encodeGooglePolyline(altGeometry.routePathPoints);

    setIsSavingAlternative(true);
    try {
      const saved = targetAlternativeId
        ? await updateAlternativeRoute(targetAlternativeId, request)
        : await createAlternativeRoute(selectedRouteId, request);

      if (selectedRouteIdRef.current !== requestRouteId) {
        return;
      }

      try {
        const withGeometry = await updateAlternativeRouteGeometry(saved.id, {
          pathPolyline,
        });

        if (selectedRouteIdRef.current !== requestRouteId) {
          return;
        }

        setAlternativeRoutes((current) =>
          current.some((item) => item.id === withGeometry.id)
            ? current.map((item) =>
                item.id === withGeometry.id ? withGeometry : item,
              )
            : [...current, withGeometry],
        );
        loadAlternativeIntoWorkspace(withGeometry);
        toastSuccess(
          targetAlternativeId
            ? t("routes.alternativeUpdated")
            : t("routes.alternativeCreated"),
        );
      } catch (geometryErr) {
        if (selectedRouteIdRef.current !== requestRouteId) {
          return;
        }

        // Metrics/stops đã lưu nhưng polyline lỗi — GIỮ NGUYÊN draft đang
        // soạn (form/stop/đường trên map/isAltDirty không đổi, KHÔNG gọi
        // loadAlternativeIntoWorkspace). Chỉ đồng bộ id vào pendingAlternativeIdRef
        // (không phải selectedAlternativeRouteId) để altGeometryKey/suggestions
        // giữ nguyên khoá nháp cũ — tránh máy geometry coi đây là "tuyến" khác
        // rồi fetch lại y hệt dữ liệu vừa có (1 request Routes + 2 Places lãng phí).
        setAlternativeRoutes((current) =>
          current.some((item) => item.id === saved.id)
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved],
        );
        pendingAlternativeIdRef.current = saved.id;
        toastError(
          geometryErr instanceof Error
            ? geometryErr.message
            : t("routes.alternativeGeometrySaveFailed"),
        );
      }
    } catch (err) {
      if (selectedRouteIdRef.current !== requestRouteId) {
        return;
      }

      toastError(err instanceof Error ? err.message : t("routes.actionFailed"));
    } finally {
      setIsSavingAlternative(false);
    }
  }

  // DELETE của BE là XOÁ MỀM (DeactivateAlternativeRouteCommand): bản ghi vẫn
  // còn nguyên tên/bến/km/phút/stop/polyline, chỉ hạ isActive=false và GET danh
  // sách vẫn trả về. Vì vậy UI KHÔNG gỡ item khỏi danh sách (làm vậy là nói dối
  // user: F5 phát là nó hiện lại) — chỉ đánh dấu ngưng áp dụng, giữ nguyên
  // đang chọn để bấm "Khôi phục" ngay tại chỗ.
  async function handleDeleteAlternativeRoute(alternative: AlternativeRoute) {
    // Chụp tuyến chính đang chọn lúc bấm xoá — cùng lý do race với handleSaveAlternative
    const requestRouteId = selectedRouteId;

    // Modal đóng ở `finally`, tức là trong lúc request bay người dùng vẫn bấm
    // được nút xoá lần nữa — khoá lại, giống isSavingAlternative.
    if (isDeletingAlternative) return;
    setIsDeletingAlternative(true);
    try {
      await deleteAlternativeRoute(alternative.id);

      if (selectedRouteIdRef.current !== requestRouteId) {
        return;
      }

      const deactivated: AlternativeRoute = { ...alternative, isActive: false };
      setAlternativeRoutes((current) =>
        current.map((item) => (item.id === deactivated.id ? deactivated : item)),
      );
      loadAlternativeIntoWorkspace(deactivated);
      toastSuccess(t("routes.alternativeDeactivated"));
    } catch (err) {
      if (selectedRouteIdRef.current !== requestRouteId) {
        return;
      }

      toastError(err instanceof Error ? err.message : t("routes.actionFailed"));
    } finally {
      setIsDeletingAlternative(false);
      setPendingDeleteAlternative(null);
    }
  }

  // Khôi phục: PATCH partial chỉ có `isActive` — BE giữ nguyên mọi field khác
  // (xem UpdateAlternativeRouteRequest, field vắng mặt = không đụng tới), nên
  // KHÔNG gửi kèm form đang soạn để tránh vô tình ghi đè bản đã lưu.
  async function handleRestoreAlternativeRoute(alternative: AlternativeRoute) {
    const requestRouteId = selectedRouteId;

    setIsSavingAlternative(true);
    try {
      const restored = await setAlternativeRouteActive(alternative.id, true);

      if (selectedRouteIdRef.current !== requestRouteId) {
        return;
      }

      setAlternativeRoutes((current) =>
        current.map((item) => (item.id === restored.id ? restored : item)),
      );
      loadAlternativeIntoWorkspace(restored);
      toastSuccess(t("routes.alternativeRestored"));
    } catch (err) {
      if (selectedRouteIdRef.current !== requestRouteId) {
        return;
      }

      toastError(err instanceof Error ? err.message : t("routes.actionFailed"));
    } finally {
      setIsSavingAlternative(false);
    }
  }

  return {
    alternativeRoutes,
    selectedAlternativeRouteId,
    selectedAlternative,
    activeAlternativeCount,
    maxActiveAlternatives,
    altForm,
    altMetrics,
    altStopDrafts,
    altMapPoints,
    altGeometry,
    altSuggestions,
    isLoadingAltSuggestions,
    pickedAltSuggestion,
    handlePickAltSearchResult,
    isAltDirty,
    isSavingAlternative,
    isDeletingAlternative,
    isAddingAltSuggestion,
    pendingDeleteAlternative,
    setPendingDeleteAlternative,
    pendingRemoveAltStop,
    setPendingRemoveAltStop,
    applyAlternatives,
    resetAlternatives,
    startNewAlternative,
    handleSelectAlternativeRoute,
    updateAltField,
    toggleAlternativeActive,
    addAltStopFromSuggestion,
    removeAltStop,
    confirmRemoveAltStop,
    handleSaveAlternative,
    handleDeleteAlternativeRoute,
    handleRestoreAlternativeRoute,
  };
}

export type UseAlternativeRouteWorkspaceResult = ReturnType<
  typeof useAlternativeRouteWorkspace
>;
