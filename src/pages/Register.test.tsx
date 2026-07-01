import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { registerOperator } from "../api/vietride";
import Register from "./Register";

vi.mock("../api/vietride", () => ({
  registerOperator: vi.fn(async () => ({
    operatorId: "operator-1",
    message: "Created",
  })),
  verifyEmail: vi.fn(),
}));

vi.mock("../components/LanguageSwitcher", () => ({
  default: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const values: Record<string, string> = {
        "errors.required": "Required",
        "errors.invalidEmail": "Invalid email",
        "errors.passwordMin": "Password must be at least 6 characters",
        registerSubmit: "Create account",
        submitting: "Submitting",
        password: "Password",
        passwordPlaceholder: "Enter password",
        phonePlaceholder: "0901234567",
        displayNamePlaceholder: "Nguyen Van A",
        continue: "Continue",
        back: "Back",
        stepLabel: "Step {{number}}",
        operatorName: "Operator name",
        contactEmail: "Contact email",
        contactPhone: "Contact phone",
        businessRegistrationNumber: "Business registration number",
        taxCode: "Tax code",
        streetAddress: "Street address",
        ward: "Ward",
        district: "District",
        province: "Province",
        representativeName: "Representative name",
        representativePosition: "Representative position",
        representativePhone: "Representative phone",
        representativeEmail: "Representative email",
      };

      return values[key] ?? key;
    },
  }),
}));

describe("Register", () => {
  it("keeps previous step values and submits the complete registration payload", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("VietRide Express"), "VietRide Express");
    await user.type(screen.getByPlaceholderText("ops@operator.vn"), "ops@operator.vn");
    await user.type(screen.getAllByPlaceholderText("0901234567")[0], "0901234567");
    await user.type(screen.getByPlaceholderText("0312345678"), "0312345678");
    await user.type(screen.getByPlaceholderText("0301234567"), "0301234567");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByPlaceholderText("123 Nguyen Van Linh"), "123 Nguyen Van Linh");
    await user.type(screen.getByPlaceholderText("Ward 1"), "Ward 1");
    await user.type(screen.getByPlaceholderText("District 1"), "District 1");
    await user.type(screen.getByPlaceholderText("Ho Chi Minh City"), "Ho Chi Minh City");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByPlaceholderText("Nguyen Van A"), "Nguyen Van A");
    await user.type(screen.getByPlaceholderText("Operations manager"), "Operations manager");
    await user.type(screen.getAllByPlaceholderText("0901234567")[0], "0907654321");
    await user.type(screen.getByPlaceholderText("owner@operator.vn"), "owner@operator.vn");
    await user.type(screen.getByPlaceholderText("Enter password"), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(registerOperator).toHaveBeenCalledWith({
      name: "VietRide Express",
      contactEmail: "ops@operator.vn",
      contactPhone: "0901234567",
      businessRegistrationNumber: "0312345678",
      taxCode: "0301234567",
      addressStreet: "123 Nguyen Van Linh",
      addressWard: "Ward 1",
      addressDistrict: "District 1",
      addressProvince: "Ho Chi Minh City",
      representativeName: "Nguyen Van A",
      representativePosition: "Operations manager",
      representativePhone: "0907654321",
      representativeEmail: "owner@operator.vn",
      password: "secret123",
    });
  });
});
