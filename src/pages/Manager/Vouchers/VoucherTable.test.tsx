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

function renderTable(props: Partial<Parameters<typeof VoucherTable>[0]> = {}) {
  const onPageChange = vi.fn();
  render(
    <VoucherTable
      toolbar={null}
      vouchers={Array.from({ length: 8 }, (_, index) => makeVoucher(index))}
      isLoading={false}
      page={1}
      pageSize={8}
      totalItems={20}
      onPageChange={onPageChange}
      onEdit={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />,
  );
  return { onPageChange };
}

describe("Manager VoucherTable", () => {
  // Bảng giờ là controlled component: BE đã phân trang, component chỉ render
  // đúng những dòng được truyền vào và KHÔNG tự cắt lại.
  it("render đúng các dòng được truyền vào, không tự cắt", () => {
    renderTable();

    expect(screen.getByText("CODE0")).toBeInTheDocument();
    expect(screen.getByText("CODE7")).toBeInTheDocument();
  });

  // Tổng số bản ghi phải lấy từ `totalItems` của BE, không phải `rows.length` —
  // nếu lấy nhầm thì trang 1 luôn là trang cuối.
  it("dựng phân trang theo totalItems của BE chứ không theo số dòng", () => {
    renderTable();

    // 20 bản ghi / pageSize 8 = 3 trang
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("báo trang mới lên cha thay vì tự đổi state", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderTable();

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
