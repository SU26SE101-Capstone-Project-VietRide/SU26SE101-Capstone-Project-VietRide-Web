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
  createAdminUser: vi.fn(),
  getAdminOperatorUsers: vi.fn(),
  getAdminUsers: vi.fn(),
  lockAdminUser: vi.fn(),
  unlockAdminUser: vi.fn(),
}));

const user = {
  userId: "user-1",
  id: "user-1",
  email: "passenger@example.com",
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
});
