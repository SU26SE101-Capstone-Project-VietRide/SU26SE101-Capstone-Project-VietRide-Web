import { describe, expect, it, vi } from "vitest";

import {
  isParcelDeliveryToken,
  parseParcelDeliveryToken,
  redactParcelDeliveryToken,
  stripParcelDeliveryTokenFromUrl,
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

describe("stripParcelDeliveryTokenFromUrl", () => {
  it("xoá token khỏi URL nhưng giữ path, query khác và hash", () => {
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

  it("không đụng URL khi không có token", () => {
    const replaceState = vi.fn();
    stripParcelDeliveryTokenFromUrl(
      { replaceState },
      { pathname: "/parcels/delivery/confirm", search: "", hash: "" },
    );

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
