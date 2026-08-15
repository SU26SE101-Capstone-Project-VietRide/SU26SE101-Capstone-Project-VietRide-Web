// Kịch bản gốc: admin đổi filter khi request cũ chưa về. Request cũ (chậm) trả
// sau request mới và ghi đè danh sách đúng bằng dữ liệu của filter cũ.
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestRequest } from "./useLatestRequest";

describe("useLatestRequest", () => {
  it("chỉ lần gọi mới nhất được coi là hợp lệ", () => {
    const { result } = renderHook(() => useLatestRequest());

    const isFirstLatest = result.current();
    expect(isFirstLatest()).toBe(true);

    const isSecondLatest = result.current();

    // Request cũ về trễ phải bị bỏ, request mới vẫn được ghi
    expect(isFirstLatest()).toBe(false);
    expect(isSecondLatest()).toBe(true);
  });

  it("bỏ qua mọi response về sau khi component đã unmount", () => {
    const { result, unmount } = renderHook(() => useLatestRequest());
    const isLatest = result.current();

    expect(isLatest()).toBe(true);

    unmount();

    expect(isLatest()).toBe(false);
  });

  it("giữ nguyên tham chiếu giữa các lần render để dùng được trong deps", () => {
    const { result, rerender } = renderHook(() => useLatestRequest());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
