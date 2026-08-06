import type { GoogleAddressComponent } from "./googleMaps";

export type GoogleAddressParts = {
  city: string;
  ward: string;
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
    "administrative_area_level_1",
    "locality",
  ]);
  const wardComponent = findComponent(components, [
    "administrative_area_level_3",
    "sublocality_level_1",
    "sublocality",
    "administrative_area_level_2",
  ]);
  const city = cityComponent ? componentText(cityComponent) : "";
  const ward = wardComponent ? componentText(wardComponent) : "";

  return {
    city,
    ward,
  };
}
