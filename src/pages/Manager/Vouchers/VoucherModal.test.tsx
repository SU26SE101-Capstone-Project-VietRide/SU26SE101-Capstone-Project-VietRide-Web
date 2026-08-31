import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VoucherModal from "./VoucherModal";
import type { VoucherForm } from "./voucherHelpers";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const form: VoucherForm = {
  code: "SUMMER",
  name: "Summer voucher",
  type: "PERCENT_OFF",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "50000",
  totalUsageLimit: "100",
  perUserLimit: "1",
  validFrom: "2026-09-01T08:30",
  validUntil: "2026-09-10T18:45",
  applicableService: "BOOKING",
  applicableRouteIds: "",
};

describe("Manager VoucherModal", () => {
  it("does not show admin-only funding and application scope controls", () => {
    render(
      <VoucherModal
        open
        form={form}
        isEditing={false}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("vouchers.formBasics")).toBeInTheDocument();
    expect(screen.queryByText("vouchers.scopeRules")).not.toBeInTheDocument();
    expect(screen.queryByText("vouchers.fundingType")).not.toBeInTheDocument();
    expect(screen.queryByText("vouchers.applicableTo")).not.toBeInTheDocument();
  });
});
