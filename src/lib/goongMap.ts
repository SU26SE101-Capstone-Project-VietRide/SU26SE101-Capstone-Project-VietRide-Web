// Adapter Goong JS → API hình dáng Google Maps.
//
// Toàn app (GoogleMapCanvas + các màn dùng nó) nói chuyện với bản đồ qua bộ
// interface `GoogleMapInstance` / `GooglePolylineInstance` / ... trong
// `googleMaps.ts`. Google khoá key nên phần RUỘT đổi sang Goong JS (bản fork
// của Mapbox GL JS 1.x), còn interface giữ nguyên — nhờ vậy 30+ file gọi bản
// đồ và toàn bộ test hiện có không phải sửa.
//
// Khác biệt nền tảng phải tự bù ở đây:
//  1. Mapbox/Goong GL không có overlay Circle/Polyline dạng object — phải dựng
//     source GeoJSON + layer, và chỉ thêm được SAU khi style tải xong
//     (`whenReady`).
//  2. Không có z-index cho layer, thứ tự vẽ = thứ tự layer → tự quản bằng
//     `LayerStack` và `moveLayer`.
//  3. Marker là DOM element, không có Symbol path như Google → tự dựng SVG từ
//     `icon.path` + scale/rotation.
//  4. Circle của Google tính bán kính bằng MÉT; layer `circle` của GL tính bằng
//     PIXEL → phải vẽ đa giác trắc địa (xem `buildCircleRing`).
import { isRecord } from "../utils/typeGuards";
import type {
  GoogleCircleInstance,
  GoogleInfoWindowInstance,
  GoogleLatLngBoundsInstance,
  GoogleMapCoordinate,
  GoogleMapInstance,
  GoogleMapOptionUpdates,
  GoogleMapsEventListener,
  GoogleMapsLibrary,
  GoogleMarkerIcon,
  GoogleMarkerInstance,
  GooglePolylineInstance,
  GooglePolylineOptionUpdates,
} from "./googleMaps";
import {
  getGoongMapStyleUrl,
  getGoongMaptilesKey,
  goongMissingMaptilesKeyMessage,
} from "./goongConfig";

type GoongSdk = typeof import("@goongmaps/goong-js");
type GoongModule = GoongSdk;
type GoongMap = InstanceType<GoongModule["Map"]>;
type GoongMarker = InstanceType<GoongModule["Marker"]>;
type GoongPopup = InstanceType<GoongModule["Popup"]>;

// Handler nội bộ nhận event đã quy đổi về hình dáng Google (`latLng.lat()`)
type MapEventHandler = (event?: { latLng: GoogleLatLng }) => void;

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

let sdkPromise: Promise<GoongSdk> | null = null;

// Gói `@goongmaps/goong-js` là UMD, không có bản ESM — tuỳ bundler mà namespace
// nằm thẳng hoặc bọc trong `default`. Gỡ cả hai trường hợp thay vì ép kiểu mù.
function unwrapGoongModule(imported: unknown): GoongSdk {
  const candidates = [
    imported,
    isRecord(imported) ? imported.default : undefined,
  ];

  for (const candidate of candidates) {
    if (isRecord(candidate) && typeof candidate.Map === "function") {
      return candidate as unknown as GoongSdk;
    }
  }

  throw new Error("Goong JS SDK không khởi tạo được.");
}

/**
 * Nạp SDK Goong JS (kèm CSS) một lần rồi dùng lại. Import động để bundle chính
 * không phải gánh ~700KB WebGL khi người dùng chưa mở màn có bản đồ.
 *
 * KHÔNG gán Maptiles key ở đây. Tài liệu Goong bảo đặt `goongjs.accessToken`,
 * nhưng đó là một cặp getter/setter ghi vào biến `config.ACCESS_TOKEN` bên
 * trong SDK — mà qua interop CJS→ESM của bundler, object ta nhận được chỉ còn
 * `accessToken` dạng data property THƯỜNG. Gán vào đó đọc lại vẫn thấy đúng giá
 * trị nhưng SDK không hề nhận, và `new Map()` ném "An API access token is
 * required to use Goong JS". Thay vào đó truyền key thẳng cho từng Map qua
 * `options.accessToken` (→ `RequestManager._customAccessToken`, dùng cho cả
 * style/sprite/glyph/tile) — xem constructor bên dưới.
 */
export async function loadGoongSdk(): Promise<GoongSdk> {
  sdkPromise ??= (async () => {
    // Kiểm tra sớm để báo lỗi cấu hình rõ ràng thay vì để SDK ném lỗi khó hiểu
    if (!getGoongMaptilesKey()) {
      throw new Error(goongMissingMaptilesKeyMessage);
    }

    const [imported] = await Promise.all([
      import("@goongmaps/goong-js"),
      import("@goongmaps/goong-js/dist/goong-js.css"),
    ]);
    return unwrapGoongModule(imported);
  })().catch((error: unknown) => {
    // Lỗi mạng/chunk hỏng/thiếu key: xoá promise để lần sau thử lại thay vì kẹt
    sdkPromise = null;
    throw error instanceof Error
      ? error
      : new Error("Không thể tải Goong JS.");
  });

  return sdkPromise;
}

function toLngLat(position: GoogleMapCoordinate): [number, number] {
  return [position.lng, position.lat];
}

function toGoogleLatLng(position: { lat: number; lng: number }): GoogleLatLng {
  return {
    lat: () => position.lat,
    lng: () => position.lng,
  };
}

// ── Thứ tự vẽ layer ────────────────────────────────────────────────────────
// Goong GL vẽ theo thứ tự layer trong style, không có z-index. Giữ sổ các layer
// do adapter tạo rồi `moveLayer` theo thứ tự zIndex tăng dần mỗi khi có thay
// đổi — layer đứng sau nằm trên cùng.
type StackEntry = {
  layerIds: string[];
  sequence: number;
  zIndex: number;
};

class LayerStack {
  private entries = new Map<string, StackEntry>();
  private nextSequence = 0;
  private readonly map: GoongMap;

  constructor(map: GoongMap) {
    this.map = map;
  }

  add(key: string, layerIds: string[], zIndex: number) {
    const entry: StackEntry = {
      layerIds,
      sequence: this.nextSequence++,
      zIndex,
    };
    const isTopmost = [...this.entries.values()].every(
      (existing) => existing.zIndex <= zIndex,
    );
    this.entries.set(key, entry);

    // Layer vừa thêm đã nằm trên cùng sẵn (SDK luôn thêm vào cuối) → khỏi
    // sắp lại cả chồng; chỉ tốn công khi có layer zIndex cao hơn đứng dưới.
    if (!isTopmost) {
      this.apply();
    }
  }

  setZIndex(key: string, zIndex: number) {
    const entry = this.entries.get(key);
    if (!entry || entry.zIndex === zIndex) {
      return;
    }

    entry.zIndex = zIndex;
    this.apply();
  }

  remove(key: string) {
    this.entries.delete(key);
  }

  private apply() {
    [...this.entries.values()]
      .sort(
        (first, second) =>
          first.zIndex - second.zIndex || first.sequence - second.sequence,
      )
      .forEach((entry) => {
        entry.layerIds.forEach((layerId) => {
          if (this.map.getLayer(layerId)) {
            this.map.moveLayer(layerId);
          }
        });
      });
  }
}


// Goong GL khai báo tên event layer bằng union literal; adapter lại nhận tên
// động (đã quy đổi từ Google) nên phải ép kiểu tại đúng hai hàm nhỏ này thay
// vì rải `as` khắp nơi.
type LayerPointerEvent = {
  lngLat?: { lat: number; lng: number };
  originalEvent?: { target?: unknown };
};
type LayerPointerListener = (event: LayerPointerEvent) => void;

// Google: bấm/nhấn chuột lên marker KHÔNG kích hoạt handler của bản đồ hay của
// polyline nằm dưới. Ở đây marker là DOM nằm trong container của SDK nên sự
// kiện tự nổi bọt lên map — bấm một điểm dừng là chạy luôn cả `onMapClick` lẫn
// click trên đường, thao tác chọn bị ghi đè ngay và nhìn như bấm không ăn.
//
// KHÔNG chặn bằng stopPropagation: SDK đăng ký kéo marker qua `map.on('mousedown')`
// và `map.once('mouseup')`, chặn nổi bọt là marker hết kéo được. Thay vào đó lọc
// tại đúng listener do adapter tạo ra. `mousemove` cố tình KHÔNG lọc để preview
// lúc kéo nắn đường không bị đứt quãng khi con trỏ lướt qua marker.
const markerSwallowedEvents = new Set([
  "click",
  "contextmenu",
  "dblclick",
  "mousedown",
  "mouseup",
]);

function onLayer(
  map: GoongMap,
  eventName: string,
  layerId: string,
  listener: LayerPointerListener,
) {
  map.on(eventName as "click", layerId, listener);
}

/** Sự kiện này có phát sinh từ một marker của bản đồ không? */
function isFromMarker(adapter: GoongMapAdapter, event: LayerPointerEvent) {
  const target = event.originalEvent?.target;
  return target instanceof Node && adapter.containsMarker(target);
}

/**
 * Bọc listener: nuốt sự kiện đến từ marker cho đúng hành vi Google. Trả về
 * chính listener khi event không thuộc nhóm cần nuốt.
 */
function withMarkerGuard(
  adapter: GoongMapAdapter,
  eventName: string,
  listener: LayerPointerListener,
): LayerPointerListener {
  if (!markerSwallowedEvents.has(eventName)) {
    return listener;
  }

  return (event) => {
    if (!isFromMarker(adapter, event)) {
      listener(event);
    }
  };
}

function offLayer(
  map: GoongMap,
  eventName: string,
  layerId: string,
  listener: LayerPointerListener,
) {
  map.off(eventName as "click", layerId, listener);
}

// ── Bản đồ ─────────────────────────────────────────────────────────────────

// Quy đổi tên event Google → Goong GL. Chỉ liệt kê các event app thực sự dùng.
const mapEventNames: Record<string, string> = {
  click: "click",
  dragend: "dragend",
  idle: "idle",
  mousedown: "mousedown",
  mousemove: "mousemove",
  mouseup: "mouseup",
  zoom_changed: "zoom",
};

// Mọi overlay nhận `map` dưới dạng wrapper (kiểu Google) nhưng cần map thật của
// Goong GL — tra ngược qua sổ này thay vì bắt interface Google phải lộ nó ra.
const mapRegistry = new WeakMap<GoogleMapInstance, GoongMapAdapter>();

function resolveAdapter(map: GoogleMapInstance | null) {
  return map ? (mapRegistry.get(map) ?? null) : null;
}

type GoongMapOptions = {
  center: GoogleMapCoordinate;
  fallbackMapStyleUrl?: string;
  gestureHandling?: "auto" | "cooperative" | "greedy" | "none";
  mapStyleUrl?: string;
  zoom: number;
  zoomControl?: boolean;
};

class GoongMapAdapter implements GoogleMapInstance {
  readonly map: GoongMap;
  readonly layers: LayerStack;
  private styleReady = false;
  private pendingStyleTasks: Array<() => void> = [];
  private overlaySequence = 0;
  // Sổ element marker đang sống — dùng để nhận ra sự kiện phát sinh từ marker
  private readonly markerElements = new Set<HTMLElement>();

  constructor(
    sdk: GoongSdk,
    container: HTMLElement,
    options: GoongMapOptions,
  ) {
    const style = options.mapStyleUrl ?? getGoongMapStyleUrl();
    const maptilesKey = getGoongMaptilesKey();
    if (!maptilesKey) {
      throw new Error(goongMissingMaptilesKeyMessage);
    }

    const interactive = options.gestureHandling !== "none";
    this.map = new sdk.Map({
      // Key đi thẳng vào từng Map thay vì qua `goongjs.accessToken` toàn cục —
      // xem chú thích ở `loadGoongSdk` về lý do biến toàn cục không ăn.
      accessToken: maptilesKey,
      attributionControl: true,
      center: toLngLat(options.center),
      container,
      // Bản đồ điều vận là bản đồ 2D thuần — tắt xoay/nghiêng để thao tác kéo
      // nắn tuyến không bị lệch trục như hồi dùng Google (renderingType RASTER)
      dragRotate: false,
      pitchWithRotate: false,
      scrollZoom: interactive,
      style,
      zoom: options.zoom,
    });
    this.map.touchZoomRotate.disableRotation();
    if (!interactive) {
      this.map.dragPan.disable();
      this.map.doubleClickZoom.disable();
    }
    if (options.zoomControl !== false) {
      this.map.addControl(
        new sdk.NavigationControl({ showCompass: false }),
        "top-right",
      );
    }

    this.layers = new LayerStack(this.map);
    let fallbackAttempted = false;
    this.map.on("error", () => {
      const fallbackStyle = options.fallbackMapStyleUrl;
      if (
        this.styleReady ||
        fallbackAttempted ||
        !fallbackStyle ||
        fallbackStyle === style
      ) {
        return;
      }

      // Marker DOM vẫn hiện dù style/tile nền lỗi, tạo cảm giác map trắng nhưng
      // marker bình thường. Chỉ fallback trước lần load đầu; setStyle sau khi
      // đã load sẽ xoá custom route layers đang sống trên bản đồ.
      fallbackAttempted = true;
      this.map.setStyle(fallbackStyle);
    });
    this.map.on("load", () => {
      this.styleReady = true;
      const tasks = this.pendingStyleTasks;
      this.pendingStyleTasks = [];
      tasks.forEach((task) => task());
    });

    mapRegistry.set(this, this);
  }

  /**
   * Chạy `task` khi style đã tải xong. Source/layer thêm trước lúc đó sẽ bị
   * Goong GL ném lỗi, mà GoogleMapCanvas thì vẽ overlay ngay sau khi `new Map`
   * trả về — nên mọi thao tác layer đều phải đi qua đây.
   */
  whenReady(task: () => void) {
    if (this.styleReady || this.map.isStyleLoaded()) {
      task();
      return;
    }

    this.pendingStyleTasks.push(task);
  }

  registerMarkerElement(element: HTMLElement) {
    this.markerElements.add(element);
  }

  unregisterMarkerElement(element: HTMLElement) {
    this.markerElements.delete(element);
  }

  containsMarker(node: Node) {
    for (const element of this.markerElements) {
      if (element === node || element.contains(node)) {
        return true;
      }
    }

    return false;
  }

  /** Id duy nhất cho source/layer của một overlay. */
  nextOverlayId(prefix: string) {
    return `vietride-${prefix}-${this.overlaySequence++}`;
  }

  addListener(eventName: string, handler: MapEventHandler) {
    const nativeEvent = mapEventNames[eventName] ?? eventName;
    const swallowFromMarker = markerSwallowedEvents.has(nativeEvent);
    const listener = (event: unknown) => {
      const mapEvent =
        typeof event === "object" && event !== null
          ? (event as LayerPointerEvent)
          : undefined;
      // Bấm lên marker không được coi là bấm lên bản đồ (xem markerSwallowedEvents)
      if (swallowFromMarker && mapEvent && isFromMarker(this, mapEvent)) {
        return;
      }

      const lngLat = mapEvent?.lngLat;
      handler(lngLat ? { latLng: toGoogleLatLng(lngLat) } : undefined);
    };

    this.map.on(nativeEvent, listener);
    return {
      remove: () => {
        this.map.off(nativeEvent, listener);
      },
    };
  }

  fitBounds(bounds: GoogleLatLngBoundsInstance, padding = 0) {
    const nativeBounds = boundsRegistry.get(bounds);
    if (!nativeBounds || bounds.isEmpty()) {
      return;
    }

    this.map.fitBounds(nativeBounds, { animate: false, padding });
  }

  getZoom() {
    return this.map.getZoom();
  }

  panTo(position: GoogleMapCoordinate) {
    this.map.panTo(toLngLat(position));
  }

  setCenter(position: GoogleMapCoordinate) {
    this.map.setCenter(toLngLat(position));
  }

  setZoom(zoom: number) {
    this.map.setZoom(zoom);
  }

  setOptions(options: GoogleMapOptionUpdates) {
    if (options.draggable === true) {
      this.map.dragPan.enable();
    } else if (options.draggable === false) {
      this.map.dragPan.disable();
    }

    // `styles` là bảng màu kiểu Google — Goong đổi giao diện bằng style URL
    // (VITE_GOONG_MAP_STYLE_URL) nên field này bỏ qua có chủ đích.
    const cursor = options.draggingCursor ?? options.draggableCursor;
    if (cursor !== undefined) {
      this.map.getCanvas().style.cursor = cursor;
    }
  }
}

// ── LatLngBounds ───────────────────────────────────────────────────────────

const boundsRegistry = new WeakMap<
  GoogleLatLngBoundsInstance,
  InstanceType<GoongModule["LngLatBounds"]>
>();

function createBoundsClass(sdk: GoongSdk) {
  return class GoongBounds implements GoogleLatLngBoundsInstance {
    private empty = true;

    constructor() {
      boundsRegistry.set(this, new sdk.LngLatBounds());
    }

    extend(position: GoogleMapCoordinate) {
      boundsRegistry.get(this)?.extend(toLngLat(position));
      this.empty = false;
    }

    isEmpty() {
      return this.empty;
    }
  };
}

// ── Circle ─────────────────────────────────────────────────────────────────

// Số cạnh của đa giác xấp xỉ hình tròn — 64 đủ mượt ở mọi mức zoom màn điều vận
const circleSteps = 64;
const metersPerLatitudeDegree = 110_574;
const metersPerLongitudeDegreeAtEquator = 111_320;

/**
 * Đa giác trắc địa xấp xỉ hình tròn bán kính `radiusMeters`. Phải là đa giác
 * chứ không dùng layer `circle` của Goong GL: `circle-radius` tính bằng PIXEL
 * nên chấm sẽ phình/teo theo zoom, trong khi Google Circle tính bằng MÉT.
 */
function buildCircleRing(center: GoogleMapCoordinate, radiusMeters: number) {
  const latitudeSpan = radiusMeters / metersPerLatitudeDegree;
  const longitudeSpan =
    radiusMeters /
    (metersPerLongitudeDegreeAtEquator *
      Math.cos((center.lat * Math.PI) / 180));

  const ring = Array.from({ length: circleSteps }, (_unused, index) => {
    const angle = (index / circleSteps) * 2 * Math.PI;
    return [
      center.lng + longitudeSpan * Math.cos(angle),
      center.lat + latitudeSpan * Math.sin(angle),
    ];
  });
  ring.push(ring[0]);

  return ring;
}

function createCircleClass() {
  return class GoongCircle implements GoogleCircleInstance {
    private adapter: GoongMapAdapter | null;
    private readonly sourceId: string;
    private readonly fillLayerId: string;
    private readonly strokeLayerId: string;
    private removed = false;
    private readonly disposers: Array<() => void> = [];

    constructor(options: {
      center: GoogleMapCoordinate;
      clickable?: boolean;
      fillColor?: string;
      fillOpacity?: number;
      map: GoogleMapInstance;
      radius: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }) {
      this.adapter = resolveAdapter(options.map);
      const adapter = this.adapter;
      if (!adapter) {
        throw new Error("Bản đồ Goong chưa sẵn sàng để vẽ vòng tròn.");
      }

      this.sourceId = adapter.nextOverlayId("circle");
      this.fillLayerId = `${this.sourceId}-fill`;
      this.strokeLayerId = `${this.sourceId}-stroke`;

      adapter.whenReady(() => {
        if (this.removed) {
          return;
        }

        adapter.map.addSource(this.sourceId, {
          data: {
            geometry: {
              coordinates: [buildCircleRing(options.center, options.radius)],
              type: "Polygon",
            },
            properties: {},
            type: "Feature",
          },
          type: "geojson",
        });
        adapter.map.addLayer({
          id: this.fillLayerId,
          paint: {
            "fill-color": options.fillColor ?? "#2563eb",
            "fill-opacity": options.fillOpacity ?? 0.9,
          },
          source: this.sourceId,
          type: "fill",
        });
        adapter.map.addLayer({
          id: this.strokeLayerId,
          paint: {
            "line-color": options.strokeColor ?? "#ffffff",
            "line-opacity": options.strokeOpacity ?? 1,
            "line-width": options.strokeWeight ?? 2,
          },
          source: this.sourceId,
          type: "line",
        });
        adapter.layers.add(this.sourceId, [this.fillLayerId, this.strokeLayerId], 0);

        if (options.clickable !== false) {
          const enter = () => {
            adapter.map.getCanvas().style.cursor = "pointer";
          };
          const leave = () => {
            adapter.map.getCanvas().style.cursor = "";
          };
          adapter.map.on("mouseenter", this.fillLayerId, enter);
          adapter.map.on("mouseleave", this.fillLayerId, leave);
          this.disposers.push(() => {
            adapter.map.off("mouseenter", this.fillLayerId, enter);
            adapter.map.off("mouseleave", this.fillLayerId, leave);
          });
        }
      });
    }

    addListener(
      eventName: string,
      handler: MapEventHandler,
    ): GoogleMapsEventListener {
      const adapter = this.adapter;
      if (!adapter) {
        return { remove: () => undefined };
      }

      // Google "mouseover" ↔ Goong GL "mouseenter" (chỉ bắn khi vào vùng layer)
      const nativeEvent = eventName === "mouseover" ? "mouseenter" : eventName;
      const listener: LayerPointerListener = (event) => {
        handler(
          event.lngLat ? { latLng: toGoogleLatLng(event.lngLat) } : undefined,
        );
      };

      const guarded = withMarkerGuard(adapter, nativeEvent, listener);
      adapter.whenReady(() => {
        if (!this.removed) {
          onLayer(adapter.map, nativeEvent, this.fillLayerId, guarded);
        }
      });

      return {
        remove: () => {
          offLayer(adapter.map, nativeEvent, this.fillLayerId, guarded);
        },
      };
    }

    setMap(map: GoogleMapInstance | null) {
      if (map || !this.adapter) {
        return;
      }

      const adapter = this.adapter;
      this.removed = true;
      this.disposers.forEach((dispose) => dispose());
      adapter.layers.remove(this.sourceId);
      [this.fillLayerId, this.strokeLayerId].forEach((layerId) => {
        if (adapter.map.getLayer(layerId)) {
          adapter.map.removeLayer(layerId);
        }
      });
      if (adapter.map.getSource(this.sourceId)) {
        adapter.map.removeSource(this.sourceId);
      }
      this.adapter = null;
    }
  };
}

// ── Polyline ───────────────────────────────────────────────────────────────

// Google vẽ nét đứt bằng Symbol lặp dọc đường; Goong GL có sẵn `line-dasharray`
// (đơn vị = bội của line-width) nên dùng thẳng.
const dashPattern = [2, 1.6];

type PolylineStyle = {
  color: string;
  cursor?: string;
  dashed: boolean;
  opacity: number;
  weight: number;
  zIndex: number;
};

function createPolylineClass() {
  return class GoongPolyline implements GooglePolylineInstance {
    private adapter: GoongMapAdapter | null;
    private readonly sourceId: string;
    private readonly layerId: string;
    private removed = false;
    private path: GoogleMapCoordinate[];
    private style: PolylineStyle;
    private cursorDisposer: (() => void) | null = null;

    constructor(options: {
      clickable?: boolean;
      cursor?: string;
      // `icons` là cơ chế nét đứt của Google — adapter suy ra từ chính nó
      icons?: unknown[];
      map: GoogleMapInstance;
      path: GoogleMapCoordinate[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      zIndex?: number;
    }) {
      this.adapter = resolveAdapter(options.map);
      const adapter = this.adapter;
      if (!adapter) {
        throw new Error("Bản đồ Goong chưa sẵn sàng để vẽ đường.");
      }

      this.path = options.path;
      // strokeOpacity 0 + có icons = quy ước "đường đứt nét" của GoogleMapCanvas
      const dashed = Boolean(options.icons?.length);
      this.style = {
        color: options.strokeColor ?? "#2563eb",
        cursor: options.cursor,
        dashed,
        opacity: dashed ? 1 : (options.strokeOpacity ?? 1),
        weight: options.strokeWeight ?? 5,
        zIndex: options.zIndex ?? 1,
      };

      this.sourceId = adapter.nextOverlayId("line");
      this.layerId = `${this.sourceId}-line`;

      adapter.whenReady(() => {
        if (this.removed) {
          return;
        }

        adapter.map.addSource(this.sourceId, {
          data: this.toFeature(),
          type: "geojson",
        });
        adapter.map.addLayer({
          id: this.layerId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: this.toPaint(),
          source: this.sourceId,
          type: "line",
        });
        adapter.layers.add(this.sourceId, [this.layerId], this.style.zIndex);
        this.bindCursor();
      });
    }

    private toFeature() {
      return {
        geometry: {
          coordinates: this.path.map(toLngLat),
          type: "LineString" as const,
        },
        properties: {},
        type: "Feature" as const,
      };
    }

    private toPaint() {
      return {
        "line-color": this.style.color,
        ...(this.style.dashed ? { "line-dasharray": dashPattern } : {}),
        "line-opacity": this.style.opacity,
        "line-width": this.style.weight,
      };
    }

    // Con trỏ riêng khi rê lên đường (Google có option `cursor`, Goong GL không)
    private bindCursor() {
      const adapter = this.adapter;
      this.cursorDisposer?.();
      this.cursorDisposer = null;
      if (!adapter || !this.style.cursor) {
        return;
      }

      const cursor = this.style.cursor;
      const enter = () => {
        adapter.map.getCanvas().style.cursor = cursor;
      };
      const leave = () => {
        adapter.map.getCanvas().style.cursor = "";
      };
      adapter.map.on("mouseenter", this.layerId, enter);
      adapter.map.on("mouseleave", this.layerId, leave);
      this.cursorDisposer = () => {
        adapter.map.off("mouseenter", this.layerId, enter);
        adapter.map.off("mouseleave", this.layerId, leave);
      };
    }

    addListener(
      eventName: string,
      handler: MapEventHandler,
    ): GoogleMapsEventListener {
      const adapter = this.adapter;
      if (!adapter) {
        return { remove: () => undefined };
      }

      const nativeEvent =
        eventName === "mouseover"
          ? "mouseenter"
          : eventName === "mouseout"
            ? "mouseleave"
            : eventName;
      const listener: LayerPointerListener = (event) => {
        handler(
          event.lngLat ? { latLng: toGoogleLatLng(event.lngLat) } : undefined,
        );
      };

      const guarded = withMarkerGuard(adapter, nativeEvent, listener);
      adapter.whenReady(() => {
        if (!this.removed) {
          onLayer(adapter.map, nativeEvent, this.layerId, guarded);
        }
      });

      return {
        remove: () => {
          offLayer(adapter.map, nativeEvent, this.layerId, guarded);
        },
      };
    }

    setPath(path: GoogleMapCoordinate[]) {
      this.path = path;
      const adapter = this.adapter;
      if (!adapter) {
        return;
      }

      adapter.whenReady(() => {
        const source = adapter.map.getSource(this.sourceId) as
          | { setData: (data: unknown) => void }
          | undefined;
        source?.setData(this.toFeature());
      });
    }

    setOptions(options: GooglePolylineOptionUpdates) {
      const dashed = Boolean(options.icons?.length);
      this.style = {
        color: options.strokeColor ?? this.style.color,
        cursor: options.cursor,
        dashed,
        opacity: dashed ? 1 : (options.strokeOpacity ?? this.style.opacity),
        weight: options.strokeWeight ?? this.style.weight,
        zIndex: options.zIndex ?? this.style.zIndex,
      };

      const adapter = this.adapter;
      if (!adapter) {
        return;
      }

      adapter.whenReady(() => {
        if (this.removed || !adapter.map.getLayer(this.layerId)) {
          return;
        }

        const paint = this.toPaint();
        adapter.map.setPaintProperty(this.layerId, "line-color", paint["line-color"]);
        adapter.map.setPaintProperty(this.layerId, "line-opacity", paint["line-opacity"]);
        adapter.map.setPaintProperty(this.layerId, "line-width", paint["line-width"]);
        adapter.map.setPaintProperty(
          this.layerId,
          "line-dasharray",
          this.style.dashed ? dashPattern : null,
        );
        adapter.layers.setZIndex(this.sourceId, this.style.zIndex);
        this.bindCursor();
      });
    }

    setMap(map: GoogleMapInstance | null) {
      if (map || !this.adapter) {
        return;
      }

      const adapter = this.adapter;
      this.removed = true;
      this.cursorDisposer?.();
      this.cursorDisposer = null;
      adapter.layers.remove(this.sourceId);
      if (adapter.map.getLayer(this.layerId)) {
        adapter.map.removeLayer(this.layerId);
      }
      if (adapter.map.getSource(this.sourceId)) {
        adapter.map.removeSource(this.sourceId);
      }
      this.adapter = null;
    }
  };
}

// ── Marker ─────────────────────────────────────────────────────────────────

const svgNamespace = "http://www.w3.org/2000/svg";

/**
 * Dựng SVG cho Symbol kiểu Google: path vẽ quanh gốc toạ độ (0,0), phóng theo
 * `scale`, xoay `rotation` độ thuận chiều kim đồng hồ. Khung SVG rộng hơn hẳn
 * hình để không bị cắt, `pointer-events` chỉ bật trên đúng nét vẽ nên phần
 * khung trong suốt không nuốt click xuống bản đồ.
 */
function renderMarkerIcon(icon: GoogleMarkerIcon, interactive: boolean) {
  const scale = icon.scale ?? 1;
  const half = Math.max(64, Math.ceil(scale * 48));
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("width", `${half * 2}`);
  svg.setAttribute("height", `${half * 2}`);
  svg.style.position = "absolute";
  svg.style.left = `${-half}px`;
  svg.style.top = `${-half}px`;
  svg.style.overflow = "visible";
  svg.style.pointerEvents = "none";

  const group = document.createElementNS(svgNamespace, "g");
  group.setAttribute(
    "transform",
    `translate(${half} ${half}) rotate(${icon.rotation ?? 0}) scale(${scale})`,
  );

  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", icon.path);
  path.setAttribute("fill", icon.fillColor ?? "none");
  path.setAttribute("fill-opacity", String(icon.fillOpacity ?? 0));
  path.setAttribute("stroke", icon.strokeColor ?? "none");
  path.setAttribute("stroke-opacity", String(icon.strokeOpacity ?? 1));
  path.setAttribute("stroke-width", String(icon.strokeWeight ?? 1));
  // Nét giữ nguyên độ dày pixel dù group đã scale — khớp cách Google tính
  // strokeWeight theo pixel màn hình
  path.setAttribute("vector-effect", "non-scaling-stroke");
  path.style.pointerEvents = interactive ? "auto" : "none";

  group.appendChild(path);
  svg.appendChild(group);
  return svg;
}

type GoogleMarkerLabel = {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  text: string;
};

function renderMarkerLabel(label: GoogleMarkerLabel) {
  const element = document.createElement("span");
  element.textContent = label.text;
  element.style.position = "absolute";
  element.style.left = "0";
  element.style.top = "0";
  element.style.transform = "translate(-50%, -50%)";
  element.style.whiteSpace = "nowrap";
  element.style.pointerEvents = "none";
  element.style.color = label.color ?? "#111827";
  element.style.fontFamily = label.fontFamily ?? "inherit";
  element.style.fontSize = label.fontSize ?? "12px";
  element.style.fontWeight = label.fontWeight ?? "500";
  return element;
}

function createMarkerClass(sdk: GoongSdk) {
  return class GoongMarkerAdapter implements GoogleMarkerInstance {
    private marker: GoongMarker | null = null;
    private readonly element: HTMLDivElement;
    private iconElement: SVGSVGElement | null = null;
    // Nét vẽ có nhận chuột hay không. KÉO ĐƯỢC cũng phải nhận: SDK khởi động
    // kéo bằng cách kiểm tra `element.contains(event.target)`, mà marker chỉ có
    // `onDragEnd` (không `onClick`) thì GoogleMapCanvas truyền `clickable:false`
    // — để `pointer-events:none` là tay nắm nắn tuyến hết kéo được, chỉ pan map.
    private readonly interactive: boolean;
    private adapter: GoongMapAdapter | null;

    constructor(options: {
      clickable?: boolean;
      cursor?: string;
      draggable?: boolean;
      icon?: GoogleMarkerIcon;
      label?: GoogleMarkerLabel;
      map: GoogleMapInstance;
      position: GoogleMapCoordinate;
      title?: string;
      zIndex?: number;
    }) {
      this.adapter = resolveAdapter(options.map);
      const adapter = this.adapter;
      if (!adapter) {
        throw new Error("Bản đồ Goong chưa sẵn sàng để đặt marker.");
      }

      this.interactive =
        options.clickable !== false || options.draggable === true;
      this.element = document.createElement("div");
      // BẮT BUỘC absolute: SDK định vị marker bằng `transform` và CSS của nó đặt
      // `.mapboxgl-marker { position: absolute }`. Đặt `relative` là marker rơi
      // vào luồng bố cục SAU canvas rồi mới bị transform → lệch xuống đúng bằng
      // chiều cao bản đồ và biến mất khỏi khung nhìn (điểm đầu/cuối, số thứ tự
      // điểm dừng, bubble phương án, tay nắm kéo đều dính).
      this.element.style.position = "absolute";
      this.element.style.top = "0";
      this.element.style.left = "0";
      this.element.style.width = "0";
      this.element.style.height = "0";
      // Chỉ nét vẽ bên trong nhận chuột; sự kiện vẫn nổi bọt lên div này
      this.element.style.pointerEvents = "none";
      if (options.cursor) {
        this.element.style.cursor = options.cursor;
      }
      if (options.zIndex !== undefined) {
        this.element.style.zIndex = String(options.zIndex);
      }
      if (options.title) {
        this.element.title = options.title;
      }

      if (options.icon) {
        this.iconElement = renderMarkerIcon(options.icon, this.interactive);
        this.element.appendChild(this.iconElement);
      }
      if (options.label) {
        this.element.appendChild(renderMarkerLabel(options.label));
      }

      adapter.registerMarkerElement(this.element);
      // Marker KHÔNG kéo được: chặn hẳn mousedown/touchstart tại element để nhấn
      // giữ lên nó không kéo theo cả bản đồ (Google cũng nuốt sự kiện này).
      // Marker KÉO ĐƯỢC thì phải để lọt: SDK đăng ký kéo bằng
      // `map.on('mousedown')` và tự `preventDefault()` để chặn pan.
      if (!options.draggable) {
        const swallow = (event: Event) => event.stopPropagation();
        this.element.addEventListener("mousedown", swallow);
        this.element.addEventListener("touchstart", swallow, { passive: true });
      }
      this.marker = new sdk.Marker({
        anchor: "center",
        draggable: options.draggable ?? false,
        element: this.element,
      })
        .setLngLat(toLngLat(options.position))
        .addTo(adapter.map);
    }

    addListener(
      eventName: string,
      handler: MapEventHandler,
    ): GoogleMapsEventListener {
      const marker = this.marker;
      if (!marker) {
        return { remove: () => undefined };
      }

      // drag/dragend đến từ chính Marker của Goong GL; click/mouseover là DOM
      if (eventName === "drag" || eventName === "dragend") {
        const listener = () => {
          handler({ latLng: toGoogleLatLng(marker.getLngLat()) });
        };
        marker.on(eventName, listener);
        return {
          remove: () => {
            marker.off(eventName, listener);
          },
        };
      }

      const domEvent = eventName === "mouseover" ? "mouseenter" : eventName;
      const listener = () => {
        handler({ latLng: toGoogleLatLng(marker.getLngLat()) });
      };
      // `mouseenter` không nổi bọt — nghe ở pha capture để vẫn nhận từ nét vẽ
      const useCapture = domEvent === "mouseenter";
      this.element.addEventListener(domEvent, listener, useCapture);
      return {
        remove: () => {
          this.element.removeEventListener(domEvent, listener, useCapture);
        },
      };
    }

    setPosition(position: GoogleMapCoordinate) {
      this.marker?.setLngLat(toLngLat(position));
    }

    setIcon(icon: GoogleMarkerIcon) {
      const next = renderMarkerIcon(icon, this.interactive);
      if (this.iconElement) {
        this.element.replaceChild(next, this.iconElement);
      } else {
        this.element.insertBefore(next, this.element.firstChild);
      }
      this.iconElement = next;
    }

    setMap(map: GoogleMapInstance | null) {
      if (map) {
        return;
      }

      this.adapter?.unregisterMarkerElement(this.element);
      this.marker?.remove();
      this.marker = null;
      this.adapter = null;
    }
  };
}

// ── InfoWindow ─────────────────────────────────────────────────────────────

function createInfoWindowClass(sdk: GoongSdk) {
  return class GoongInfoWindow implements GoogleInfoWindowInstance {
    private readonly popup: GoongPopup;

    constructor() {
      this.popup = new sdk.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "320px",
        offset: 14,
      });
    }

    close() {
      this.popup.remove();
    }

    open({ map }: { map: GoogleMapInstance }) {
      const adapter = resolveAdapter(map);
      if (adapter) {
        this.popup.addTo(adapter.map);
      }
    }

    setContent(content: Node | string) {
      if (typeof content === "string") {
        this.popup.setHTML(content);
        return;
      }

      this.popup.setDOMContent(content);
    }

    setPosition(position: GoogleMapCoordinate) {
      this.popup.setLngLat(toLngLat(position));
    }
  };
}

// ── OverlayView (card neo theo toạ độ) ─────────────────────────────────────

// Google yêu cầu subclass hoá: tạo instance rỗng rồi GÁN onAdd/draw/onRemove.
// Bản Goong dựng một pane tuyệt đối trong container bản đồ và gọi lại
// draw() mỗi khung hình render để card bám camera y như marker thật.
function createOverlayViewClass() {
  return class GoongOverlayView {
    private adapter: GoongMapAdapter | null = null;
    private pane: HTMLDivElement | null = null;
    private renderListener: (() => void) | null = null;

    onAdd: () => void = () => undefined;
    draw: () => void = () => undefined;
    onRemove: () => void = () => undefined;

    getPanes() {
      const pane = this.pane ?? document.createElement("div");
      return { floatPane: pane };
    }

    getProjection() {
      const adapter = this.adapter;
      if (!adapter) {
        return undefined;
      }

      return {
        fromLatLngToDivPixel: (position: GoogleMapCoordinate) => {
          const point = adapter.map.project(toLngLat(position));
          return { x: point.x, y: point.y };
        },
      };
    }

    setMap(map: GoogleMapInstance | null) {
      const nextAdapter = resolveAdapter(map);

      if (!nextAdapter) {
        if (this.pane) {
          this.onRemove();
          this.pane.remove();
          this.pane = null;
        }
        if (this.renderListener && this.adapter) {
          this.adapter.map.off("render", this.renderListener);
        }
        this.renderListener = null;
        this.adapter = null;
        return;
      }

      if (this.adapter === nextAdapter && this.pane) {
        return;
      }

      this.adapter = nextAdapter;
      const pane = document.createElement("div");
      pane.style.position = "absolute";
      pane.style.inset = "0";
      pane.style.pointerEvents = "none";
      pane.style.overflow = "visible";
      nextAdapter.map.getContainer().appendChild(pane);
      this.pane = pane;

      this.onAdd();
      const redraw = () => this.draw();
      this.renderListener = redraw;
      nextAdapter.map.on("render", redraw);
      redraw();
    }
  };
}

// ── Nhà máy dựng "thư viện" hình dáng Google ───────────────────────────────

/**
 * Bộ constructor tương đương `google.maps` nhưng chạy trên Goong JS.
 * `GoogleMapCanvas` dùng đúng bộ này, không biết bên dưới là SDK nào.
 */
export async function createGoongMapsLibrary(): Promise<GoogleMapsLibrary> {
  const sdk = await loadGoongSdk();

  return {
    Circle: createCircleClass(),
    InfoWindow: createInfoWindowClass(sdk),
    LatLngBounds: createBoundsClass(sdk),
    Map: class GoongMapClass extends GoongMapAdapter {
      constructor(element: HTMLElement, options: GoongMapOptions) {
        super(sdk, element, options);
      }
    },
    Marker: createMarkerClass(sdk),
    OverlayView: createOverlayViewClass(),
    Polyline: createPolylineClass(),
  };
}
