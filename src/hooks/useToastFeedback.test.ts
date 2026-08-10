// Regression: error thường được khởi tạo useState("") (chuỗi rỗng), không phải
// undefined/null. rawText trước đây dùng `error ?? message ?? ""` — ?? không rơi
// qua chuỗi rỗng nên khi error="" (không có lỗi thật) mà message có nội dung
// thành công thật, rawText vẫn khoá cứng vào error="" → toast luôn hiện fallback
// chung "Thao tác đã hoàn tất." thay vì message thật (bug quan sát được trên
// trang Manager/Vehicles: sửa xe/sửa ghế xong không hiện đúng câu thành công).
import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastContext, type ToastApi } from "../components/toast/toastContext";
import { useToastFeedback } from "./useToastFeedback";

function renderWithToast(
  props: { message?: string | null; error?: string | null },
  toast: ToastApi,
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ToastContext.Provider, { value: toast }, children);

  return renderHook(() => useToastFeedback(props), { wrapper });
}

describe("useToastFeedback", () => {
  it("shows the real success message when error is an empty string (not undefined)", () => {
    const toast: ToastApi = { success: vi.fn(), error: vi.fn() };

    renderWithToast({ message: "Thông tin xe đã cập nhật", error: "" }, toast);

    expect(toast.success).toHaveBeenCalledWith("Thông tin xe đã cập nhật");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the real error message when error has content", () => {
    const toast: ToastApi = { success: vi.fn(), error: vi.fn() };

    renderWithToast({ message: "", error: "Không thể lưu thay đổi." }, toast);

    expect(toast.error).toHaveBeenCalledWith("Không thể lưu thay đổi.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("fires no toast when both message and error are empty strings", () => {
    const toast: ToastApi = { success: vi.fn(), error: vi.fn() };

    renderWithToast({ message: "", error: "" }, toast);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("dedupes repeated identical success messages across re-renders", () => {
    const toast: ToastApi = { success: vi.fn(), error: vi.fn() };

    const { rerender } = renderWithToast(
      { message: "Đã lưu.", error: "" },
      toast,
    );
    rerender();
    rerender();

    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
