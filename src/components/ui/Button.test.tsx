import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("dùng bậc màu đạt AA cho nút primary và danger", () => {
    // vr-800 = 4,54:1 với chữ trắng; vr-500/600/700 đều dưới 3:1 nên nút
    // primary tuyệt đối không được rơi về các bậc đó.
    const { rerender } = render(<Button variant="primary">Lưu</Button>);
    const button = screen.getByRole("button", { name: "Lưu" });
    expect(button).toHaveClass("bg-vr-800", "text-white");
    expect(button.className).not.toMatch(/bg-vr-[4-7]00/);

    rerender(<Button variant="danger">Xoá</Button>);
    expect(screen.getByRole("button", { name: "Xoá" })).toHaveClass(
      "bg-red-700",
      "text-white",
    );
  });

  it("chỉ có đúng ba bậc chiều cao", () => {
    const heights = (["sm", "md", "lg"] as const).map((size) => {
      const { unmount } = render(<Button size={size}>x</Button>);
      const className = screen.getByRole("button").className;
      unmount();
      // Neo vào ranh giới class, nếu không `max-sm:min-h-11` cũng khớp
      return /(?:^| )h-(\d+)(?: |$)/.exec(className)?.[1];
    });

    expect(heights).toEqual(["8", "10", "12"]);
  });

  it("giữ vùng chạm tối thiểu 44px ở mobile", () => {
    render(
      <Button iconOnly size="sm" aria-label="Xem">
        <span />
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Xem" });
    // Ở desktop nút icon nhỏ 32px vẫn hợp lý trong bảng dày đặc, nhưng dưới
    // breakpoint sm phải đạt 44×44 (WCAG 2.5.8).
    expect(button).toHaveClass("max-sm:min-h-11", "max-sm:min-w-11");
    expect(button).toHaveClass("h-8", "w-8");
  });

  it("mặc định type=button để không submit nhầm form bao ngoài", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Không submit</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Không submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
