// Bản đồ thiết kế tuyến: marker bến/điểm dừng + polyline hình học tuyến.
// Khi có nhiều phương án: vẽ TẤT CẢ (phương án chọn đậm, còn lại xám mờ), nhãn
// bubble thời lượng trên từng đường, click đường/nhãn để chọn; TÚM thẳng thân
// đường đang chọn (mousedown) là cắm điểm nắn ngay dưới chuột + kéo liền một
// nhịp như Google Maps thật (gesture tuỳ chỉnh: khoá kéo bản đồ, theo mousemove,
// mouseup chốt reroute); click đường vẫn là fallback cắm điểm nắn.
// Mọi mảng overlay đều memo hoá — GoogleMapCanvas reconcile overlay theo identity
// mảng/id, không memo thì mỗi render của trang cha là một lần vẽ lại toàn bộ.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiLoader } from "react-icons/fi";
import GoogleMapCanvas, {
  type GoogleMapPointMarker,
  type GoogleMapPolyline,
} from "../../../components/GoogleMapCanvas";
import type {
  GoogleMapCoordinate,
  GoogleMapInstance,
  GoogleMapsEventListener,
} from "../../../lib/googleMaps";
import type { RoadRouteOption } from "./geometry";
import type { RouteCoordinate } from "./polyline";
import type { RouteMapPoint } from "./types";

const defaultRouteMapCenter: GoogleMapCoordinate = {
  lat: 10.7769,
  lng: 106.7009,
};

// Symbol path: bubble bo tròn cho nhãn thời lượng (tâm 0,0 để label nằm giữa)
const durationBubblePath =
  "M -24 -12 H 24 A 12 12 0 0 1 24 12 H -24 A 12 12 0 0 1 -24 -12 Z";
// Symbol path: chấm tròn cho điểm nắn lộ trình kéo được
const viaPointPath = "M 0 -9 a 9 9 0 1 1 0 18 a 9 9 0 1 1 0 -18 Z";
// Symbol path: đĩa tròn to hơn cho marker điểm dừng đánh số 1..N
const stopNumberPath = "M 0 -11 a 11 11 0 1 1 0 22 a 11 11 0 1 1 0 -22 Z";

// Vị trí bubble thời lượng dọc theo đường theo index phương án (40%/55%/70%
// chiều dài) — tránh 2 bubble đè nhau khi các phương án bám sát nhau
const bubblePositionFractions = [0.4, 0.55, 0.7];

// Mảng rỗng ổn định identity — trả về từ memo khi không có nhãn/marker để mảng
// pointMarkers gộp không đổi identity vô cớ (đổi identity giữa lúc kéo là
// GoogleMapCanvas gỡ + vẽ lại marker, cắt đứt thao tác kéo đang diễn ra)
const noPointMarkers: GoogleMapPointMarker[] = [];

// Điểm dừng của tuyến hiển thị thành marker đánh số 1..N theo orderIndex —
// click marker chọn stop tương ứng (đồng bộ highlight với danh sách trong panel).
// Marker điểm dừng KHÔNG kéo được: vị trí stop là cố định.
export type RouteStopMarker = {
  stopId: string;
  orderIndex: number;
  name: string;
  latitude: number;
  longitude: number;
};

type RouteDesignMapProps = {
  points: RouteMapPoint[];
  pathPoints: RouteCoordinate[];
  // Marker điểm dừng đánh số + stop đang chọn (highlight) + handler chọn
  stopMarkers?: RouteStopMarker[];
  selectedStopId?: string;
  onSelectStop?: (stopId: string) => void;
  // Các phương án Google trả về sau "Tính đường tự động" — vẽ tất cả, phương án
  // đang chọn đậm, phương án khác xám mờ (click đường mờ/nhãn để chọn)
  routeOptions?: RoadRouteOption[];
  selectedOptionIndex?: number;
  onSelectOption?: (index: number) => void;
  // Điểm nắn lộ trình đang có + các thao tác cắm/kéo/xoá (undefined = chỉ xem)
  viaPoints?: RouteCoordinate[];
  onAddViaPoint?: (point: RouteCoordinate) => void;
  // Bắt đầu gesture túm thân đường: cắm điểm nắn tại point (không reroute),
  // trả về index điểm mới (-1 = chạm trần) — kéo stream qua onDragViaPoint,
  // chốt qua onMoveViaPoint lúc thả
  onBeginViaDrag?: (point: RouteCoordinate) => number;
  onMoveViaPoint?: (index: number, point: RouteCoordinate) => void;
  // Bắn liên tục trong lúc kéo điểm nắn (event drag) — "kéo tới đâu tính tới đó"
  onDragViaPoint?: (index: number, point: RouteCoordinate) => void;
  onRemoveViaPoint?: (index: number) => void;
  // Đang có request tính lại đường chạy ngầm → hiện pill "đang tính..." trên map
  isRerouting?: boolean;
  isEditing: boolean;
  onAppendPoint: (point: RouteCoordinate) => void;
  emptyText: string;
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
  routeOptions = [],
  selectedOptionIndex = 0,
  onSelectOption,
  viaPoints = [],
  onAddViaPoint,
  onBeginViaDrag,
  onMoveViaPoint,
  onDragViaPoint,
  onRemoveViaPoint,
  isRerouting = false,
  isEditing,
  onAppendPoint,
  emptyText,
}: RouteDesignMapProps) {
  const { t } = useTranslation("manager");
  // Callback đổi identity mỗi render của trang cha — giữ trong ref để các mảng
  // overlay memo theo DỮ LIỆU, closure đọc callback mới nhất lúc sự kiện xảy ra
  const callbacksRef = useRef({
    onAddViaPoint,
    onAppendPoint,
    onBeginViaDrag,
    onDragViaPoint,
    onMoveViaPoint,
    onRemoveViaPoint,
    onSelectOption,
    onSelectStop,
  });

  useEffect(() => {
    callbacksRef.current = {
      onAddViaPoint,
      onAppendPoint,
      onBeginViaDrag,
      onDragViaPoint,
      onMoveViaPoint,
      onRemoveViaPoint,
      onSelectOption,
      onSelectStop,
    };
  });

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
  const hasSavedOrDraftPath = pathPoints.length > 1;
  // Có phương án auto-fetch (và không đang vẽ tay) → vẽ tất cả kèm bubble thời
  // lượng để user bấm chọn ngay trên bản đồ (không còn chip trong toolbar)
  const showOptionOverlay = routeOptions.length > 0 && !isEditing;
  // Cho phép cắm điểm nắn: có handler + không ở chế độ vẽ tay. Dùng Boolean thay
  // callback trong deps memo — identity callback đổi mỗi render của trang cha
  const canAddViaPoint = Boolean(onAddViaPoint) && !isEditing;
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

  const mapMarkers = useMemo(
    () => [
      ...points.map((point) => ({
        color: point.color,
        id: point.id,
        position: {
          lat: point.latitude,
          lng: point.longitude,
        },
        radiusMeters: 1_200,
        title: point.name,
      })),
      ...(isEditing
        ? pathPoints.map((point, index) => ({
            color: "#0f766e",
            id: `geometry-${index}-${point.latitude}-${point.longitude}`,
            position: {
              lat: point.latitude,
              lng: point.longitude,
            },
            radiusMeters: 550,
          }))
        : []),
    ],
    [isEditing, pathPoints, points],
  );

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
            color: line.selected ? "#0f766e" : "#94a3b8",
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
            opacity: line.selected ? 1 : 0.55,
            path: line.path,
            weight: line.selected ? 5 : 4,
            zIndex: line.zIndex,
          }),
        );
    }

    return linePositions.length > 1
      ? [
          {
            color: hasSavedOrDraftPath ? "#0f766e" : "#64748b",
            id: "route-geometry",
            // Đường đơn (1 phương án sau khi nắn / đường đã lưu) cũng nắn tiếp được
            onClick: hasSavedOrDraftPath ? addViaPoint : undefined,
            onMouseDown: hasSavedOrDraftPath ? grabLine : undefined,
            opacity: hasSavedOrDraftPath ? 1 : 0.62,
            path: linePositions,
            weight: hasSavedOrDraftPath ? 5 : 3,
          },
        ]
      : [];
  }, [
    beginPolylineGrab,
    canAddViaPoint,
    canGrabLine,
    canSelectOption,
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

    return routeOptions.map((option, index): GoogleMapPointMarker => {
      const selected = index === selectedOptionIndex;
      // Bubble đặt lệch nhau theo index (40%/55%/70% chiều dài đường) — các
      // phương án chạy gần nhau sẽ không chồng bubble lên cùng một chỗ
      const fraction =
        bubblePositionFractions[index % bubblePositionFractions.length];
      const midPoint =
        option.points[
          Math.min(
            option.points.length - 1,
            Math.floor(option.points.length * fraction),
          )
        ];
      const hours = Math.floor(option.estimatedDurationMinutes / 60);
      const minutes = option.estimatedDurationMinutes % 60;
      const duration =
        hours > 0
          ? t("routes.routeOptionDurationHours", { hours, minutes })
          : t("routes.routeOptionDurationMinutes", { minutes });

      return {
        cursor: "pointer",
        icon: {
          fillColor: "#ffffff",
          fillOpacity: 1,
          path: durationBubblePath,
          scale: 1,
          strokeColor: selected ? "#0f766e" : "#94a3b8",
          strokeWeight: selected ? 2 : 1.5,
        },
        id: `route-option-label-${index}`,
        label: {
          color: selected ? "#0f766e" : "#475569",
          fontSize: "11px",
          fontWeight: selected ? "700" : "600",
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
        zIndex: selected ? 4 : 3,
      };
    });
  }, [
    canSelectOption,
    routeOptions,
    selectedOptionIndex,
    showOptionOverlay,
    t,
  ]);

  const viaPointMarkers: GoogleMapPointMarker[] = useMemo(() => {
    if (isEditing || (viaPoints.length === 0 && !activeGrab)) {
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
          strokeColor: "#0f766e",
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
              callbacksRef.current.onDragViaPoint?.(index, {
                latitude: position.lat,
                longitude: position.lng,
              });
            }
          : undefined,
        onDragEnd: canMoveViaPoint
          ? (position) => {
              setIsMarkerDragging(false);
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
    activeGrab,
    canDragViaPoint,
    canMoveViaPoint,
    canRemoveViaPoint,
    isEditing,
    t,
    viaPoints,
  ]);

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
          fillColor: selected ? "#0f766e" : "#ffffff",
          fillOpacity: 1,
          path: stopNumberPath,
          scale: 1,
          strokeColor: "#0f766e",
          strokeWeight: 2,
        },
        id: `route-stop-${stop.stopId}`,
        label: {
          color: selected ? "#ffffff" : "#0f766e",
          fontSize: "11px",
          fontWeight: "700",
          text: String(stop.orderIndex),
        },
        onClick: canSelectStop
          ? () => callbacksRef.current.onSelectStop?.(stop.stopId)
          : undefined,
        position: {
          lat: stop.latitude,
          lng: stop.longitude,
        },
        title: `#${stop.orderIndex} · ${stop.name}`,
        zIndex: selected ? 7 : 6,
      };
    });
  }, [canSelectStop, selectedStopId, stopMarkers]);

  const mapPointMarkers: GoogleMapPointMarker[] = useMemo(
    () =>
      durationLabels === noPointMarkers &&
      viaPointMarkers === noPointMarkers &&
      routeStopMarkers === noPointMarkers
        ? noPointMarkers
        : [...durationLabels, ...viaPointMarkers, ...routeStopMarkers],
    [durationLabels, routeStopMarkers, viaPointMarkers],
  );

  const fitPoints = useMemo(
    () =>
      showOptionOverlay
        ? [
            // Gồm cả đường đang hiển thị (vd đường đã lưu không trùng phương án
            // nào) để fit không cắt mất nó
            ...linePositions,
            ...routeOptions.flatMap((option) => toMapPath(option.points)),
          ]
        : linePositions,
    [linePositions, routeOptions, showOptionOverlay],
  );

  const handleMapClick = useMemo(
    () =>
      isEditing
        ? (position: GoogleMapCoordinate) =>
            callbacksRef.current.onAppendPoint({
              latitude: position.lat,
              longitude: position.lng,
            })
        : undefined,
    [isEditing],
  );

  return (
    <div className={`relative h-full ${isEditing ? "cursor-crosshair" : ""}`}>
      <GoogleMapCanvas
        ariaLabel={t("routes.designMapAria")}
        center={center}
        fitPoints={fitPoints}
        markers={mapMarkers}
        onMapClick={handleMapClick}
        onMapReady={handleMapReady}
        pointMarkers={mapPointMarkers}
        polylines={mapPolylines}
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
