import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "./Checkbox";

describe("Checkbox", () => {
  it("ticks when the label text is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox checked={false} onChange={onChange} label="Tuyến hoạt động" />);

    expect(
      screen.getByRole("checkbox", { name: "Tuyến hoạt động" }),
    ).not.toBeChecked();

    await user.click(screen.getByText("Tuyến hoạt động"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("stays reachable by keyboard because the input is sr-only, not hidden", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox checked={false} onChange={onChange} label="Tuyến hoạt động" />);

    // sr-only vẫn nhận focus được; display:none/hidden thì không.
    await user.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reports unchecking through the same boolean callback", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox checked onChange={onChange} label="Đang bật" />);

    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders without a wrapping label so it can sit inside an existing label", () => {
    const { container } = render(
      <Checkbox checked={false} onChange={vi.fn()} aria-label="Chọn dòng" />,
    );

    // Lồng <label> trong <label> là HTML không hợp lệ — không có nhãn thì
    // component không được tự sinh <label>.
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Chọn dòng" })).toBeInTheDocument();
  });

  it("sets the DOM-only indeterminate flag and clears it once checked", () => {
    const { rerender } = render(
      <Checkbox checked={false} indeterminate onChange={vi.fn()} aria-label="Tất cả" />,
    );

    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);

    rerender(
      <Checkbox checked indeterminate onChange={vi.fn()} aria-label="Tất cả" />,
    );
    expect(input.indeterminate).toBe(false);
  });

  it("does not fire onChange while disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox checked={false} disabled onChange={onChange} label="Khoá" />);

    await user.click(screen.getByText("Khoá"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
