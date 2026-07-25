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

export type GoogleMapInstance = {
  addListener: (
    eventName: string,
    handler: (event?: GoogleMapMouseEvent) => void,
  ) => GoogleMapsEventListener;
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void;
  panTo: (position: GoogleMapCoordinate) => void;
  setCenter: (position: GoogleMapCoordinate) => void;
  setZoom: (zoom: number) => void;
};

export type GoogleLatLngBoundsInstance = {
  extend: (position: GoogleMapCoordinate) => void;
  isEmpty: () => boolean;
};

type GoogleMapOptions = {
  center: GoogleMapCoordinate;
  clickableIcons?: boolean;
  fullscreenControl?: boolean;
  gestureHandling?: "auto" | "cooperative" | "greedy" | "none";
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
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
};

export type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

export type GoogleInfoWindowInstance = {
  close: () => void;
  open: (options: { map: GoogleMapInstance }) => void;
  setContent: (content: Node | string) => void;
  setPosition: (position: GoogleMapCoordinate) => void;
};

export type GoogleMapsLibrary = {
  Circle: new (options: GoogleCircleOptions) => GoogleCircleInstance;
  InfoWindow: new () => GoogleInfoWindowInstance;
  LatLngBounds: new () => GoogleLatLngBoundsInstance;
  Map: new (
    element: HTMLElement,
    options: GoogleMapOptions,
  ) => GoogleMapInstance;
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

function hasMapsLibraryShape(value: unknown): value is GoogleMapsLibrary {
  return (
    hasCallableProperty(value, "Map") &&
    hasCallableProperty(value, "Circle") &&
    hasCallableProperty(value, "Polyline") &&
    hasCallableProperty(value, "LatLngBounds") &&
    hasCallableProperty(value, "InfoWindow")
  );
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
      auth_referrer_policy: "origin",
      callback: GOOGLE_MAPS_CALLBACK,
      key: apiKey,
      language: "vi",
      loading: "async",
      region: "VN",
      v: "weekly",
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

export async function loadGoogleMapsLibrary() {
  const maps = await loadGoogleMapsBootstrap();
  const library = await maps.importLibrary("maps");

  if (!hasMapsLibraryShape(library)) {
    throw new Error("Google Maps trả về thư viện bản đồ không hợp lệ.");
  }

  return library;
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
