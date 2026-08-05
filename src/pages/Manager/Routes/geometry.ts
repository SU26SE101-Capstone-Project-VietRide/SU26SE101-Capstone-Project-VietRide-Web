// Helper hình học + gọi Google Routes API cho màn Routes
import { isRecord } from "../../../utils/typeGuards";
import {
  decodeGooglePolyline,
  parseGoogleDurationSeconds,
  type RouteCoordinate,
} from "./polyline";

const googleRoutesEndpoint =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKmBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(second.latitude - first.latitude);
  const lonDistance = toRadians(second.longitude - first.longitude);
  const firstLat = toRadians(first.latitude);
  const secondLat = toRadians(second.latitude);
  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDistance / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function calculatePathDistance(points: RouteCoordinate[]) {
  return points.slice(1).reduce(
    (total, point, index) => total + distanceKmBetween(points[index], point),
    0,
  );
}

export async function requestRoadGeometry(
  points: RouteCoordinate[],
  errorMessage: string,
) {
  const apiKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(errorMessage);
  }

  const toWaypoint = (point: RouteCoordinate) => ({
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude,
      },
    },
  });
  const response = await fetch(googleRoutesEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: toWaypoint(points[0]),
      destination: toWaypoint(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(toWaypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      computeAlternativeRoutes: false,
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      languageCode: "vi",
      units: "METRIC",
    }),
  });
  const body: unknown = await response.json();

  if (!response.ok || !isRecord(body) || !Array.isArray(body.routes)) {
    throw new Error(errorMessage);
  }

  const firstRoute = body.routes[0];
  if (
    !isRecord(firstRoute) ||
    typeof firstRoute.distanceMeters !== "number" ||
    typeof firstRoute.duration !== "string"
  ) {
    throw new Error(errorMessage);
  }

  const polyline = firstRoute.polyline;
  if (!isRecord(polyline) || typeof polyline.encodedPolyline !== "string") {
    throw new Error(errorMessage);
  }

  const durationSeconds = parseGoogleDurationSeconds(firstRoute.duration);
  if (durationSeconds <= 0) {
    throw new Error(errorMessage);
  }

  return {
    points: decodeGooglePolyline(polyline.encodedPolyline),
    totalDistanceKm: Number((firstRoute.distanceMeters / 1000).toFixed(1)),
    estimatedDurationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
  };
}
