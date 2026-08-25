// Gợi ý địa điểm dọc tuyến chạy trên Place API của Goong: không có nearby lẫn
// text search nên dựng bằng Place AutoComplete (có location + radius) lấy mẫu
// điểm dọc polyline, rồi gọi Place Detail cho gợi ý nào thiếu toạ độ.
import { encodeGooglePolyline } from "../pages/Manager/Routes/polyline";
import {
  buildPlacePhotoUrl,
  getPlaceDetails,
  searchPlacesAlongRoute,
  stopPlaceCategories,
  __clearPlaceDetailsCacheForTest,
} from "./googlePlacesSearch";

const [busStationCategory, restStopCategory] = stopPlaceCategories;

// Polyline 2 điểm → hàm lấy mẫu giữ nguyên cả hai, tức đúng 2 lần AutoComplete
const routeStart = { latitude: 10.77, longitude: 106.69 };
const routeEnd = { latitude: 11.94, longitude: 108.44 };
const encodedRoute = encodeGooglePolyline([routeStart, routeEnd]);

function prediction(placeId: string, description = "Bến xe Miền Đông, HCM") {
  return {
    description,
    place_id: placeId,
    structured_formatting: {
      main_text: description.split(",")[0],
      secondary_text: description,
    },
  };
}

function detailResult(lat: number, lng: number, name = "Bến xe Miền Đông") {
  return {
    result: {
      formatted_address: "QL20, Đạ Huoai, Lâm Đồng",
      geometry: { location: { lat, lng } },
      name,
      types: ["bus_station"],
    },
  };
}

// Trả body theo path của URL để không phụ thuộc thứ tự request song song
function stubFetchByPath(responder: (url: URL) => unknown) {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => responder(new URL(String(url))),
  }));
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubFetchByPath>, path: string) {
  return fetchMock.mock.calls.filter((call) =>
    new URL(String(call[0])).pathname.endsWith(path),
  );
}

describe("searchPlacesAlongRoute", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hỏi AutoComplete quanh từng điểm mẫu rồi lấy toạ độ qua Place Detail", async () => {
    const fetchMock = stubFetchByPath((url) =>
      url.pathname.endsWith("/Place/Detail")
        ? detailResult(10.771, 106.691)
        : { predictions: [prediction("place-1")], status: "OK" },
    );

    const places = await searchPlacesAlongRoute(encodedRoute, restStopCategory);

    // 2 điểm mẫu → 2 AutoComplete; trùng place_id nên chỉ 1 Place Detail
    expect(callsTo(fetchMock, "/Place/AutoComplete")).toHaveLength(2);
    expect(callsTo(fetchMock, "/Place/Detail")).toHaveLength(1);

    const autocompleteUrl = new URL(
      String(callsTo(fetchMock, "/Place/AutoComplete")[0][0]),
    );
    expect(autocompleteUrl.origin + autocompleteUrl.pathname).toBe(
      "https://rsapi.goong.io/Place/AutoComplete",
    );
    expect(autocompleteUrl.searchParams.get("input")).toBe("trạm dừng chân");
    expect(autocompleteUrl.searchParams.get("location")).toBe("10.77,106.69");
    // `radius` của Goong tính bằng KM
    expect(autocompleteUrl.searchParams.get("radius")).toBe("8");
    expect(autocompleteUrl.searchParams.get("api_key")).toBe("test-key");

    expect(places).toEqual([
      {
        placeId: "place-1",
        name: "Bến xe Miền Đông",
        address: "QL20, Đạ Huoai, Lâm Đồng",
        latitude: 10.771,
        longitude: 106.691,
        types: ["bus_station"],
      },
    ]);
  });

  it("dùng thẳng toạ độ khi AutoComplete có kèm, không gọi Place Detail", async () => {
    const fetchMock = stubFetchByPath(() => ({
      predictions: [
        {
          ...prediction("place-2"),
          geometry: { location: { lat: 10.772, lng: 106.692 } },
        },
      ],
      status: "OK",
    }));

    const places = await searchPlacesAlongRoute(
      encodedRoute,
      busStationCategory,
    );

    expect(callsTo(fetchMock, "/Place/Detail")).toHaveLength(0);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      placeId: "place-2",
      latitude: 10.772,
      longitude: 106.692,
    });
  });

  it("loại gợi ý xa điểm mẫu một cách vô lý (tỉnh khác hẳn)", async () => {
    // Chỉ là chặn vệ sinh 50km. KHÔNG siết về đúng `radius` đã xin: bộ lọc địa
    // lý thật là "cách tuyến <= 1km" ở useRouteStopSuggestions — siết theo
    // khoảng cách tới ĐIỂM MẪU sẽ cắt nhầm chỗ nằm giữa hai điểm mẫu.
    stubFetchByPath((url) =>
      url.pathname.endsWith("/Place/Detail")
        ? detailResult(21.02, 105.83)
        : { predictions: [prediction("far-away")], status: "OK" },
    );

    await expect(
      searchPlacesAlongRoute(encodedRoute, busStationCategory),
    ).resolves.toEqual([]);
  });

  it("HTTP lỗi → trả [] không throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    await expect(
      searchPlacesAlongRoute(encodedRoute, busStationCategory),
    ).resolves.toEqual([]);
  });

  it("thiếu API key → trả [] không gọi fetch", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "");
    const fetchMock = stubFetchByPath(() => ({ predictions: [] }));

    await expect(
      searchPlacesAlongRoute(encodedRoute, busStationCategory),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polyline rỗng → trả [] không gọi fetch", async () => {
    const fetchMock = stubFetchByPath(() => ({ predictions: [] }));

    await expect(
      searchPlacesAlongRoute("", busStationCategory),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getPlaceDetails", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    __clearPlaceDetailsCacheForTest();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("gọi Place Detail và map đủ field", async () => {
    const fetchMock = stubFetchByPath(() => ({
      result: {
        formatted_address: "QL20, Đạ Huoai, Lâm Đồng",
        geometry: { location: { lat: 11.36, lng: 107.51 } },
        name: "Trạm dừng chân Madagui",
        place_id: "place-1",
      },
      status: "OK",
    }));

    const details = await getPlaceDetails("place-1");

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      "https://rsapi.goong.io/Place/Detail",
    );
    expect(url.searchParams.get("place_id")).toBe("place-1");

    // Goong thiên về địa chỉ: rating/ảnh/giờ mở cửa/SĐT luôn null, card tự ẩn
    expect(details).toEqual({
      placeId: "place-1",
      name: "Trạm dừng chân Madagui",
      address: "QL20, Đạ Huoai, Lâm Đồng",
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

  it("giữ nguyên placeId truyền vào khi Place Detail không lặp lại field đó", async () => {
    stubFetchByPath(() => detailResult(11.36, 107.51, "Trạm dừng chân"));

    await expect(getPlaceDetails("place-2")).resolves.toMatchObject({
      placeId: "place-2",
      name: "Trạm dừng chân",
    });
  });

  it("HTTP lỗi → trả null không throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    await expect(getPlaceDetails("place-3")).resolves.toBeNull();
  });

  it("thiếu API key → trả null không gọi fetch", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "");
    const fetchMock = stubFetchByPath(() => ({}));

    await expect(getPlaceDetails("place-4")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cache theo placeId — chỉ gọi fetch 1 lần cho 2 lần gọi liên tiếp", async () => {
    const fetchMock = stubFetchByPath(() => detailResult(11.36, 107.51));

    await getPlaceDetails("place-5");
    await getPlaceDetails("place-5");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("buildPlacePhotoUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dùng thẳng URL tuyệt đối nếu có", () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");

    expect(buildPlacePhotoUrl("https://cdn.goong.io/p/1.jpg")).toBe(
      "https://cdn.goong.io/p/1.jpg",
    );
  });

  it("Goong không có Place Photo API → mã tham chiếu trả null để ẩn khung ảnh", () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");

    expect(buildPlacePhotoUrl("photo-ref-1")).toBeNull();
  });

  it("thiếu API key → trả null", () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "");
    expect(buildPlacePhotoUrl("https://cdn.goong.io/p/1.jpg")).toBeNull();
  });
});
