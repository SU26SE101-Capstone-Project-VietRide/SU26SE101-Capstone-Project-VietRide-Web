// Hàng đợi + retry 429 của tầng REST Goong.
//
// Bối cảnh: gợi ý điểm dừng dọc tuyến bắn ~50 request trong một nhịp (2 danh
// mục × 12 điểm mẫu + Place Detail cho từng gợi ý thiếu toạ độ). Goong chặn
// bằng `429 OVER_RATE_LIMIT`, mà tầng trên `.catch()` nuốt im lặng nên gợi ý
// "biến mất" không dấu vết. Đo thật trên tuyến TP.HCM - Đà Lạt: bắn thẳng ra 2
// gợi ý, qua hàng đợi ra 18.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetGoongCircuitForTest,
  __setGoongRequestStartIntervalForTest,
  goongDirections,
  goongPlaceDetail,
} from "./goongApi";

const detailPayload = {
  result: {
    place_id: "place-1",
    name: "Bến xe Miền Đông",
    formatted_address: "292 Đinh Bộ Lĩnh, Bình Thạnh",
    geometry: { location: { lat: 10.8155, lng: 106.7115 } },
    types: ["bus_station"],
  },
};

function okResponse() {
  return new Response(JSON.stringify(detailPayload), { status: 200 });
}

function rateLimitedResponse(headers?: HeadersInit) {
  return new Response(
    JSON.stringify({
      error: { code: "OVER_RATE_LIMIT", message: "You have exceeded your rate limit." },
    }),
    { headers, status: 429 },
  );
}

function directionResponse() {
  return new Response(
    JSON.stringify({
      routes: [
        {
          legs: [
            {
              distance: { value: 95_700 },
              duration: { value: 7_200 },
            },
          ],
          overview_polyline: { points: "_p~iF~ps|U_ulLnnqC" },
          summary: "QL51",
        },
      ],
    }),
    { status: 200 },
  );
}

describe("fetchGoongJson — chống rate limit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_GOONG_API_KEY", "test-goong-key");
    // Trạng thái ngắt mạch nằm ở module-level — không reset thì một case dính
    // 429 sẽ mở mạch và làm mọi case sau đó hỏng vì không request nữa.
    __resetGoongCircuitForTest();
    __setGoongRequestStartIntervalForTest(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rải thời điểm bắt đầu request thay vì bắn dồn", async () => {
    vi.useFakeTimers();
    __setGoongRequestStartIntervalForTest(350);
    const fetchMock = vi.fn<typeof fetch>(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const requests = [
      goongPlaceDetail("place-1"),
      goongPlaceDetail("place-2"),
      goongPlaceDetail("place-3"),
    ];

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(349);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(350);
    await Promise.all(requests);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("thử lại một lần khi Goong trả 429 thay vì bỏ luôn kết quả", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rateLimitedResponse())
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const detail = await goongPlaceDetail("place-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(detail?.name).toBe("Bến xe Miền Đông");
  });

  it("tôn trọng Retry-After trước khi thử lại 429", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rateLimitedResponse({ "Retry-After": "2" }))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const detailPromise = goongPlaceDetail("place-1");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const detail = await detailPromise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(detail?.name).toBe("Bến xe Miền Đông");
  });

  // Sai key / place_id không tồn tại thì thử lại chỉ tốn quota mà kết quả vẫn
  // thế — chỉ 429 mới đáng thử lại.
  it("không thử lại với lỗi không phải 429", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response("{}", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(goongPlaceDetail("place-1")).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bỏ cuộc sau khi hết số lần thử lại, không lặp vô hạn", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => rateLimitedResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(goongPlaceDetail("place-1")).rejects.toThrow(/429/);
    // 1 lần đầu + 1 lần thử lại. Trước đây là 3 lần thử lại, tức mỗi lời gọi
    // thành 4 request — một loạt quét 84 lời gọi khi đã cạn quota biến thành
    // 336 request, càng 429 càng đốt thêm.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Quota đã cạn thì mọi request sau đó gần như chắc chắn cũng 429, mà request
  // bị 429 VẪN bị tính vào quota ngày. Dừng hẳn một nhịp rẻ hơn nhiều so với
  // để từng lời gọi trong loạt tự thử lại.
  it("ngắt mạch sau nhiều 429 liên tiếp thay vì bắn tiếp", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => rateLimitedResponse());
    vi.stubGlobal("fetch", fetchMock);

    // Lời gọi đầu: 1 request + 1 lần thử lại → 2 lần 429 liên tiếp
    await expect(goongPlaceDetail("place-1")).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Request kế tiếp là lần 429 thứ 3 → mở mạch ngay tại chỗ
    await expect(goongPlaceDetail("place-2")).rejects.toThrow(/tạm ngừng/);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Mạch đang mở: hỏng ngay, không còn request nào chạm mạng
    await expect(goongPlaceDetail("place-3")).rejects.toThrow(/tạm ngừng/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // Regression thực tế: tab Điểm dừng quét Place Detail dính 429 và mở circuit
  // chung, sau đó Directions bị từ chối ngay trước khi chạm mạng. Map mất
  // polyline và chỉ hết sau F5 vì refresh reset state module.
  it("Places mở circuit không được khóa nhầm Directions", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("/v2/direction")
        ? directionResponse()
        : rateLimitedResponse(),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Hai lượt này tạo đủ 3 phản hồi 429 để circuit standard mở.
    await expect(goongPlaceDetail("place-1")).rejects.toThrow(/429/);
    await expect(goongPlaceDetail("place-2")).rejects.toThrow(/tạm ngừng/);

    const routes = await goongDirections({
      origin: { lat: 10.7769, lng: 106.7009 },
      destination: { lat: 10.346, lng: 107.0843 },
      vehicle: "truck",
      waypoints: [{ lat: 10.58, lng: 107.02 }],
    });

    expect(routes).toHaveLength(1);
    expect(routes[0].summary).toBe("QL51");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/v2/direction");
  });

  // Đây là phần thực sự cứu được gợi ý: bắn 12 lời gọi cùng lúc mà không bao
  // giờ có quá 4 request đang bay.
  it("giới hạn 4 request chạy song song", async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return okResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all(
      Array.from({ length: 12 }, (_unused, index) =>
        goongPlaceDetail(`place-${index}`),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(peakInFlight).toBeLessThanOrEqual(4);
  });

  it("cho Directions lấy slot trước các Place Detail đang chờ", async () => {
    const blockers = Array.from({ length: 4 }, () => {
      let resolve: (response: Response) => void = () => {};
      const promise = new Promise<Response>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    });
    const callOrder: string[] = [];
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      callOrder.push(new URL(url).pathname);
      const callIndex = callOrder.length - 1;

      if (callIndex < blockers.length) {
        return blockers[callIndex].promise;
      }

      return Promise.resolve(
        url.includes("/v2/direction") ? directionResponse() : okResponse(),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    // 4 request chiếm hết slot; 2 Place Detail tiếp theo nằm ở hàng đợi thường.
    const placePromises = Array.from({ length: 6 }, (_unused, index) =>
      goongPlaceDetail(`place-${index}`),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    // Directions vào sau nhưng phải đứng đầu hàng đợi ưu tiên.
    const directionsPromise = goongDirections({
      origin: { lat: 10.7769, lng: 106.7009 },
      destination: { lat: 10.346, lng: 107.0843 },
      vehicle: "truck",
    });
    blockers[0].resolve(okResponse());

    const routes = await directionsPromise;
    expect(routes).toHaveLength(1);
    expect(callOrder[4]).toBe("/v2/direction");

    blockers.slice(1).forEach(({ resolve }) => resolve(okResponse()));
    await Promise.all(placePromises);
  });

  // Hàng đợi phải nhả slot cả khi request hỏng — nếu không, vài lỗi đầu tiên là
  // treo cứng mọi lời gọi Goong sau đó trong cả phiên.
  it("nhả slot khi request hỏng để không kẹt hàng đợi", async () => {
    // `Response` chỉ đọc body được MỘT lần, nên mock phải sinh instance mới cho
    // từng lời gọi — tái dùng một object là lời gọi thứ hai ném "body already read"
    // và test đổ lỗi nhầm cho hàng đợi.
    let call = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      call += 1;
      return call <= 4 ? new Response("{}", { status: 500 }) : okResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_unused, index) =>
        goongPlaceDetail(`place-${index}`),
      ),
    );

    expect(results.filter((r) => r.status === "rejected")).toHaveLength(4);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  });
});
