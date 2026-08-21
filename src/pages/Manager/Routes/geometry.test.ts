// Test requestRoadGeometry: gọi computeRoutes với computeAlternativeRoutes và
// parse MẢNG phương án (tối đa 3, bỏ phần tử thiếu field, kèm description);
// travelMode theo opts, mặc định TRUCK (app nhà xe — xe lớn là chuẩn)
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dedupeRouteOptions,
  excludeMatchingRouteOptions,
  findMatchingRouteOption,
  findPathAnchorWindow,
  findRouteLabelAnchor,
  isTruckDetour,
  requestRoadGeometry,
  splicePathSegment,
  type RoadRouteOption,
} from "./geometry";
import { encodeGooglePolyline } from "./polyline";

const endpoints = [
  { latitude: 10.77, longitude: 106.69 },
  { latitude: 11.94, longitude: 108.44 },
];

function googleRoute(
  distanceMeters: number,
  durationSeconds: number,
  description?: string,
) {
  return {
    distanceMeters,
    duration: `${durationSeconds}s`,
    polyline: { encodedPolyline: encodeGooglePolyline(endpoints) },
    ...(description ? { description } : {}),
  };
}

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("requestRoadGeometry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requests alternative routes and returns every parsed option", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
    const fetchMock = stubFetch({
      routes: [
        googleRoute(308_000, 18_600, "QL20"),
        googleRoute(410_200, 22_320, "QL1A"),
      ],
    });

    const options = await requestRoadGeometry(endpoints, "failed");

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      totalDistanceKm: 308,
      estimatedDurationMinutes: 310,
      description: "QL20",
    });
    expect(options[1]).toMatchObject({
      totalDistanceKm: 410.2,
      estimatedDurationMinutes: 372,
      description: "QL1A",
    });
    expect(options[0].points).toHaveLength(endpoints.length);

    // Body bật computeAlternativeRoutes + FieldMask lấy description/routeLabels
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(requestBody.computeAlternativeRoutes).toBe(true);
    // Không truyền travelMode → mặc định TRUCK (xe khách lớn)
    expect(requestBody.travelMode).toBe("TRUCK");
    expect(
      (init.headers as Record<string, string>)["X-Goog-FieldMask"],
    ).toContain("routes.description");
    expect(
      (init.headers as Record<string, string>)["X-Goog-FieldMask"],
    ).toContain("routes.routeLabels");
  });

  it("appends via:true intermediates for reroute drag points after the stop waypoints", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
    const fetchMock = stubFetch({ routes: [googleRoute(320_500, 19_800)] });
    const stopPoint = { latitude: 11.1, longitude: 107.1 };
    const viaPoint = { latitude: 11.31, longitude: 107.61 };

    await requestRoadGeometry(
      [endpoints[0], stopPoint, endpoints[1]],
      "failed",
      { intermediates: [viaPoint] },
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body)) as {
      intermediates: Array<{
        via?: boolean;
        location: { latLng: { latitude: number; longitude: number } };
      }>;
    };
    // Điểm dừng của tuyến giữ waypoint thường, điểm nắn thêm sau cùng với via:true
    expect(requestBody.intermediates).toEqual([
      {
        location: {
          latLng: { latitude: 11.1, longitude: 107.1 },
        },
      },
      {
        via: true,
        location: {
          latLng: { latitude: 11.31, longitude: 107.61 },
        },
      },
    ]);
  });

  it.each(["DRIVE", "TRUCK"] as const)(
    "sends travelMode %s when passed through opts",
    async (travelMode) => {
      vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
      const fetchMock = stubFetch({ routes: [googleRoute(308_000, 18_600)] });

      await requestRoadGeometry(endpoints, "failed", { travelMode });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const requestBody = JSON.parse(String(init.body)) as Record<
        string,
        unknown
      >;
      expect(requestBody.travelMode).toBe(travelMode);
    },
  );

  it("caps the result at 3 options and skips malformed entries", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
    stubFetch({
      routes: [
        googleRoute(100_000, 6_000),
        { distanceMeters: "bad" },
        googleRoute(200_000, 12_000),
        googleRoute(300_000, 18_000),
        googleRoute(400_000, 24_000),
      ],
    });

    const options = await requestRoadGeometry(endpoints, "failed");

    expect(options).toHaveLength(3);
    expect(options.map((option) => option.totalDistanceKm)).toEqual([
      100, 200, 300,
    ]);
    expect(options[0].description).toBeUndefined();
  });

  it("throws the provided message when no valid route is returned", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "test-key");
    stubFetch({ routes: [{ distanceMeters: "bad" }] });

    await expect(requestRoadGeometry(endpoints, "failed")).rejects.toThrow(
      "failed",
    );
  });

  it("throws without calling fetch when the API key is missing", async () => {
    vi.stubEnv("VITE_GOOGLE_ROUTES_API_KEY", "");
    const fetchMock = stubFetch({ routes: [] });

    await expect(requestRoadGeometry(endpoints, "failed")).rejects.toThrow(
      "failed",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// So sánh TRUCK vs DRIVE để cảnh báo đường hạn chế xe lớn — dùng phương án TỐT
// NHẤT (thời lượng ngắn nhất) của mỗi mode, ngưỡng >10% km hoặc >10 phút
describe("isTruckDetour", () => {
  function option(
    totalDistanceKm: number,
    estimatedDurationMinutes: number,
  ): RoadRouteOption {
    return { points: [], totalDistanceKm, estimatedDurationMinutes };
  }

  it("flags a detour when the truck route is more than 10% longer in km", () => {
    expect(isTruckDetour([option(345, 315)], [option(308, 310)])).toBe(true);
  });

  it("flags a detour when the truck route takes more than 10 extra minutes", () => {
    expect(isTruckDetour([option(310, 325)], [option(308, 310)])).toBe(true);
  });

  it("does not flag comparable routes", () => {
    expect(isTruckDetour([option(318, 318)], [option(308, 310)])).toBe(false);
  });

  it("compares the best option of each mode, not the first one", () => {
    // Phương án đầu của TRUCK tệ nhưng phương án 2 tốt nhất tương đương DRIVE
    expect(
      isTruckDetour(
        [option(500, 500), option(310, 312)],
        [option(400, 420), option(308, 310)],
      ),
    ).toBe(false);
  });

  it("returns false when either side has no option", () => {
    expect(isTruckDetour([], [option(308, 310)])).toBe(false);
    expect(isTruckDetour([option(308, 310)], [])).toBe(false);
  });
});

// Dedupe phương án gần trùng: lệch <1% km VÀ cùng số phút → bỏ bản đứng sau
// (Google đôi khi trả 2 đường lệch không đáng kể → 2 bubble đè nhau trên map)
describe("dedupeRouteOptions", () => {
  function option(
    totalDistanceKm: number,
    estimatedDurationMinutes: number,
  ): RoadRouteOption {
    return { points: [], totalDistanceKm, estimatedDurationMinutes };
  }

  it("drops a later option within 1% km and the same minutes", () => {
    const first = option(308, 310);
    const nearDuplicate = option(309.5, 310);
    const distinct = option(410.2, 372);

    expect(dedupeRouteOptions([first, nearDuplicate, distinct])).toEqual([
      first,
      distinct,
    ]);
  });

  it("keeps options that differ in minutes even when the km are close", () => {
    const first = option(308, 310);
    const sameKmOtherDuration = option(308.5, 325);

    expect(dedupeRouteOptions([first, sameKmOtherDuration])).toHaveLength(2);
  });

  it("keeps options that differ in km beyond the threshold", () => {
    const first = option(308, 310);
    const longer = option(355.4, 310);

    expect(dedupeRouteOptions([first, longer])).toHaveLength(2);
  });
});

// Tìm phương án "trùng ~" một đường có sẵn (polyline đã lưu): tổng km lệch
// <1.5% và trung điểm 2 đường gần nhau → coi là cùng lộ trình
describe("findMatchingRouteOption", () => {
  const viaNorth = [
    { latitude: 10.77, longitude: 106.69 },
    { latitude: 11.5, longitude: 107.2 },
    { latitude: 11.94, longitude: 108.44 },
  ];
  const viaSouth = [
    { latitude: 10.77, longitude: 106.69 },
    { latitude: 10.95, longitude: 107.9 },
    { latitude: 11.94, longitude: 108.44 },
  ];
  const options: RoadRouteOption[] = [
    { points: viaNorth, totalDistanceKm: 355.4, estimatedDurationMinutes: 345 },
    { points: viaSouth, totalDistanceKm: 410.2, estimatedDurationMinutes: 372 },
  ];

  it("returns the index of the option matching the saved path", () => {
    expect(findMatchingRouteOption(options, viaSouth)).toBe(1);
    expect(findMatchingRouteOption(options, viaNorth)).toBe(0);
  });

  it("returns -1 when no option matches the path", () => {
    const other = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 12.3, longitude: 109.2 },
      { latitude: 11.94, longitude: 108.44 },
    ];

    expect(findMatchingRouteOption(options, other)).toBe(-1);
  });

  it("returns -1 for an empty or single-point path", () => {
    expect(findMatchingRouteOption(options, [])).toBe(-1);
    expect(
      findMatchingRouteOption(options, [{ latitude: 10.77, longitude: 106.69 }]),
    ).toBe(-1);
  });
});

// Lọc BỎ phương án trùng ~ một đường (polyline tuyến chính khi soạn tuyến thay
// thế) — cùng ngưỡng với findMatchingRouteOption
describe("excludeMatchingRouteOptions", () => {
  const viaNorth = [
    { latitude: 10.77, longitude: 106.69 },
    { latitude: 11.5, longitude: 107.2 },
    { latitude: 11.94, longitude: 108.44 },
  ];
  const viaSouth = [
    { latitude: 10.77, longitude: 106.69 },
    { latitude: 10.95, longitude: 107.9 },
    { latitude: 11.94, longitude: 108.44 },
  ];
  const options: RoadRouteOption[] = [
    { points: viaNorth, totalDistanceKm: 355.4, estimatedDurationMinutes: 345 },
    { points: viaSouth, totalDistanceKm: 410.2, estimatedDurationMinutes: 372 },
  ];

  it("drops options matching the excluded path and keeps the rest", () => {
    expect(excludeMatchingRouteOptions(options, viaNorth)).toEqual([options[1]]);
    expect(excludeMatchingRouteOptions(options, viaSouth)).toEqual([options[0]]);
  });

  it("keeps every option when none matches the excluded path", () => {
    const other = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 12.3, longitude: 109.2 },
      { latitude: 11.94, longitude: 108.44 },
    ];

    expect(excludeMatchingRouteOptions(options, other)).toEqual(options);
  });

  it("returns options unchanged for an empty or single-point excluded path", () => {
    expect(excludeMatchingRouteOptions(options, [])).toEqual(options);
    expect(
      excludeMatchingRouteOptions(options, [
        { latitude: 10.77, longitude: 106.69 },
      ]),
    ).toEqual(options);
  });

  it("can drop every option when all of them match the excluded path", () => {
    expect(
      excludeMatchingRouteOptions([options[0]], viaNorth),
    ).toEqual([]);
  });
});

describe("findRouteLabelAnchor", () => {
  // Tuyến chính chạy dọc kinh tuyến 106.7; phương án tách sang phía đông giữa
  // chặng rồi nhập lại — nhãn phải neo đúng chỗ tách, không phải chỗ trùng
  const mainPath = Array.from({ length: 21 }, (_unused, index) => ({
    latitude: 10 + index * 0.05,
    longitude: 106.7,
  }));
  const detourPath = mainPath.map((point, index) =>
    index >= 8 && index <= 12
      ? { latitude: point.latitude, longitude: 107.0 }
      : point,
  );

  it("anchors on the diverging part of the option", () => {
    const anchor = findRouteLabelAnchor(detourPath, mainPath);

    expect(anchor?.longitude).toBe(107.0);
  });

  it("returns null when the option overlaps the reference path", () => {
    expect(findRouteLabelAnchor(mainPath, mainPath)).toBeNull();
  });

  it("returns null without usable input", () => {
    expect(findRouteLabelAnchor([], mainPath)).toBeNull();
    expect(findRouteLabelAnchor(detourPath, [])).toBeNull();
  });

  it("avoids anchors already taken by another option", () => {
    const taken = [{ latitude: 10.5, longitude: 107.0 }];
    const wideDetour = mainPath.map((point, index) =>
      index >= 8 && index <= 12
        ? { latitude: point.latitude, longitude: 107.0 }
        : index >= 16 && index <= 18
          ? { latitude: point.latitude, longitude: 106.95 }
          : point,
    );
    const anchor = findRouteLabelAnchor(wideDetour, mainPath, taken);

    // Chỗ tách rộng nhất (107.0) nằm sát bubble đã đặt → lùi sang chỗ tách kia
    expect(anchor?.longitude).toBe(106.95);
  });
});

describe("findPathAnchorWindow + splicePathSegment", () => {
  // Đường ngang 6 đỉnh, mỗi đỉnh cách nhau 0.01 độ kinh — đủ để đọc kết quả bằng mắt
  const path = [
    { latitude: 10, longitude: 106.0 },
    { latitude: 10, longitude: 106.01 },
    { latitude: 10, longitude: 106.02 },
    { latitude: 10, longitude: 106.03 },
    { latitude: 10, longitude: 106.04 },
    { latitude: 10, longitude: 106.05 },
  ];

  it("bounds the leg by the anchors nearest the dragged point", () => {
    expect(
      findPathAnchorWindow(
        path,
        [
          { latitude: 10, longitude: 106.01 },
          { latitude: 10, longitude: 106.04 },
        ],
        { latitude: 10, longitude: 106.025 },
      ),
    ).toEqual({ previousIndex: 1, nextIndex: 4 });
  });

  it("falls back to the whole path when there is no anchor around", () => {
    expect(
      findPathAnchorWindow(path, [], { latitude: 10, longitude: 106.02 }),
    ).toEqual({ previousIndex: 0, nextIndex: 5 });
  });

  it("ignores an anchor sitting on the same vertex as the dragged point", () => {
    // Mỏ neo trùng đỉnh của điểm đang kéo mà tính vào thì cửa sổ co về rỗng
    // và không còn chặng nào để tính lại
    expect(
      findPathAnchorWindow(
        path,
        [{ latitude: 10, longitude: 106.02 }],
        { latitude: 10, longitude: 106.02 },
      ),
    ).toEqual({ previousIndex: 0, nextIndex: 5 });
  });

  it("returns null for a path too short to splice", () => {
    expect(
      findPathAnchorWindow([{ latitude: 10, longitude: 106 }], [], {
        latitude: 10,
        longitude: 106,
      }),
    ).toBeNull();
  });

  it("replaces exactly the leg and keeps the rest of the road shape", () => {
    // Google trả hình chặng path[1] → path[4] có ghé qua điểm kéo; hai đầu đã
    // trùng sẵn nên ghép xong không có mối nối gãy
    const segment = [
      { latitude: 10, longitude: 106.01 },
      { latitude: 10.5, longitude: 106.025 },
      { latitude: 10, longitude: 106.04 },
    ];

    expect(
      splicePathSegment(path, { previousIndex: 1, nextIndex: 4 }, segment),
    ).toEqual([
      { latitude: 10, longitude: 106.0 },
      { latitude: 10, longitude: 106.01 },
      { latitude: 10.5, longitude: 106.025 },
      { latitude: 10, longitude: 106.04 },
      { latitude: 10, longitude: 106.05 },
    ]);
  });

  it("leaves the path untouched when the segment is empty", () => {
    expect(
      splicePathSegment(path, { previousIndex: 1, nextIndex: 4 }, []),
    ).toEqual(path);
  });
});
