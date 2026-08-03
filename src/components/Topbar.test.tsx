import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNotifications } from "../api/vietride";
import Topbar from "./Topbar";

const translate = (key: string) => key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { resolvedLanguage: "vi" },
  }),
}));

vi.mock("../auth", () => ({
  getAuthUser: () => ({
    id: "admin-1",
    email: "system.admin.with.a.long.account@vietride.online",
    role: "SYSTEM_ADMIN",
  }),
  logout: vi.fn(),
}));

vi.mock("../api/vietride", () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("./LanguageSwitcher", () => ({
  default: () => <div data-testid="language-switcher" />,
}));

vi.mock("./OperatorAnnouncementModal", () => ({
  default: () => null,
}));

describe("Topbar dropdowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotifications).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("keeps the notification and profile menus mutually exclusive", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Topbar onMenuToggle={vi.fn()} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "notifications" }));
    expect(screen.getByRole("heading", { name: "notifications" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "me" }));

    expect(screen.queryByRole("heading", { name: "notifications" })).not.toBeInTheDocument();
    const email = screen.getByText("system.admin.with.a.long.account@vietride.online");
    expect(email).toHaveClass("break-all");
    expect(email).toHaveAttribute(
      "title",
      "system.admin.with.a.long.account@vietride.online",
    );
  });
});
