import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureParcelDeliveryTokenFromWindow,
  clearParcelDeliveryTokenSession,
  isParcelDeliveryToken,
  parseParcelDeliveryToken,
  parseParcelDeliveryTokenFromHash,
  PARCEL_DELIVERY_TOKEN_SESSION_KEY,
  redactParcelDeliveryToken,
  stripParcelDeliveryTokenFromUrl,
  writeParcelDeliveryTokenToSession,
} from "./deliveryToken";

const VALID_TOKEN = "6f2a1b3c-4d5e-4f60-8a91-2b3c4d5e6f70";

describe("parseParcelDeliveryToken", () => {
  it("đọc token UUID từ query string", () => {
    expect(parseParcelDeliveryToken(`?token=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
    expect(parseParcelDeliveryToken(`token=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
  });

  it("bỏ qua query thừa do mail client thêm vào", () => {
    expect(
      parseParcelDeliveryToken(`?utm_source=email&token=${VALID_TOKEN}`),
    ).toBe(VALID_TOKEN);
  });

  it("trả null khi thiếu, sai định dạng hoặc token bị lặp", () => {
    expect(parseParcelDeliveryToken("")).toBeNull();
    expect(parseParcelDeliveryToken("?foo=bar")).toBeNull();
    expect(parseParcelDeliveryToken("?token=not-a-uuid")).toBeNull();
    expect(
      parseParcelDeliveryToken(`?token=${VALID_TOKEN}&token=${VALID_TOKEN}`),
    ).toBeNull();
  });
});

describe("isParcelDeliveryToken", () => {
  it("chấp nhận UUID hoa/thường, từ chối chuỗi khác", () => {
    expect(isParcelDeliveryToken(VALID_TOKEN.toUpperCase())).toBe(true);
    expect(isParcelDeliveryToken(` ${VALID_TOKEN} `)).toBe(true);
    expect(isParcelDeliveryToken("123")).toBe(false);
  });
});

describe("parseParcelDeliveryTokenFromHash", () => {
  it("đọc #token=uuid và từ chối hash mập mờ", () => {
    expect(parseParcelDeliveryTokenFromHash(`#token=${VALID_TOKEN}`)).toBe(
      VALID_TOKEN,
    );
    expect(
      parseParcelDeliveryTokenFromHash(`#token=${VALID_TOKEN}&utm=1`),
    ).toBeNull();
    expect(parseParcelDeliveryTokenFromHash("#top")).toBeNull();
  });
});

describe("stripParcelDeliveryTokenFromUrl", () => {
  it("xoá token khỏi URL nhưng giữ path, query khác và hash thường", () => {
    const replaceState = vi.fn();
    stripParcelDeliveryTokenFromUrl(
      { replaceState },
      {
        pathname: "/parcels/delivery/confirm",
        search: `?token=${VALID_TOKEN}&lang=vi`,
        hash: "#top",
      },
    );

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/parcels/delivery/confirm?lang=vi#top",
    );
  });

  it("xoá #token khỏi hash capability", () => {
    const replaceState = vi.fn();
    stripParcelDeliveryTokenFromUrl(
      { replaceState },
      {
        pathname: "/parcels/delivery/confirm",
        search: "",
        hash: `#token=${VALID_TOKEN}`,
      },
    );

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/parcels/delivery/confirm",
    );
  });

  it("không đụng URL khi không có token", () => {
    const replaceState = vi.fn();
    stripParcelDeliveryTokenFromUrl(
      { replaceState },
      { pathname: "/parcels/delivery/confirm", search: "", hash: "" },
    );

    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("captureParcelDeliveryTokenFromWindow", () => {
  beforeEach(() => {
    clearParcelDeliveryTokenSession();
  });

  it("ưu tiên query, ghi session, rồi tẩy URL", () => {
    const replaceState = vi.fn();
    const token = captureParcelDeliveryTokenFromWindow(
      { replaceState },
      {
        pathname: "/parcels/delivery/confirm",
        search: `?token=${VALID_TOKEN}&lang=vi`,
        hash: "",
      },
    );

    expect(token).toBe(VALID_TOKEN);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/parcels/delivery/confirm?lang=vi",
    );
    expect(sessionStorage.getItem(PARCEL_DELIVERY_TOKEN_SESSION_KEY)).toBe(
      VALID_TOKEN,
    );
  });

  it("nhận #token khi không có query", () => {
    const token = captureParcelDeliveryTokenFromWindow(
      { replaceState: vi.fn() },
      {
        pathname: "/parcels/delivery/confirm",
        search: "",
        hash: `#token=${VALID_TOKEN}`,
      },
    );

    expect(token).toBe(VALID_TOKEN);
  });

  it("query token sai không fallback sang session/hash", () => {
    writeParcelDeliveryTokenToSession(VALID_TOKEN);

    expect(
      captureParcelDeliveryTokenFromWindow(
        { replaceState: vi.fn() },
        {
          pathname: "/parcels/delivery/confirm",
          search: "?token=not-a-uuid",
          hash: `#token=${VALID_TOKEN}`,
        },
      ),
    ).toBeNull();
  });

  it("tẩy query xong, mất sessionStorage vẫn giữ token trong memory", () => {
    expect(
      captureParcelDeliveryTokenFromWindow(
        { replaceState: vi.fn() },
        {
          pathname: "/parcels/delivery/confirm",
          search: `?token=${VALID_TOKEN}`,
          hash: "",
        },
      ),
    ).toBe(VALID_TOKEN);

    sessionStorage.removeItem(PARCEL_DELIVERY_TOKEN_SESSION_KEY);

    expect(
      captureParcelDeliveryTokenFromWindow(
        { replaceState: vi.fn() },
        { pathname: "/parcels/delivery/confirm", search: "", hash: "" },
      ),
    ).toBe(VALID_TOKEN);
  });

  it("F5 không còn token trên URL thì lấy lại từ session", () => {
    writeParcelDeliveryTokenToSession(VALID_TOKEN);

    const replaceState = vi.fn();
    expect(
      captureParcelDeliveryTokenFromWindow(
        { replaceState },
        { pathname: "/parcels/delivery/confirm", search: "", hash: "" },
      ),
    ).toBe(VALID_TOKEN);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("redactParcelDeliveryToken", () => {
  it("không bao giờ trả lại token gốc", () => {
    expect(redactParcelDeliveryToken(VALID_TOKEN)).toBe("[delivery-token]");
    expect(redactParcelDeliveryToken("abc")).toBe("[invalid-token]");
    expect(redactParcelDeliveryToken("")).toBe("");
  });
});
