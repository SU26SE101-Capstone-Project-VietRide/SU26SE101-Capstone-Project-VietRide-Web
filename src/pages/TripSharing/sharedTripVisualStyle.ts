/**
 * Visual tokens scoped to the public trip-sharing experience.
 *
 * They mirror Passenger Mobile's light tracking palette without changing the
 * Manager/Admin map tokens. Marker geometry and interaction behavior stay the
 * same; only this public capability page adopts the Mobile visual language.
 */
export const originStopColor = "#2457D6";
export const destinationStopColor = "#B8325A";
export const intermediateStopColor = "#FFFFFF";

export const routeRemainingColor = "#007D78";
export const routeTraveledColor = "#627A77";
export const routeCasingColor = "#FFFFFF";

/** Official Goong light basemap, scoped to the public tracking canvas only. */
export const sharedTripMapStyleUrl =
  "https://tiles.goong.io/assets/goong_light_v2.json";

export const vehicleMovingColor = "#9A6500";
export const vehicleIdleColor = "#627A77";

export const routeEndpointPinScale = 0.8;
export const routeStopBadgeScale = 0.95;
