import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OperatorVoucher } from "../../../api/vietride";
import VoucherTable from "./VoucherTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; date?: string }) =>
      options?.count !== undefined
        ? `${key}:${options.count}`
        : options?.date !== undefined
          ? `${key}:${options.date}`
          : key,
  }),
}));

function makeVoucher(index: number): OperatorVoucher {
  return {
    id: `voucher-${index}`,
    code: `CODE${index}`,
    name: `Voucher ${index}`,
    type: "PERCENT_OFF",
    value: 10,
    totalUsageLimit: 100,
    perUserLimit: 1,
    validFrom: "2026-08-01T00:00:00Z",
    validUntil: "2026-09-01T00:00:00Z",
    isActive: true,
  } as OperatorVoucher;
}

describe("Manager VoucherTable", () => {
  // PersonnelTable render thẳng `rows` và không tự cắt theo trang. Trước đây
  // VoucherTable truyền cả danh sách nên bảng hiện mọi voucher còn thanh phân
  // trang chỉ là trang trí — bấm trang 2 thì số trang đổi mà hàng thì không.
  it("chỉ render đúng số hàng của một trang", () => {
    const vouchers = Array.from({ length: 20 }, (_, index) =>
      makeVoucher(index),
    );

    render(
      <VoucherTable
        toolbar={null}
        vouchers={vouchers}
        isLoading={false}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // pageSize = 8
    expect(screen.getByText("CODE0")).toBeInTheDocument();
    expect(screen.getByText("CODE7")).toBeInTheDocument();
    expect(screen.queryByText("CODE8")).not.toBeInTheDocument();
    expect(screen.queryByText("CODE19")).not.toBeInTheDocument();
  });

  it("đổi trang thì đổi luôn hàng hiển thị", async () => {
    const user = userEvent.setup();
    const vouchers = Array.from({ length: 20 }, (_, index) =>
      makeVoucher(index),
    );

    render(
      <VoucherTable
        toolbar={null}
        vouchers={vouchers}
        isLoading={false}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByText("CODE8")).toBeInTheDocument();
    expect(screen.queryByText("CODE0")).not.toBeInTheDocument();
  });

  // Lọc xong danh sách ngắn lại, trang đang đứng có thể vượt quá dữ liệu còn
  // lại — phải kẹp về trang cuối hợp lệ thay vì hiện bảng rỗng.
  it("kẹp trang khi bộ lọc làm danh sách ngắn đi", async () => {
    const user = userEvent.setup();
    const vouchers = Array.from({ length: 20 }, (_, index) =>
      makeVoucher(index),
    );

    const { rerender } = render(
      <VoucherTable
        toolbar={null}
        vouchers={vouchers}
        isLoading={false}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("CODE16")).toBeInTheDocument();

    rerender(
      <VoucherTable
        toolbar={null}
        vouchers={vouchers.slice(0, 3)}
        isLoading={false}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("CODE0")).toBeInTheDocument();
    expect(screen.getByText("CODE2")).toBeInTheDocument();
  });
});
