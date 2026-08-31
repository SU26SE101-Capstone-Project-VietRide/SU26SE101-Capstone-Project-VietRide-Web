// Lớp tương thích bản đồ — TÊN kiểu vẫn là "Google" nhưng RUỘT đã là Goong.
//
// Google khoá key nên toàn bộ bản đồ chuyển sang Goong Maps (xem
// `goongMap.ts` cho adapter SDK và `goongApi.ts` cho REST). Bộ interface
// dưới đây giữ nguyên hình dáng cũ để `GoogleMapCanvas` + các màn dùng bản đồ +
// test hiện có không phải sửa: đây là ranh giới duy nhất giữa app và SDK bản đồ.
// Muốn đổi nhà cung cấp lần nữa thì chỉ cần viết adapter mới thoả các type này.
import {
  goongAutocomplete,
  goongPlaceDetail,
  goongReverseGeocode,
  type GoongAddressComponent,
  type GoongPlaceResult,
} from "./goongApi";
import { getGoongApiKey, goongMissingApiKeyMessage } from "./goongConfig";
import { createGoongMapsLibrary } from "./goongMap";

export type GoogleMapCoordinate = {
  lat: number;
  lng: number;
};

export type GoogleMapsEventListener = {
  remove: () => void;
};

export type GoogleLatLngValue = {
  lat: () => number;
  lng: () => number;
};

export type GoogleMapMouseEvent = {
  latLng: GoogleLatLngValue | null;
};

// Tập option đổi được lúc runtime qua map.setOptions (kéo nắn đường tuỳ chỉnh:
// tạm khoá kéo bản đồ + đổi con trỏ trong lúc túm thân đường)
export type GoogleMapOptionUpdates = {
  draggable?: boolean;
  draggableCursor?: string;
  draggingCursor?: string;
  styles?: readonly GoogleMapStyleElement[];
};

export type GoogleMapStyleElement = {
  elementType?: string;
  featureType?: string;
  stylers: ReadonlyArray<Record<string, string | number>>;
};

export type GoogleMapInstance = {
  addListener: (
    eventName: string,
    handler: (event?: GoogleMapMouseEvent) => void,
  ) => GoogleMapsEventListener;
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void;
  // Optional để mock/test cũ không gãy — caller phải guard trước khi dùng
  getZoom?: () => number | undefined;
  panTo: (position: GoogleMapCoordinate) => void;
  setCenter: (position: GoogleMapCoordinate) => void;
  // Optional để mock/test cũ không gãy — caller phải guard trước khi dùng
  setOptions?: (options: GoogleMapOptionUpdates) => void;
  setZoom: (zoom: number) => void;
};

export type GoogleLatLngBoundsInstance = {
  extend: (position: GoogleMapCoordinate) => void;
  isEmpty: () => boolean;
};

type GoogleMapOptions = {
  cameraControl?: boolean;
  center: GoogleMapCoordinate;
  clickableIcons?: boolean;
  fullscreenControl?: boolean;
  gestureHandling?: "auto" | "cooperative" | "greedy" | "none";
  mapTypeControl?: boolean;
  /** Goong-compatible style URL; ignored by providers that do not use it. */
  mapStyleUrl?: string;
  renderingType?: "RASTER" | "VECTOR";
  rotateControl?: boolean;
  scaleControl?: boolean;
  streetViewControl?: boolean;
  styles?: readonly GoogleMapStyleElement[];
  zoom: number;
  zoomControl?: boolean;
};

type GoogleCircleOptions = {
  center: GoogleMapCoordinate;
  clickable?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  map: GoogleMapInstance;
  radius: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
};

export type GoogleCircleInstance = {
  addListener: (
    eventName: string,
    handler: (event?: GoogleMapMouseEvent) => void,
  ) => GoogleMapsEventListener;
  setMap: (map: GoogleMapInstance | null) => void;
};

// Icon lặp dọc polyline — dùng vẽ đường ĐỨT NÉT: strokeOpacity của thân đường
// đặt 0, mỗi "gạch" là một Symbol path lặp lại theo `repeat`.
type GooglePolylineIcon = {
  icon: GoogleMarkerIcon;
  offset?: string;
  repeat?: string;
};

type GooglePolylineOptions = {
  clickable?: boolean;
  // Con trỏ khi rê chuột lên đường — "grab" cho đường kéo nắn được, "pointer"
  // cho đường chỉ bấm chọn. Không đặt thì đường dùng con trỏ của bản đồ.
  cursor?: string;
  icons?: GooglePolylineIcon[];
  map: GoogleMapInstance;
  path: GoogleMapCoordinate[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  zIndex?: number;
};

// Tập option đổi được tại chỗ qua polyline.setOptions — đủ để reconcile mà không
// phải gỡ + vẽ lại instance (xem pool polyline trong GoogleMapCanvas)
export type GooglePolylineOptionUpdates = {
  clickable?: boolean;
  cursor?: string;
  icons?: GooglePolylineIcon[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  zIndex?: number;
};

export type GooglePolylineInstance = {
  addListener: (
    eventName: string,
    handler: (event?: GoogleMapMouseEvent) => void,
  ) => GoogleMapsEventListener;
  setMap: (map: GoogleMapInstance | null) => void;
  // Optional (mock/test cũ không gãy): đổi hình dạng/kiểu vẽ TẠI CHỖ thay vì gỡ
  // + vẽ lại. Thiếu hai hàm này thì pool tự fallback về tạo instance mới.
  setPath?: (path: GoogleMapCoordinate[]) => void;
  setOptions?: (options: GooglePolylineOptionUpdates) => void;
};

// Nhãn chữ hiển thị trên marker (bubble thời lượng phương án đường)
type GoogleMarkerLabel = {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  text: string;
};

// Icon dạng Symbol (path SVG) — dùng vẽ bubble/điểm kéo thay pin mặc định
export type GoogleMarkerIcon = {
  fillColor?: string;
  fillOpacity?: number;
  path: string;
  /** Độ, thuận chiều kim đồng hồ từ hướng bắc — xoay Symbol quanh gốc path. */
  rotation?: number;
  scale?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
};

type GoogleMarkerOptions = {
  clickable?: boolean;
  cursor?: string;
  draggable?: boolean;
  icon?: GoogleMarkerIcon;
  label?: GoogleMarkerLabel;
  map: GoogleMapInstance;
  position: GoogleMapCoordinate;
  title?: string;
  zIndex?: number;
};

export type GoogleMarkerInstance = {
  addListener: (
    eventName: string,
    handler: (event?: GoogleMapMouseEvent) => void,
  ) => GoogleMapsEventListener;
  setMap: (map: GoogleMapInstance | null) => void;
  // Optional (mock/test cũ không gãy): dời marker tại chỗ thay vì gỡ + vẽ lại —
  // giữ nguyên instance để không cắt đứt thao tác kéo đang diễn ra
  setPosition?: (position: GoogleMapCoordinate) => void;
  // Cùng lý do với setPosition, nhưng cho hình dạng: marker xe đổi `rotation`
  // mỗi lần có điểm GPS mới, gỡ + vẽ lại từng nhịp thì xe nháy và mất InfoWindow
  // đang mở.
  setIcon?: (icon: GoogleMarkerIcon) => void;
};

export type GoogleInfoWindowInstance = {
  close: () => void;
  open: (options: { map: GoogleMapInstance }) => void;
  setContent: (content: Node | string) => void;
  setPosition: (position: GoogleMapCoordinate) => void;
};

// Pane float của OverlayView — nơi gắn div tuỳ ý (card neo theo tọa độ) chồng
// lên bản đồ, di chuyển cùng camera (pan/zoom) như marker thật
export type GoogleOverlayViewPanes = {
  floatPane: HTMLElement;
};

// Projection quy đổi toạ độ lat/lng ra pixel trong div bản đồ — chỉ dùng được
// bên trong draw() (sau khi onAdd chạy), null nếu map chưa sẵn sàng chiếu
export type GoogleOverlayViewProjection = {
  fromLatLngToDivPixel: (
    position: GoogleMapCoordinate,
  ) => { x: number; y: number } | null;
};

// OverlayView: khác các overlay khác (Circle/Polyline/Marker) ở chỗ KHÔNG nhận
// options qua constructor — phải tạo rỗng rồi GÁN onAdd/draw/onRemove (đúng
// cách Google Maps API yêu cầu subclass hoá). Dùng để neo card tuỳ ý (React
// portal) theo toạ độ bản đồ thay vì marker/InfoWindow có sẵn.
export type GoogleOverlayViewInstance = {
  draw: () => void;
  getPanes: () => GoogleOverlayViewPanes;
  // undefined tới khi Google chạy xong onAdd/draw-cycle thật đầu tiên — draw()
  // GỌI CHỦ ĐỘNG ngay sau setMap() (không đợi cycle đó) nên caller BẮT BUỘC
  // guard trước khi dùng, không được coi là luôn có sẵn
  getProjection: () => GoogleOverlayViewProjection | undefined;
  onAdd: () => void;
  onRemove: () => void;
  setMap: (map: GoogleMapInstance | null) => void;
};

export type GoogleMapsLibrary = {
  Circle: new (options: GoogleCircleOptions) => GoogleCircleInstance;
  InfoWindow: new () => GoogleInfoWindowInstance;
  LatLngBounds: new () => GoogleLatLngBoundsInstance;
  Map: new (
    element: HTMLElement,
    options: GoogleMapOptions,
  ) => GoogleMapInstance;
  // Marker (legacy) đến từ importLibrary("marker") — optional để không gãy khi
  // thư viện marker không tải được; caller phải tự guard trước khi dùng
  Marker?: new (options: GoogleMarkerOptions) => GoogleMarkerInstance;
  // Optional (mock/test cũ không gãy + phòng thư viện "maps" không kèm sẵn):
  // caller phải guard trước khi dùng — thiếu thì card neo tuỳ ý không vẽ được
  OverlayView?: new () => GoogleOverlayViewInstance;
  Polyline: new (options: GooglePolylineOptions) => GooglePolylineInstance;
};

export type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types?: string[];
};

export type GooglePlace = {
  addressComponents?: GoogleAddressComponent[];
  displayName?: string;
  fetchFields: (request: { fields: string[] }) => Promise<void>;
  formattedAddress?: string;
  id?: string;
  location?: GoogleLatLngValue;
};

export type GooglePlacePrediction = {
  mainText?: { toString: () => string };
  placeId: string;
  secondaryText?: { toString: () => string };
  text: { toString: () => string };
  toPlace: () => GooglePlace;
};

export type GoogleAutocompleteSessionToken = object;

type GoogleAutocompleteSuggestion = {
  placePrediction?: GooglePlacePrediction;
};

type GoogleAutocompleteRequest = {
  includedRegionCodes?: string[];
  input: string;
  language?: string;
  region?: string;
  sessionToken: GoogleAutocompleteSessionToken;
};

export type GooglePlacesLibrary = {
  AutocompleteSessionToken: new () => GoogleAutocompleteSessionToken;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (
      request: GoogleAutocompleteRequest,
    ) => Promise<{ suggestions: GoogleAutocompleteSuggestion[] }>;
  };
};

export type GoogleGeocoderResult = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
  geometry?: {
    location?: GoogleLatLngValue;
  };
  place_id?: string;
};

export type GoogleGeocoderInstance = {
  geocode: (request: {
    language?: string;
    location: GoogleMapCoordinate;
    region?: string;
  }) => Promise<{ results: GoogleGeocoderResult[] }>;
};

export type GoogleGeocodingLibrary = {
  Geocoder: new () => GoogleGeocoderInstance;
};

// ── Nạp SDK bản đồ ─────────────────────────────────────────────────────────

/**
 * Bộ constructor bản đồ (Map/Circle/Polyline/Marker/InfoWindow/OverlayView).
 * Chạy trên Goong JS; ném lỗi khi chưa cấu hình VITE_GOONG_MAPTILES_KEY.
 */
export async function loadGoogleMapsLibrary(): Promise<GoogleMapsLibrary> {
  return createGoongMapsLibrary();
}

// ── Places: autocomplete + chi tiết địa điểm ───────────────────────────────

function toLatLngValue(location: { lat: number; lng: number }): GoogleLatLngValue {
  return {
    lat: () => location.lat,
    lng: () => location.lng,
  };
}

function toAddressComponents(
  components: GoongAddressComponent[],
): GoogleAddressComponent[] {
  return components.map((component) => ({
    long_name: component.long_name,
    short_name: component.short_name,
    types: component.types,
  }));
}

// Điền dữ liệu chi tiết vào `place` đã trả cho caller — giữ đúng hợp đồng của
// Google Places New: `toPlace()` trả object rỗng, `fetchFields()` mới nạp field.
function assignPlaceFields(place: GooglePlace, detail: GoongPlaceResult) {
  place.addressComponents = toAddressComponents(detail.addressComponents);
  place.displayName = detail.name || place.displayName;
  place.formattedAddress = detail.formattedAddress || place.formattedAddress;
  place.id = detail.placeId;
  place.location = toLatLngValue(detail.location);
}

function createPlaceFromPrediction(
  prediction: { description: string; mainText: string; placeId: string },
  sessionToken?: string,
): GooglePlace {
  const place: GooglePlace = {
    displayName: prediction.mainText,
    fetchFields: async () => {
      // Goong AutoComplete KHÔNG kèm toạ độ — bắt buộc gọi Place Detail mới có
      const detail = await goongPlaceDetail(prediction.placeId, sessionToken);
      if (detail) {
        assignPlaceFields(place, detail);
      }
    },
    formattedAddress: prediction.description,
    id: prediction.placeId,
  };

  return place;
}

function toTextValue(value: string) {
  return { toString: () => value };
}

// Goong CÓ session token thật (gom autocomplete + detail vào một phiên tính
// cước, đúng như Google) — token là một UUID gửi kèm cả hai request.
class GoongSessionToken {
  private readonly value =
    globalThis.crypto?.randomUUID?.() ??
    `vr-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  toString() {
    return this.value;
  }
}

function readSessionToken(token: unknown): string | undefined {
  return token instanceof GoongSessionToken ? token.toString() : undefined;
}

/** Thư viện gợi ý địa điểm, chạy trên Place AutoComplete + Place Detail. */
export async function loadGooglePlacesLibrary(): Promise<GooglePlacesLibrary> {
  requireGoongApiKey();

  return {
    AutocompleteSessionToken: GoongSessionToken,
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: async (request) => {
        const sessionToken = readSessionToken(request.sessionToken);
        const predictions = await goongAutocomplete({
          input: request.input,
          sessionToken,
        });

        return {
          suggestions: predictions.map((prediction) => ({
            placePrediction: {
              mainText: toTextValue(prediction.mainText),
              placeId: prediction.placeId,
              secondaryText: toTextValue(prediction.secondaryText),
              text: toTextValue(prediction.description),
              toPlace: () =>
                createPlaceFromPrediction(prediction, sessionToken),
            },
          })),
        };
      },
    },
  };
}

// ── Geocoding: toạ độ → địa chỉ ────────────────────────────────────────────

function toGeocoderResult(place: GoongPlaceResult): GoogleGeocoderResult {
  return {
    address_components: toAddressComponents(place.addressComponents),
    formatted_address: place.formattedAddress || place.name,
    geometry: { location: toLatLngValue(place.location) },
    place_id: place.placeId,
  };
}

export async function loadGoogleGeocodingLibrary(): Promise<GoogleGeocodingLibrary> {
  requireGoongApiKey();

  return {
    Geocoder: class {
      async geocode(request: { location: GoogleMapCoordinate }) {
        const places = await goongReverseGeocode({
          lat: request.location.lat,
          lng: request.location.lng,
        });

        return { results: places.map(toGeocoderResult) };
      }
    },
  };
}

function requireGoongApiKey() {
  if (!getGoongApiKey()) {
    throw new Error(goongMissingApiKeyMessage);
  }
}
