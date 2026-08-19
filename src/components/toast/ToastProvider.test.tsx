import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "./ToastProvider";
import { useToast } from "./useToast";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Component mồi: bắn toast qua hook để test hành vi provider.
function ToastTrigger() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success("saved ok")}>
        fire-success
      </button>
      <button type="button" onClick={() => toast.error("delete failed")}>
        fire-error
      </button>
      <button type="button" onClick={() => toast.success("")}>
        fire-empty-success
      </button>
      <button type="button" onClick={() => toast.error("   ")}>
        fire-empty-error
      </button>
    </>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a success toast and auto-dismisses it after 3s", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-success" }));

    // Toast render qua portal vào body — vẫn query được bằng screen
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("saved ok");
    expect(toast).toHaveAttribute("role", "status");

    // Chưa hết 3s thì toast vẫn còn
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    // Đủ 3000ms — toast tự biến mất
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  // 3s không đủ để đọc xong một thông báo lỗi, và khi nó tắt thì màn hình chỉ
  // còn dữ liệu cũ — không còn dấu vết nào cho biết thao tác vừa rồi đã hỏng.
  it("keeps an error toast on screen until the user closes it", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-error" }));
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    // Quá xa mốc 3s của toast thành công mà vẫn còn nguyên
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("renders an error toast with role=alert", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-error" }));

    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("delete failed");
    expect(toast).toHaveAttribute("role", "alert");
  });

  it("provides content when a caller passes an empty message", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-empty-success" }));
    expect(screen.getByTestId("toast")).toHaveTextContent("Thao tác đã hoàn tất.");

    fireEvent.click(screen.getByRole("button", { name: "fire-empty-error" }));
    expect(screen.getAllByTestId("toast")[1]).toHaveTextContent("Đã xảy ra lỗi, vui lòng thử lại.");
  });

  it("closes immediately via the X button", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-success" }));
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("pauses the auto-dismiss timer while hovered", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-success" }));
    const toast = screen.getByTestId("toast");

    // Hover trước khi hết giờ — timer dừng, quá 3s toast vẫn còn
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    // Rời chuột — đếm lại từ đầu 3000ms rồi mới tắt
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("keeps at most 5 toasts and evicts the oldest", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fire-error" }));
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "fire-success" }));
    }

    const toasts = screen.getAllByTestId("toast");
    expect(toasts).toHaveLength(5);
    // Toast lỗi bắn đầu tiên (cũ nhất) đã bị đẩy ra
    expect(screen.queryByText("delete failed")).not.toBeInTheDocument();
  });

  it("throws a clear error when useToast is used outside the provider", () => {
    // Chặn log lỗi render của React cho case throw chủ đích
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<ToastTrigger />)).toThrow(
      "useToast must be used within a ToastProvider",
    );

    consoleError.mockRestore();
  });
});
