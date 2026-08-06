import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminUsers, type AdminUser } from "../../api/vietride";
import Users from "./Users";

vi.mock("react-i18next", () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

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
    expect(table?.parentElement).toHaveClass("overflow-x-auto");

    expect(screen.queryByText("users.joined" )).not.toBeInTheDocument();
  });

  it("shows only table skeleton rows while keeping pagination visible", async () => {
    render(<Users />);

    expect(screen.queryByTestId("users-page-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("users-table-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(await screen.findByText(user.displayName)).toBeInTheDocument();
    expect(screen.queryByTestId("users-table-skeleton")).not.toBeInTheDocument();
  });

  it("keeps the action icons separated in the sticky action cell", async () => {
    render(<Users />);

    const detailsButton = await screen.findByRole("button", { name: "details" });
    expect(detailsButton.closest("td")).toHaveClass("sticky", "right-0");
    expect(detailsButton.parentElement).toHaveClass("flex", "gap-2", "w-[80px]");
  });

  it("shows identity data once and balances timestamps in the detail modal", async () => {
    const interaction = userEvent.setup();
    render(<Users />);

    await interaction.click(await screen.findByRole("button", { name: "details" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getAllByText(user.displayName)).toHaveLength(1);
    expect(within(dialog).getAllByText(user.email)).toHaveLength(1);
    expect(within(dialog).getAllByText("users.customer")).toHaveLength(1);
    expect(within(dialog).queryByText("users.fullName")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("email")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("users.role")).not.toBeInTheDocument();

    const updatedLabel = within(dialog).getByText("users.updatedAt");
    expect(updatedLabel.parentElement?.parentElement).toHaveClass("sm:grid-cols-2");
  });

  it("does not show refresh or admin-account creation actions", async () => {
    render(<Users />);
    await screen.findByText(user.displayName);

    expect(screen.queryByRole("button", { name: "refresh" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "users.createAdminUser" }),
    ).not.toBeInTheDocument();
  });

  it("keeps pagination visible while only the user table is loading", async () => {
    const browserUser = userEvent.setup();
    vi.mocked(getAdminUsers)
      .mockResolvedValueOnce({
        items: [user],
        page: 1,
        pageSize: 10,
        totalItems: 20,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      })
      .mockImplementationOnce(() => new Promise<never>(() => undefined));

    render(<Users />);
    await screen.findByText(user.displayName);

    await browserUser.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByTestId("users-table-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(user.displayName)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("table").parentElement).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
