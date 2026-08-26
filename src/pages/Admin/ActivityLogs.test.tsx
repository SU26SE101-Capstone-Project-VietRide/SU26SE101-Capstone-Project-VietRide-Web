import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminActivityLogs } from "../../api/vietride";
import ActivityLogs from "./ActivityLogs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../api/vietride", () => ({
  getAdminActivityLogs: vi.fn(),
}));

function page(items: unknown[] | null) {
  return {
    items: items as never,
    page: 1,
    pageSize: 15,
    totalItems: items?.length ?? 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

const log = {
  id: "log-1",
  action: "APPROVE_OPERATOR",
  actor: {
    id: "admin-1",
    email: "admin@vietride.vn",
    displayName: "Quản trị viên",
    role: "SYSTEM_ADMIN",
  },
  metadata: { operatorId: "operator-1", operatorName: "Nhà xe Minh Tâm" },
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  createdAt: "2026-08-25T10:00:00+07:00",
};

describe("Admin ActivityLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminActivityLogs).mockResolvedValue(page([log]));
  });

  it("hiện người thực hiện và tác vụ, giấu UUID khỏi bảng", async () => {
    render(<ActivityLogs />);

    expect(await screen.findByText("Quản trị viên")).toBeInTheDocument();
    expect(screen.getByText("APPROVE_OPERATOR")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
    // BE chưa gắn snapshot tên đối tượng (xem
    // BE_ACTIVITY_LOG_READABLE_TARGET_CONTRACT.md) nên UUID chỉ được xuất hiện
    // trong modal chi tiết, không nằm trong bảng.
    expect(screen.queryByText("log-1")).not.toBeInTheDocument();
  });

  // Spec BE khai `data.items` có thể là null cho trang trống. Component phải
  // chuẩn hoá về [] chứ không được `.map` thẳng lên null.
  it("không vỡ khi BE trả items null", async () => {
    vi.mocked(getAdminActivityLogs).mockResolvedValue(page(null));
    render(<ActivityLogs />);

    expect(await screen.findByText("activityLogs.empty")).toBeInTheDocument();
  });

  it("mở chi tiết thì hiện UUID và metadata thô", async () => {
    const user = userEvent.setup();
    render(<ActivityLogs />);

    await user.click(await screen.findByRole("button", { name: "details" }));

    expect(await screen.findByText("log-1")).toBeInTheDocument();
    expect(screen.getByText("admin-1")).toBeInTheDocument();
    expect(screen.getByText(/Nhà xe Minh Tâm/)).toBeInTheDocument();
  });

  it("bấm Lọc thì gọi lại API kèm tác vụ đang nhập", async () => {
    const user = userEvent.setup();
    render(<ActivityLogs />);

    await screen.findByText("Quản trị viên");
    await user.type(
      screen.getByLabelText("activityLogs.action"),
      "LOCK_USER",
    );
    await user.click(screen.getByRole("button", { name: "filter" }));

    await waitFor(() =>
      expect(getAdminActivityLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "LOCK_USER" }),
      ),
    );
  });

  it("lỗi tải thì hiện thông báo thay vì bảng trống im lặng", async () => {
    vi.mocked(getAdminActivityLogs).mockRejectedValue(new Error("boom"));
    render(<ActivityLogs />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
