import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  loadGoogleMapsLibrary,
  type GoogleCircleInstance,
  type GoogleMapCoordinate,
  type GoogleMapInstance,
  type GoogleMapsEventListener,
  type GoogleMapsLibrary,
  type GoogleMapStyleElement,
  type GoogleMarkerInstance,
  type GoogleOverlayViewInstance,
  type GooglePolylineInstance,
} from "../lib/googleMaps";

export type GoogleMapMarker = {
  color: string;
  description?: string[];
  fillOpacity?: number;
  id: string;
  onClick?: () => void;
  position: GoogleMapCoordinate;
  radiusMeters?: number;
  selected?: boolean;
  title?: string;
};

export type GoogleMapPolyline = {
  color: string;
  id: string;
  // Click chọn polyline (vd chọn phương án đường mờ) — có onClick thì clickable.
  // position là tọa độ click trên đường (dùng cắm điểm nắn lộ trình)
  onClick?: (position?: GoogleMapCoordinate) => void;
  // Mousedown trên thân đường — khởi động kéo nắn tuỳ chỉnh kiểu Google Maps
  // (túm thẳng thân đường); có handler thì polyline cũng clickable
  onMouseDown?: (position: GoogleMapCoordinate) => void;
  opacity?: number;
  path: GoogleMapCoordinate[];
  weight?: number;
  // Thứ tự chồng lớp: phương án đang chọn vẽ đè lên các phương án mờ
  zIndex?: number;
};

// Marker dạng Symbol (google.maps.Marker legacy): nhãn bubble thời lượng phương án
// hoặc điểm trung gian kéo được để nắn lộ trình
export type GoogleMapPointMarker = {
  cursor?: string;
  draggable?: boolean;
  icon?: {
    fillColor?: string;
    fillOpacity?: number;
    path: string;
    scale?: number;
    strokeColor?: string;
    strokeWeight?: number;
  };
  id: string;
  label?: {
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    text: string;
  };
  onClick?: () => void;
  // Bắn LIÊN TỤC trong lúc kéo marker (event "drag") — caller tự throttle
  onDrag?: (position: GoogleMapCoordinate) => void;
  onDragEnd?: (position: GoogleMapCoordinate) => void;
  position: GoogleMapCoordinate;
  title?: string;
  zIndex?: number;
};

type GoogleMapCanvasProps = {
  // Nội dung card neo theo anchorPosition (render qua React portal vào div của
  // OverlayView) — dùng cho popup gợi ý điểm dừng, thả NGAY DƯỚI chấm trên bản
  // đồ thay vì docked cố định một góc. Chỉ vẽ khi có ĐỦ cả anchorContent lẫn
  // anchorPosition; thiếu một trong hai thì overlay bị ẩn (setMap(null)).
  anchorContent?: ReactNode;
  anchorPosition?: GoogleMapCoordinate | null;
  ariaLabel: string;
  center: GoogleMapCoordinate;
  className?: string;
  emptyState?: ReactNode;
  fitPoints?: GoogleMapCoordinate[];
  focusCenter?: GoogleMapCoordinate | null;
  /** Optional product palette. Kept stable after map creation to avoid repaint churn. */
  mapStyles?: readonly GoogleMapStyleElement[];
  markers?: GoogleMapMarker[];
  onMapClick?: (position: GoogleMapCoordinate) => void;
  // Trao instance bản đồ cho caller cần thao tác imperative (setOptions khoá kéo
  // bản đồ + addListener mousemove/mouseup cho kéo nắn tuỳ chỉnh). Gọi 1 lần khi
  // bản đồ sẵn sàng — caller giữ trong ref, KHÔNG setState từ callback này.
  onMapReady?: (map: GoogleMapInstance) => void;
  pointMarkers?: GoogleMapPointMarker[];
  polylines?: GoogleMapPolyline[];
  /** Safe caller-owned copy instead of exposing loader/config details to users. */
  errorFallback?: ReactNode;
  scrollWheelZoom?: boolean;
  // true = tạm ngưng đồng bộ camera theo props (setCenter/setZoom/fitBounds) —
  // bật trong lúc kéo nắn đường để preview không giật camera giữa thao tác
  suspendViewportSync?: boolean;
  zoom: number;
};

type ReadyMap = {
  instance: GoogleMapInstance;
  library: GoogleMapsLibrary;
};

const defaultClassName = "h-full min-h-60 w-full";

function buildInfoContent(marker: GoogleMapMarker) {
  const wrapper = document.createElement("div");
  wrapper.className = "min-w-40 py-1";

  if (marker.title) {
    const title = document.createElement("p");
    title.className = "font-semibold text-gray-900";
    title.textContent = marker.title;
    wrapper.appendChild(title);
  }

  marker.description?.forEach((line) => {
    const description = document.createElement("p");
    description.className = "mt-0.5 text-xs text-gray-600";
    description.textContent = line;
    wrapper.appendChild(description);
  });

  return wrapper;
}

function clearCircles(circles: GoogleCircleInstance[]) {
  circles.forEach((circle) => circle.setMap(null));
}

function clearPolylines(polylines: GooglePolylineInstance[]) {
  polylines.forEach((polyline) => polyline.setMap(null));
}

// Một marker Symbol đang sống trên bản đồ (pool reconcile theo id): overlay +
// listener bind một lần + data mới nhất để dispatcher gọi đúng callback hiện tại
type PooledPointMarker = {
  data: GoogleMapPointMarker;
  listeners: Array<GoogleMapsEventListener | undefined>;
  overlay: GoogleMarkerInstance;
  positionKey: string;
  styleKey: string;
};

// Khóa "hình dạng" của marker — đổi khóa này mới phải gỡ + vẽ lại instance;
// KHÔNG gồm position (dời tại chỗ bằng setPosition) và callback (đọc qua data)
function buildPointMarkerStyleKey(marker: GoogleMapPointMarker) {
  return JSON.stringify({
    clickable: Boolean(marker.onClick),
    cursor: marker.cursor,
    draggable: marker.draggable,
    icon: marker.icon,
    label: marker.label,
    title: marker.title,
    zIndex: marker.zIndex,
  });
}

function removePooledPointMarker(entry: PooledPointMarker) {
  entry.listeners.forEach((listener) => listener?.remove());
  entry.overlay.setMap(null);
}

export default function GoogleMapCanvas({
  anchorContent,
  anchorPosition = null,
  ariaLabel,
  center,
  className = defaultClassName,
  emptyState,
  fitPoints = [],
  focusCenter,
  mapStyles,
  markers = [],
  onMapClick,
  onMapReady,
  pointMarkers = [],
  polylines = [],
  errorFallback,
  scrollWheelZoom = true,
  suspendViewportSync = false,
  zoom,
}: GoogleMapCanvasProps) {
  const { t } = useTranslation("common");
  // Giữ t trong ref để effect khởi tạo bản đồ không phải chạy lại khi đổi ngôn ngữ.
  const tRef = useRef(t);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<ReadyMap | null>(null);
  const mapClickListenerRef = useRef<GoogleMapsEventListener | null>(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const initialMapStylesRef = useRef(mapStyles);
  const [readyMap, setReadyMap] = useState<ReadyMap | null>(null);
  const [error, setError] = useState("");
  // Callback onMapReady giữ trong ref — identity đổi mỗi render của caller
  // không được kích lại effect trao instance
  const onMapReadyRef = useRef(onMapReady);
  // Pool marker Symbol theo id — reconcile thay vì gỡ + vẽ lại toàn bộ
  const pointMarkerPoolRef = useRef(new Map<string, PooledPointMarker>());
  // OverlayView neo card tuỳ ý (popup gợi ý điểm dừng) — tạo LƯỜI một lần khi
  // thực sự cần (có cả anchorPosition lẫn anchorContent), giữ instance qua ref
  // để đổi vị trí/nội dung không phải gỡ + vẽ lại toàn bộ overlay
  const anchorOverlayRef = useRef<GoogleOverlayViewInstance | null>(null);
  const anchorOverlayDivRef = useRef<HTMLDivElement | null>(null);
  // Vị trí neo mới nhất — đọc trong draw() (closure gán một lần lúc tạo overlay)
  // để luôn dùng toạ độ hiện tại thay vì giá trị đóng băng lúc khởi tạo
  const anchorPositionRef = useRef(anchorPosition);
  const [anchorContainer, setAnchorContainer] =
    useState<HTMLDivElement | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (readyMap) {
      onMapReadyRef.current?.(readyMap.instance);
    }
  }, [readyMap]);

  const fitSignature = useMemo(
    () =>
      fitPoints
        .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
        .join("|"),
    [fitPoints],
  );

  useEffect(() => {
    let active = true;
    let initializationFrame: number | null = null;

    void loadGoogleMapsLibrary()
      .then((library) => {
        if (!active) {
          return;
        }

        initializationFrame = window.requestAnimationFrame(() => {
          const container = containerRef.current;
          if (
            !active ||
            !(container instanceof HTMLElement) ||
            !container.isConnected
          ) {
            return;
          }

          if (mapInstanceRef.current) {
            setReadyMap(mapInstanceRef.current);
            return;
          }

          try {
            const instance = new library.Map(container, {
              cameraControl: false,
              center: initialCenterRef.current,
              clickableIcons: true,
              fullscreenControl: false,
              // "greedy": cuộn chuột luôn zoom map ngay, không cần giữ ctrl —
              // đổi từ "cooperative" để bỏ banner đen gợi ý "Sử dụng ctrl +
              // cuộn..." mà Google tự hiện khi cuộn không giữ ctrl.
              gestureHandling: scrollWheelZoom ? "greedy" : "none",
              mapTypeControl: false,
              renderingType: "RASTER",
              rotateControl: false,
              scaleControl: false,
              streetViewControl: false,
              styles: initialMapStylesRef.current,
              zoom: initialZoomRef.current,
              zoomControl: true,
            });
            const nextReadyMap = { instance, library };
            mapInstanceRef.current = nextReadyMap;

            if (active) {
              setReadyMap(nextReadyMap);
            }
          } catch (mapError: unknown) {
            if (active) {
              setError(
                mapError instanceof Error
                  ? mapError.message
                  : tRef.current("map.initFailed"),
              );
            }
          }
        });
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : tRef.current("map.loadFailed"),
        );
      });

    return () => {
      active = false;
      if (initializationFrame !== null) {
        window.cancelAnimationFrame(initializationFrame);
      }
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
    };
  }, [scrollWheelZoom]);

  useEffect(() => {
    if (!readyMap || suspendViewportSync) {
      return;
    }

    readyMap.instance.setCenter(center);
    readyMap.instance.setZoom(zoom);
  }, [center, readyMap, suspendViewportSync, zoom]);

  useEffect(() => {
    if (!readyMap || !focusCenter) {
      return;
    }

    readyMap.instance.panTo(focusCenter);
    readyMap.instance.setZoom(14);
  }, [focusCenter, readyMap]);

  useEffect(() => {
    if (!readyMap || suspendViewportSync || fitPoints.length < 2) {
      return;
    }

    const bounds = new readyMap.library.LatLngBounds();
    fitPoints.forEach((point) => bounds.extend(point));
    if (!bounds.isEmpty()) {
      readyMap.instance.fitBounds(bounds, 32);
    }
  }, [fitPoints, fitSignature, readyMap, suspendViewportSync]);

  useEffect(() => {
    mapClickListenerRef.current?.remove();
    mapClickListenerRef.current = null;

    if (!readyMap || !onMapClick) {
      return;
    }

    mapClickListenerRef.current = readyMap.instance.addListener(
      "click",
      (event) => {
        if (!event?.latLng) {
          return;
        }

        onMapClick({
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        });
      },
    );

    return () => {
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
    };
  }, [onMapClick, readyMap]);

  useEffect(() => {
    if (!readyMap) {
      return;
    }

    const infoWindow = new readyMap.library.InfoWindow();
    const listeners: GoogleMapsEventListener[] = [];
    const circles = markers.map((marker) => {
      const circle = new readyMap.library.Circle({
        center: marker.position,
        clickable: true,
        fillColor: marker.color,
        fillOpacity: marker.fillOpacity ?? 0.9,
        map: readyMap.instance,
        radius: marker.radiusMeters ?? (marker.selected ? 260 : 180),
        strokeColor: "#ffffff",
        strokeOpacity: 1,
        strokeWeight: marker.selected ? 4 : 2,
      });

      if (marker.title || marker.description?.length) {
        const showInfo = () => {
          infoWindow.setContent(buildInfoContent(marker));
          infoWindow.setPosition(marker.position);
          infoWindow.open({ map: readyMap.instance });
        };
        listeners.push(circle.addListener("mouseover", showInfo));
        listeners.push(circle.addListener("click", showInfo));
      }

      if (marker.onClick) {
        listeners.push(circle.addListener("click", marker.onClick));
      }

      return circle;
    });

    return () => {
      listeners.forEach((listener) => listener?.remove());
      infoWindow.close();
      clearCircles(circles);
    };
  }, [markers, readyMap]);

  useEffect(() => {
    if (!readyMap) {
      return;
    }

    const listeners: GoogleMapsEventListener[] = [];
    const overlays = polylines
      .filter((polyline) => polyline.path.length > 1)
      .map((polyline) => {
        const overlay = new readyMap.library.Polyline({
          clickable: Boolean(polyline.onClick || polyline.onMouseDown),
          map: readyMap.instance,
          path: polyline.path,
          strokeColor: polyline.color,
          strokeOpacity: polyline.opacity ?? 1,
          strokeWeight: polyline.weight ?? 5,
          zIndex: polyline.zIndex,
        });

        if (polyline.onClick) {
          const handleClick = polyline.onClick;
          listeners.push(
            overlay.addListener("click", (event) => {
              handleClick(
                event?.latLng
                  ? { lat: event.latLng.lat(), lng: event.latLng.lng() }
                  : undefined,
              );
            }),
          );
        }

        if (polyline.onMouseDown) {
          const handleMouseDown = polyline.onMouseDown;
          listeners.push(
            overlay.addListener("mousedown", (event) => {
              if (event?.latLng) {
                handleMouseDown({
                  lat: event.latLng.lat(),
                  lng: event.latLng.lng(),
                });
              }
            }),
          );
        }

        return overlay;
      });

    return () => {
      listeners.forEach((listener) => listener?.remove());
      clearPolylines(overlays);
    };
  }, [polylines, readyMap]);

  // Marker dạng Symbol (nhãn bubble / điểm kéo) — cần thư viện marker; thiếu thì
  // bỏ qua. RECONCILE theo id thay vì gỡ + vẽ lại toàn bộ mỗi khi mảng đổi
  // identity: marker giữ nguyên id + hình dạng thì GIỮ NGUYÊN instance (marker
  // đang được kéo không bao giờ bị recreate giữa gesture — nguyên nhân "đứt kéo");
  // chỉ đổi vị trí thì setPosition tại chỗ; đổi hình dạng mới gỡ + vẽ lại.
  useEffect(() => {
    const MarkerClass = readyMap?.library.Marker;
    if (!readyMap || !MarkerClass) {
      return;
    }

    const pool = pointMarkerPoolRef.current;
    const seenIds = new Set<string>();

    pointMarkers.forEach((marker) => {
      seenIds.add(marker.id);
      const styleKey = buildPointMarkerStyleKey(marker);
      const positionKey = `${marker.position.lat},${marker.position.lng}`;
      let entry = pool.get(marker.id);

      // Hình dạng đổi (icon/label/draggable...) → buộc phải vẽ lại instance.
      // Vị trí đổi mà instance không hỗ trợ setPosition (mock cũ) cũng vẽ lại.
      if (
        entry &&
        (entry.styleKey !== styleKey ||
          (entry.positionKey !== positionKey && !entry.overlay.setPosition))
      ) {
        removePooledPointMarker(entry);
        pool.delete(marker.id);
        entry = undefined;
      }

      if (entry) {
        // Chỉ vị trí đổi → dời tại chỗ, KHÔNG recreate (giữ gesture kéo nếu có)
        if (entry.positionKey !== positionKey) {
          entry.overlay.setPosition?.(marker.position);
          entry.positionKey = positionKey;
        }
        // Handler đọc qua entry.data nên chỉ cần cập nhật data, không rebind
        entry.data = marker;
        return;
      }

      const overlay = new MarkerClass({
        clickable: Boolean(marker.onClick),
        cursor: marker.cursor,
        draggable: marker.draggable,
        icon: marker.icon,
        label: marker.label,
        map: readyMap.instance,
        position: marker.position,
        title: marker.title,
        zIndex: marker.zIndex,
      });
      const nextEntry: PooledPointMarker = {
        data: marker,
        listeners: [],
        overlay,
        positionKey,
        styleKey,
      };
      // Listener bind MỘT lần khi tạo, dispatch qua entry.data để luôn gọi
      // callback của render mới nhất mà không phải gỡ/gắn lại listener mỗi render
      nextEntry.listeners = [
        overlay.addListener("click", () => nextEntry.data.onClick?.()),
        overlay.addListener("drag", (event) => {
          if (event?.latLng) {
            nextEntry.data.onDrag?.({
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
            });
          }
        }),
        overlay.addListener("dragend", (event) => {
          if (event?.latLng) {
            nextEntry.data.onDragEnd?.({
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
            });
          }
        }),
      ];
      pool.set(marker.id, nextEntry);
    });

    // Marker không còn trong props → gỡ khỏi bản đồ
    pool.forEach((entry, id) => {
      if (!seenIds.has(id)) {
        removePooledPointMarker(entry);
        pool.delete(id);
      }
    });
  }, [pointMarkers, readyMap]);

  // Dọn toàn bộ pool marker khi unmount (kể cả unmount giả của StrictMode —
  // effect chạy lại sẽ dựng lại pool từ props hiện tại)
  useEffect(() => {
    const pool = pointMarkerPoolRef.current;
    return () => {
      pool.forEach((entry) => removePooledPointMarker(entry));
      pool.clear();
    };
  }, []);

  // Giữ ref luôn khớp anchorPosition mới nhất — draw() (closure gán lúc tạo
  // overlay, chỉ chạy MỘT lần) đọc qua ref này thay vì tham số đóng băng
  useEffect(() => {
    anchorPositionRef.current = anchorPosition;
  }, [anchorPosition]);

  // Tạo/ẩn/hiện OverlayView neo card theo anchorPosition: tạo lười khi có đủ
  // map + anchorPosition (KHÔNG tạo trước "phòng khi cần" — chỉ tạo đúng lúc
  // popup đầu tiên mở), giữ nguyên instance cho các lần đổi vị trí sau, ẩn qua
  // setMap(null) khi anchorPosition về null thay vì gỡ hẳn overlay.
  useEffect(() => {
    const OverlayViewClass = readyMap?.library.OverlayView;
    if (!readyMap || !OverlayViewClass) {
      return;
    }

    if (!anchorPosition) {
      anchorOverlayRef.current?.setMap(null);
      return;
    }

    let overlay = anchorOverlayRef.current;
    if (!overlay) {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.zIndex = "20";
      div.style.pointerEvents = "auto";

      overlay = new OverlayViewClass();
      overlay.onAdd = () => {
        overlay?.getPanes().floatPane.appendChild(div);
      };
      overlay.draw = () => {
        const position = anchorPositionRef.current;
        if (!position) {
          div.style.display = "none";
          return;
        }

        // getProjection() có thể undefined tới khi Google chạy xong onAdd —
        // draw() bị gọi CHỦ ĐỘNG ngay sau setMap() (không đợi cycle đó), nên
        // lần mở popup đầu tiên projection thường chưa sẵn sàng: giữ div ẩn,
        // Google sẽ tự gọi lại draw() khi projection đã có
        const point = overlay
          ?.getProjection()
          ?.fromLatLngToDivPixel(position);
        if (!point) {
          div.style.display = "none";
          return;
        }

        // Card thả NGAY DƯỚI chấm: dịch ngang về giữa (-50%) + xuống dưới 14px
        // chừa chỗ mũi neo tam giác trỏ lên chấm
        div.style.display = "";
        div.style.left = `${point.x}px`;
        div.style.top = `${point.y}px`;
        div.style.transform = "translate(-50%, 14px)";
      };
      overlay.onRemove = () => {
        div.remove();
      };

      anchorOverlayRef.current = overlay;
      anchorOverlayDivRef.current = div;
      setAnchorContainer(div);
    }

    overlay.setMap(readyMap.instance);
    overlay.draw();
  }, [anchorPosition, readyMap]);

  // Gỡ hẳn overlay neo (kể cả khi chưa từng ẩn) lúc unmount — tránh rò div
  // gắn trong floatPane của bản đồ đã bị huỷ
  useEffect(() => {
    return () => {
      anchorOverlayRef.current?.setMap(null);
      anchorOverlayRef.current = null;
      anchorOverlayDivRef.current = null;
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="h-full min-h-[inherit] w-full" />
      {!readyMap && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-500">
          {t("map.loading")}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-amber-50 px-6 text-center text-sm text-amber-800">
          {errorFallback ?? error}
        </div>
      )}
      {readyMap && markers.length === 0 && polylines.length === 0 && emptyState && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-center text-xs text-gray-600 shadow-sm">
          {emptyState}
        </div>
      )}
      {anchorContainer &&
        anchorPosition &&
        anchorContent &&
        createPortal(anchorContent, anchorContainer)}
    </div>
  );
}
