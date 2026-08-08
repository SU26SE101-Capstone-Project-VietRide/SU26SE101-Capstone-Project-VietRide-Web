import {
  buildPlacePhotoUrl,
  getPlaceDetails,
  searchPlacesAlongRoute,
  __clearPlaceDetailsCacheForTest,
} from "./googlePlacesSearch";

const fakePlace = {
  id: "place-1",
  displayName: { text: "Trạm dừng chân Madagui" },
  formattedAddress: "QL20, Đạ Huoai, Lâm Đồng",
  location: { latitude: 11.36, longitude: 107.51 },
  types: ["point_of_interest", "establishment"],
  primaryType: "rest_stop",
};

describe("searchPlacesAlongRoute", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("gọi đúng endpoint searchText kèm searchAlongRouteParameters và map kết quả", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [fakePlace] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchPlacesAlongRoute("abc123", "bến xe");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:searchText",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "test-key",
          "X-Goog-FieldMask": expect.stringContaining("places.types"),
        }),
      }),
    );
    expect(
      (fetchMock.mock.calls[0][1].headers as Record<string, string>)[
        "X-Goog-FieldMask"
      ],
    ).toContain("places.primaryType");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.searchAlongRouteParameters.polyline.encodedPolyline).toBe("abc123");
    expect(body.textQuery).toBe("bến xe");
    expect(results).toEqual([
      {
        placeId: "place-1",
        name: "Trạm dừng chân Madagui",
        address: "QL20, Đạ Huoai, Lâm Đồng",
        latitude: 11.36,
        longitude: 107.51,
        types: ["point_of_interest", "establishment", "rest_stop"],
      },
    ]);
  });

  it("gộp primaryType vào types khi thiếu trong mảng types, và mặc định [] khi không có field types/primaryType", async () => {
    const placeWithoutTypes = {
      id: "place-2",
      displayName: { text: "Không rõ loại" },
      formattedAddress: "Đâu đó",
      location: { latitude: 10, longitude: 106 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ places: [placeWithoutTypes] }),
      }),
    );

    const results = await searchPlacesAlongRoute("abc123", "bến xe");
    expect(results).toEqual([
      {
        placeId: "place-2",
        name: "Không rõ loại",
        address: "Đâu đó",
        latitude: 10,
        longitude: 106,
        types: [],
      },
    ]);
  });

  it("HTTP lỗi → trả [] không throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(searchPlacesAlongRoute("abc", "bến xe")).resolves.toEqual([]);
  });

  it("thiếu API key → trả [] không gọi fetch", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchPlacesAlongRoute("abc", "bến xe")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const fakePlaceDetailsPayload = {
  id: "place-1",
  displayName: { text: "Trạm dừng chân Madagui" },
  formattedAddress: "QL20, Đạ Huoai, Lâm Đồng",
  rating: 4.3,
  userRatingCount: 128,
  internationalPhoneNumber: "+84 251 3874 999",
  primaryTypeDisplayName: { text: "Trạm dừng chân" },
  regularOpeningHours: {
    openNow: true,
    weekdayDescriptions: ["Thứ Hai: 00:00–24:00"],
  },
  photos: [{ name: "places/place-1/photos/photo-1" }],
  googleMapsUri: "https://maps.google.com/?cid=123",
};

describe("getPlaceDetails", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
    __clearPlaceDetailsCacheForTest();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("gọi đúng endpoint GET kèm fieldMask và map đủ field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakePlaceDetailsPayload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPlaceDetails("place-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/place-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "test-key",
          "X-Goog-FieldMask": expect.stringContaining("regularOpeningHours"),
        }),
      }),
    );
    expect(result).toEqual({
      placeId: "place-1",
      name: "Trạm dừng chân Madagui",
      address: "QL20, Đạ Huoai, Lâm Đồng",
      rating: 4.3,
      userRatingCount: 128,
      phone: "+84 251 3874 999",
      primaryTypeLabel: "Trạm dừng chân",
      openNow: true,
      weekdayHours: ["Thứ Hai: 00:00–24:00"],
      photoName: "places/place-1/photos/photo-1",
      googleMapsUri: "https://maps.google.com/?cid=123",
    });
  });

  it("thiếu field tuỳ chọn → null/[] mặc định", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "place-2" }),
      }),
    );

    const result = await getPlaceDetails("place-2");
    expect(result).toEqual({
      placeId: "place-2",
      name: "",
      address: "",
      rating: null,
      userRatingCount: null,
      phone: null,
      primaryTypeLabel: null,
      openNow: null,
      weekdayHours: [],
      photoName: null,
      googleMapsUri: null,
    });
  });

  it("HTTP lỗi → trả null không throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(getPlaceDetails("place-1")).resolves.toBeNull();
  });

  it("fetch throw → trả null không throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network")),
    );
    await expect(getPlaceDetails("place-1")).resolves.toBeNull();
  });

  it("thiếu API key → trả null không gọi fetch", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPlaceDetails("place-1")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cache theo placeId — chỉ gọi fetch 1 lần cho 2 lần gọi liên tiếp", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakePlaceDetailsPayload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await getPlaceDetails("place-1");
    await getPlaceDetails("place-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("buildPlacePhotoUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dựng đúng URL ảnh kèm maxWidthPx và key", () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
    expect(buildPlacePhotoUrl("places/place-1/photos/photo-1")).toBe(
      "https://places.googleapis.com/v1/places/place-1/photos/photo-1/media?maxWidthPx=640&key=test-key",
    );
    expect(buildPlacePhotoUrl("places/place-1/photos/photo-1", 320)).toBe(
      "https://places.googleapis.com/v1/places/place-1/photos/photo-1/media?maxWidthPx=320&key=test-key",
    );
  });

  it("thiếu API key → trả null", () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "");
    expect(buildPlacePhotoUrl("places/place-1/photos/photo-1")).toBeNull();
  });
});
