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
  it("does not show the funding and operator scope section", () => {
    render(
      <VoucherModal
        open
        onClose={vi.fn()}
        editingVoucher={null}
        form={emptyForm}
        updateForm={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("vouchers.formBasics")).toBeInTheDocument();
    expect(screen.queryByText("vouchers.scopeRules")).not.toBeInTheDocument();
    expect(screen.queryByText("vouchers.fundingType")).not.toBeInTheDocument();
  });
});
