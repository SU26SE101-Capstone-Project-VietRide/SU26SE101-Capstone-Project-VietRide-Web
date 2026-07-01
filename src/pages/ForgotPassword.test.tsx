import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";

vi.mock("../components/LanguageSwitcher", () => ({
  default: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const values: Record<string, string> = {
        "errors.required": "Required",
        "errors.invalidEmail": "Invalid email",
        "forgotPasswordPage.title": "Forgot password",
        "forgotPasswordPage.subtitle": "Enter your account email.",
        "forgotPasswordPage.heroTitle": "Recover access",
        "forgotPasswordPage.heroSubtitle": "Reset flow",
        "forgotPasswordPage.submit": "Request reset link",
        "forgotPasswordPage.pendingApiMessage": "Forgot password API is not connected yet.",
        "hero.station": "Bus station",
        email: "Email",
        emailPlaceholder: "hello@vietride.vn",
        backToLogin: "Back to sign in",
      };

      return values[key] ?? key;
    },
  }),
}));

describe("ForgotPassword", () => {
  it("validates email and shows the pending API state", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /request reset link/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Required");

    await user.type(screen.getByPlaceholderText("hello@vietride.vn"), "ops@operator.vn");
    await user.click(screen.getByRole("button", { name: /request reset link/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Forgot password API is not connected yet.",
    );
  });
});
