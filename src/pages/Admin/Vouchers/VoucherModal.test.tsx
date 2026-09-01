import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VoucherModal from "./VoucherModal";
import { emptyForm } from "./voucherHelpers";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Admin VoucherModal", () => {
  it("shows operator scope while keeping funding fixed to VietRide", () => {
    render(
      <VoucherModal
        open
        onClose={vi.fn()}
        editingVoucher={null}
        form={emptyForm}
        operators={[]}
        operatorsLoading={false}
        updateForm={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("vouchers.formBasics")).toBeInTheDocument();
    expect(screen.getByText("vouchers.scopeRules")).toBeInTheDocument();
    expect(screen.getByText("vouchers.vietrideFunded")).toBeInTheDocument();
    expect(screen.queryByText("vouchers.fundingType")).not.toBeInTheDocument();
  });
});
