// Lớp tương thích bản đồ chạy trên Goong: gợi ý địa điểm (autocomplete + chi
// tiết) và reverse geocoding phải giữ NGUYÊN hình dáng API kiểu Google mà
// PlacePicker/StopSearchBox đang gọi, chỉ đổi endpoint bên dưới.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadGoogleGeocodingLibrary,
  loadGooglePlacesLibrary,
} from "./googleMaps";

function stubFetch(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  bodies.forEach((body) => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  });
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof stubFetch>, index = 0) {
  return new URL(String(fetchMock.mock.calls[index][0]));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loadGooglePlacesLibrary", () => {
  it("rejects when the Goong API key is missing", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "");

    await expect(loadGooglePlacesLibrary()).rejects.toThrow(
      "VITE_GOONG_API_KEY",
    );
  });

  it("maps autocomplete predictions to the Google-shaped suggestion list", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({
      predictions: [
        {
          description: "Bến xe Miền Đông, Bình Thạnh, Hồ Chí Minh",
          place_id: "place-1",
          structured_formatting: {
            main_text: "Bến xe Miền Đông",
            secondary_text: "Bình Thạnh, Hồ Chí Minh",
          },
        },
        { description: "thiếu place_id" },
      ],
      status: "OK",
    });

    const library = await loadGooglePlacesLibrary();
    const { suggestions } =
      await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: "ben xe",
        sessionToken: new library.AutocompleteSessionToken(),
      });

    const url = requestedUrl(fetchMock);
    expect(url.origin + url.pathname).toBe(
      "https://rsapi.goong.io/Place/AutoComplete",
    );
    expect(url.searchParams.get("input")).toBe("ben xe");
    expect(url.searchParams.get("api_key")).toBe("test-key");
    // Goong CÓ session token thật — phải gửi kèm để gộp cước autocomplete+detail
    expect(url.searchParams.get("sessiontoken")).toBeTruthy();

    // Bản ghi thiếu place_id bị loại, bản hợp lệ giữ đúng hình dáng cũ
    expect(suggestions).toHaveLength(1);
    const prediction = suggestions[0].placePrediction;
    expect(prediction?.placeId).toBe("place-1");
    expect(prediction?.mainText?.toString()).toBe("Bến xe Miền Đông");
    expect(prediction?.secondaryText?.toString()).toBe(
      "Bình Thạnh, Hồ Chí Minh",
    );
    expect(prediction?.text.toString()).toBe(
      "Bến xe Miền Đông, Bình Thạnh, Hồ Chí Minh",
    );
  });

  it("fills the place through fetchFields and rebuilds address parts from compound", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch(
      {
        predictions: [
          { description: "Bến xe Miền Đông", place_id: "place-1" },
        ],
      },
      {
        result: {
          // Goong mô tả địa giới bằng `compound`, KHÔNG có address_components
          compound: {
            commune: "Phường 26",
            district: "Bình Thạnh",
            province: "Hồ Chí Minh",
          },
          formatted_address: "501 Hoàng Văn Thụ, Hồ Chí Minh",
          geometry: { location: { lat: 10.8, lng: 106.65 } },
          name: "Bến xe Miền Đông",
          place_id: "place-1",
        },
      },
    );

    const library = await loadGooglePlacesLibrary();
    const { suggestions } =
      await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: "ben xe",
        sessionToken: new library.AutocompleteSessionToken(),
      });
    const place = suggestions[0].placePrediction!.toPlace();
    await place.fetchFields({ fields: ["location"] });

    const detailUrl = requestedUrl(fetchMock, 1);
    expect(detailUrl.origin + detailUrl.pathname).toBe(
      "https://rsapi.goong.io/Place/Detail",
    );
    expect(detailUrl.searchParams.get("place_id")).toBe("place-1");
    // Cùng một phiên với autocomplete
    expect(detailUrl.searchParams.get("sessiontoken")).toBe(
      requestedUrl(fetchMock).searchParams.get("sessiontoken"),
    );

    expect(place.location?.lat()).toBe(10.8);
    expect(place.location?.lng()).toBe(106.65);
    expect(place.formattedAddress).toBe("501 Hoàng Văn Thụ, Hồ Chí Minh");
    expect(place.displayName).toBe("Bến xe Miền Đông");
    // compound → address_components để extractGoogleAddressParts đọc được
    // tỉnh/thành (level_1) và phường/xã (level_3) y như hồi Google
    expect(place.addressComponents).toEqual([
      {
        long_name: "Phường 26",
        short_name: "Phường 26",
        types: ["administrative_area_level_3", "sublocality"],
      },
      {
        long_name: "Bình Thạnh",
        short_name: "Bình Thạnh",
        types: ["administrative_area_level_2"],
      },
      {
        long_name: "Hồ Chí Minh",
        short_name: "Hồ Chí Minh",
        types: ["administrative_area_level_1"],
      },
    ]);
  });
});

describe("loadGoogleGeocodingLibrary", () => {
  it("rejects when the Goong API key is missing", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "");

    await expect(loadGoogleGeocodingLibrary()).rejects.toThrow(
      "VITE_GOONG_API_KEY",
    );
  });

  it("reverse geocodes a coordinate into Google-shaped results", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({
      results: [
        {
          compound: { commune: "Phường 4", province: "Hồ Chí Minh" },
          formatted_address: "12 Nguyễn Huệ, Phường 4",
          geometry: { location: { lat: 10.8142, lng: 106.7108 } },
          place_id: "place-9",
        },
      ],
      status: "OK",
    });

    const library = await loadGoogleGeocodingLibrary();
    const { results } = await new library.Geocoder().geocode({
      language: "vi",
      location: { lat: 10.8142, lng: 106.7108 },
      region: "VN",
    });

    const url = requestedUrl(fetchMock);
    expect(url.origin + url.pathname).toBe("https://rsapi.goong.io/Geocode");
    expect(url.searchParams.get("latlng")).toBe("10.8142,106.7108");

    expect(results).toHaveLength(1);
    expect(results[0].formatted_address).toBe("12 Nguyễn Huệ, Phường 4");
    expect(results[0].place_id).toBe("place-9");
    expect(results[0].geometry?.location?.lat()).toBe(10.8142);
    expect(results[0].geometry?.location?.lng()).toBe(106.7108);
  });
});
