// Hàng đợi + retry 429 của tầng REST Goong.
//
// Bối cảnh: gợi ý điểm dừng dọc tuyến bắn ~50 request trong một nhịp (2 danh
// mục × 12 điểm mẫu + Place Detail cho từng gợi ý thiếu toạ độ). Goong chặn
// bằng `429 OVER_RATE_LIMIT`, mà tầng trên `.catch()` nuốt im lặng nên gợi ý
// "biến mất" không dấu vết. Đo thật trên tuyến TP.HCM - Đà Lạt: bắn thẳng ra 2
// gợi ý, qua hàng đợi ra 18.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetGoongCircuitForTest, goongPlaceDetail } from "./goongApi";

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

function rateLimitedResponse() {
  return new Response(
    JSON.stringify({
      error: { code: "OVER_RATE_LIMIT", message: "You have exceeded your rate limit." },
    }),
    { status: 429 },
  );
}

describe("fetchGoongJson — chống rate limit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_GOONG_API_KEY", "test-goong-key");
    // Trạng thái ngắt mạch nằm ở module-level — không reset thì một case dính
    // 429 sẽ mở mạch và làm mọi case sau đó hỏng vì không request nữa.
    __resetGoongCircuitForTest();
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
