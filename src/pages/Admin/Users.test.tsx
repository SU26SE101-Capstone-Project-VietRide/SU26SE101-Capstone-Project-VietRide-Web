import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminOperators,
  getAdminUsers,
  lockAdminUser,
  unlockAdminUser,
  type AdminUser,
} from "../../api/vietride";
import Users from "./Users";

// t trả về key để assert cho gọn, nhưng vẫn ghi lại tham số nội suy — nhờ đó
// bắt được lỗi quên truyền biến cho key có placeholder ({{name}}...).
const { translate } = vi.hoisted(() => ({
  translate: vi.fn((key: string) => key),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../auth", () => ({
  getAuthUser: () => ({ id: "current-admin" }),
}));

vi.mock("../../api/vietride", () => ({
  getAdminOperatorUsers: vi.fn(),
  getAdminOperators: vi.fn(),
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
    vi.mocked(getAdminOperators).mockResolvedValue({
      items: [
        {
          operatorId: "operator-1",
          name: "Nhà xe Phương Trang",
          contactEmail: "ops@example.com",
          contactPhone: "0900000000",
          businessRegistrationNumber: "BR-1",
          taxCode: "TAX-1",
          registrationStatus: "APPROVED",
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  // BE nhận `operatorId` từ đầu, màn chỉ thiếu ô chọn nhà xe.
  it("lọc người dùng theo nhà xe", async () => {
    const actor = userEvent.setup();
    render(<Users />);

    await screen.findByText(user.displayName);

    await actor.click(
      screen.getByRole("button", { name: "users.filterOperator" }),
    );
    await actor.click(
      await screen.findByRole("option", { name: "Nhà xe Phương Trang" }),
    );

    await waitFor(() =>
      expect(getAdminUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ operatorId: "operator-1", page: 1 }),
      ),
    );
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

  // users.lockSuccess / users.unlockSuccess chứa {{name}}; nếu gọi t() mà không
  // truyền biến thì toast hiện nguyên chuỗi "{{name}}".
  it.each([
    ["ACTIVE", "users.lockSuccess", lockAdminUser],
    ["LOCKED", "users.unlockSuccess", unlockAdminUser],
  ])(
    "truyền tên người dùng vào toast khi khoá/mở khoá (%s)",
    async (status, expectedKey, action) => {
      const interaction = userEvent.setup();
      vi.mocked(getAdminUsers).mockResolvedValue({
        items: [{ ...user, status }],
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      vi.mocked(action).mockResolvedValue({ status } as never);

      render(<Users />);
      await screen.findByText(user.displayName);

      // Nút khoá/mở khoá không có aria-label, nó là nút thứ hai trong ô thao tác
      // cạnh nút "details".
      const detailsButton = screen.getByRole("button", { name: "details" });
      const toggleButton = within(
        detailsButton.parentElement as HTMLElement,
      ).getAllByRole("button")[1];
      await interaction.click(toggleButton);
      await interaction.click(screen.getByRole("button", { name: "confirm" }));

      expect(action).toHaveBeenCalledWith(user.userId);
      expect(translate).toHaveBeenCalledWith(expectedKey, {
        name: user.displayName,
      });
    },
  );

  // Thẻ thống kê trước đây đếm mảng của trang đang xem nên trần cứng ở pageSize
  // (10) và còn đổi theo filter — phải đọc số đếm toàn hệ thống.
  it("thẻ thống kê đếm toàn hệ thống chứ không đếm trang đang xem", async () => {
    const countByQuery: Record<string, number> = {
      all: 42,
      ACTIVE: 30,
      OPERATOR_STAFF: 7,
      PENDING_INITIAL_PASSWORD: 5,
    };

    vi.mocked(getAdminUsers).mockImplementation(async (params = {}) => {
      const isCountQuery = params.pageSize === 1;
      const key = params.status ?? params.role ?? "all";

      return {
        items: isCountQuery ? [] : [user],
        page: 1,
        pageSize: params.pageSize ?? 10,
        totalItems: isCountQuery ? countByQuery[key] : 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    });

    render(<Users />);
    await screen.findByText(user.displayName);

    for (const expected of Object.values(countByQuery)) {
      expect(await screen.findByText(String(expected))).toBeInTheDocument();
    }
  });

  it("keeps pagination visible while only the user table is loading", async () => {
    const browserUser = userEvent.setup();
    // Màn bắn thêm 4 request `pageSize: 1` để đếm thẻ thống kê, nên mock phải
    // định tuyến theo tham số — xếp hàng bằng `...Once` là các lượt đếm nuốt mất
    // response của bảng.
    let listCalls = 0;
    vi.mocked(getAdminUsers).mockImplementation(async (params = {}) => {
      const emptyPage = {
        items: [],
        page: 1,
        pageSize: 1,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };

      if (params.pageSize === 1) return emptyPage;

      listCalls += 1;
      if (listCalls > 1) return new Promise<never>(() => undefined);

      return {
        items: [user],
        page: 1,
        pageSize: 10,
        totalItems: 20,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      };
    });

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
