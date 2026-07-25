import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadGoogleMapsLibrary,
  type GoogleCircleInstance,
  type GoogleMapCoordinate,
  type GoogleMapInstance,
  type GoogleMapsEventListener,
  type GoogleMapsLibrary,
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
  opacity?: number;
  path: GoogleMapCoordinate[];
  weight?: number;
};

type GoogleMapCanvasProps = {
  ariaLabel: string;
  center: GoogleMapCoordinate;
  className?: string;
  emptyState?: ReactNode;
  fitPoints?: GoogleMapCoordinate[];
  focusCenter?: GoogleMapCoordinate | null;
  markers?: GoogleMapMarker[];
  onMapClick?: (position: GoogleMapCoordinate) => void;
  polylines?: GoogleMapPolyline[];
  scrollWheelZoom?: boolean;
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

export default function GoogleMapCanvas({
  ariaLabel,
  center,
  className = defaultClassName,
  emptyState,
  fitPoints = [],
  focusCenter,
  markers = [],
  onMapClick,
  polylines = [],
  scrollWheelZoom = true,
  zoom,
}: GoogleMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapClickListenerRef = useRef<GoogleMapsEventListener | null>(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const [readyMap, setReadyMap] = useState<ReadyMap | null>(null);
  const [error, setError] = useState("");

  const fitSignature = useMemo(
    () =>
      fitPoints
        .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
        .join("|"),
    [fitPoints],
  );

  useEffect(() => {
    let active = true;

    void loadGoogleMapsLibrary()
      .then((library) => {
        if (!active || !containerRef.current) {
          return;
        }

        const instance = new library.Map(containerRef.current, {
          center: initialCenterRef.current,
          clickableIcons: true,
          fullscreenControl: false,
          gestureHandling: scrollWheelZoom ? "cooperative" : "none",
          mapTypeControl: false,
          streetViewControl: false,
          zoom: initialZoomRef.current,
          zoomControl: true,
        });
        setReadyMap({ instance, library });
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải bản đồ Google.",
        );
      });

    return () => {
      active = false;
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
    };
  }, [scrollWheelZoom]);

  useEffect(() => {
    if (!readyMap) {
      return;
    }

    readyMap.instance.setCenter(center);
    readyMap.instance.setZoom(zoom);
  }, [center, readyMap, zoom]);

  useEffect(() => {
    if (!readyMap || !focusCenter) {
      return;
    }

    readyMap.instance.panTo(focusCenter);
    readyMap.instance.setZoom(14);
  }, [focusCenter, readyMap]);

  useEffect(() => {
    if (!readyMap || fitPoints.length < 2) {
      return;
    }

    const bounds = new readyMap.library.LatLngBounds();
    fitPoints.forEach((point) => bounds.extend(point));
    if (!bounds.isEmpty()) {
      readyMap.instance.fitBounds(bounds, 32);
    }
  }, [fitPoints, fitSignature, readyMap]);

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
      listeners.forEach((listener) => listener.remove());
      infoWindow.close();
      clearCircles(circles);
    };
  }, [markers, readyMap]);

  useEffect(() => {
    if (!readyMap) {
      return;
    }

    const overlays = polylines
      .filter((polyline) => polyline.path.length > 1)
      .map(
        (polyline) =>
          new readyMap.library.Polyline({
            clickable: false,
            map: readyMap.instance,
            path: polyline.path,
            strokeColor: polyline.color,
            strokeOpacity: polyline.opacity ?? 1,
            strokeWeight: polyline.weight ?? 5,
          }),
      );

    return () => clearPolylines(overlays);
  }, [polylines, readyMap]);

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="h-full min-h-[inherit] w-full" />
      {!readyMap && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm text-gray-500">
          Đang tải Google Maps...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-amber-50 px-6 text-center text-sm text-amber-800">
          {error}
        </div>
      )}
      {readyMap && markers.length === 0 && polylines.length === 0 && emptyState && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-center text-xs text-gray-600 shadow-sm">
          {emptyState}
        </div>
      )}
    </div>
  );
}
