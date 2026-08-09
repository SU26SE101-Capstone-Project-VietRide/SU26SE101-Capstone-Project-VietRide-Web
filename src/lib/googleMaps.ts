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

type GooglePolylineOptions = {
  clickable?: boolean;
  map: GoogleMapInstance;
  path: GoogleMapCoordinate[];
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
type GoogleMarkerIcon = {
  fillColor?: string;
  fillOpacity?: number;
  path: string;
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

type GoogleMapsRenderingLibrary = Omit<GoogleMapsLibrary, "LatLngBounds">;

type GoogleMapsCoreLibrary = Pick<GoogleMapsLibrary, "LatLngBounds">;

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

type GoogleMapsNamespace = {
  importLibrary: (name: string) => Promise<unknown>;
};

type GoogleMapsWindow = Window & {
  __vietRideGoogleMapsReady?: () => void;
  google?: {
    maps?: GoogleMapsNamespace;
  };
};

const GOOGLE_MAPS_SCRIPT_ID = "vietride-google-maps-script";
const GOOGLE_MAPS_CALLBACK = "__vietRideGoogleMapsReady";
const GOOGLE_MAPS_MISSING_KEY =
  "Chưa cấu hình VITE_GOOGLE_MAPS_API_KEY. Hãy thêm browser key đã giới hạn domain và API vào file .env.";

let bootstrapPromise: Promise<GoogleMapsNamespace> | null = null;

function getMapsWindow() {
  return window as GoogleMapsWindow;
}

function hasCallableProperty(value: unknown, property: string) {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    return false;
  }

  return typeof Reflect.get(value, property) === "function";
}

function hasMapsLibraryShape(
  value: unknown,
): value is GoogleMapsRenderingLibrary {
  return (
    hasCallableProperty(value, "Map") &&
    hasCallableProperty(value, "Circle") &&
    hasCallableProperty(value, "Polyline") &&
    hasCallableProperty(value, "InfoWindow")
  );
}

function hasCoreLibraryShape(value: unknown): value is GoogleMapsCoreLibrary {
  return hasCallableProperty(value, "LatLngBounds");
}

function hasPlacesLibraryShape(value: unknown): value is GooglePlacesLibrary {
  if (
    !hasCallableProperty(value, "AutocompleteSessionToken") ||
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    return false;
  }

  const autocompleteSuggestion = Reflect.get(value, "AutocompleteSuggestion");
  return hasCallableProperty(
    autocompleteSuggestion,
    "fetchAutocompleteSuggestions",
  );
}

function hasGeocodingLibraryShape(
  value: unknown,
): value is GoogleGeocodingLibrary {
  return hasCallableProperty(value, "Geocoder");
}

function loadGoogleMapsBootstrap() {
  const mapsWindow = getMapsWindow();
  const existingMaps = mapsWindow.google?.maps;

  if (existingMaps?.importLibrary) {
    return Promise.resolve(existingMaps);
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return Promise.reject(new Error(GOOGLE_MAPS_MISSING_KEY));
  }

  bootstrapPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const finishLoading = () => {
      const maps = mapsWindow.google?.maps;
      delete mapsWindow.__vietRideGoogleMapsReady;

      if (!maps?.importLibrary) {
        bootstrapPromise = null;
        reject(new Error("Google Maps JavaScript API không khởi tạo được."));
        return;
      }

      resolve(maps);
    };

    mapsWindow.__vietRideGoogleMapsReady = finishLoading;

    existingScript?.remove();

    const params = new URLSearchParams({
      callback: GOOGLE_MAPS_CALLBACK,
      key: apiKey,
      language: "vi",
      loading: "async",
      region: "VN",
      v: "quarterly",
    });
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.addEventListener("error", () => {
      bootstrapPromise = null;
      delete mapsWindow.__vietRideGoogleMapsReady;
      script.remove();
      reject(new Error("Không thể tải Google Maps JavaScript API."));
    });
    document.head.appendChild(script);
  });

  return bootstrapPromise;
}

function hasMarkerLibraryShape(
  value: unknown,
): value is Pick<Required<GoogleMapsLibrary>, "Marker"> {
  return hasCallableProperty(value, "Marker");
}

export async function loadGoogleMapsLibrary(): Promise<GoogleMapsLibrary> {
  const maps = await loadGoogleMapsBootstrap();
  const [library, coreLibrary, markerLibrary] = await Promise.all([
    maps.importLibrary("maps"),
    maps.importLibrary("core"),
    maps.importLibrary("marker"),
  ]);

  if (!hasMapsLibraryShape(library) || !hasCoreLibraryShape(coreLibrary)) {
    throw new Error("Google Maps trả về thư viện bản đồ không hợp lệ.");
  }

  return {
    ...library,
    LatLngBounds: coreLibrary.LatLngBounds,
    // Marker là optional: thiếu thì bản đồ vẫn chạy, chỉ không có nhãn/điểm kéo
    Marker: hasMarkerLibraryShape(markerLibrary)
      ? markerLibrary.Marker
      : undefined,
  };
}

export async function loadGooglePlacesLibrary() {
  const maps = await loadGoogleMapsBootstrap();
  const library = await maps.importLibrary("places");

  if (!hasPlacesLibraryShape(library)) {
    throw new Error("Google Maps trả về thư viện địa điểm không hợp lệ.");
  }

  return library;
}

export async function loadGoogleGeocodingLibrary() {
  const maps = await loadGoogleMapsBootstrap();
  const library = await maps.importLibrary("geocoding");

  if (!hasGeocodingLibraryShape(library)) {
    throw new Error("Google Maps trả về thư viện geocoding không hợp lệ.");
  }

  return library;
}
