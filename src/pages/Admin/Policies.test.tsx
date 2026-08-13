import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminPolicies, type PolicyItem } from "../../api/vietride";
import Policies from "./Policies";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../api/vietride", () => ({
  createAdminPolicy: vi.fn(),
  deleteAdminPolicy: vi.fn(),
  getAdminPolicies: vi.fn(),
  updateAdminPolicy: vi.fn(),
}));

const policy = {
  id: "policy-1",
  title: "Chính sách huỷ vé",
  description: "Quy định huỷ vé",
  content: "Nội dung",
  policyType: "FOR_OPERATOR",
  category: "Cancellation",
  version: 1,
  active: true,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-02T00:00:00Z",
} satisfies PolicyItem;

function pagedPolicies(items: PolicyItem[]) {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

describe("Admin Policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminPolicies).mockResolvedValue(pagedPolicies([policy]));
  });

  // BE (`ListPoliciesQuerySchema`) hỗ trợ search/category/active/sortBy từ đầu;
  // màn trước đây mới gửi mỗi `policyType`.
  it("gửi search lên BE sau khi debounce", async () => {
    const user = userEvent.setup();
    render(<Policies />);

    await screen.findByText(policy.title);

    await user.type(
      screen.getByPlaceholderText("policies.searchPlaceholder"),
      "huy ve",
    );

    await waitFor(
      () =>
        expect(getAdminPolicies).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "huy ve", page: 1 }),
        ),
      { timeout: 3_000 },
    );
  });

  it("gửi active dưới dạng boolean, không phải chuỗi trạng thái", async () => {
    const user = userEvent.setup();
    render(<Policies />);

    await screen.findByText(policy.title);

    await user.click(screen.getByRole("button", { name: "policies.filterActive" }));
    await user.click(screen.getByRole("option", { name: "inactive" }));

    await waitFor(() =>
      expect(getAdminPolicies).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: false, page: 1 }),
      ),
    );
  });

  it("gửi sortBy khi đổi cách sắp xếp", async () => {
    const user = userEvent.setup();
    render(<Policies />);

    await screen.findByText(policy.title);

    await user.click(screen.getByRole("button", { name: "policies.sortLabel" }));
    await user.click(screen.getByRole("option", { name: "policies.sortTitle" }));

    await waitFor(() =>
      expect(getAdminPolicies).toHaveBeenLastCalledWith(
        // Sắp theo tiêu đề thì phải là A→Z, không dùng desc mặc định
        expect.objectContaining({ sortBy: "title", sortDir: "asc" }),
      ),
    );
  });

  // Schema BE khai `.strict()` — key lạ trả 400 chứ không bị bỏ qua im lặng.
  it("không gửi key ngoài allow-list của endpoint", async () => {
    render(<Policies />);

    await screen.findByText(policy.title);

    const allowed = new Set([
      "page",
      "pageSize",
      "policyType",
      "category",
      "active",
      "search",
      "sortBy",
      "sortDir",
    ]);
    for (const [params] of vi.mocked(getAdminPolicies).mock.calls) {
      for (const key of Object.keys(params ?? {})) {
        expect(allowed).toContain(key);
      }
    }
  });
});
