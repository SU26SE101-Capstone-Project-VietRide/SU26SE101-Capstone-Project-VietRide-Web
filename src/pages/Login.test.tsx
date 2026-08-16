import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../components/toast/ToastProvider";
import { login, RETIRED_ROLE_ERROR } from "../auth";
import Login from "./Login";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "vi" } }),
}));

vi.mock("../auth", async () => {
  const actual = await vi.importActual<typeof import("../auth")>("../auth");
  return {
    ...actual,
    getAuthUser: vi.fn(() => null),
    login: vi.fn(),
  };
});

vi.mock("../components/LanguageSwitcher", () => ({ default: () => null }));

function renderLogin(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <ToastProvider>
        <Login />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** Hiện path hiện tại để biết Login điều hướng đi đâu sau khi đăng nhập. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLoginWithRoutes(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("emailPlaceholder"), "a@b.com");
  await user.type(screen.getByPlaceholderText("passwordPlaceholder"), "secret1");
  await user.click(screen.getByRole("button", { name: "submit" }));
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(login).mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      expiresInSeconds: 900,
      user: {
        id: "u1",
        email: "a@b.com",
        displayName: "Operator",
        phone: "0900000000",
        role: "OPERATOR_ADMIN",
      },
    });
  });

  // Thanh toán VNPay xong, phiên hết hạn thì PrivateRoute đá về đây kèm
  // `state.from`. Bỏ qua nó là người dùng đăng nhập lại xong rơi về dashboard,
  // phải tự mò về màn Gói cước.
  it("quay lại đúng trang bị chặn sau khi đăng nhập lại", async () => {
    renderLoginWithRoutes({
      from: { pathname: "/manager/packages", search: "", hash: "" },
    });

    await submitLogin();

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/manager/packages",
    );
  });

  it("bỏ qua `from` trỏ ra ngoài và về home theo role", async () => {
    renderLoginWithRoutes({ from: { pathname: "//evil.example" } });

    await submitLogin();

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/manager/dashboard",
    );
  });

  // Đổi mật khẩu xong BE thu hồi hết refresh token nên Profile buộc phải đá về
  // /login. Không hiện thông báo thì người dùng tưởng hệ thống lỗi.
  it("hiện thông báo được truyền qua router state sau khi đổi mật khẩu", async () => {
    renderLogin({ message: "profilePage.passwordChanged" });

    expect(
      await screen.findByText("profilePage.passwordChanged"),
    ).toBeInTheDocument();
  });

  it("không hiện toast khi vào thẳng trang đăng nhập", () => {
    renderLogin();

    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("xuất RETIRED_ROLE_ERROR để phân biệt role đã gỡ với sai mật khẩu", () => {
    expect(RETIRED_ROLE_ERROR).toBe("VIETRIDE_CONSOLE_ROLE_RETIRED");
  });
});
