// Test requestRoadGeometry: gọi Direction của Goong và parse MẢNG phương án
// (tối đa 3, bỏ phần tử thiếu field, kèm summary). `alternatives` chỉ bật khi
// caller cần dãy bubble chọn đường; vehicle mặc định truck (app nhà xe — xe lớn
// là chuẩn). Điểm dừng trung gian đi CHUNG tham số `destination`, ngăn bằng `;`.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advisoryRouteWaypointDistanceKm,
  dedupeRouteOptions,
  excludeMatchingRouteOptions,
  findMatchingRouteOption,
  findPathAnchorWindow,
  findRouteGeometryWaypointMismatches,
  findRouteLabelAnchor,
  isTruckDetour,
  longestRetracedSpanKm,
  requestRoadGeometry,
  splicePathSegment,
  type RoadRouteOption,
} from "./geometry";
import { encodeGooglePolyline } from "./polyline";

const endpoints = [
  { latitude: 10.77, longitude: 106.69 },
  { latitude: 11.94, longitude: 108.44 },
];

// Một phần tử routes[] theo format Google mà Goong Direction trả về
function directionsRoute(
  distanceMeters: number,
  durationSeconds: number,
  summary?: string,
) {
  return {
    legs: [
      {
        distance: { value: distanceMeters },
        duration: { value: durationSeconds },
      },
    ],
    overview_polyline: { points: encodeGooglePolyline(endpoints) },
    ...(summary ? { summary } : {}),
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

// URL của lần gọi fetch thứ `index` — đã parse để đọc query param
function requestedUrl(fetchMock: ReturnType<typeof stubFetch>, index = 0) {
  return new URL(String(fetchMock.mock.calls[index][0]));
}

describe("requestRoadGeometry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls the Goong Direction endpoint and parses every option", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({
      routes: [
        directionsRoute(308_000, 18_600, "QL20"),
        directionsRoute(410_200, 22_320, "QL1A"),
      ],
    });

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

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

    const url = requestedUrl(fetchMock);
    expect(url.origin + url.pathname).toBe("https://rsapi.goong.io/Direction");
    expect(url.searchParams.get("alternatives")).toBe("true");
    // Không truyền travelMode → mặc định truck (xe khách lớn)
    expect(url.searchParams.get("vehicle")).toBe("truck");
    expect(url.searchParams.get("origin")).toBe("10.77,106.69");
    expect(url.searchParams.get("destination")).toBe("11.94,108.44");
    expect(url.searchParams.get("api_key")).toBe("test-key");
  });

  // Goong luôn chỉ trả 1 đường (đã probe thật) nên dãy bubble chọn đường được
  // dựng lại bằng cách ép đường vòng qua điểm lệch hai bên tuyến chính.
  it("synthesises alternatives by re-routing through off-corridor probes", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    // Chặng lệch trả về một đường KHÁC hẳn để không bị lọc trùng tuyến chính
    const detourPath = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 11.5, longitude: 108.2 },
      { latitude: 11.94, longitude: 108.44 },
    ];
    const fetchMock = vi.fn(async (url: string) => {
      const hasProbe = new URL(String(url)).searchParams
        .get("destination")!
        .includes(";");
      return {
        ok: true,
        json: async () =>
          hasProbe
            ? {
                routes: [
                  {
                    legs: [
                      {
                        distance: { value: 352_000 },
                        duration: { value: 22_800 },
                      },
                    ],
                    overview_polyline: {
                      points: encodeGooglePolyline(detourPath),
                    },
                  },
                ],
              }
            : { routes: [directionsRoute(308_000, 18_600)] },
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

    // 1 request tuyến chính + 4 điểm thử lệch (2 vị trí × 2 bên)
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const probeCalls = fetchMock.mock.calls.filter((call) =>
      new URL(String(call[0])).searchParams.get("destination")!.includes(";"),
    );
    expect(probeCalls).toHaveLength(4);

    // Tuyến chính đứng đầu, phương án lệch nối sau và đã dedupe
    expect(options[0].totalDistanceKm).toBe(308);
    expect(options.length).toBeGreaterThan(1);
    expect(options[1].totalDistanceKm).toBe(352);
  });

  it("drops synthesised detours that are absurdly worse than the main route", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const farPath = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 13.5, longitude: 109.2 },
      { latitude: 11.94, longitude: 108.44 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const hasProbe = new URL(String(url)).searchParams
          .get("destination")!
          .includes(";");
        return {
          ok: true,
          json: async () =>
            hasProbe
              ? {
                  routes: [
                    {
                      // > 1.5 lần cả km lẫn phút so với tuyến chính
                      legs: [
                        {
                          distance: { value: 900_000 },
                          duration: { value: 60_000 },
                        },
                      ],
                      overview_polyline: {
                        points: encodeGooglePolyline(farPath),
                      },
                    },
                  ],
                }
              : { routes: [directionsRoute(308_000, 18_600)] },
        };
      }),
    );

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

    expect(options).toHaveLength(1);
    expect(options[0].totalDistanceKm).toBe(308);
  });

  // Điểm thử lệch được gửi như ĐIỂM ĐẾN trung gian, nên rơi trúng hẻm cụt là xe
  // phải chui vào rồi quay đầu ra. Ngưỡng tỉ lệ không bắt được: khúc quay đầu
  // chỉ vài km trên tuyến 300km, tổng số km gần như không đổi.
  it("drops synthesised detours that dive into a dead end and turn back", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    // Chạy dọc tuyến rồi rẽ vào một nhánh cụt ~1.5km và quay ra đúng lối cũ
    const spur = Array.from({ length: 16 }, (_unused, step) => ({
      latitude: 11.35 + step * 0.001,
      longitude: 107.55 + step * 0.0009,
    }));
    const deadEndPath = [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 11.35, longitude: 107.55 },
      ...spur,
      ...[...spur].reverse(),
      { latitude: 11.94, longitude: 108.44 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const hasProbe = new URL(String(url)).searchParams
          .get("destination")!
          .includes(";");
        return {
          ok: true,
          json: async () => ({
            routes: [
              hasProbe
                ? {
                    // Chỉ dài hơn tuyến chính 4km — lọt mọi ngưỡng tỉ lệ
                    legs: [
                      {
                        distance: { value: 312_000 },
                        duration: { value: 19_000 },
                      },
                    ],
                    overview_polyline: {
                      points: encodeGooglePolyline(deadEndPath),
                    },
                  }
                : directionsRoute(308_000, 18_600),
            ],
          }),
        };
      }),
    );

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

    expect(options).toHaveLength(1);
    expect(options[0].totalDistanceKm).toBe(308);
  });

  // Goong tự khai báo `maneuver: "uturn"` cho bước "Quay đầu để vào X". Đo thật
  // trên HCM–Đà Lạt: tuyến chính 0 cú, còn 3/4 bản tự chế bằng điểm thử lệch có
  // đúng 1 — xe khách 45 chỗ không quay đầu giữa quốc lộ được.
  it("drops synthesised detours that Goong marks with a u-turn", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    // Hành lang khác hẳn, dài hơn vừa phải — lọt mọi ngưỡng km/phút, chỉ hỏng
    // vì cú quay đầu
    const detourPath = [
      endpoints[0],
      { latitude: 11.4, longitude: 108.9 },
      endpoints[1],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const hasProbe = new URL(String(url)).searchParams
          .get("destination")!
          .includes(";");
        return {
          ok: true,
          json: async () => ({
            routes: [
              hasProbe
                ? {
                    legs: [
                      {
                        distance: { value: 330_000 },
                        duration: { value: 20_000 },
                        steps: [
                          { maneuver: "right" },
                          { maneuver: "uturn" },
                        ],
                      },
                    ],
                    overview_polyline: {
                      points: encodeGooglePolyline(detourPath),
                    },
                  }
                : directionsRoute(308_000, 18_600),
            ],
          }),
        };
      }),
    );

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

    expect(options).toHaveLength(1);
    expect(options[0].totalDistanceKm).toBe(308);
  });

  // Chữa thay vì vứt: điểm neo lấy từ chính polyline vừa trả về nên chắc chắn
  // nằm trên đường xe chạy được, khác hẳn điểm thử lệch đặt mù theo hình học.
  it("repairs a u-turn candidate by re-routing through its divergence anchor", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const detourPath = [
      endpoints[0],
      { latitude: 11.4, longitude: 108.9 },
      endpoints[1],
    ];
    let probeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const hasProbe = new URL(String(url)).searchParams
          .get("destination")!
          .includes(";");
        if (!hasProbe) {
          return {
            ok: true,
            json: async () => ({ routes: [directionsRoute(308_000, 18_600)] }),
          };
        }

        probeCalls += 1;
        // 4 lần đầu là điểm thử lệch (tầng 1) → bản dính quay đầu; từ lần thứ 5
        // là tầng chữa qua điểm neo → bản sạch
        const dirty = probeCalls <= 4;
        return {
          ok: true,
          json: async () => ({
            routes: [
              {
                legs: [
                  {
                    distance: { value: dirty ? 355_000 : 330_000 },
                    duration: { value: dirty ? 22_000 : 20_000 },
                    steps: dirty ? [{ maneuver: "uturn" }] : [{ maneuver: "right" }],
                  },
                ],
                overview_polyline: {
                  points: encodeGooglePolyline(detourPath),
                },
              },
            ],
          }),
        };
      }),
    );

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

    expect(probeCalls).toBeGreaterThan(4);
    expect(options).toHaveLength(2);
    expect(options[1].totalDistanceKm).toBe(330);
    expect(options[1].uTurnCount).toBe(0);
  });

  // "Phải đến được điểm cuối" — so với ĐIỂM CUỐI CỦA TUYẾN CHÍNH, không phải
  // toạ độ bến do user nhập: Directions snap cả hai đầu, nên bến lệch trục 600m
  // thì so với toạ độ gốc sẽ loại sạch cả phương án tốt.
  it("drops a synthesised detour that stops short of the destination", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const shortPath = [
      endpoints[0],
      { latitude: 11.4, longitude: 108.9 },
      { latitude: 11.6, longitude: 108.1 },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const hasProbe = new URL(String(url)).searchParams
          .get("destination")!
          .includes(";");
        return {
          ok: true,
          json: async () => ({
            routes: [
              hasProbe
                ? {
                    legs: [
                      {
                        distance: { value: 330_000 },
                        duration: { value: 20_000 },
                        steps: [{ maneuver: "right" }],
                      },
                    ],
                    overview_polyline: {
                      points: encodeGooglePolyline(shortPath),
                    },
                  }
                : directionsRoute(308_000, 18_600),
            ],
          }),
        };
      }),
    );

    const options = await requestRoadGeometry(endpoints, "failed", {
      alternatives: true,
    });

    expect(options).toHaveLength(1);
  });

  it("skips the synthesis when the route already has stops", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({ routes: [directionsRoute(320_500, 19_800)] });

    const options = await requestRoadGeometry(
      [endpoints[0], { latitude: 11.1, longitude: 107.1 }, endpoints[1]],
      "failed",
      { alternatives: true },
    );

    // Đường đã bị ghim bởi điểm dừng → ép vòng thêm chỉ ra lộ trình vô nghĩa
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(options).toHaveLength(1);
  });

  it("does not ask for alternatives unless the caller wants them", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({ routes: [directionsRoute(308_000, 18_600)] });

    await requestRoadGeometry(endpoints, "failed");

    // Preview lúc kéo nắn + auto-fill chỉ cần đường tốt nhất
    expect(requestedUrl(fetchMock).searchParams.get("alternatives")).toBe(
      "false",
    );
  });

  it("sends stops and reroute drag points inside destination, separated by ;", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({ routes: [directionsRoute(320_500, 19_800)] });
    const stopPoint = { latitude: 11.1, longitude: 107.1 };
    const viaPoint = { latitude: 11.31, longitude: 107.61 };

    await requestRoadGeometry(
      [endpoints[0], stopPoint, endpoints[1]],
      "failed",
      { intermediates: [viaPoint] },
    );

    const url = requestedUrl(fetchMock);
    expect(url.searchParams.get("origin")).toBe("10.77,106.69");
    // Điểm dừng của tuyến đứng trước, điểm nắn lộ trình nối sau, bến đến cuối cùng
    expect(url.searchParams.get("destination")).toBe(
      "11.1,107.1;11.31,107.61;11.94,108.44",
    );
  });

  it.each([
    ["DRIVE", "car"],
    ["TRUCK", "truck"],
  ] as const)("maps travelMode %s to vehicle %s", async (travelMode, vehicle) => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    const fetchMock = stubFetch({ routes: [directionsRoute(308_000, 18_600)] });

    await requestRoadGeometry(endpoints, "failed", { travelMode });

    expect(requestedUrl(fetchMock).searchParams.get("vehicle")).toBe(vehicle);
  });

  it("caps the result at 3 options and skips malformed entries", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    stubFetch({
      routes: [
        directionsRoute(100_000, 6_000),
        { legs: [{ distance: { value: "bad" } }] },
        directionsRoute(200_000, 12_000),
        directionsRoute(300_000, 18_000),
        directionsRoute(400_000, 24_000),
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
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    stubFetch({ routes: [{ legs: [] }] });

    await expect(requestRoadGeometry(endpoints, "failed")).rejects.toThrow(
      "failed",
    );
  });

  it("throws the provided message when the API answers with an HTTP error", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "test-key");
    stubFetch({ error: { code: "API_KEY_INVALID" } }, false);

    await expect(requestRoadGeometry(endpoints, "failed")).rejects.toThrow(
      "failed",
    );
  });

  it("throws without calling fetch when the API key is missing", async () => {
    vi.stubEnv("VITE_GOONG_API_KEY", "");
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

describe("longestRetracedSpanKm", () => {
  // ~1.1km mỗi bước dọc kinh tuyến
  const straight = Array.from({ length: 40 }, (_unused, step) => ({
    latitude: 10.77 + step * 0.01,
    longitude: 106.69,
  }));

  it("reports no retracing for a route that never doubles back", () => {
    expect(longestRetracedSpanKm(straight)).toBe(0);
  });

  it("measures the in-and-out length of a dead-end spur", () => {
    const spur = Array.from({ length: 12 }, (_unused, step) => ({
      latitude: 10.9,
      longitude: 106.69 + step * 0.001,
    }));
    const withSpur = [
      ...straight.slice(0, 14),
      ...spur,
      ...[...spur].reverse(),
      ...straight.slice(14),
    ];

    // Nhánh cụt ~1.3km → vào và ra là ~2.6km đi lặp
    expect(longestRetracedSpanKm(withSpur)).toBeGreaterThan(2);
  });

  it("ignores a hairpin too short to be a turnaround", () => {
    const hairpin = Array.from({ length: 4 }, (_unused, step) => ({
      latitude: 10.9,
      longitude: 106.69 + step * 0.0005,
    }));

    expect(
      longestRetracedSpanKm([
        ...straight.slice(0, 14),
        ...hairpin,
        ...[...hairpin].reverse(),
        ...straight.slice(14),
      ]),
    ).toBe(0);
  });

  it("handles paths too short to analyse", () => {
    expect(longestRetracedSpanKm([])).toBe(0);
    expect(longestRetracedSpanKm(straight.slice(0, 2))).toBe(0);
  });
});

// Điểm lệch trục chính là thứ ép Directions bám một con đường khác để chạm tới
// nơi — đo thật trên Phú Nhuận: gửi đi một toạ độ, bị snap sang trục khác cách
// 660m, và đường trả về luồn qua ba con phố nhỏ kèm một cú quay đầu.
describe("findRouteGeometryWaypointMismatches", () => {
  // Đoạn thẳng dọc kinh tuyến, ~1.1km mỗi bước
  const path = Array.from({ length: 10 }, (_unused, step) => ({
    latitude: 10.77 + step * 0.01,
    longitude: 106.69,
  }));

  // ~330m về phía đông của đường
  const offCorridor = {
    id: "stop-1",
    name: "Bến A",
    latitude: 10.8,
    longitude: 106.693,
  };
  // ~55m — chỉ là bề ngang lòng đường
  const onCorridor = {
    id: "stop-2",
    name: "Bến B",
    latitude: 10.8,
    longitude: 106.6905,
  };

  it("lets a point that is merely road-width off through the hard limit", () => {
    expect(findRouteGeometryWaypointMismatches(path, [offCorridor])).toEqual([]);
  });

  it("flags the same point once the advisory threshold is used", () => {
    const flagged = findRouteGeometryWaypointMismatches(
      path,
      [offCorridor, onCorridor],
      advisoryRouteWaypointDistanceKm,
    );

    expect(flagged).toHaveLength(1);
    expect(flagged[0].waypoint.name).toBe("Bến A");
    expect(flagged[0].distanceToPathKm).toBeGreaterThan(
      advisoryRouteWaypointDistanceKm,
    );
  });

  it("keeps the hard limit as the default so saving is not newly blocked", () => {
    expect(advisoryRouteWaypointDistanceKm).toBeLessThan(0.5);
    // Không truyền ngưỡng → vẫn là 500m như BE, điểm lệch 330m không chặn lưu
    expect(findRouteGeometryWaypointMismatches(path, [offCorridor])).toEqual([]);
  });
});
