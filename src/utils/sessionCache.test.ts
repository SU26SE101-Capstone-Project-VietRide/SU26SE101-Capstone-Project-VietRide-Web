import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSessionCache, writeSessionCache } from "./sessionCache";

describe("sessionCache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("ghi rồi đọc lại được dữ liệu còn hạn", () => {
    writeSessionCache("cache-key", { items: [1, 2, 3] });

    expect(
      readSessionCache<{ items: number[] }>("cache-key", 60_000),
    ).toEqual({ items: [1, 2, 3] });
    // Entry lưu đúng dạng { ts, data }
    const raw = JSON.parse(sessionStorage.getItem("cache-key") ?? "{}") as {
      ts: number;
      data: unknown;
    };
    expect(typeof raw.ts).toBe("number");
    expect(raw.data).toEqual({ items: [1, 2, 3] });
  });

  it("trả null khi không có entry", () => {
    expect(readSessionCache("missing-key", 60_000)).toBeNull();
  });

  it("entry quá hạn → null và xoá entry", () => {
    sessionStorage.setItem(
      "cache-key",
      JSON.stringify({ ts: Date.now() - 120_000, data: "stale" }),
    );

    expect(readSessionCache("cache-key", 60_000)).toBeNull();
    expect(sessionStorage.getItem("cache-key")).toBeNull();
  });

  it("entry còn trong hạn thì không bị xoá", () => {
    sessionStorage.setItem(
      "cache-key",
      JSON.stringify({ ts: Date.now() - 30_000, data: "fresh" }),
    );

    expect(readSessionCache("cache-key", 60_000)).toBe("fresh");
    expect(sessionStorage.getItem("cache-key")).not.toBeNull();
  });

  it("JSON hỏng → null và xoá entry", () => {
    sessionStorage.setItem("cache-key", "{not-json");

    expect(readSessionCache("cache-key", 60_000)).toBeNull();
    expect(sessionStorage.getItem("cache-key")).toBeNull();
  });

  it("entry sai shape (thiếu ts hoặc data) → null và xoá entry", () => {
    sessionStorage.setItem("no-ts", JSON.stringify({ data: "x" }));
    sessionStorage.setItem("no-data", JSON.stringify({ ts: Date.now() }));
    sessionStorage.setItem("not-record", JSON.stringify("just a string"));

    expect(readSessionCache("no-ts", 60_000)).toBeNull();
    expect(readSessionCache("no-data", 60_000)).toBeNull();
    expect(readSessionCache("not-record", 60_000)).toBeNull();
    expect(sessionStorage.getItem("no-ts")).toBeNull();
    expect(sessionStorage.getItem("no-data")).toBeNull();
    expect(sessionStorage.getItem("not-record")).toBeNull();
  });

  it("lỗi khi ghi (quota/bị chặn) không ném ra ngoài", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => writeSessionCache("cache-key", "value")).not.toThrow();
  });

  it("lỗi khi đọc (storage bị chặn) trả null", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(readSessionCache("cache-key", 60_000)).toBeNull();
  });
});
