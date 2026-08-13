import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOperatorUsers, type OperatorUser } from "../../../api/vietride";
import StaffPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  createOperatorUser: vi.fn(),
  getOperatorUsers: vi.fn(),
  resendInitialPassword: vi.fn(),
}));

const operatorUser = {
  userId: "staff-1",
  email: "staff@operator.vn",
  displayName: "Nguyễn Văn A",
  phone: "0901234567",
  avatarUrl: "https://cdn.example.com/users/staff-1.jpg",
  role: "OPERATOR_STAFF",
  status: "ACTIVE",
  operatorId: "operator-1",
  createdAt: "2026-07-01T03:00:00Z",
} satisfies OperatorUser;

describe("Operator staff users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorUsers).mockResolvedValue({
      items: [operatorUser],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("shows the user's avatar in the staff table", async () => {
    render(<StaffPage />);

    expect(
      await screen.findByRole("img", { name: operatorUser.displayName }),
    ).toHaveAttribute("src", operatorUser.avatarUrl);
  });

  it("offers each creatable role once and excludes operations staff", async () => {
    const user = userEvent.setup();
    render(<StaffPage />);

    await user.click(screen.getByRole("button", { name: "staff.add" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getAllByText("staff.role")).toHaveLength(1);
    expect(
      within(dialog).queryByText("staff.rolePermissions"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("staff.operatorStaff"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "staff.driver" }),
    ).toBeInTheDocument();
  });

  it("requests the selected server page and renders its records", async () => {
    const user = userEvent.setup();
    const secondPageUser = {
      ...operatorUser,
      userId: "staff-9",
      email: "second-page@operator.vn",
      displayName: "Second Page User",
    };
    vi.mocked(getOperatorUsers).mockImplementation(async (params = {}) => ({
      items: params.page === 2 ? [secondPageUser] : [operatorUser],
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 8,
      totalItems: 9,
      totalPages: 2,
      hasNextPage: params.page !== 2,
      hasPreviousPage: params.page === 2,
    }));

    render(<StaffPage />);
    await screen.findByText(operatorUser.displayName);
    await user.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() =>
      expect(getOperatorUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 8,
          role: undefined,
          status: undefined,
        }),
      ),
    );
    expect(await screen.findByText(secondPageUser.displayName)).toBeInTheDocument();
  });

  it("sends role and status filters to the API", async () => {
    const user = userEvent.setup();
    render(<StaffPage />);
    await screen.findByText(operatorUser.displayName);

    await user.click(
      screen.getByRole("button", { name: "staff.allRoles" }),
    );
    await user.click(screen.getByRole("option", { name: "staff.driver" }));
    await user.click(
      screen.getByRole("button", { name: "staff.allStatuses" }),
    );
    await user.click(screen.getByRole("option", { name: "enumLabels.ACTIVE" }));

    await waitFor(() =>
      expect(getOperatorUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          role: "DRIVER",
          status: "ACTIVE",
        }),
      ),
    );
  });

  // sortBy/sortDir BE nhận sẵn từ đầu, màn chỉ thiếu ô chọn.
  it("gửi sortBy/sortDir khi đổi cách sắp xếp", async () => {
    const user = userEvent.setup();
    render(<StaffPage />);

    await waitFor(() => expect(getOperatorUsers).toHaveBeenCalled());
    // Mặc định: mới nhất trước
    expect(getOperatorUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "createdAt", sortDir: "desc" }),
    );

    await user.click(screen.getByRole("button", { name: "staff.sortLabel" }));
    await user.click(screen.getByRole("option", { name: "staff.sortNameAsc" }));

    await waitFor(() =>
      expect(getOperatorUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "displayName",
          sortDir: "asc",
          page: 1,
        }),
      ),
    );
  });
});
