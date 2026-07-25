import { describe, expect, it } from "vitest";
import { extractGoogleAddressParts } from "./googlePlaces";

describe("extractGoogleAddressParts", () => {
  it("reads fields returned by Places API (New)", () => {
    expect(
      extractGoogleAddressParts([
        {
          longText: "Thành phố Thủ Đức",
          shortText: "Thủ Đức",
          types: ["administrative_area_level_2"],
        },
        {
          longText: "Thành phố Hồ Chí Minh",
          shortText: "Hồ Chí Minh",
          types: ["administrative_area_level_1"],
        },
      ]),
    ).toEqual({
      city: "Thành phố Thủ Đức",
      province: "Thành phố Hồ Chí Minh",
    });
  });

  it("reads legacy geocoder component fields", () => {
    expect(
      extractGoogleAddressParts([
        {
          long_name: "Đà Lạt",
          short_name: "Đà Lạt",
          types: ["locality"],
        },
        {
          long_name: "Lâm Đồng",
          short_name: "Lâm Đồng",
          types: ["administrative_area_level_1"],
        },
      ]),
    ).toEqual({
      city: "Đà Lạt",
      province: "Lâm Đồng",
    });
  });

  it("uses the available administrative value as a safe fallback", () => {
    expect(
      extractGoogleAddressParts([
        {
          longText: "Khánh Hòa",
          types: ["administrative_area_level_1"],
        },
      ]),
    ).toEqual({
      city: "Khánh Hòa",
      province: "Khánh Hòa",
    });
  });
});
