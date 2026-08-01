import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminUsers, type AdminUser } from "../../api/vietride";
import Users from "./Users";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../auth", () => ({
  getAuthUser: () => ({ id: "current-admin" }),
}));

vi.mock("../../api/vietride", () => ({
  getAdminOperatorUsers: vi.fn(),
  getAdminUsers: vi.fn(),
  lockAdminUser: vi.fn(),
  unlockAdminUser: vi.fn(),
}));

const user = {
  userId: "user-1",
  id: "user-1",
  email: "passenger.with.a.very.long.email.address@example.com",
  phone: "0901234567",
  displayName: "Nguyễn Văn A",
  avatarUrl: "https://cdn.example.com/users/user-1.jpg",
  role: "PASSENGER",
  status: "ACTIVE",
  createdAt: "2026-07-01T03:00:00Z",
  updatedAt: "2026-07-02T03:00:00Z",
} satisfies AdminUser;

describe("Admin Users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminUsers).mockResolvedValue({
      items: [user],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("shows the user's avatar in the table", async () => {
    render(<Users />);

    expect(
      await screen.findByRole("img", { name: user.displayName }),
    ).toHaveAttribute("src", user.avatarUrl);
  });

  it("keeps key user data on one line and truncates long emails visually", async () => {
    render(<Users />);

    const email = await screen.findByText(user.email);
    expect(email).toHaveClass("truncate", "max-w-[220px]");
    expect(email).toHaveAttribute("title", user.email);

    expect(screen.getByText(user.displayName)).toHaveClass("truncate");
    expect(screen.getByText("users.customer")).toHaveClass("truncate");

    const table = email.closest("table");
    expect(table).toHaveClass("table-fixed");
    expect(table?.parentElement).toHaveClass("overflow-hidden");

    const joinedCell = screen.getByText(/01-07-2026/).closest("td");
    expect(joinedCell).toHaveClass("whitespace-nowrap");
  });

  it("does not show refresh or admin-account creation actions", async () => {
    render(<Users />);
    await screen.findByText(user.displayName);

    expect(screen.queryByRole("button", { name: "refresh" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "users.createAdminUser" }),
    ).not.toBeInTheDocument();
  });
});
