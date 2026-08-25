// Khai báo type cho `@goongmaps/goong-js` — gói này KHÔNG kèm .d.ts (chỉ có
// .flow), nên phần adapter bản đồ tự khai đúng bề mặt mình dùng thay vì kéo
// thêm `@types/mapbox-gl`. Goong JS là bản fork của Mapbox GL JS 1.x nên tên
// class/method giống hệt Mapbox; chỉ khai những gì `goongMap.ts` thật sự gọi —
// thiếu chỗ nào thì bổ sung ở đây, đừng ép kiểu ở nơi gọi.
declare module "@goongmaps/goong-js" {
  export type LngLatLike = [number, number];

  export class LngLat {
    lat: number;
    lng: number;
  }

  export class LngLatBounds {
    extend(value: LngLatLike): this;
  }

  export class Point {
    x: number;
    y: number;
  }

  export type MapEventLike = {
    lngLat?: LngLat;
  };

  export type MapEventListener = (event: MapEventLike) => void;

  type Handler = {
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
  };

  export class Map {
    constructor(options: {
      /**
       * Maptiles key cho RIÊNG map này. Dùng cái này thay cho biến toàn cục
       * `accessToken` (biến đó không sống sót qua interop CJS→ESM).
       */
      accessToken?: string;
      attributionControl?: boolean;
      center?: LngLatLike;
      container: HTMLElement | string;
      dragRotate?: boolean;
      pitchWithRotate?: boolean;
      scrollZoom?: boolean;
      style: string;
      zoom?: number;
    });

    addControl(control: unknown, position?: string): this;
    addLayer(layer: Record<string, unknown>, beforeId?: string): this;
    addSource(id: string, source: Record<string, unknown>): this;
    doubleClickZoom: Handler;
    dragPan: Handler;
    fitBounds(
      bounds: LngLatBounds,
      options?: { animate?: boolean; padding?: number },
    ): this;
    getCanvas(): HTMLCanvasElement;
    getContainer(): HTMLElement;
    getLayer(id: string): unknown;
    getSource(id: string): { setData?: (data: unknown) => void } | undefined;
    getZoom(): number;
    isStyleLoaded(): boolean;
    moveLayer(id: string, beforeId?: string): this;
    off(type: string, listener: MapEventListener): this;
    off(type: string, layerId: string, listener: MapEventListener): this;
    on(type: string, listener: MapEventListener): this;
    on(type: string, layerId: string, listener: MapEventListener): this;
    panTo(center: LngLatLike): this;
    project(lngLat: LngLatLike): Point;
    remove(): void;
    removeLayer(id: string): this;
    removeSource(id: string): this;
    setCenter(center: LngLatLike): this;
    setPaintProperty(layerId: string, name: string, value: unknown): this;
    setZoom(zoom: number): this;
    touchZoomRotate: Handler & { disableRotation: () => void };
    triggerRepaint(): void;
  }

  export class Marker {
    constructor(options?: {
      anchor?: string;
      draggable?: boolean;
      element?: HTMLElement;
      offset?: [number, number];
      rotation?: number;
    });

    addTo(map: Map): this;
    getLngLat(): LngLat;
    off(type: string, listener: () => void): this;
    on(type: string, listener: () => void): this;
    remove(): this;
    setLngLat(lngLat: LngLatLike): this;
  }

  export class Popup {
    constructor(options?: {
      closeButton?: boolean;
      closeOnClick?: boolean;
      maxWidth?: string;
      offset?: number;
    });

    addTo(map: Map): this;
    remove(): this;
    setDOMContent(node: Node): this;
    setHTML(html: string): this;
    setLngLat(lngLat: LngLatLike): this;
  }

  export class NavigationControl {
    constructor(options?: { showCompass?: boolean });
  }

  /**
   * Maptiles key toàn cục theo tài liệu Goong. CHỈ khai để type đầy đủ —
   * KHÔNG dùng: qua interop CJS→ESM nó thành data property thường nên gán
   * không tới được SDK. Truyền `accessToken` trong options của `Map` thay thế.
   */
  export const accessToken: string;
}
