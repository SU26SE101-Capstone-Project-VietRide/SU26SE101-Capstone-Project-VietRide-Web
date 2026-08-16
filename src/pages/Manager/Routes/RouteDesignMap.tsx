// Bản đồ thiết kế tuyến: marker bến/điểm dừng + polyline hình học tuyến.
// Khi có nhiều phương án: vẽ TẤT CẢ (phương án chọn đậm, còn lại xám mờ), nhãn
// bubble thời lượng trên từng đường, click đường/nhãn để chọn; TÚM thẳng thân
// đường đang chọn (mousedown) là cắm điểm nắn ngay dưới chuột + kéo liền một
// nhịp như Google Maps thật (gesture tuỳ chỉnh: khoá kéo bản đồ, theo mousemove,
// mouseup chốt reroute); click đường vẫn là fallback cắm điểm nắn.
// Mọi mảng overlay đều memo hoá — GoogleMapCanvas reconcile overlay theo identity
// mảng/id, không memo thì mỗi render của trang cha là một lần vẽ lại toàn bộ.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { FiLoader, FiTrash2 } from "react-icons/fi";
import GoogleMapCanvas, {
  type GoogleMapPointMarker,
  type GoogleMapPolyline,
} from "../../../components/GoogleMapCanvas";
import type {
  GoogleMapCoordinate,
  GoogleMapInstance,
  GoogleMapsEventListener,
} from "../../../lib/googleMaps";
import {
  routeEndpointPinPath,
  stopNumberPath,
} from "../../../components/mapMarkerPaths";
import { findRouteLabelAnchor, type RoadRouteOption } from "./geometry";
import { dimRouteColor, mainRouteColor } from "./routeColors";
import { estimateCoachDurationMinutes, type RouteCoordinate } from "./polyline";
import StopDetailCard from "./StopDetailCard";
import type { RouteMapPoint, StopSuggestion } from "./types";
import Checkbox from "../../../components/form/Checkbox";

const defaultRouteMapCenter: GoogleMapCoordinate = {
  lat: 10.7769,
  lng: 106.7009,
};

// Symbol path: bubble bo tròn cho nhãn thời lượng (tâm 0,0 để label nằm giữa)
const durationBubblePath =
  "M -24 -12 H 24 A 12 12 0 0 1 24 12 H -24 A 12 12 0 0 1 -24 -12 Z";
// Symbol path: chấm tròn cho điểm nắn lộ trình kéo được
const viaPointPath = "M 0 -9 a 9 9 0 1 1 0 18 a 9 9 0 1 1 0 -18 Z";

// Vị trí bubble thời lượng dọc theo đường theo index phương án (40%/55%/70%
// chiều dài) — tránh 2 bubble đè nhau khi các phương án bám sát nhau
const bubblePositionFractions = [0.4, 0.55, 0.7];
// Đường ĐÃ LƯU đang chọn (selectedOptionIndex = -1) không có ô tỉ lệ riêng theo
// index — đặt bubble giờ của nó lệch hẳn khỏi dải trên cho khỏi đè phương án nào
const savedPathBubbleFraction = 0.25;

// Các phương án chưa chọn dùng CÙNG tông màu với tuyến đang soạn, chỉ nhạt hơn
// (không còn mỗi phương án một màu tím/cam riêng) — xem routeColors.ts

// Mảng rỗng ổn định identity — trả về từ memo khi không có nhãn/marker để mảng
// pointMarkers gộp không đổi identity vô cớ (đổi identity giữa lúc kéo là
// GoogleMapCanvas gỡ + vẽ lại marker, cắt đứt thao tác kéo đang diễn ra)
const noPointMarkers: GoogleMapPointMarker[] = [];

// Điểm dừng của tuyến hiển thị thành marker đánh số 1..N theo orderIndex —
// click marker chọn stop tương ứng (đồng bộ highlight với danh sách trong panel)
// VÀ mở card chi tiết kiểu Google Maps (reuse StopDetailCard của chấm gợi ý).
// Marker điểm dừng KHÔNG kéo được: vị trí stop là cố định.
export type RouteStopMarker = {
  stopId: string;
  orderIndex: number;
  name: string;
  latitude: number;
  longitude: number;
  // Dữ liệu bổ sung để dựng card chi tiết — optional để nơi gọi cũ (nếu có)
  // chưa truyền đủ vẫn không gãy type; thiếu thì card chỉ hiện tên (không gọi
  // Google Place Details, không hiện dòng km/phút).
  address?: string | null;
  googlePlaceId?: string | null;
  distanceFromOriginKm?: number;
  estimatedDurationFromOriginMinutes?: number;
};

type RouteDesignMapProps = {
  points: RouteMapPoint[];
  pathPoints: RouteCoordinate[];
  // Marker điểm dừng đánh số + stop đang chọn (highlight) + handler chọn
  stopMarkers?: RouteStopMarker[];
  selectedStopId?: string;
  onSelectStop?: (stopId: string) => void;
  // Bấm nút "Gỡ khỏi tuyến" trên card chi tiết marker đã gắn — mở modal xác
  // nhận sẵn có (chỉ hiện nút khi canManageRoutes theo caller truyền xuống)
  onRequestRemoveStop?: (stopId: string) => void;
  // Các phương án Google trả về sau "Tính đường tự động" — vẽ tất cả, phương án
  // đang chọn đậm, phương án khác xám mờ (click đường mờ/nhãn để chọn)
  routeOptions?: RoadRouteOption[];
  selectedOptionIndex?: number;
  onSelectOption?: (index: number) => void;
  // Thời lượng (phút) của đường ĐÃ LƯU/đang áp — chỉ cần khi
  // selectedOptionIndex = -1 (đường đã lưu không trùng phương án nào), lúc đó
  // map không có RoadRouteOption nào để lấy số phút mà vẫn phải hiện bubble
  // giờ của tuyến đang chọn. Bằng 0/không truyền thì bỏ qua bubble đó.
  selectedPathDurationMinutes?: number;
  // Điểm nắn lộ trình đang có + các thao tác cắm/kéo/xoá (undefined = chỉ xem)
  viaPoints?: RouteCoordinate[];
  onAddViaPoint?: (point: RouteCoordinate) => void;
  // Bắt đầu gesture túm thân đường: cắm điểm nắn tại point (không reroute),
  // trả về index điểm mới (index âm = không cắm được, bỏ gesture) — kéo stream
  // qua onDragViaPoint, chốt qua onMoveViaPoint lúc thả
  onBeginViaDrag?: (point: RouteCoordinate) => number;
  onMoveViaPoint?: (index: number, point: RouteCoordinate) => void;
  // Bắn liên tục trong lúc kéo điểm nắn (event drag) — "kéo tới đâu tính tới đó"
  onDragViaPoint?: (index: number, point: RouteCoordinate) => void;
  onRemoveViaPoint?: (index: number) => void;
  // Đang có request tính lại đường chạy ngầm → hiện pill "đang tính..." trên map
  isRerouting?: boolean;
  emptyText: string;
  // Gợi ý điểm dừng (kho nhà xe / Google Places) hiện thành chấm trên bản đồ —
  // click chấm mở popup card cho phép thêm vào tuyến
  suggestions?: StopSuggestion[];
  onAddSuggestion?: (
    suggestion: StopSuggestion,
    options: { allowPickup: boolean; allowDropoff: boolean },
  ) => void;
  isAddingSuggestion?: boolean;
  // Kết quả chọn từ ô search panel: object mới mỗi lần chọn để re-trigger effect
  // đồng bộ vào activeSuggestion cục bộ (mở popup như bấm chấm trên bản đồ)
  externalActiveSuggestion?: StopSuggestion | null;
  // Màu đường/via-point/marker số của tuyến ĐANG SOẠN trên map này — mặc định
  // teal (#0f766e, tuyến chính). Tab Tuyến thay thế (map-first, phụ lục spec
  // 2026-08-07) truyền cam (#f59e0b) để phân biệt với tuyến chính vẽ mờ bên dưới.
  activeColor?: string;
  // Polyline THAM CHIẾU, không tương tác (không onClick/onMouseDown) — dùng cho
  // tab Tuyến thay thế: vẽ tuyến CHÍNH đã lưu để so với tuyến thay thế đang soạn
  // (activeColor). undefined/rỗng → không vẽ gì thêm.
  referencePath?: RouteCoordinate[];
  // Màu đường tham chiếu — mặc định teal tuyến chính (#0f766e) để user nhận ra
  // ngay "đây là tuyến chính", vẽ ĐỨT NÉT nên không lẫn với đường đang soạn.
  referenceColor?: string;
  // Marker điểm dừng của đường tham chiếu (tuyến chính) — chấm nhỏ đánh số,
  // không bấm được, chỉ để thấy tuyến chính đã set up những đâu.
  referenceStops?: Array<{
    stopId: string;
    orderIndex: number;
    name: string;
    latitude: number;
    longitude: number;
  }>;
  // Ẩn 2 checkbox đón/trả trong popup thêm gợi ý — tuyến thay thế không có khái
  // niệm đón/trả riêng theo điểm (AlternativeRouteRequest.stops không có 2 cờ
  // này). Mặc định true (tab Điểm dừng tuyến chính vẫn hiện như cũ).
  showPickupDropoffOptions?: boolean;
};

function toMapPath(path: RouteCoordinate[]): GoogleMapCoordinate[] {
  return path.map((point) => ({
    lat: point.latitude,
    lng: point.longitude,
  }));
}

export default function RouteDesignMap({
  points,
  pathPoints,
  stopMarkers,
  selectedStopId = "",
  onSelectStop,
  onRequestRemoveStop,
  routeOptions = [],
  selectedOptionIndex = 0,
  onSelectOption,
  selectedPathDurationMinutes = 0,
  viaPoints = [],
  onAddViaPoint,
  onBeginViaDrag,
  onMoveViaPoint,
  onDragViaPoint,
  onRemoveViaPoint,
  isRerouting = false,
  emptyText,
  suggestions = [],
  onAddSuggestion,
  isAddingSuggestion = false,
  externalActiveSuggestion = null,
  activeColor = mainRouteColor,
  referencePath,
  referenceColor = mainRouteColor,
  referenceStops,
  showPickupDropoffOptions = true,
}: RouteDesignMapProps) {
  const { t } = useTranslation("manager");
  // Callback đổi identity mỗi render của trang cha — giữ trong ref để các mảng
  // overlay memo theo DỮ LIỆU, closure đọc callback mới nhất lúc sự kiện xảy ra
  const callbacksRef = useRef({
    onAddViaPoint,
    onBeginViaDrag,
    onDragViaPoint,
    onMoveViaPoint,
    onRemoveViaPoint,
    onRequestRemoveStop,
    onSelectOption,
    onSelectStop,
  });

  // Đồng bộ trước paint để overlay vừa render không thể nhận click bằng callback
  // của render trước (đặc biệt lúc routeOptions vừa được auto-fetch).
  useLayoutEffect(() => {
    callbacksRef.current = {
      onAddViaPoint,
      onBeginViaDrag,
      onDragViaPoint,
      onMoveViaPoint,
      onRemoveViaPoint,
      onRequestRemoveStop,
      onSelectOption,
      onSelectStop,
    };
  });

  // Gợi ý điểm dừng đang mở popup (chấm bấm trên bản đồ hoặc từ ô search panel)
  // + 2 tuỳ chọn đón/trả — reset về true mỗi khi đổi sang gợi ý khác. Đồng bộ
  // theo props được làm NGAY TRONG RENDER (pattern "adjusting state during
  // render" của React) thay vì useEffect — gọi setState trong effect bị lint
  // react-hooks/set-state-in-effect chặn vì gây cascading render thừa.
  const [activeSuggestion, setActiveSuggestion] =
    useState<StopSuggestion | null>(null);
  const [allowPickup, setAllowPickup] = useState(true);
  const [allowDropoff, setAllowDropoff] = useState(true);

  // Card chi tiết marker điểm dừng ĐÃ GẮN (đánh số 1..N) đang mở, nếu có — CHỈ
  // một trong hai card (gợi ý / stop đã gắn) được mở tại một thời điểm: mở
  // card này thì đóng card kia và ngược lại (xem các nơi setState bên dưới).
  const [activeAttachedStopId, setActiveAttachedStopId] = useState<
    string | null
  >(null);

  // Theo dõi giá trị externalActiveSuggestion của lần render trước — đổi thì
  // đồng bộ vào activeSuggestion (mở popup như bấm chấm trên bản đồ)
  const [prevExternalSuggestion, setPrevExternalSuggestion] = useState(
    externalActiveSuggestion,
  );
  if (externalActiveSuggestion !== prevExternalSuggestion) {
    setPrevExternalSuggestion(externalActiveSuggestion);
    if (externalActiveSuggestion) {
      setActiveSuggestion(externalActiveSuggestion);
      setActiveAttachedStopId(null);
    }
  }

  // Theo dõi activeSuggestion của lần render trước — đổi thì reset 2 tuỳ chọn
  // đón/trả về mặc định true
  const [prevActiveSuggestion, setPrevActiveSuggestion] =
    useState(activeSuggestion);
  if (activeSuggestion !== prevActiveSuggestion) {
    setPrevActiveSuggestion(activeSuggestion);
    setAllowPickup(true);
    setAllowDropoff(true);
  }

  // Đóng popup nếu gợi ý đang mở không còn trong danh sách (vd vừa thêm xong
  // bị dedupe khỏi suggestions) — tự triệt tiêu: sau khi set null, điều kiện
  // này false ở render kế tiếp nên không lặp vô hạn.
  // TRỪ gợi ý đang mở đến từ externalActiveSuggestion (ô search panel): nguồn
  // này không bắt buộc phải là thành viên của `suggestions` (chỉ chứa chấm
  // ≤3km dọc tuyến) — vd kết quả Google Places cách xa polyline vẫn tìm/pick
  // được. Caller (index.tsx) đã merge nó vào suggestions để hiện chấm trên map,
  // nhưng guard ở đây vẫn tự chừa để component đứng vững kể cả khi caller khác
  // chưa làm vậy.
  if (
    activeSuggestion &&
    activeSuggestion !== externalActiveSuggestion &&
    !suggestions.some(
      (suggestion) =>
        suggestion.kind === activeSuggestion.kind &&
        suggestion.id === activeSuggestion.id,
    )
  ) {
    setActiveSuggestion(null);
  }

  // Stop đã gắn tương ứng card đang mở (nếu có) — tra trong stopMarkers theo id.
  // Đóng card nếu stop vừa bị gỡ khỏi tuyến (không còn trong stopMarkers) —
  // cùng pattern tự triệt tiêu như guard suggestion ở trên.
  const activeAttachedStop = activeAttachedStopId
    ? (stopMarkers?.find((stop) => stop.stopId === activeAttachedStopId) ??
      null)
    : null;
  if (activeAttachedStopId && !activeAttachedStop) {
    setActiveAttachedStopId(null);
  }

  // Google Place ID của gợi ý đang mở (nếu có) — truyền xuống StopDetailCard để
  // tự gọi Google Place Details (ảnh, rating, giờ mở cửa...). Gợi ý kho không
  // gắn googlePlaceId thì không gọi API, card giữ như cũ (chỉ tên/địa chỉ).
  const activeSuggestionPlaceId =
    activeSuggestion?.googlePlaceId ??
    (activeSuggestion?.kind === "googlePlace" ? activeSuggestion.id : null);

  // Instance bản đồ cho gesture túm thân đường (setOptions + mousemove/mouseup)
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    mapRef.current = map;
  }, []);
  // Gesture túm thân đường đang chạy: index điểm nắn + vị trí chuột hiện tại —
  // state cục bộ của map (re-render chỉ subtree này, không kéo cả trang theo)
  const [activeGrab, setActiveGrab] = useState<{
    index: number;
    position: GoogleMapCoordinate;
  } | null>(null);
  // Đang kéo điểm nắn bằng drag NATIVE của marker (không phải gesture túm đường)
  const [isMarkerDragging, setIsMarkerDragging] = useState(false);
  // Index + vị trí đang kéo native — cùng vai trò activeGrab nhưng cho nhánh
  // kéo marker chấm tròn (thay vì túm thân đường): dùng để dựng đường xem
  // trước nối thẳng qua điểm đang kéo, xem dragPreviewPath bên dưới.
  const [nativeDragPoint, setNativeDragPoint] = useState<{
    index: number;
    position: GoogleMapCoordinate;
  } | null>(null);
  // Hàm chốt gesture đang chạy — gọi khi unmount giữa chừng để không rò listener
  const grabCleanupRef = useRef<(() => void) | null>(null);
  // Sau mouseup của gesture, Google còn bắn thêm "click" trên polyline — chặn
  // click đó để không cắm thêm một điểm nắn thứ hai
  const suppressLineClickRef = useRef(false);

  useEffect(() => {
    return () => {
      grabCleanupRef.current?.();
    };
  }, []);

  // Bắt đầu kéo nắn từ mousedown trên thân đường đang chọn: cắm điểm nắn ngay
  // dưới chuột, khoá kéo bản đồ, theo mousemove cập nhật marker + preview
  // (hook tự throttle), mouseup → mở lại kéo bản đồ + chốt reroute như dragend.
  const beginPolylineGrab = useCallback((position: GoogleMapCoordinate) => {
    const map = mapRef.current;
    const begin = callbacksRef.current.onBeginViaDrag;
    // Không đủ khả năng chạy gesture (map chưa sẵn sàng / mock không hỗ trợ)
    // → bỏ qua, click fallback trên đường vẫn cắm điểm nắn được
    if (!map?.setOptions || !begin) {
      return;
    }

    const index = begin({ latitude: position.lat, longitude: position.lng });
    if (index < 0) {
      return;
    }

    suppressLineClickRef.current = true;
    map.setOptions({
      draggable: false,
      draggableCursor: "grabbing",
      draggingCursor: "grabbing",
    });
    setActiveGrab({ index, position });

    let lastPosition = position;
    let finished = false;
    let upListener: GoogleMapsEventListener | null = null;
    const moveListener = map.addListener("mousemove", (event) => {
      if (!event?.latLng) {
        return;
      }

      lastPosition = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      setActiveGrab({ index, position: lastPosition });
      callbacksRef.current.onDragViaPoint?.(index, {
        latitude: lastPosition.lat,
        longitude: lastPosition.lng,
      });
    });

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      grabCleanupRef.current = null;
      moveListener.remove();
      upListener?.remove();
      window.removeEventListener("mouseup", handleWindowMouseUp);
      // Optional chaining: guard đầu hàm không narrow được vào closure chạy sau
      map.setOptions?.({
        draggable: true,
        draggableCursor: "",
        draggingCursor: "",
      });
      setActiveGrab(null);
      callbacksRef.current.onMoveViaPoint?.(index, {
        latitude: lastPosition.lat,
        longitude: lastPosition.lng,
      });
      // Click "trễ" của Google tới ngay sau mouseup — nhả cờ chặn sau một nhịp
      window.setTimeout(() => {
        suppressLineClickRef.current = false;
      }, 250);
    };

    upListener = map.addListener("mouseup", (event) => {
      if (event?.latLng) {
        lastPosition = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      }
      finish();
    });
    // Thả chuột NGOÀI bản đồ (kéo ra khỏi khung) → vẫn phải chốt gesture
    const handleWindowMouseUp = () => finish();
    window.addEventListener("mouseup", handleWindowMouseUp);
    grabCleanupRef.current = finish;
  }, []);

  const displayedPath = pathPoints.length > 0 ? pathPoints : points;
  const center: GoogleMapCoordinate = useMemo(
    () =>
      displayedPath.length > 0
        ? {
            lat:
              displayedPath.reduce(
                (total, point) => total + point.latitude,
                0,
              ) / displayedPath.length,
            lng:
              displayedPath.reduce(
                (total, point) => total + point.longitude,
                0,
              ) / displayedPath.length,
          }
        : defaultRouteMapCenter,
    [displayedPath],
  );
  const linePositions = useMemo(
    () => toMapPath(displayedPath),
    [displayedPath],
  );
  // Xem trước dạng đường thẳng nối qua điểm đang kéo (gesture túm thân đường
  // HOẶC kéo native marker chấm tròn): bám tay chuột NGAY LẬP TỨC, không đợi
  // request tính đường bộ thật (throttle 350ms/50m — xem useRouteGeometry.ts,
  // mức owner đã duyệt vì API tính tiền theo request, không hạ thấp thêm).
  // Khi throttle trả kết quả mới, đường thật (routeOptions/pathPoints) thay
  // chỗ bản xem trước này.
  const activeDragPoint = activeGrab ?? nativeDragPoint;
  const dragPreviewPath = useMemo(() => {
    if (!activeDragPoint || displayedPath.length < 2) {
      return null;
    }

    const start = displayedPath[0];
    const end = displayedPath[displayedPath.length - 1];
    const draggedPoint: RouteCoordinate = {
      latitude: activeDragPoint.position.lat,
      longitude: activeDragPoint.position.lng,
    };
    const viaList =
      activeDragPoint.index >= viaPoints.length
        ? [...viaPoints, draggedPoint]
        : viaPoints.map((point, index) =>
            index === activeDragPoint.index ? draggedPoint : point,
          );

    return [start, ...viaList, end];
  }, [activeDragPoint, displayedPath, viaPoints]);
  const dragPreviewLinePositions = useMemo(
    () => (dragPreviewPath ? toMapPath(dragPreviewPath) : null),
    [dragPreviewPath],
  );
  // Đường tham chiếu (tuyến chính) khi soạn tuyến thay thế — vẽ mờ, không bắt
  // sự kiện (không onClick/onMouseDown), zIndex thấp nhất để luôn nằm dưới.
  const referenceLinePositions = useMemo(
    () => toMapPath(referencePath ?? []),
    [referencePath],
  );
  // Tuyến chính vẽ ĐỨT NÉT bằng chính màu tuyến chính: xám nhạt như bản cũ vừa
  // chìm vào nền bản đồ vừa không cho biết đó là tuyến gì, user không phân biệt
  // được tuyến thay thế đang soạn đã lệch khỏi tuyến chính ở đâu.
  const referencePolylines: GoogleMapPolyline[] = useMemo(
    () =>
      referenceLinePositions.length > 1
        ? [
            {
              color: referenceColor,
              dashed: true,
              id: "reference-route-path",
              opacity: 0.9,
              path: referenceLinePositions,
              weight: 5,
              zIndex: 0,
            },
          ]
        : [],
    [referenceColor, referenceLinePositions],
  );
  const hasSavedOrDraftPath = pathPoints.length > 1;
  // Có phương án auto-fetch → vẽ tất cả kèm bubble thời lượng để user bấm
  // chọn ngay trên bản đồ (không còn chip trong toolbar)
  const showOptionOverlay = routeOptions.length > 0;
  // Cho phép cắm điểm nắn: có handler truyền xuống. Dùng Boolean thay callback
  // trong deps memo — identity callback đổi mỗi render của trang cha
  const canAddViaPoint = Boolean(onAddViaPoint);
  const canSelectOption = Boolean(onSelectOption);
  const canSelectStop = Boolean(onSelectStop);
  const canMoveViaPoint = Boolean(onMoveViaPoint);
  const canDragViaPoint = Boolean(onDragViaPoint);
  const canRemoveViaPoint = Boolean(onRemoveViaPoint);
  // Túm thân đường cần đủ bộ: bắt đầu + stream + chốt (thiếu cái nào thì chỉ
  // còn click fallback)
  const canGrabLine =
    canAddViaPoint &&
    canDragViaPoint &&
    canMoveViaPoint &&
    Boolean(onBeginViaDrag);
  // Màu dùng chung cho MỌI phương án chưa chọn (đường + bubble thời lượng)
  const dimmedColor = useMemo(() => dimRouteColor(activeColor), [activeColor]);

  const mapPolylines: GoogleMapPolyline[] = useMemo(() => {
    // Click lên đường đang chọn → cắm điểm nắn tại vị trí click (fallback khi
    // gesture túm đường không chạy được; bị chặn ngay sau một gesture vừa chốt)
    const addViaPoint = canAddViaPoint
      ? (position?: GoogleMapCoordinate) => {
          if (suppressLineClickRef.current) {
            suppressLineClickRef.current = false;
            return;
          }

          if (position) {
            callbacksRef.current.onAddViaPoint?.({
              latitude: position.lat,
              longitude: position.lng,
            });
          }
        }
      : undefined;
    // Mousedown trên đường đang chọn → vào gesture kéo nắn một nhịp
    const grabLine = canGrabLine ? beginPolylineGrab : undefined;

    if (showOptionOverlay) {
      // Vẽ phương án đang chọn sau cùng + zIndex cao để luôn nổi trên các đường mờ.
      // Chưa có đường áp/lưu (pathPoints rỗng) → các phương án chỉ là bản xem
      // trước: click BẤT KỲ đường nào (kể cả đường đậm) là chọn + áp phương án đó;
      // đã có đường áp thì click đường đậm mới là cắm điểm nắn.
      // selectedOptionIndex = -1: đường ĐÃ LƯU đang chọn mà không trùng phương án
      // nào → vẽ thêm chính nó (đậm, kind "saved") đè lên các phương án mờ để so.
      // Dựng + SORT mảng dữ liệu thuần trước, gắn closure ở bước .map cuối —
      // sort sau khi đã có closure sẽ bị react-hooks/refs coi là "pass ref vào
      // function trong lúc render" (rule của React Compiler).
      return [
        ...routeOptions.map((option, index) => ({
          index,
          path: toMapPath(option.points),
          selected: index === selectedOptionIndex,
          zIndex: index === selectedOptionIndex ? 2 : 1,
          isSavedPath: false,
        })),
        ...(selectedOptionIndex < 0 && hasSavedOrDraftPath
          ? [
              {
                index: -1,
                path: linePositions,
                selected: true,
                zIndex: 3,
                isSavedPath: true,
              },
            ]
          : []),
      ]
        .sort((first, second) => first.zIndex - second.zIndex)
        .map(
          (line): GoogleMapPolyline => ({
            // Tuyến đang chọn giữ màu chính; phương án chưa chọn cùng tông nhưng nhạt.
            color: line.selected ? activeColor : dimmedColor,
            id: line.isSavedPath
              ? "route-geometry"
              : `route-option-${line.index}`,
            onClick:
              line.selected && hasSavedOrDraftPath
                ? addViaPoint
                : canSelectOption
                  ? () => callbacksRef.current.onSelectOption?.(line.index)
                  : undefined,
            onMouseDown:
              line.selected && hasSavedOrDraftPath ? grabLine : undefined,
            // Màu đã pha nhạt sẵn nên giữ opacity cao — mờ thêm nữa là chìm vào
            // nền bản đồ, đúng thứ user phàn nàn ở bản màu tím/cam trước
            opacity: line.selected ? 1 : 0.9,
            // Đang kéo nắn đường này → bám thẳng qua điểm dưới tay chuột thay
            // vì đợi request tính đường bộ thật (xem dragPreviewLinePositions)
            path:
              line.selected && dragPreviewLinePositions
                ? dragPreviewLinePositions
                : line.path,
            weight: line.selected ? 6 : 4,
            zIndex: line.zIndex,
          }),
        )
        .flatMap((line) =>
          // Đường mờ (chưa chọn) chỉ vẽ mảnh 4px — thêm lớp "vùng bắt click"
          // rộng vô hình đè lên trên để bấm gần đường vẫn chọn được luôn,
          // không phải rê chuột trúng đúng vệt mảnh mới đổi được tuyến. Tách
          // bước map thành ref/closure trước rồi flatMap thuần trên object đã
          // dựng xong (không đọc ref ở đây) để không dính rule react-hooks/refs.
          line.opacity === 1 || !line.onClick
            ? [line]
            : [
                {
                  ...line,
                  id: `${line.id}-hit`,
                  opacity: 0,
                  weight: 18,
                },
                line,
              ],
        );
    }

    return linePositions.length > 1
      ? [
          {
            color: hasSavedOrDraftPath ? activeColor : "#64748b",
            id: "route-geometry",
            // Đường đơn (1 phương án sau khi nắn / đường đã lưu) cũng nắn tiếp được
            onClick: hasSavedOrDraftPath ? addViaPoint : undefined,
            onMouseDown: hasSavedOrDraftPath ? grabLine : undefined,
            opacity: hasSavedOrDraftPath ? 1 : 0.62,
            path:
              hasSavedOrDraftPath && dragPreviewLinePositions
                ? dragPreviewLinePositions
                : linePositions,
            weight: hasSavedOrDraftPath ? 5 : 3,
          },
        ]
      : [];
  }, [
    activeColor,
    beginPolylineGrab,
    canAddViaPoint,
    canGrabLine,
    canSelectOption,
    dimmedColor,
    dragPreviewLinePositions,
    hasSavedOrDraftPath,
    linePositions,
    routeOptions,
    selectedOptionIndex,
    showOptionOverlay,
  ]);

  // Nhãn bubble thời lượng + marker điểm nắn tách thành 2 memo RIÊNG rồi mới gộp:
  // preview "kéo tới đâu tính tới đó" đổi routeOptions liên tục trong lúc kéo —
  // nếu chung một memo thì mảng gộp đổi identity theo và marker đang kéo bị vẽ lại
  const durationLabels: GoogleMapPointMarker[] = useMemo(() => {
    if (!showOptionOverlay) {
      return noPointMarkers;
    }

    const formatDuration = (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return hours > 0
        ? t("routes.routeOptionDurationHours", { hours, minutes })
        : t("routes.routeOptionDurationMinutes", { minutes });
    };

    // Đường đang chọn để đo chỗ tách nhánh: phương án đang chọn, hoặc đường đã
    // lưu/đang áp khi selectedOptionIndex = -1
    const selectedOption = routeOptions[selectedOptionIndex];
    const referencePoints = selectedOption?.points ?? displayedPath;
    // Neo đã cấp cho các bubble trước — tránh 2 bubble chồng chỗ
    const takenAnchors: RouteCoordinate[] = [];

    // Bubble của TUYẾN ĐANG CHỌN dựng trước và chiếm neo trước: các phương án
    // còn lại đo chỗ tách qua `takenAnchors` nên tự né nó. Trước đây tuyến đang
    // chọn cố tình không có nhãn (sợ che đường), nhưng thành ra chỉ đọc được
    // giờ của những phương án KHÔNG dùng — đúng số liệu người dùng cần thì phải
    // mở panel mới thấy. Giờ vẫn tách khỏi các bubble kia bằng màu: tô đặc màu
    // tuyến đang chọn + chữ trắng, thay vì bubble trắng viền nhạt.
    const selectedPoints = selectedOption?.points ?? displayedPath;
    const selectedMinutes =
      selectedOption?.estimatedDurationMinutes ?? selectedPathDurationMinutes;
    const selectedLabels: GoogleMapPointMarker[] = [];

    if (selectedPoints.length > 0 && selectedMinutes > 0) {
      // Đang chọn một phương án → dùng đúng ô tỉ lệ của phương án đó (mỗi index
      // một tỉ lệ nên không đụng bubble nào). Đường ĐÃ LƯU (index -1) không có ô
      // riêng: lấy savedPathBubbleFraction nằm ngoài dải 40/55/70% để không rơi
      // trúng chỗ dự phòng của phương án nào.
      const fraction =
        selectedOptionIndex >= 0
          ? bubblePositionFractions[
              selectedOptionIndex % bubblePositionFractions.length
            ]
          : savedPathBubbleFraction;
      const anchor =
        selectedPoints[
          Math.min(
            selectedPoints.length - 1,
            Math.floor(selectedPoints.length * fraction),
          )
        ];
      takenAnchors.push(anchor);
      const duration = formatDuration(selectedMinutes);

      selectedLabels.push({
        icon: {
          fillColor: activeColor,
          fillOpacity: 1,
          path: durationBubblePath,
          scale: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        id: "route-option-label-selected",
        label: {
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "700",
          text: duration,
        },
        position: {
          lat: anchor.latitude,
          lng: anchor.longitude,
        },
        title: t("routes.routeSelectedOptionLabel", { duration }),
        zIndex: 6,
      });
    }

    return selectedLabels.concat(
      routeOptions
      .map((option, index): GoogleMapPointMarker | null => {
      const selected = index === selectedOptionIndex;
      // Phương án đang chọn đã có bubble tô đặc ở trên, không vẽ chồng lần nữa.
      if (selected || option.points.length === 0) {
        return null;
      }
      // Bubble phải nằm trên ĐOẠN TÁCH của chính phương án này, không phải trên
      // đoạn nó trùng tuyến đang chọn (nhìn ra sẽ tưởng nhãn của tuyến chính).
      // Hai đường gần như trùng khít → không có đoạn riêng, lùi về vị trí theo
      // tỉ lệ chiều dài (40%/55%/70%, lệch nhau theo index cho khỏi chồng).
      const divergentAnchor = findRouteLabelAnchor(
        option.points,
        referencePoints,
        takenAnchors,
      );
      const fraction =
        bubblePositionFractions[index % bubblePositionFractions.length];
      const midPoint =
        divergentAnchor ??
        option.points[
          Math.min(
            option.points.length - 1,
            Math.floor(option.points.length * fraction),
          )
        ];
      takenAnchors.push(midPoint);
      const duration = formatDuration(option.estimatedDurationMinutes);

      return {
        cursor: "pointer",
        icon: {
          fillColor: "#ffffff",
          fillOpacity: 1,
          path: durationBubblePath,
          scale: 1,
          strokeColor: dimmedColor,
          strokeWeight: 2,
        },
        id: `route-option-label-${index}`,
        label: {
          color: dimmedColor,
          fontSize: "11px",
          fontWeight: "600",
          text: duration,
        },
        onClick: canSelectOption
          ? () => callbacksRef.current.onSelectOption?.(index)
          : undefined,
        position: {
          lat: midPoint.latitude,
          lng: midPoint.longitude,
        },
        title: t("routes.routeOptionLabel", {
          index: index + 1,
          duration,
          km: option.totalDistanceKm,
        }),
        zIndex: 4,
      };
    })
        .filter((marker): marker is GoogleMapPointMarker => marker !== null),
    );
  }, [
    activeColor,
    canSelectOption,
    dimmedColor,
    displayedPath,
    routeOptions,
    selectedOptionIndex,
    selectedPathDurationMinutes,
    showOptionOverlay,
    t,
  ]);

  const viaPointMarkers: GoogleMapPointMarker[] = useMemo(() => {
    if (viaPoints.length === 0 && !activeGrab) {
      return noPointMarkers;
    }

    // Gesture vừa bắt đầu, state viaPoints của hook chưa kịp flush → nối thêm
    // marker đang kéo để không "trống tay" một nhịp render. (Không tách helper
    // function — rule react-hooks/refs coi gọi hàm chứa closure đọc ref trong
    // render là vi phạm; giữ nguyên pattern closure trực tiếp trong .map)
    const viaList =
      activeGrab && activeGrab.index >= viaPoints.length
        ? [
            ...viaPoints,
            {
              latitude: activeGrab.position.lat,
              longitude: activeGrab.position.lng,
            },
          ]
        : viaPoints;

    return viaList.map((point, index): GoogleMapPointMarker => {
      // Trong gesture túm đường, vị trí marker đang kéo đi theo chuột (state
      // cục bộ) — GoogleMapCanvas dời marker bằng setPosition, KHÔNG recreate
      const grabbing = activeGrab?.index === index;

      return {
        cursor: "grab",
        draggable: canMoveViaPoint,
        icon: {
          fillColor: "#ffffff",
          fillOpacity: 1,
          path: viaPointPath,
          scale: 1,
          strokeColor: activeColor,
          strokeWeight: 3,
        },
        id: `via-point-${index}`,
        onClick: canRemoveViaPoint
          ? () => callbacksRef.current.onRemoveViaPoint?.(index)
          : undefined,
        // Drag native của marker: đánh dấu đang-kéo để tạm ngưng đồng bộ camera
        // (preview đổi path làm fitBounds/setCenter giật bản đồ giữa gesture)
        onDrag: canDragViaPoint
          ? (position) => {
              setIsMarkerDragging(true);
              setNativeDragPoint({ index, position });
              callbacksRef.current.onDragViaPoint?.(index, {
                latitude: position.lat,
                longitude: position.lng,
              });
            }
          : undefined,
        onDragEnd: canMoveViaPoint
          ? (position) => {
              setIsMarkerDragging(false);
              setNativeDragPoint(null);
              callbacksRef.current.onMoveViaPoint?.(index, {
                latitude: position.lat,
                longitude: position.lng,
              });
            }
          : undefined,
        position: grabbing
          ? activeGrab.position
          : { lat: point.latitude, lng: point.longitude },
        title: t("routes.viaPointHint"),
        zIndex: 5,
      };
    });
  }, [
    activeColor,
    activeGrab,
    canDragViaPoint,
    canMoveViaPoint,
    canRemoveViaPoint,
    t,
    viaPoints,
  ]);

  // Bến đi/bến đến dùng pin cố định theo pixel, mũi pin neo đúng tọa độ.
  // Điểm dừng trung gian đã có routeStopMarkers đánh số riêng nên không lặp lại.
  const routeEndpointMarkers: GoogleMapPointMarker[] = useMemo(() => {
    const endpoints = points.filter(
      (point) =>
        point.id.startsWith("origin-") ||
        point.id.startsWith("destination-") ||
        point.id.startsWith("alt-destination-"),
    );
    if (endpoints.length === 0) {
      return noPointMarkers;
    }

    return endpoints.map((point) => ({
      icon: {
        fillColor: point.color,
        fillOpacity: 1,
        path: routeEndpointPinPath,
        scale: 0.82,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      id: `route-endpoint-${point.id}`,
      position: {
        lat: point.latitude,
        lng: point.longitude,
      },
      title: point.name,
      zIndex: 8,
    }));
  }, [points]);

  // Marker điểm dừng đánh số 1..N theo orderIndex — stop đang chọn tô đậm nền,
  // click marker chọn stop (highlight dòng tương ứng trong panel). Không draggable.
  const routeStopMarkers: GoogleMapPointMarker[] = useMemo(() => {
    if (!stopMarkers || stopMarkers.length === 0) {
      return noPointMarkers;
    }

    return stopMarkers.map((stop): GoogleMapPointMarker => {
      const selected = stop.stopId === selectedStopId;

      return {
        cursor: canSelectStop ? "pointer" : undefined,
        icon: {
          fillColor: selected ? activeColor : "#ffffff",
          fillOpacity: 1,
          path: stopNumberPath,
          scale: 1,
          strokeColor: activeColor,
          strokeWeight: 2,
        },
        id: `route-stop-${stop.stopId}`,
        label: {
          color: selected ? "#ffffff" : activeColor,
          fontSize: "11px",
          fontWeight: "700",
          text: String(stop.orderIndex),
        },
        onClick: canSelectStop
          ? () => {
              callbacksRef.current.onSelectStop?.(stop.stopId);
              // Mở card chi tiết marker này — đóng card gợi ý đang mở (nếu có),
              // một card một thời điểm
              setActiveSuggestion(null);
              setActiveAttachedStopId(stop.stopId);
            }
          : undefined,
        position: {
          lat: stop.latitude,
          lng: stop.longitude,
        },
        title: `#${stop.orderIndex} · ${stop.name}`,
        zIndex: selected ? 7 : 6,
      };
    });
  }, [activeColor, canSelectStop, selectedStopId, stopMarkers]);

  // Điểm dừng của ĐƯỜNG THAM CHIẾU (tuyến chính) — chấm nhỏ viền đứt-nhạt cùng
  // màu tham chiếu, KHÔNG bấm được: chỉ để thấy tuyến chính đã set up qua những
  // điểm nào, so với marker số của tuyến thay thế đang soạn (activeColor).
  const referenceStopMarkers: GoogleMapPointMarker[] = useMemo(() => {
    if (!referenceStops || referenceStops.length === 0) {
      return noPointMarkers;
    }

    return referenceStops.map((stop): GoogleMapPointMarker => ({
      icon: {
        fillColor: "#ffffff",
        fillOpacity: 1,
        path: viaPointPath,
        scale: 0.8,
        strokeColor: referenceColor,
        strokeOpacity: 0.9,
        strokeWeight: 2,
      },
      id: `reference-stop-${stop.stopId}`,
      position: {
        lat: stop.latitude,
        lng: stop.longitude,
      },
      title: `#${stop.orderIndex} · ${stop.name}`,
      zIndex: 3,
    }));
  }, [referenceColor, referenceStops]);

  // Chấm gợi ý điểm dừng (kho nhà xe / Google Places) — memo RIÊNG như các loại
  // marker khác: click chấm mở popup card (state activeSuggestion cục bộ)
  const suggestionMarkers: GoogleMapPointMarker[] = useMemo(() => {
    if (suggestions.length === 0) {
      return noPointMarkers;
    }

    return suggestions.map((suggestion): GoogleMapPointMarker => {
      const isOperatorStop = suggestion.kind === "operatorStop";

      return {
        cursor: "pointer",
        icon: {
          // Gợi ý Google tô đỏ (cùng tông marker điểm đến) — chấm trắng viền xám
          // cũ chìm hẳn trên nền bản đồ, user không nhìn ra chỗ để bấm
          fillColor: isOperatorStop ? "#0f766e" : "#dc2626",
          fillOpacity: 1,
          path: viaPointPath,
          scale: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        id: `suggest-${suggestion.kind}-${suggestion.id}`,
        onClick: () => {
          setActiveSuggestion(suggestion);
          // Mở card gợi ý — đóng card marker stop đã gắn đang mở (nếu có)
          setActiveAttachedStopId(null);
        },
        position: {
          lat: suggestion.latitude,
          lng: suggestion.longitude,
        },
        title: suggestion.name,
        zIndex: 6,
      };
    });
  }, [suggestions]);

  const mapPointMarkers: GoogleMapPointMarker[] = useMemo(
    () =>
      durationLabels === noPointMarkers &&
      viaPointMarkers === noPointMarkers &&
      routeEndpointMarkers === noPointMarkers &&
      routeStopMarkers === noPointMarkers &&
      referenceStopMarkers === noPointMarkers &&
      suggestionMarkers === noPointMarkers
        ? noPointMarkers
        : [
            ...durationLabels,
            ...viaPointMarkers,
            ...routeEndpointMarkers,
            ...referenceStopMarkers,
            ...routeStopMarkers,
            ...suggestionMarkers,
          ],
    [
      durationLabels,
      referenceStopMarkers,
      routeEndpointMarkers,
      routeStopMarkers,
      suggestionMarkers,
      viaPointMarkers,
    ],
  );

  // m-A: chọn gợi ý từ ô search (externalActiveSuggestion) phải kéo bản đồ tới
  // thấy chấm — nếu chấm nằm ngoài viewport hiện tại (vd kết quả Google Places
  // xa polyline) mà không đưa vào fitPoints thì bay tới không thấy gì.
  const externalSuggestionPoint = useMemo(
    () =>
      externalActiveSuggestion
        ? [
            {
              lat: externalActiveSuggestion.latitude,
              lng: externalActiveSuggestion.longitude,
            },
          ]
        : [],
    [externalActiveSuggestion],
  );

  const fitPoints = useMemo(
    () =>
      showOptionOverlay
        ? [
            // Gồm cả đường đang hiển thị (vd đường đã lưu không trùng phương án
            // nào) để fit không cắt mất nó
            ...linePositions,
            ...routeOptions.flatMap((option) => toMapPath(option.points)),
            ...externalSuggestionPoint,
            ...referenceLinePositions,
          ]
        : [...linePositions, ...externalSuggestionPoint, ...referenceLinePositions],
    [
      externalSuggestionPoint,
      linePositions,
      referenceLinePositions,
      routeOptions,
      showOptionOverlay,
    ],
  );

  // Click nền bản đồ khi đang mở card (gợi ý HOẶC stop đã gắn) → đóng card
  // (card khá to, che bản đồ — bấm ra chỗ trống phải giải phóng tầm nhìn)
  const isDetailCardOpen = activeSuggestion !== null || activeAttachedStop !== null;
  const handleMapClick = useMemo(() => {
    if (isDetailCardOpen) {
      return () => {
        setActiveSuggestion(null);
        setActiveAttachedStopId(null);
      };
    }

    return undefined;
  }, [isDetailCardOpen]);

  // Toạ độ neo card: NGAY DƯỚI chấm/marker đang mở (GoogleMapCanvas tự vẽ card
  // tại vị trí này qua OverlayView) — null khi không có card nào mở. Hai state
  // loại trừ nhau (xem các setState ở trên) nên chỉ một nhánh có giá trị.
  const activeCardAnchor: GoogleMapCoordinate | null = activeSuggestion
    ? { lat: activeSuggestion.latitude, lng: activeSuggestion.longitude }
    : activeAttachedStop
      ? { lat: activeAttachedStop.latitude, lng: activeAttachedStop.longitude }
      : null;

  // Card chi tiết gợi ý điểm dừng: mở khi bấm chấm gợi ý trên bản đồ hoặc chọn
  // từ ô search panel — kiểu Google Maps (ảnh/rating/giờ mở cửa) khi gợi ý có
  // googlePlaceId, cho phép chỉnh đón/trả trước khi thêm vào tuyến.
  const suggestionPopup = activeSuggestion ? (
    <StopDetailCard
      testId="stop-suggestion-popup"
      title={activeSuggestion.name}
      titleBadge={
        <span className="rounded-full bg-vr-100 px-2 py-0.5 text-xs font-medium text-vr-700">
          {activeSuggestion.kind === "operatorStop"
            ? t("routes.suggestSourceOperator")
            : t("routes.suggestSourceGoogle")}
        </span>
      }
      address={activeSuggestion.address}
      googlePlaceId={activeSuggestionPlaceId}
      metricsText={t("routes.suggestMetrics", {
        km: activeSuggestion.distanceFromStartKm.toFixed(1),
        minutes: estimateCoachDurationMinutes(
          activeSuggestion.distanceFromStartKm,
        ),
      })}
      onClose={() => setActiveSuggestion(null)}
    >
      {showPickupDropoffOptions && (
      <div className="mt-2 flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <Checkbox checked={allowPickup} onChange={setAllowPickup} />
          {t("routes.allowPickup")}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <Checkbox checked={allowDropoff} onChange={setAllowDropoff} />
          {t("routes.allowDropoff")}
        </label>
      </div>
      )}
      <button
        type="button"
        disabled={isAddingSuggestion}
        onClick={() => {
          onAddSuggestion?.(activeSuggestion, {
            allowPickup,
            allowDropoff,
          });
          setActiveSuggestion(null);
        }}
        className="mt-3 w-full rounded-md bg-vr-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {activeSuggestion.kind === "operatorStop"
          ? t("routes.suggestAdd")
          : t("routes.suggestCreateAdd")}
      </button>
    </StopDetailCard>
  ) : null;

  // Card chi tiết marker điểm dừng ĐÃ GẮN vào tuyến (đánh số 1..N) — cùng kiểu
  // Google Maps như card gợi ý (reuse StopDetailCard), hành động là nút "Gỡ
  // khỏi tuyến" thay vì "Thêm vào tuyến". Chỉ hiện nút gỡ khi caller có truyền
  // onRequestRemoveStop (canManageRoutes) — viewer chỉ xem thông tin.
  const attachedStopPopup = activeAttachedStop ? (
    <StopDetailCard
      testId="stop-detail-popup"
      title={`#${activeAttachedStop.orderIndex} · ${activeAttachedStop.name}`}
      address={activeAttachedStop.address}
      googlePlaceId={activeAttachedStop.googlePlaceId ?? null}
      metricsText={
        activeAttachedStop.distanceFromOriginKm !== undefined &&
        activeAttachedStop.estimatedDurationFromOriginMinutes !== undefined
          ? t("routes.suggestMetrics", {
              km: activeAttachedStop.distanceFromOriginKm.toFixed(1),
              minutes: activeAttachedStop.estimatedDurationFromOriginMinutes,
            })
          : undefined
      }
      onClose={() => setActiveAttachedStopId(null)}
    >
      {onRequestRemoveStop && (
        <button
          type="button"
          onClick={() =>
            callbacksRef.current.onRequestRemoveStop?.(
              activeAttachedStop.stopId,
            )
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <FiTrash2 size={14} />
          {t("routes.removeRouteStop")}
        </button>
      )}
    </StopDetailCard>
  ) : null;

  const activeCardContent = suggestionPopup ?? attachedStopPopup;

  return (
    <div className="relative h-full">
      <GoogleMapCanvas
        anchorContent={activeCardContent}
        anchorPosition={activeCardAnchor}
        ariaLabel={t("routes.designMapAria")}
        center={center}
        fitPoints={fitPoints}
        onMapClick={handleMapClick}
        onMapReady={handleMapReady}
        pointMarkers={mapPointMarkers}
        polylines={
          referencePolylines.length > 0
            ? [...referencePolylines, ...mapPolylines]
            : mapPolylines
        }
        className="h-full w-full"
        // Đang kéo nắn (native drag hoặc túm thân đường) → preview đổi path
        // không được giật camera (setCenter/fitBounds) giữa gesture
        suspendViewportSync={isMarkerDragging || activeGrab !== null}
        zoom={displayedPath.length > 1 ? 8 : 13}
      />
      {/* Pill "đang tính..." trong lúc chờ reroute (kéo điểm nắn / đổi loại xe) */}
      {isRerouting && (
        <span
          data-testid="reroute-computing-indicator"
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm"
        >
          <FiLoader className="animate-spin" size={12} />
          {t("routes.rerouteComputing")}
        </span>
      )}
      {points.length === 0 && (
        <p className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 px-3 py-2 text-xs text-gray-500">
          {emptyText}
        </p>
      )}
    </div>
  );
}
