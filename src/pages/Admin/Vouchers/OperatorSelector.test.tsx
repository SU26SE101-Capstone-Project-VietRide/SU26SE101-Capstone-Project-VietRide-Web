import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminOperator } from "../../../api/vietride";
import OperatorSelector from "./OperatorSelector";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const operators: AdminOperator[] = [
  {
    operatorId: "operator-1",
    name: "Phương linh",
    contactEmail: "phuonglinh@example.com",
    contactPhone: "0900000001",
    businessRegistrationNumber: "BRN-1",
    taxCode: "TAX-1",
    registrationStatus: "APPROVED",
    isActive: true,
  },
  {
    operatorId: "operator-2",
    name: "VietRide Express",
    contactEmail: "express@example.com",
    contactPhone: "0900000002",
    businessRegistrationNumber: "BRN-2",
    taxCode: "TAX-2",
    registrationStatus: "APPROVED",
    isActive: true,
  },
];

describe("OperatorSelector", () => {
  it("selects all visible operators and clears them", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OperatorSelector
        operators={operators}
        selectedOperatorIds={[]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "vouchers.selectAllOperators" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["operator-1", "operator-2"]);

    rerender(
      <OperatorSelector
        operators={operators}
        selectedOperatorIds={["operator-1", "operator-2"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "vouchers.clearSelectedOperators" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("selects only matching operators after searching", () => {
    const onChange = vi.fn();
    render(
      <OperatorSelector
        operators={operators}
        selectedOperatorIds={[]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "express" },
    });
    expect(screen.queryByText("Phương linh")).not.toBeInTheDocument();
    expect(screen.getByText("VietRide Express")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "vouchers.selectAllOperators" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["operator-2"]);
  });
});
