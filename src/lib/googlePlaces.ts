import type { GoogleAddressComponent } from "./googleMaps";

export type GoogleAddressParts = {
  city: string;
  province: string;
};

function componentText(component: GoogleAddressComponent) {
  return (
    component.longText ??
    component.long_name ??
    component.shortText ??
    component.short_name ??
    ""
  );
}

function findComponent(
  components: GoogleAddressComponent[] | undefined,
  acceptedTypes: string[],
) {
  return (
    components?.find((component) =>
      acceptedTypes.some((type) => component.types?.includes(type)),
    ) ?? null
  );
}

export function extractGoogleAddressParts(
  components: GoogleAddressComponent[] | undefined,
): GoogleAddressParts {
  const cityComponent = findComponent(components, [
    "locality",
    "administrative_area_level_2",
    "sublocality_level_1",
  ]);
  const provinceComponent = findComponent(components, [
    "administrative_area_level_1",
  ]);
  const city = cityComponent ? componentText(cityComponent) : "";
  const province = provinceComponent ? componentText(provinceComponent) : "";

  return {
    city: city || province,
    province: province || city,
  };
}
