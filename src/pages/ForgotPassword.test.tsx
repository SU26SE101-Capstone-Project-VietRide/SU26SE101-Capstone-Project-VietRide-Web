import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";
import { requestForgotPassword, resetPassword } from "../api/vietride";
import { useToastFeedback } from "../hooks/useToastFeedback";

vi.mock("../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../components/LanguageSwitcher", () => ({
  default: () => null,
}));

vi.mock("../api/vietride", () => ({
  requestForgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const values: Record<string, string> = {
        "errors.required": "Required",
        "errors.invalidEmail": "Invalid email",
        "forgotPasswordPage.title": "Forgot password",
        "forgotPasswordPage.subtitle": "Enter your account email.",
        "forgotPasswordPage.heroTitle": "Recover access",
        "forgotPasswordPage.heroSubtitle": "Reset flow",
        "forgotPasswordPage.submit": "Send OTP",
        "forgotPasswordPage.resetSubmit": "Reset password",
        "forgotPasswordPage.otpSent": "OTP sent for {{minutes}} minutes.",
        "forgotPasswordPage.code": "OTP code",
        "forgotPasswordPage.codePlaceholder": "Enter 6 digits",
        "forgotPasswordPage.newPassword": "New password",
        "forgotPasswordPage.newPasswordPlaceholder": "At least 8 chars",
        "forgotPasswordPage.confirmPassword": "Confirm password",
        "forgotPasswordPage.confirmPasswordPlaceholder": "Re-enter password",
        "forgotPasswordPage.invalidCode": "Invalid OTP",
        "forgotPasswordPage.passwordRules": "Password rules",
        "forgotPasswordPage.passwordMismatch": "Password mismatch",
        "forgotPasswordPage.requestFailed": "Request failed",
        "forgotPasswordPage.resetFailed": "Reset failed",
        "forgotPasswordPage.resetSuccess": "Password reset successfully.",
        "hero.station": "Bus station",
        submitting: "Processing",
        email: "Email",
        emailPlaceholder: "hello@vietride.vn",
        backToLogin: "Back to sign in",
      };

      const value = values[key] ?? key;
      return value.replace("{{minutes}}", String(options?.minutes ?? ""));
    },
  }),
}));

describe("ForgotPassword", () => {
  it("validates email and resets password with OTP", async () => {
    const user = userEvent.setup();
    vi.mocked(requestForgotPassword).mockResolvedValue({
      email: "ops@operator.vn",
      otpTtlMinutes: 5,
    });
    vi.mocked(resetPassword).mockResolvedValue({
      userId: "user-1",
      status: "ACTIVE",
    });

    // Đặt lại mật khẩu thành công thì màn điều hướng sang /login và mang câu
    // thông báo trong router state, không hiện toast tại chỗ nữa — nên phải
    // dựng sẵn route /login để đọc được state đó.
    function LoginProbe() {
      const location = useLocation();
      const state = location.state as { message?: string } | null;
      return <div data-testid="login-route">{state?.message ?? ""}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /send otp/i }));
    expect(useToastFeedback).toHaveBeenLastCalledWith({ message: "", error: "Required" });

    await user.type(screen.getByPlaceholderText("hello@vietride.vn"), "ops@operator.vn");
    await user.click(screen.getByRole("button", { name: /send otp/i }));

    // Tham số thứ hai là Idempotency-Key: màn giữ key trong ref để lần bấm gửi
    // lại dùng đúng key cũ, BE không tạo thêm OTP mới.
    expect(requestForgotPassword).toHaveBeenCalledWith(
      { email: "ops@operator.vn" },
      expect.any(String),
    );
    expect(useToastFeedback).toHaveBeenLastCalledWith({ message: "OTP sent for 5 minutes.", error: "" });

    await user.type(screen.getByPlaceholderText("Enter 6 digits"), "123456");
    await user.type(screen.getByPlaceholderText("At least 8 chars"), "Password123");
    await user.type(screen.getByPlaceholderText("Re-enter password"), "Password123");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(resetPassword).toHaveBeenCalledWith(
      {
        email: "ops@operator.vn",
        code: "123456",
        newPassword: "Password123",
      },
      expect.any(String),
    );
    await waitFor(() =>
      expect(screen.getByTestId("login-route")).toHaveTextContent(
        "Password reset successfully.",
      ),
    );
  });
});
