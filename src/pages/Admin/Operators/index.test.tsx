import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdminOperator,
  getAdminOperators,
  getAdminOperatorSummary,
  exportAdminOperators,
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
  getAdminOperatorSummary: vi.fn(),
  exportAdminOperators: vi.fn(),
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
    vi.mocked(getAdminOperatorSummary).mockResolvedValue({
      total: 1,
      pending: 1,
      approved: 0,
      suspended: 0,
      rejected: 0,
      active: 1,
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
    // Quay về "tất cả trạng thái": key `status` bị bỏ hẳn khỏi query thay vì
    // gửi `status=undefined` (BE strict-query từ chối query rỗng/lạ).
    await waitFor(() => {
      const lastCall = vi.mocked(getAdminOperators).mock.calls.at(-1)?.[0] ?? {};
      expect(lastCall.status).toBeUndefined();
    });
  });

  it("phân trang server-side: mỗi trang là một request riêng", async () => {
    const user = userEvent.setup();
    // 11 bản ghi / 10 mỗi trang = 2 trang (mọi bảng dùng chung pageSize 10)
    const operators = Array.from({ length: 11 }, (_, index) => ({
      ...pendingOperator,
      operatorId: `operator-${index + 1}`,
      name: `Operator ${index + 1}`,
    }));
    vi.mocked(getAdminOperators).mockImplementation(async (params = {}) => {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 10;
      const start = (page - 1) * pageSize;

      return {
        items: operators.slice(start, start + pageSize),
        page,
        pageSize,
        totalItems: operators.length,
        totalPages: 2,
        hasNextPage: page === 1,
        hasPreviousPage: page > 1,
      };
    });

    render(<Operators />);

    // Mở màn chỉ tải trang 1 — trước đây fetchAllPages kéo hết mọi trang
    expect(
      await screen.findByText("Operator 1", {}, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(getAdminOperators).not.toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );

    await user.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() =>
      expect(getAdminOperators).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    expect(await screen.findByText("Operator 11")).toBeInTheDocument();
  });

  // Export lấy CSV do BE dựng, dùng đúng bộ lọc của danh sách nhưng KHÔNG kèm
  // page/pageSize — nếu kèm thì chỉ xuất được trang đang xem.
  it("xuất CSV qua BE với đúng filter, không kèm phân trang", async () => {
    const user = userEvent.setup();
    vi.mocked(exportAdminOperators).mockResolvedValue(
      new Blob(["operatorId,name"], { type: "text/csv" }),
    );
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    render(<Operators />);
    await screen.findByText(pendingOperator.name, {}, { timeout: 5_000 });

    await user.click(screen.getByRole("button", { name: /exportCsv/ }));

    await waitFor(() => expect(exportAdminOperators).toHaveBeenCalled());
    const params = vi.mocked(exportAdminOperators).mock.calls.at(-1)?.[0] ?? {};
    expect(params).not.toHaveProperty("page");
    expect(params).not.toHaveProperty("pageSize");
  });

  // Khoảng ngày nằm trong panel nâng cao (giống ScheduleTable bên Manager) nên
  // hàng lọc chính chỉ còn search + 2 trạng thái.
  it("khoảng ngày nằm trong panel lọc nâng cao", async () => {
    const user = userEvent.setup();
    render(<Operators />);
    await screen.findByText(pendingOperator.name, {}, { timeout: 5_000 });

    expect(
      screen.queryByLabelText("operators.dateFromLabel"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /operators\.advancedFilters/ }),
    );

    expect(screen.getByLabelText("operators.dateFromLabel")).toBeInTheDocument();
    expect(screen.getByLabelText("operators.dateToLabel")).toBeInTheDocument();
    expect(
      screen.getByLabelText("operators.dateFieldLabel"),
    ).toBeInTheDocument();
  });

  // Không có nút xoá lọc thì admin phải tự tay dọn từng ô mới quay lại được
  // danh sách đầy đủ — nhất là khi lọc rỗng và bảng không còn dòng nào.
  it("nút xoá bộ lọc dọn hết filter và tải lại danh sách đầy đủ", async () => {
    const user = userEvent.setup();
    render(<Operators />);
    await screen.findByText(pendingOperator.name, {}, { timeout: 5_000 });

    expect(
      screen.queryByRole("button", { name: /operators\.clearFilters/ }),
    ).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      "operators.searchPlaceholder",
    );
    await user.type(searchInput, "dalat");
    await waitFor(() =>
      expect(getAdminOperators).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "dalat" }),
      ),
    );

    await user.click(
      screen.getByRole("button", { name: /operators\.clearFilters/ }),
    );

    expect(searchInput).toHaveValue("");
    await waitFor(() => {
      const lastCall = vi.mocked(getAdminOperators).mock.calls.at(-1)?.[0] ?? {};
      expect(lastCall.search).toBeUndefined();
      expect(lastCall.page).toBe(1);
    });
    expect(
      screen.queryByRole("button", { name: /operators\.clearFilters/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps rows the BE matched on non-name fields", async () => {
    // BE tìm trên name/contactEmail/contactPhone/businessRegistrationNumber/
    // taxCode. Trước đây màn lọc lại ở client theo mỗi `name` nên dòng khớp
    // email hay mã số thuế bị vứt đi và bảng hiện rỗng.
    const user = userEvent.setup();
    render(<Operators />);

    expect(
      await screen.findByText(pendingOperator.name, {}, { timeout: 5_000 }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("operators.searchPlaceholder"),
      "dalat@example.com",
    );

    await waitFor(() =>
      expect(getAdminOperators).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "dalat@example.com" }),
      ),
    );
    expect(await screen.findByText(pendingOperator.name)).toBeInTheDocument();
  });
});
