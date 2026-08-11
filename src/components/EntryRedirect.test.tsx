import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import EntryRedirect from "./EntryRedirect";

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<EntryRedirect />} />
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/manager/dashboard" element={<div>manager-home</div>} />
        <Route path="/admin/dashboard" element={<div>admin-home</div>} />
        <Route
          path="/payments/return"
          element={<PaymentReturnProbe />}
        />
        <Route path="*" element={<EntryRedirect />} />
      </Routes>
    </MemoryRouter>,
  );
}

function PaymentReturnProbe() {
  return <div>payment-return-page{window.location.search}</div>;
}

function signIn(role: string) {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresInSeconds: 3600,
      user: {
        id: "user-1",
        email: "user@vietride.test",
        displayName: "User",
        phone: "0900000000",
        role,
      },
    }),
  );
}

describe("EntryRedirect", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sends an anonymous visitor to the login page", () => {
    renderAt("/");
    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("keeps a signed-in manager inside the app instead of the login page", () => {
    signIn("OPERATOR_ADMIN");
    renderAt("/");
    expect(screen.getByText("manager-home")).toBeInTheDocument();
  });

  it("sends a signed-in admin to the admin home", () => {
    signIn("SYSTEM_ADMIN");
    renderAt("/some/unknown/path");
    expect(screen.getByText("admin-home")).toBeInTheDocument();
  });

  // Nếu vnp_ReturnUrl phía Backend trỏ lệch thì kết quả thanh toán vẫn phải
  // tới được trang xác minh, không bị nuốt mất ở /login.
  it("forwards a VNPay result landing on the wrong path to the return page", () => {
    renderAt("/?vnp_ResponseCode=00&vnp_TxnRef=VR-1");
    expect(screen.getByText(/payment-return-page/)).toBeInTheDocument();
  });

  it("forwards a VNPay result even when signed in", () => {
    signIn("OPERATOR_ADMIN");
    renderAt("/unknown?vnp_ResponseCode=24");
    expect(screen.getByText(/payment-return-page/)).toBeInTheDocument();
  });
});
