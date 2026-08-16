import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureTripShareTokenFromWindow,
  clearTripShareTokenSession,
  isTripShareToken,
  parseTripShareTokenFromHash,
  readTripShareTokenFromSession,
  redactTripShareToken,
  stripTripShareTokenFromUrl,
  TRIP_SHARE_TOKEN_SESSION_KEY,
  writeTripShareTokenToSession,
} from "./tripShareToken";

const VALID_TOKEN =
  "v1.11111111-1111-4111-a111-111111111111.abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

describe("parseTripShareTokenFromHash", () => {
  it("đọc đúng #token=v1.grant.sig", () => {
    expect(parseTripShareTokenFromHash(`#token=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
    expect(parseTripShareTokenFromHash(`token=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
  });

  it("từ chối query, field thừa, hoặc token sai dạng", () => {
    expect(parseTripShareTokenFromHash("")).toBeNull();
    expect(parseTripShareTokenFromHash(`?token=${VALID_TOKEN}`)).toBeNull();
    expect(parseTripShareTokenFromHash(`#token=${VALID_TOKEN}&lang=vi`)).toBeNull();
    expect(parseTripShareTokenFromHash("#token=not-a-share-token")).toBeNull();
  });
});

describe("isTripShareToken", () => {
  it("chấp nhận token v1 hợp lệ, từ chối chuỗi khác", () => {
    expect(isTripShareToken(VALID_TOKEN)).toBe(true);
    expect(isTripShareToken(` ${VALID_TOKEN} `)).toBe(true);
    expect(isTripShareToken("v1.not-a-uuid.signature")).toBe(false);
  });
});

describe("stripTripShareTokenFromUrl", () => {
  it("xoá hash token, giữ path và query", () => {
    const replaceState = vi.fn();
    stripTripShareTokenFromUrl(
      { replaceState },
      {
        pathname: "/trip-sharing",
        search: "?lang=vi",
        hash: `#token=${VALID_TOKEN}`,
      },
    );

    expect(replaceState).toHaveBeenCalledWith(null, "", "/trip-sharing?lang=vi");
  });

  it("không đụng URL khi hash không phải capability token", () => {
    const replaceState = vi.fn();
    stripTripShareTokenFromUrl(
      { replaceState },
      { pathname: "/trip-sharing", search: "", hash: "#map" },
    );

    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("captureTripShareTokenFromWindow", () => {
  beforeEach(() => {
    clearTripShareTokenSession();
  });

  it("đọc hash, ghi session, rồi tẩy URL", () => {
    const replaceState = vi.fn();
    const token = captureTripShareTokenFromWindow(
      { replaceState },
      {
        pathname: "/trip-sharing",
        search: "",
        hash: `#token=${VALID_TOKEN}`,
      },
    );

    expect(token).toBe(VALID_TOKEN);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/trip-sharing");
    expect(sessionStorage.getItem(TRIP_SHARE_TOKEN_SESSION_KEY)).toBe(VALID_TOKEN);
  });

  it("F5 không còn hash thì lấy lại từ session cùng tab", () => {
    writeTripShareTokenToSession(VALID_TOKEN);

    const replaceState = vi.fn();
    const token = captureTripShareTokenFromWindow(
      { replaceState },
      { pathname: "/trip-sharing", search: "", hash: "" },
    );

    expect(token).toBe(VALID_TOKEN);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("hash mới trong cùng tab ghi đè session cũ", () => {
    const nextToken =
      "v1.22222222-2222-4222-8222-222222222222.ABCDEFGhijklmnopqrstuvwxyz0123456789abcdefg";
    writeTripShareTokenToSession(VALID_TOKEN);

    const token = captureTripShareTokenFromWindow(
      { replaceState: vi.fn() },
      {
        pathname: "/trip-sharing",
        search: "",
        hash: `#token=${nextToken}`,
      },
    );

    expect(token).toBe(nextToken);
    expect(readTripShareTokenFromSession()).toBe(nextToken);
  });

  it("tẩy hash xong, mất sessionStorage vẫn giữ token trong memory", () => {
    const token = captureTripShareTokenFromWindow(
      { replaceState: vi.fn() },
      {
        pathname: "/trip-sharing",
        search: "",
        hash: `#token=${VALID_TOKEN}`,
      },
    );
    expect(token).toBe(VALID_TOKEN);

    sessionStorage.removeItem(TRIP_SHARE_TOKEN_SESSION_KEY);

    expect(
      captureTripShareTokenFromWindow(
        { replaceState: vi.fn() },
        { pathname: "/trip-sharing", search: "", hash: "" },
      ),
    ).toBe(VALID_TOKEN);
  });

  it("xoá session hỏng, không trả token giả", () => {
    sessionStorage.setItem(TRIP_SHARE_TOKEN_SESSION_KEY, "garbage");

    expect(
      captureTripShareTokenFromWindow(
        { replaceState: vi.fn() },
        { pathname: "/trip-sharing", search: "", hash: "" },
      ),
    ).toBeNull();
    expect(sessionStorage.getItem(TRIP_SHARE_TOKEN_SESSION_KEY)).toBeNull();
  });
});

describe("redactTripShareToken", () => {
  it("không bao giờ trả lại token gốc", () => {
    expect(redactTripShareToken(VALID_TOKEN)).toBe("[trip-share-token]");
    expect(redactTripShareToken("abc")).toBe("[invalid-token]");
    expect(redactTripShareToken("")).toBe("");
  });
});
