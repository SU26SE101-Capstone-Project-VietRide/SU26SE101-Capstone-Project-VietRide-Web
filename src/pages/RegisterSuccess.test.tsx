import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RegisterSuccess from "./RegisterSuccess";

vi.mock("../components/LanguageSwitcher", () => ({
  default: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const values: Record<string, string> = {
        brand: "VietRide",
        registrationCompleteTitle: "Registration successful",
        registrationCompleteDescription: "Application submitted",
        registrationPendingApproval: "Waiting for Admin approval",
        registrationPendingNote: "Sign in after approval",
        registrationEmailLabel: "Registration email",
        goToLogin: "Go to sign in",
      };

      return values[key] ?? key;
    },
  }),
}));

describe("RegisterSuccess", () => {
  it("shows the verified operator email and pending approval state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/register/success",
            state: { email: "operator@vietride.vn" },
          },
        ]}
      >
        <RegisterSuccess />
      </MemoryRouter>,
    );

    expect(screen.getByText("Registration successful")).toBeInTheDocument();
    expect(screen.getByText("Waiting for Admin approval")).toBeInTheDocument();
    expect(screen.getByText("operator@vietride.vn")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
