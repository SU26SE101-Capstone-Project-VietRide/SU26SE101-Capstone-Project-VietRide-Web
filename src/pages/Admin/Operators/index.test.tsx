import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdminOperator,
  getAdminOperators,
  type AdminOperator,
} from "../../../api/vietride";
import Operators from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  approveAdminOperator: vi.fn(),
  createAdminOperator: vi.fn(),
  getAdminOperatorDetail: vi.fn(),
  getAdminOperators: vi.fn(),
  reactivateAdminOperator: vi.fn(),
  rejectAdminOperator: vi.fn(),
  suspendAdminOperator: vi.fn(),
}));

const pendingOperator = {
  operatorId: "operator-1",
  name: "Nhà xe Đà Lạt",
  contactEmail: "dalat@example.com",
  contactPhone: "0901234567",
  businessRegistrationNumber: "BR-001",
  taxCode: "TAX-001",
  registrationStatus: "PENDING",
} satisfies AdminOperator;

describe("Admin Operators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let isApproved = false;

    vi.mocked(approveAdminOperator).mockImplementation(async (operatorId) => {
      isApproved = true;
      return { operatorId, message: "approved" };
    });
    vi.mocked(getAdminOperators).mockImplementation(async (params = {}) => {
      const operator = {
        ...pendingOperator,
        registrationStatus: isApproved ? "APPROVED" : "PENDING",
      };
      const items =
        params.status && params.status !== operator.registrationStatus
          ? []
          : [operator];

      return {
        items,
        page: 1,
        pageSize: 20,
        totalItems: items.length,
        totalPages: items.length ? 1 : 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    });
  });

  it("shows the approved operator immediately and returns to the full list", async () => {
    const user = userEvent.setup();
    render(<Operators />);

    expect(
      await screen.findByText(pendingOperator.name, {}, { timeout: 5_000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "operators.viewNow" }));
    await waitFor(() =>
      expect(getAdminOperators).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "PENDING" }),
      ),
    );

    await user.click(screen.getByTitle("operators.approve"));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "operators.approve" }),
    );

    await waitFor(() =>
      expect(approveAdminOperator).toHaveBeenCalledWith(
        pendingOperator.operatorId,
      ),
    );
    expect(screen.getByText(pendingOperator.name)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "operators.allStatus" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(getAdminOperators).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: undefined }),
      ),
    );
  });

});
