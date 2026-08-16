import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../components/toast/ToastProvider";
import { RETIRED_ROLE_ERROR } from "../auth";
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

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
