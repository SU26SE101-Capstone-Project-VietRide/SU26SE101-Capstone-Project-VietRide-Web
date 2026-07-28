import { render, screen } from "@testing-library/react";
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
});
