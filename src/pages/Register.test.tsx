import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerOperator,
  resendVerificationEmail,
  verifyEmail,
} from "../api/vietride";
import Register from "./Register";
import { useToastFeedback } from "../hooks/useToastFeedback";

vi.mock("../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../api/vietride", () => ({
  registerOperator: vi.fn(async () => ({
    operatorId: "operator-1",
    message: "Created",
  })),
  resendVerificationEmail: vi.fn(),
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
        representativePhone: "Representative phone",
        resendVerification: "Resend code",
        resendVerificationSuccess: "Verification code resent",
        verifyEmail: "Verify email",
      };

      return values[key] ?? key;
    },
  }),
}));

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances from the address step without submitting the registration", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route
            path="/register/success"
            element={<div>Pending operator approval</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("VietRide Express"), "VietRide Express");
    await user.type(
      screen.getByPlaceholderText("ops@operator.vn"),
      " Ops@Operator.VN ",
    );
    await user.type(screen.getAllByPlaceholderText("0901234567")[0], "0901234567");
    await user.type(screen.getByPlaceholderText("0312345678"), "0312345678");
    await user.type(screen.getByPlaceholderText("0301234567"), "0301234567");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByPlaceholderText("123 Nguyen Van Linh"), "123 Nguyen Van Linh");
    await user.type(screen.getByPlaceholderText("Ward 1"), "Ward 1");
    await user.type(screen.getByPlaceholderText("Ho Chi Minh City"), "Ho Chi Minh City");

    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByPlaceholderText("Nguyen Van A")).toBeInTheDocument();
    expect(registerOperator).not.toHaveBeenCalled();
  });

  // Bug thật quan sát trên Chrome: một cú bấm "Tiếp tục" ở bước 2 vừa sang bước
  // 3 vừa gọi luôn API đăng ký. React tái dùng đúng thẻ <button> đó và chỉ đổi
  // `type` từ "button" sang "submit"; trình duyệt chạy hành vi kích hoạt SAU khi
  // dispatch xong nên đọc phải type mới rồi submit form.
  //
  // Test "advances from the address step..." ở trên KHÔNG bắt được — jsdom
  // không tái hiện thứ tự đó. Nên chốt thẳng vào cách chặn: click bị
  // preventDefault, và hai nút mang danh tính khác nhau (React dựng thẻ mới).
  it("nút chuyển bước huỷ hành vi mặc định để không submit form", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
        </Routes>
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
    await user.type(screen.getByPlaceholderText("Ho Chi Minh City"), "Ho Chi Minh City");

    const nextButton = screen.getByRole("button", { name: /continue/i });
    expect(nextButton).toHaveAttribute("type", "button");

    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    nextButton.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);

    // Sang được bước 3 và không đụng tới API
    expect(await screen.findByPlaceholderText("Nguyen Van A")).toBeInTheDocument();
    expect(registerOperator).not.toHaveBeenCalled();
  });

  it("keeps previous step values and submits the complete registration payload", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route
            path="/register/success"
            element={<div>Pending operator approval</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("VietRide Express"), "VietRide Express");
    await user.type(
      screen.getByPlaceholderText("ops@operator.vn"),
      " Ops@Operator.VN ",
    );
    await user.type(screen.getAllByPlaceholderText("0901234567")[0], "0901234567");
    await user.type(screen.getByPlaceholderText("0312345678"), "0312345678");
    await user.type(screen.getByPlaceholderText("0301234567"), "0301234567");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByPlaceholderText("123 Nguyen Van Linh"), "123 Nguyen Van Linh");
    await user.type(screen.getByPlaceholderText("Ward 1"), "Ward 1");
    await user.type(screen.getByPlaceholderText("Ho Chi Minh City"), "Ho Chi Minh City");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByPlaceholderText("Nguyen Van A"), "Nguyen Van A");
    await user.type(screen.getAllByPlaceholderText("0901234567")[0], "0907654321");
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
      addressProvince: "Ho Chi Minh City",
      representativeName: "Nguyen Van A",
      representativePhone: "0907654321",
      password: "secret123",
    });

    expect(screen.getByDisplayValue("ops@operator.vn")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resend code/i }));

    expect(resendVerificationEmail).toHaveBeenCalledWith({
      email: "ops@operator.vn",
      purpose: "REGISTRATION",
    });
    expect(useToastFeedback).toHaveBeenCalledWith({ message: "Verification code resent", error: "" });

    await user.type(screen.getByPlaceholderText("123456"), "654321");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(verifyEmail).toHaveBeenCalledWith({
      email: "ops@operator.vn",
      code: "654321",
      purpose: "REGISTRATION",
    });
    expect(await screen.findByText("Pending operator approval")).toBeInTheDocument();
  });
});
