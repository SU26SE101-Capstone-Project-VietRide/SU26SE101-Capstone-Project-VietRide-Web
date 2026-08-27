// Hook cục bộ: state + thao tác hình học tuyến (polyline) của màn Routes.
// Mọi thao tác chỉ sửa state cục bộ + đánh dấu "chưa lưu" — polyline được lưu
// atomic cùng form/stops qua nút "Lưu tuyến" (PUT /routes/{id}/full).
//
// Phương án đường (kiểu Google Maps thật): chọn tuyến là TỰ fetch các phương án
// và vẽ lên bản đồ để so — KHÔNG tự áp/đánh dấu dirty; chỉ khi user bấm chọn một
// phương án khác đường đã lưu mới áp polyline + số liệu và bật dirty.
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
import {
  dedupeRouteOptions,
  distanceKmBetween,
  excludeMatchingRouteOptions,
  findMatchingRouteOption,
  findPathAnchorWindow,
  isTruckDetour,
  requestRoadGeometry,
  splicePathSegment,
  type PathAnchorWindow,
  type RoadGeometryOptions,
  type RoadRouteOption,
  type RouteTravelMode,
} from "./geometry";
import {
  readSessionCache,
  writeSessionCache,
} from "../../../utils/sessionCache";
import type { TranslateFn } from "./types";

// Không giới hạn số điểm nắn lộ trình phía FE. Trần thực tế là của Google Routes
// API: `intermediates` gồm CẢ điểm dừng của tuyến lẫn điểm nắn `via:true`, vượt
// hạn ngạch waypoint thì request trả lỗi và toolbar hiện "không tính được đường".

// Kéo tới đâu tính tới đó: throttle + ngưỡng di chuyển tối thiểu giữa 2 lần gọi
// Google trong lúc kéo — API tính tiền theo request, đừng hạ thấp tùy tiện.
// 350ms/50m là mức owner duyệt để kéo mượt gần như Google thật (800ms/150m cũ
// cho cảm giác "ì" — preview đi sau tay quá xa).
const dragRecomputeThrottleMs = 350;
const dragRecomputeMinMeters = 50;

// Trạng thái throttle của stream drag
type DragPreviewState = {
  lastRunAt: number;
  lastPoint: RouteCoordinate | null;
};

// Lượt kéo này có được phép gọi Google không (đủ xa lượt trước cả về thời gian
// lẫn quãng đường)? Trả về state mới, hoặc null nếu phải bỏ qua.
// Để ở module scope vì `Date.now()` gọi trong thân hook bị react-hooks/purity
// chặn — compiler không phân biệt được event handler với code chạy lúc render.
function nextDragPreviewState(
  current: DragPreviewState,
  point: RouteCoordinate,
): DragPreviewState | null {
  const now = Date.now();

  if (now - current.lastRunAt < dragRecomputeThrottleMs) {
    return null;
  }

  if (
    current.lastPoint &&
    distanceKmBetween(current.lastPoint, point) * 1000 < dragRecomputeMinMeters
  ) {
    return null;
  }

  return { lastRunAt: now, lastPoint: point };
}

// Đợi 400ms sau hành động (chọn tuyến / đổi loại xe / xoá đường) mới auto-fetch
// phương án — gom các thay đổi liên tiếp thành 1 request, đỡ đốt quota
const autoFetchDebounceMs = 400;

// Cảnh báo khi tính bằng TRUCK: "detour" = TRUCK dài hơn đáng kể DRIVE (đường
// ngắn nhất có đoạn hạn chế xe lớn); "unavailable" = TRUCK bí đường nhưng DRIVE
// vẫn đi được (gần nhất với "xe 50 chỗ không vào được" trong khả năng Google)
export type TruckRouteWarning = "" | "detour" | "unavailable";

// Kết quả một lượt auto-fetch để cache theo phiên: options=null nghĩa là TRUCK
// bí đường (chỉ cảnh báo); cả entry=null nghĩa là request lỗi/thiếu key
type FetchedOptionsEntry = {
  options: RoadRouteOption[] | null;
  warning: TruckRouteWarning;
} | null;

/**
 * Cache phương án Directions, dùng chung cho mọi lần mount.
 *
 * Trước đây nằm trong `useRef` nên rời trang Tuyến là mất, quay lại tốn 6-11
 * request Goong cho đúng bộ dữ liệu vừa có. Giờ cache ở module-level (sống hết
 * phiên SPA) và đổ thêm xuống sessionStorage (sống qua F5).
 *
 * Entry lưu là options THÔ — lọc theo `excludedPathPoints` diễn ra lúc ingest
 * (xem `ingestFetchedEntry`), nên cùng một entry vẫn đúng khi đường loại trừ
 * đổi. Giá trị `null` là kết quả hợp lệ ("đã hỏi, không có đường"), nên phải
 * phân biệt với "chưa từng hỏi" — do đó bọc trong `{ entry }` khi lưu.
 */
const geometryOptionsCache = new Map<string, FetchedOptionsEntry>();
// Đuôi `.v2` là một lần xả cache: bản trước ghi cả LỖI REQUEST vào cache (xem
// `autoFetchOptions`), nên trình duyệt của người dùng có thể đang giữ những
// entry "không tính được đường" sai sự thật, sống 24h và qua cả F5. Đổi tiền tố
// là bỏ qua toàn bộ đám đó, khỏi bắt người dùng tự xoá dữ liệu trình duyệt.
const geometryStorageKeyPrefix = "vietride.routeGeometryOptions.v2.";
const geometryCacheMaxAgeMs = 24 * 60 * 60 * 1_000;
// Chặn trên số đỉnh polyline được phép ghi xuống sessionStorage. Kho này dùng
// CHUNG với cache danh sách tuyến/nguồn lực chuyến — một tuyến dài bất thường
// làm tràn quota 5MB sẽ đá văng cả các cache kia.
const maxPersistedPathPoints = 8_000;

type PersistedGeometryEntry = { entry: FetchedOptionsEntry };

function geometryStorageKey(key: string) {
  return `${geometryStorageKeyPrefix}${key}`;
}

/**
 * Nạp entry của `key` từ sessionStorage lên Map nếu Map chưa có.
 *
 * Tách riêng khỏi chỗ đọc để phần đọc trong effect giữ nguyên hình dạng cũ
 * (`Map.get()` + so với `undefined`) — "chưa từng hỏi" là `undefined`, còn
 * `null` là kết quả hợp lệ nghĩa là "đã hỏi, không có đường".
 */
function hydrateGeometryCache(key: string) {
  if (geometryOptionsCache.has(key)) {
    return;
  }

  const persisted = readSessionCache<PersistedGeometryEntry>(
    geometryStorageKey(key),
    geometryCacheMaxAgeMs,
  );
  if (persisted) {
    geometryOptionsCache.set(key, persisted.entry);
  }
}

/**
 * Xoá entry của `key` khỏi cả Map lẫn sessionStorage, đưa nó về trạng thái
 * "chưa từng hỏi" để lượt sau hỏi lại thật.
 */
function dropGeometryCache(key: string) {
  geometryOptionsCache.delete(key);
  try {
    sessionStorage.removeItem(geometryStorageKey(key));
  } catch {
    // Cache chỉ là tối ưu — không được làm vỡ luồng chính.
  }
}

function writeGeometryCache(key: string, entry: FetchedOptionsEntry) {
  geometryOptionsCache.set(key, entry);

  const pathPointCount = (entry?.options ?? []).reduce(
    (total, option) => total + option.points.length,
    0,
  );
  if (pathPointCount > maxPersistedPathPoints) {
    return;
  }

  writeSessionCache<PersistedGeometryEntry>(geometryStorageKey(key), { entry });
}

/** Chỉ dùng trong test — cache module-level phải reset thủ công giữa các case. */
export function __clearGeometryOptionsCacheForTest() {
  geometryOptionsCache.clear();
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(geometryStorageKeyPrefix))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // sessionStorage bị chặn — không có gì để dọn.
  }
}

// Key cache/dedupe auto-fetch: tuyến + loại xe + điểm nắn + bộ waypoint
function coordKey(point: RouteCoordinate) {
  return `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
}

function coordsKey(points: RouteCoordinate[]) {
  return points.map(coordKey).join(";");
}

type UseRouteGeometryParams = {
  selectedRouteId: string;
  routeWaypoints: RouteCoordinate[];
  // Chỉ auto-fetch phương án khi tab gộp map-first đang mở và user được sửa tuyến
  // — tuyệt đối không fetch hàng loạt cho danh sách tuyến
  isWorkspaceActive: boolean;
  // Đường bị LOẠI khỏi bộ phương án Google (vd polyline tuyến chính khi soạn
  // tuyến thay thế — phương án trùng tuyến chính không phải "thay thế").
  // Chỉ lọc lúc ingest (cache vẫn giữ options thô) — đường loại trừ đổi thì
  // re-ingest từ cache, không tốn request. Không truyền → không lọc gì.
  excludedPathPoints?: RouteCoordinate[];
  setRouteForm: Dispatch<SetStateAction<OperatorRouteRequest>>;
  setRoutes: Dispatch<SetStateAction<OperatorRoute[]>>;
  setError: (message: string) => void;
  t: TranslateFn;
};

export function useRouteGeometry({
  selectedRouteId,
  routeWaypoints,
  isWorkspaceActive,
  excludedPathPoints,
  setRouteForm,
  setRoutes,
  setError,
  t,
}: UseRouteGeometryParams) {
  const [routePathPoints, setRoutePathPoints] = useState<RouteCoordinate[]>([]);
  const [isGeometryDirty, setIsGeometryDirty] = useState(false);
  // Các phương án Google trả về (auto-fetch khi chọn tuyến) — chỉ là state phiên,
  // server chỉ nhận polyline của phương án ĐANG chọn khi bấm "Lưu tuyến".
  // selectedOptionIndex = -1 nghĩa là đường ĐÃ LƯU đang chọn mà không trùng
  // phương án nào — map vẽ đường lưu đậm + các phương án mờ để so.
  const [routeOptions, setRouteOptions] = useState<RoadRouteOption[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  // Điểm nắn lộ trình user cắm/kéo trên bản đồ — chỉ là state phiên như routeOptions
  const [viaPoints, setViaPoints] = useState<RouteCoordinate[]>([]);
  // Loại xe để tính đường — state phiên theo tuyến đang mở, không lưu server
  const [travelMode, setTravelMode] = useState<RouteTravelMode>("TRUCK");
  // Cảnh báo đường hạn chế xe lớn của lần tính TRUCK gần nhất — cũng là state phiên
  const [truckWarning, setTruckWarning] = useState<TruckRouteWarning>("");
  // Đang có request tính lại đường chạy ngầm (kéo điểm nắn) — map hiện "đang tính..."
  const [isRerouting, setIsRerouting] = useState(false);
  // Đang auto-fetch phương án cho tuyến vừa chọn/toggle — toolbar hiện spinner nhỏ
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);
  // Auto-fetch lỗi (thiếu key/Google lỗi) → toolbar hiện text nhỏ + vẫn cho vẽ tay
  const [autoRouteUnavailable, setAutoRouteUnavailable] = useState(false);
  // Google CÓ trả phương án nhưng tất cả đều trùng excludedPathPoints (bị lọc
  // sạch) → toolbar hiện hint "kéo điểm nắn để tự tạo đường khác"
  const [allOptionsExcluded, setAllOptionsExcluded] = useState(false);
  // Chống race khi kéo/xoá điểm nắn liên tiếp: chỉ nhận kết quả của lượt mới nhất
  const rerouteSeqRef = useRef(0);
  // Throttle cho stream drag: thời điểm + vị trí của lần tính preview gần nhất
  const dragPreviewRef = useRef<DragPreviewState>({
    lastRunAt: 0,
    lastPoint: null,
  });
  // Chặng đang nắn của gesture kéo hiện tại: đường gốc lúc bắt đầu kéo + khoảng
  // đỉnh cần tính lại. Chốt MỘT lần lúc bắt đầu và giữ nguyên tới lúc thả —
  // tính lại theo con trỏ mỗi nhịp thì cửa sổ trượt theo tay, mối ghép nhảy loạn.
  const dragLegRef = useRef<{
    basePath: RouteCoordinate[];
    window: PathAnchorWindow;
  } | null>(null);
  // Đang trong gesture túm thân đường (mousedown→mouseup): chặn effect auto-fetch
  // bắn request trùng khi viaPoints đổi giữa gesture — phát chốt lúc thả mới ghi
  // cache + key như thường
  const isDraggingViaRef = useRef(false);
  // Cache phương án theo phiên (không persist): chọn qua lại các tuyến không gọi
  // lại Google — kể cả lượt lỗi (entry null) cũng cache để không retry vô hạn
  // Trỏ vào cache module-level (xem geometryOptionsCache) — giữ lại ref để
  // cách đọc trong effect không đổi so với trước.
  const optionsCacheRef = useRef(geometryOptionsCache);
  // Key của lượt auto-fetch gần nhất — chặn effect refetch trùng key
  const lastAutoFetchKeyRef = useRef("");
  // Snapshot đường + số liệu ĐÃ LƯU của tuyến đang mở — bấm lại phương án trùng
  // đường lưu sẽ khôi phục đúng trạng thái sạch (không dirty)
  const savedGeometryRef = useRef<{
    points: RouteCoordinate[];
    totalDistanceKm: number;
    estimatedDurationMinutes: number;
  } | null>(null);
  // Index phương án trùng ~ đường đã lưu trong bộ options hiện tại (-1 = không có)
  const savedOptionIndexRef = useRef(-1);
  // true = lượt auto-fetch KẾ TIẾP phải tự áp ngay phương án đầu (không chờ
  // user bấm chọn) — bật khi invalidateLocalGeometry được gọi vì thêm/gỡ điểm
  // dừng (đường cũ không còn khớp nhưng user đã có đường/điểm nắn đang soạn
  // dở, không nên rơi về "chế độ so sánh" bắt bấm lại từ đầu; xem
  // useRouteStopEditor.ts). Tiêu thụ đúng MỘT lần trong ingestFetchedEntry.
  const autoApplyPendingRef = useRef(false);
  // Ref giữ giá trị mới nhất cho closure async/effect
  const routePathPointsRef = useRef(routePathPoints);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
    routePathPointsRef.current = routePathPoints;
  });

  // Xóa các phương án phiên trước (đổi tuyến / vào chế độ khác) — không giữ lại.
  // Mọi flow reset đi qua đây đều dọn cả cảnh báo TRUCK + trạng thái đang tính.
  // keepViaPoints: true → GIỮ nguyên điểm nắn user đã kéo (đổi bến đi/đến mới
  // cần xoá sạch vì tuyến khác hẳn, nhưng thêm/gỡ điểm dừng thì các điểm nắn
  // cũ vẫn còn ý nghĩa — auto-fetch kế tiếp sẽ tính lại có kèm chúng).
  function clearRouteOptions(options?: { keepViaPoints?: boolean }) {
    rerouteSeqRef.current += 1;
    lastAutoFetchKeyRef.current = "";
    savedOptionIndexRef.current = -1;
    setRouteOptions([]);
    setSelectedOptionIndex(0);
    if (!options?.keepViaPoints) {
      setViaPoints([]);
      // Reset "toàn phần" (đổi bến/đổi tuyến...) huỷ luôn ý định tự-áp còn dở
      // từ một lượt keepViaPoints trước đó chưa kịp fetch xong.
      autoApplyPendingRef.current = false;
    }
    setTruckWarning("");
    setIsRerouting(false);
    setIsFetchingOptions(false);
    setAutoRouteUnavailable(false);
    setAllOptionsExcluded(false);
    dragPreviewRef.current = { lastRunAt: 0, lastPoint: null };
  }

  // Kiểu tối thiểu để applySavedGeometry nhận cả OperatorRoute (tuyến chính)
  // lẫn AlternativeRoute (tuyến thay thế, xem useAlternativeRouteWorkspace) —
  // hook chỉ đọc 3 field này, không cần toàn bộ shape OperatorRoute.
  const applySavedGeometry = useCallback(
    (
      route: {
        pathPolyline?: string | null;
        totalDistanceKm: number;
        estimatedDurationMinutes: number;
      } | null,
    ) => {
      setIsGeometryDirty(false);
      rerouteSeqRef.current += 1;
      lastAutoFetchKeyRef.current = "";
      savedOptionIndexRef.current = -1;
      setRouteOptions([]);
      setSelectedOptionIndex(0);
      setViaPoints([]);
      // Đổi tuyến → loại xe + cảnh báo quay về mặc định (state phiên theo tuyến)
      setTravelMode("TRUCK");
      setTruckWarning("");
      setIsRerouting(false);
      setIsFetchingOptions(false);
      setAutoRouteUnavailable(false);
      setAllOptionsExcluded(false);
      dragPreviewRef.current = { lastRunAt: 0, lastPoint: null };
      autoApplyPendingRef.current = false;

      if (!route?.pathPolyline) {
        savedGeometryRef.current = null;
        setRoutePathPoints([]);
        return;
      }

      try {
        const points = decodeGooglePolyline(route.pathPolyline);
        savedGeometryRef.current = {
          points,
          totalDistanceKm: route.totalDistanceKm,
          estimatedDurationMinutes: route.estimatedDurationMinutes,
        };
        setRoutePathPoints(points);
      } catch {
        savedGeometryRef.current = null;
        setRoutePathPoints([]);
        setError(tRef.current("routes.invalidSavedGeometry"));
      }
    },
    [setError],
  );

  function invalidateLocalGeometry(
    routeId = selectedRouteId,
    options?: { keepViaPoints?: boolean },
  ) {
    savedGeometryRef.current = null;
    setRoutePathPoints([]);
    setIsGeometryDirty(false);
    clearRouteOptions(options);
    if (options?.keepViaPoints) {
      // Giữ điểm nắn nhưng đường áp vừa bị xoá (không còn khớp stop mới) →
      // tự áp lại phương án đầu ngay khi auto-fetch xong, đừng bắt user bấm
      // chọn lại mới có đường + kéo tiếp được (xem ingestFetchedEntry).
      autoApplyPendingRef.current = true;
    }
    setRoutes((current) =>
      current.map((route) =>
        route.id === routeId ? { ...route, pathPolyline: null } : route,
      ),
    );
  }

  // Áp một phương án vào state: polyline hiển thị + km/thời lượng của form
  function applyRouteOption(option: RoadRouteOption) {
    setRoutePathPoints(option.points);
    setRouteForm((current) => ({
      ...current,
      totalDistanceKm: option.totalDistanceKm,
      estimatedDurationMinutes: option.estimatedDurationMinutes,
    }));
  }

  // Dựng opts gửi requestRoadGeometry theo mode + điểm nắn hiện có
  function buildGeometryOptions(
    mode: RouteTravelMode,
    viaList: RouteCoordinate[],
  ): RoadGeometryOptions {
    // `referencePath` cho requestRoadGeometry biết chèn điểm nắn vào khe nào
    // giữa các điểm dừng — thiếu nó thì điểm nắn bị dồn xuống sau mọi điểm dừng
    // và lộ trình chốt khác hẳn cái vừa xem trước lúc kéo.
    return viaList.length > 0
      ? {
          intermediates: viaList,
          referencePath: routePathPointsRef.current,
          travelMode: mode,
        }
      : { travelMode: mode };
  }

  function buildFetchKey(mode: RouteTravelMode, viaList: RouteCoordinate[]) {
    return `${selectedRouteId}|${mode}|${coordsKey(viaList)}|${coordsKey(routeWaypoints)}`;
  }

  // Gọi Directions theo mode đang chọn. Với TRUCK: bắn thêm 1 request DRIVE cùng bộ
  // điểm (song song) để so sánh — TRUCK dài hơn đáng kể ⇒ cảnh báo "detour";
  // TRUCK lỗi/rỗng mà DRIVE có kết quả ⇒ options = null + cảnh báo "unavailable"
  // (không áp đường DRIVE vì mode đang là xe lớn); cả hai cùng lỗi ⇒ throw như cũ.
  async function requestGeometryWithWarning(
    mode: RouteTravelMode,
    viaList: RouteCoordinate[],
  ): Promise<{ options: RoadRouteOption[] | null; warning: TruckRouteWarning }> {
    const failMessage = t("routes.routingFailed");
    const baseOpts = buildGeometryOptions(mode, viaList);

    // `alternatives` chỉ bật cho request của MODE ĐANG CHỌN — đó là bộ phương
    // án người dùng nhìn thấy và bấm chọn trên bản đồ.
    if (mode === "DRIVE") {
      return {
        options: await requestRoadGeometry(routeWaypoints, failMessage, {
          ...baseOpts,
          alternatives: true,
        }),
        warning: "",
      };
    }

    // Tạo promise TRUCK trước DRIVE — thứ tự gọi ổn định (test mock theo thứ tự)
    const truckPromise = requestRoadGeometry(routeWaypoints, failMessage, {
      ...baseOpts,
      alternatives: true,
    });
    // Request DRIVE chỉ để so km/phút ra cảnh báo "đường vòng vì xe lớn" —
    // không hiện cho user chọn nên không xin phương án phụ.
    const drivePromise = requestRoadGeometry(routeWaypoints, failMessage, {
      ...baseOpts,
      travelMode: "DRIVE",
    }).catch(() => null);

    let truckOptions: RoadRouteOption[];
    try {
      truckOptions = await truckPromise;
    } catch (err) {
      if (await drivePromise) {
        return { options: null, warning: "unavailable" };
      }

      throw err;
    }

    const driveOptions = await drivePromise;

    return {
      options: truckOptions,
      warning:
        driveOptions && isTruckDetour(truckOptions, driveOptions)
          ? "detour"
          : "",
    };
  }

  // Đưa một entry (fetch mới hoặc cache) vào state: CHỈ vẽ phương án để so —
  // không áp polyline/số liệu, không dirty. Phương án đang chọn được suy ra:
  // trùng ~ đường đang hiển thị → chọn phương án đó; đường đang hiển thị không
  // trùng phương án nào → -1 (đường lưu đậm, phương án mờ); chưa có đường → 0.
  function ingestFetchedEntry(entry: FetchedOptionsEntry) {
    setIsFetchingOptions(false);
    setAutoRouteUnavailable(entry === null);
    setTruckWarning(entry?.warning ?? "");

    // Lọc phương án trùng đường loại trừ (tuyến chính) NGAY LÚC INGEST — cache
    // giữ options thô nên đường loại trừ đổi chỉ cần re-ingest, không request lại.
    // Lọc trước khi vào state để selectedOptionIndex/click trên map không lệch index.
    const rawOptions = entry?.options ?? [];
    const options = excludedPathPoints
      ? excludeMatchingRouteOptions(rawOptions, excludedPathPoints)
      : rawOptions;
    setAllOptionsExcluded(rawOptions.length > 0 && options.length === 0);
    setRouteOptions(options);

    const currentPath = routePathPointsRef.current;
    const hasAppliedPath = currentPath.length > 1;
    const matchIndex = hasAppliedPath
      ? findMatchingRouteOption(options, currentPath)
      : -1;
    setSelectedOptionIndex(
      matchIndex >= 0 ? matchIndex : hasAppliedPath ? -1 : 0,
    );

    const saved = savedGeometryRef.current;
    savedOptionIndexRef.current = saved
      ? findMatchingRouteOption(options, saved.points)
      : -1;

    // Lượt fetch này đến từ invalidateLocalGeometry({ keepViaPoints: true })
    // (thêm/gỡ điểm dừng) — tự áp phương án đầu ngay, đừng để user rơi vào
    // "chế độ so sánh" phải bấm lại mới có đường + kéo nắn tiếp được.
    if (autoApplyPendingRef.current) {
      autoApplyPendingRef.current = false;
      if (options.length > 0) {
        applyRouteOption(options[0]);
        setIsGeometryDirty(true);
      }
    }
  }

  // Auto-fetch phương án cho tuyến đang chọn (debounce ở effect bên dưới) —
  // lỗi nuốt im lặng thành entry null: toolbar hiện "không tính được", không
  // báo lỗi toàn cục vì user không bấm gì cả
  async function autoFetchOptions(key: string) {
    const seq = ++rerouteSeqRef.current;
    setIsFetchingOptions(true);

    let entry: FetchedOptionsEntry;
    let requestFailed = false;
    try {
      const { options, warning } = await requestGeometryWithWarning(
        travelMode,
        viaPoints,
      );
      entry = {
        options: options ? dedupeRouteOptions(options) : null,
        warning,
      };
    } catch {
      entry = null;
      requestFailed = true;
    }

    // LỖI REQUEST KHÔNG ĐƯỢC VÀO CACHE. Cache cố tình phân biệt "chưa từng hỏi"
    // (undefined) với "đã hỏi, không có đường" (null) — nhưng mất mạng, hết
    // quota, API đổi endpoint hay Goong trả 5xx đều rơi vào cùng nhánh catch
    // này. Ghi chúng xuống thì một cú lỗi thoáng qua khoá tuyến đó ở trạng thái
    // "không tính được đường" suốt 24h, sống qua cả F5, kể cả khi API đã hoạt
    // động lại — user không có cách nào thoát ngoài việc tự xoá sessionStorage.
    // Bỏ luôn entry cũ để lượt sau hỏi lại thật.
    if (requestFailed) {
      dropGeometryCache(key);
    } else {
      // User đã đổi tuyến/thao tác khác trong lúc chờ → bỏ kết quả (cache vẫn ghi)
      writeGeometryCache(key, entry);
    }
    if (seq !== rerouteSeqRef.current) {
      return;
    }

    ingestFetchedEntry(entry);
  }

  const waypointsKey = coordsKey(routeWaypoints);
  const viaKey = coordsKey(viaPoints);
  const excludedKey = excludedPathPoints ? coordsKey(excludedPathPoints) : "";

  // Đường loại trừ đổi (vd sửa polyline tuyến chính rồi quay lại tab Tuyến thay
  // thế) → xoá key auto-fetch gần nhất để effect bên dưới re-ingest từ cache
  // (options thô lọc lại theo đường mới — cache hit nên không request thêm)
  useEffect(() => {
    lastAutoFetchKeyRef.current = "";
  }, [excludedKey]);

  // Chọn tuyến / đổi loại xe / xoá đường → TỰ tính phương án sau 400ms, không còn
  // nút bấm. Cache theo key nên chọn qua lại các tuyến không gọi lại Google;
  // đổi tuyến giữa chừng huỷ theo seq + cleanup timer.
  useEffect(() => {
    if (
      !isWorkspaceActive ||
      !selectedRouteId ||
      routeWaypoints.length < 2 ||
      // Đang túm thân đường kéo — preview tự lo request, không auto-fetch chen vào
      isDraggingViaRef.current
    ) {
      return;
    }

    const key = buildFetchKey(travelMode, viaPoints);
    if (lastAutoFetchKeyRef.current === key) {
      return;
    }

    hydrateGeometryCache(key);
    const cached = optionsCacheRef.current.get(key);
    if (cached !== undefined) {
      // Cache hit → vẽ lại ngay, không request, không cần debounce
      lastAutoFetchKeyRef.current = key;
      ingestFetchedEntry(cached);
      return;
    }

    const timer = setTimeout(() => {
      lastAutoFetchKeyRef.current = key;
      void autoFetchOptions(key);
    }, autoFetchDebounceMs);

    return () => clearTimeout(timer);
    // Các hàm trong deps là function component-scope (identity đổi mỗi render);
    // effect chỉ cần chạy lại khi các key dữ liệu này đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isWorkspaceActive,
    selectedRouteId,
    travelMode,
    viaKey,
    waypointsKey,
    excludedKey,
    routeOptions.length,
  ]);

  // Tính lại đường với bộ điểm nắn mới (thêm/kéo/xoá điểm trên bản đồ). Kết quả
  // thay TOÀN BỘ bộ phương án hiện tại; lượt cũ về muộn bị bỏ qua theo seq —
  // kể cả preview trong lúc kéo về muộn hơn phát chốt lúc thả.
  async function recomputeWithViaPoints(nextViaPoints: RouteCoordinate[]) {
    const seq = ++rerouteSeqRef.current;
    setIsRerouting(true);
    // Reroute chủ động vô hiệu lượt auto-fetch đang bay (nếu có) → tắt spinner của nó
    setIsFetchingOptions(false);

    try {
      const { options, warning } = await requestGeometryWithWarning(
        travelMode,
        nextViaPoints,
      );

      if (seq !== rerouteSeqRef.current) {
        return;
      }

      setTruckWarning(warning);

      if (!options) {
        return;
      }

      const deduped = dedupeRouteOptions(options);
      // Reroute chủ động cũng ghi cache + key để effect auto-fetch không bắn
      // thêm một request trùng ngay sau khi viaPoints đổi
      const key = buildFetchKey(travelMode, nextViaPoints);
      writeGeometryCache(key, { options: deduped, warning });
      lastAutoFetchKeyRef.current = key;
      savedOptionIndexRef.current = -1;
      setAutoRouteUnavailable(false);
      // Đường có điểm nắn là user CHỦ ĐỘNG tạo hình — không lọc theo đường loại
      // trừ (kể cả trùng tuyến chính cũng là lựa chọn có chủ đích của user)
      setAllOptionsExcluded(false);
      setViaPoints(nextViaPoints);
      setRouteOptions(deduped);
      setSelectedOptionIndex(0);
      applyRouteOption(deduped[0]);
      setIsGeometryDirty(true);
    } finally {
      // Chỉ lượt MỚI NHẤT được tắt cờ "đang tính" — lượt cũ xong sau vẫn còn
      // request mới hơn đang chạy thì giữ nguyên
      if (seq === rerouteSeqRef.current) {
        setIsRerouting(false);
      }
    }
  }

  // Chạy reroute từ event bản đồ (không qua onRunAction) — lỗi hiển thị qua setError
  function runReroute(nextViaPoints: RouteCoordinate[]) {
    void recomputeWithViaPoints(nextViaPoints).catch((err: unknown) => {
      setError(
        err instanceof Error ? err.message : t("routes.routingFailed"),
      );
    });
  }

  // Đổi loại xe tính đường — effect auto-fetch tự tính lại với mode mới (giữ
  // nguyên bộ điểm nắn hiện tại; cache theo key nên toggle qua lại không gọi thêm)
  function handleSetTravelMode(mode: RouteTravelMode) {
    if (mode === travelMode) {
      return;
    }

    setTravelMode(mode);
    setTruckWarning("");
  }

  // Mỏ neo của chặng đang nắn: điểm dừng của tuyến + các điểm nắn KHÁC. Kéo ở
  // chặng nào thì chỉ chặng đó được tính lại, các chặng khác không đụng tới.
  function buildDragAnchors(draggedIndex: number) {
    return [
      ...routeWaypoints,
      ...viaPoints.filter((_, index) => index !== draggedIndex),
    ];
  }

  // Chốt chặng cần nắn cho gesture hiện tại (một lần cho cả lượt kéo). seed là
  // vị trí GỐC của điểm đang kéo — chỗ bấm chuột xuống với gesture túm đường,
  // hoặc toạ độ cũ của điểm nắn với kéo marker (viaPoints chỉ đổi lúc thả).
  function beginDragLeg(draggedIndex: number, seed: RouteCoordinate) {
    const basePath = routePathPointsRef.current;
    const window = findPathAnchorWindow(
      basePath,
      buildDragAnchors(draggedIndex),
      seed,
    );

    dragLegRef.current = window ? { basePath, window } : null;
  }

  // Kéo tới đâu tính tới đó: gọi trong event drag liên tục của marker điểm nắn.
  // Throttle 350ms + phải dịch tối thiểu 50m so với lần preview trước (API tính
  // tiền theo request); lỗi preview nuốt im lặng — phát chốt lúc thả (dragend)
  // mới báo lỗi.
  //
  // Preview chỉ tính lại ĐÚNG CHẶNG đang nắn (2 waypoint + 1 via) rồi ghép vào
  // đường hiện có, KHÔNG tính lại cả tuyến. Hai lý do: request nhỏ về nhanh hơn
  // nhiều nên đường bám tay kịp, và đường vẽ ra luôn là đường bộ thật — không
  // bao giờ có đoạn chim bay như khi vẽ tạm bằng đường thẳng.
  function handleDragViaPoint(index: number, point: RouteCoordinate) {
    isDraggingViaRef.current = true;
    const nextPreviewState = nextDragPreviewState(dragPreviewRef.current, point);

    if (!nextPreviewState) {
      return;
    }

    // Kéo marker native không đi qua handleBeginViaPointDrag → chốt chặng ở
    // nhịp drag đầu tiên (nhịp này không bao giờ bị throttle chặn: lastRunAt=0
    // và lastPoint=null), seed là toạ độ CŨ của chính điểm nắn đó
    if (!dragLegRef.current) {
      beginDragLeg(index, viaPoints[index] ?? point);
    }

    const leg = dragLegRef.current;
    if (!leg) {
      return;
    }

    dragPreviewRef.current = nextPreviewState;
    void previewDragLeg(leg, point).catch(() => {});
  }

  // Một lượt preview: tính lại chặng path[previousIndex] → path[nextIndex] có
  // ghé qua con trỏ, rồi ghép hình trả về vào đúng khoảng đó. CHỈ đổi polyline
  // — km/phút của form và bộ phương án giữ nguyên tới lúc thả, vì số của một
  // chặng không phải số của cả tuyến.
  async function previewDragLeg(
    leg: { basePath: RouteCoordinate[]; window: PathAnchorWindow },
    point: RouteCoordinate,
  ) {
    const seq = ++rerouteSeqRef.current;
    setIsRerouting(true);

    try {
      const { basePath, window: legWindow } = leg;
      // Khi chặng đang nắn CHẠM mép đường thì đầu chặng phải là đúng bến của
      // tuyến, không phải đỉnh polyline ở đó. Đỉnh polyline đã được Directions
      // nắn về mặt đường rồi, còn toạ độ bến thì chưa — mà lúc thả chuột, phép
      // tính chốt lại hỏi từ chính toạ độ bến. Hỏi bằng hai bộ điểm khác nhau
      // là nhận về hai hình đường khác nhau, và người dùng thấy đường nhảy sang
      // lộ trình khác ngay khi buông tay.
      const lastWaypoint = routeWaypoints[routeWaypoints.length - 1];
      const legOrigin =
        legWindow.previousIndex === 0 && routeWaypoints.length > 1
          ? routeWaypoints[0]
          : basePath[legWindow.previousIndex];
      const legDestination =
        legWindow.nextIndex === basePath.length - 1 && routeWaypoints.length > 1
          ? lastWaypoint
          : basePath[legWindow.nextIndex];

      const options = await requestRoadGeometry(
        [legOrigin, legDestination],
        tRef.current("routes.routingFailed"),
        { travelMode, intermediates: [point] },
      );

      if (seq !== rerouteSeqRef.current) {
        return;
      }

      setRoutePathPoints(
        splicePathSegment(basePath, legWindow, options[0].points),
      );
    } finally {
      if (seq === rerouteSeqRef.current) {
        setIsRerouting(false);
      }
    }
  }


  // Bộ điểm nắn với điểm tại index thay bằng point. Gesture túm thân đường có
  // thể bắn drag/mouseup TRƯỚC khi render sau setViaPoints của begin kịp chạy —
  // closure còn bộ cũ thiếu điểm mới thì append để không rớt điểm đang kéo.
  function replaceViaPointAt(index: number, point: RouteCoordinate) {
    return index >= viaPoints.length
      ? [...viaPoints, point]
      : viaPoints.map((current, currentIndex) =>
          currentIndex === index ? point : current,
        );
  }

  // Click lên đường đang chọn → cắm điểm nắn tại đó và tính lại (như kéo đường Google)
  function handleAddViaPoint(point: RouteCoordinate) {
    runReroute([...viaPoints, point]);
  }

  // Túm thẳng thân đường (mousedown trên polyline đang chọn) → cắm điểm nắn NGAY
  // dưới chuột và vào gesture kéo tuỳ chỉnh: KHÔNG reroute ở bước này — preview
  // chạy qua handleDragViaPoint trong lúc mousemove, phát chốt qua
  // handleMoveViaPoint lúc mouseup. Trả về index điểm nắn mới (>= 0). Giữ kiểu
  // trả về number vì caller vẫn guard index âm — không còn nhánh nào trả -1.
  function handleBeginViaPointDrag(point: RouteCoordinate): number {
    isDraggingViaRef.current = true;
    // Chưa từng preview trong gesture này — lần drag đầu tiên đủ xa là tính ngay
    dragPreviewRef.current = { lastRunAt: 0, lastPoint: point };
    // Điểm nắn mới nằm ĐÚNG trên đường (mousedown trên polyline) nên chính nó
    // là seed định vị chặng cần nắn
    beginDragLeg(viaPoints.length, point);
    setViaPoints((current) => [...current, point]);
    return viaPoints.length;
  }

  // Thả điểm nắn tại vị trí mới (dragend/mouseup) → tính phát cuối để chốt số
  // chính xác (preview trong lúc kéo chỉ là tạm; seq mới vô hiệu preview về muộn)
  function handleMoveViaPoint(index: number, point: RouteCoordinate) {
    isDraggingViaRef.current = false;
    dragPreviewRef.current = { lastRunAt: 0, lastPoint: null };
    dragLegRef.current = null;
    runReroute(replaceViaPointAt(index, point));
  }

  // Bấm điểm nắn → xoá và tính lại; hết điểm nắn thì Google trả lại các phương án
  function handleRemoveViaPoint(index: number) {
    runReroute(
      viaPoints.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  // Hoàn tác điểm nắn vừa kéo/cắm gần nhất (điểm cuối mảng — luôn là điểm mới
  // nhất do handleAddViaPoint/handleBeginViaPointDrag append vào cuối)
  function handleUndoViaPoint() {
    if (viaPoints.length === 0) {
      return;
    }

    handleRemoveViaPoint(viaPoints.length - 1);
  }

  // Bỏ hết điểm nắn đã kéo, quay về đường Google tính tự động ban đầu (không
  // qua điểm nắn nào) — "vẽ lại từ đầu" khi kéo sai quá nhiều lần
  function handleResetViaPoints() {
    if (viaPoints.length === 0) {
      return;
    }

    runReroute([]);
  }

  // Chọn phương án trên bản đồ (click đường mờ hoặc bubble thời lượng) — chỉ lúc
  // này mới áp polyline + số liệu và bật dirty. Bấm lại phương án trùng đường
  // ĐÃ LƯU thì khôi phục đúng trạng thái sạch (không dirty) — xem tuyến mà không
  // đổi gì thì không có gì để lưu.
  function handleSelectRouteOption(index: number) {
    const option = routeOptions[index];
    if (!option) {
      return;
    }

    const hasAppliedPath = routePathPoints.length > 1;
    if (index === selectedOptionIndex && hasAppliedPath) {
      return;
    }

    const saved = savedGeometryRef.current;
    if (saved && index === savedOptionIndexRef.current) {
      setSelectedOptionIndex(index);
      setRoutePathPoints(saved.points);
      setRouteForm((current) => ({
        ...current,
        totalDistanceKm: saved.totalDistanceKm,
        estimatedDurationMinutes: saved.estimatedDurationMinutes,
      }));
      setIsGeometryDirty(false);
      return;
    }

    setSelectedOptionIndex(index);
    applyRouteOption(option);
    setIsGeometryDirty(true);
  }

  // Nhận kết quả đường đã tính sẵn (flow auto-fill khi chọn đủ 2 bến) — chỉ áp
  // polyline cục bộ + đánh dấu chưa lưu; số km/thời lượng do caller tự cập nhật form
  function applyComputedGeometry(points: RouteCoordinate[]) {
    setRoutePathPoints(points);
    setIsGeometryDirty(true);
    clearRouteOptions();
  }

  // Xóa đường chỉ trên state cục bộ; lưu qua "Lưu tuyến" sẽ gửi pathPolyline=null
  // kèm manualMetrics từ form (server clear geometry + set metrics — contract 8.5).
  // Sau khi xoá, effect auto-fetch vẽ lại các phương án (cache hit → không request).
  function handleClearGeometry() {
    setRoutePathPoints([]);
    setIsGeometryDirty(true);
    clearRouteOptions();
  }

  return {
    routePathPoints,
    routeOptions,
    selectedOptionIndex,
    viaPoints,
    travelMode,
    truckWarning,
    isRerouting,
    isFetchingOptions,
    autoRouteUnavailable,
    allOptionsExcluded,
    isGeometryDirty,
    applySavedGeometry,
    applyComputedGeometry,
    invalidateLocalGeometry,
    handleSetTravelMode,
    handleSelectRouteOption,
    handleAddViaPoint,
    handleBeginViaPointDrag,
    handleMoveViaPoint,
    handleDragViaPoint,
    handleRemoveViaPoint,
    handleUndoViaPoint,
    handleResetViaPoints,
    handleClearGeometry,
  };
}

export type UseRouteGeometryResult = ReturnType<typeof useRouteGeometry>;
