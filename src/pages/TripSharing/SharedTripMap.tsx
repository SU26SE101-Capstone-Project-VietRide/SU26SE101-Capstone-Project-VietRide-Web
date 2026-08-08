import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import GoogleMapCanvas, {
  type GoogleMapPointMarker,
  type GoogleMapPolyline,
} from "../../components/GoogleMapCanvas";
import type { GoogleMapStyleElement } from "../../lib/googleMaps";
import type { SharedTripContext, SharedTripVehicleLocation } from "./tripShareApi";

/** Passenger liquid light map palette (aligned with mobile tracking). */
const ROUTE_COLOR = "rgba(0, 125, 120, 0.88)";
const VEHICLE_COLOR = "#E6A800";
const ORIGIN_COLOR = "#0F9F6E";
const DESTINATION_COLOR = "#C43C3C";
const PIN_PATH =
  "M 0,-10 C -5.5,-10 -9,-6.2 -9,-1.5 C -9,4.7 0,12 0,12 C 0,12 9,4.7 9,-1.5 C 9,-6.2 5.5,-10 0,-10 Z";
const DOT_PATH = "M 0,-7 A 7,7 0 1,0 0,7 A 7,7 0 1,0 0,-7";

/** Same quiet liquid-light canvas used by Passenger mobile tracking. */
const LIQUID_LIGHT_MAP_STYLES: readonly GoogleMapStyleElement[] = [
  { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#F2F7F6" }] },
  { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#E4F0E6" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3D524F" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F8FCFB" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#D0DDDB" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#D5E0DE" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#FFE4B0" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#C5E6E8" }] },
];

type SharedTripMapProps = {
  context: SharedTripContext | null;
  location: SharedTripVehicleLocation | null;
};

export default function SharedTripMap({ context, location }: SharedTripMapProps) {
  const { t } = useTranslation("tripShare");

  const routePath = useMemo(() => {
    const coords = context?.route.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  }, [context?.route.geometry?.coordinates]);

  const vehiclePosition = useMemo(() => {
    if (!location) return null;
    return { lat: location.latitude, lng: location.longitude };
  }, [location]);

  const center = useMemo(() => {
    if (routePath.length > 0) return routePath[Math.floor(routePath.length / 2)];
    if (vehiclePosition) return vehiclePosition;
    return { lat: 10.8231, lng: 106.6297 };
  }, [routePath, vehiclePosition]);

  const fitPoints = useMemo(() => {
    // A stable route-sized viewport avoids a full fitBounds + pan on every GPS
    // tick. Only fall back to the vehicle when geometry is unavailable.
    return routePath.length > 0
      ? routePath
      : vehiclePosition
        ? [vehiclePosition]
        : [];
  }, [routePath, vehiclePosition]);

  const pointMarkers = useMemo<GoogleMapPointMarker[]>(() => {
    const list: GoogleMapPointMarker[] = [];
    if (routePath.length > 0) {
      list.push({
        id: "origin",
        icon: {
          fillColor: ORIGIN_COLOR,
          fillOpacity: 1,
          path: DOT_PATH,
          scale: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2.5,
        },
        position: routePath[0],
        title: context?.route.originName,
        zIndex: 2,
      });
      list.push({
        id: "destination",
        icon: {
          fillColor: DESTINATION_COLOR,
          fillOpacity: 1,
          path: DOT_PATH,
          scale: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2.5,
        },
        position: routePath[routePath.length - 1],
        title: context?.route.destinationName,
        zIndex: 2,
      });
    }
    if (vehiclePosition) {
      list.push({
        id: "vehicle",
        icon: {
          fillColor: VEHICLE_COLOR,
          fillOpacity: 1,
          path: PIN_PATH,
          scale: 1.25,
          strokeColor: "#FFFFFF",
          strokeWeight: 2.5,
        },
        label: {
          color: "#13211F",
          fontSize: "10px",
          fontWeight: "800",
          text: "•",
        },
        position: vehiclePosition,
        title: t("map.vehicle"),
        zIndex: 4,
      });
    }
    return list;
  }, [context?.route.destinationName, context?.route.originName, routePath, t, vehiclePosition]);

  const polylines = useMemo<GoogleMapPolyline[]>(() => {
    if (routePath.length < 2) return [];
    return [
      {
        id: "planned-route",
        color: ROUTE_COLOR,
        path: routePath,
        weight: 5,
        opacity: 0.92,
        zIndex: 1,
      },
    ];
  }, [routePath]);

  return (
    <GoogleMapCanvas
      ariaLabel={t("map.ariaLabel")}
      center={center}
      className="h-full w-full"
      errorFallback={t("map.unavailable")}
      fitPoints={fitPoints.length > 0 ? fitPoints : undefined}
      mapStyles={LIQUID_LIGHT_MAP_STYLES}
      pointMarkers={pointMarkers}
      polylines={polylines}
      scrollWheelZoom
      zoom={vehiclePosition ? 13 : 11}
    />
  );
}
