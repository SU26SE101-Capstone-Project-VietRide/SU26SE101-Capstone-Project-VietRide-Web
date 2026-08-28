import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOperatorShuttleAssignmentHistory } from "../../../api/vietride";
import ShuttleAssignmentHistorySection from "./ShuttleAssignmentHistorySection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const entries = Object.entries(vars ?? {}).filter(
        ([name]) => name !== "defaultValue",
      );
      return entries.length === 0
        ? key
        : `${key} ${entries.map(([name, value]) => `${name}=${value}`).join(" ")}`;
    },
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorShuttleAssignmentHistory: vi.fn(),
}));

const actor = {
  userId: "user-1",
  displayName: "Trần Minh Bình",
  role: "OPERATOR_ADMIN",
};

function page(items: unknown[], hasNextPage = false, pageNumber = 1) {
  return {
    items,
    page: pageNumber,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage,
    hasPreviousPage: false,
  };
}

describe("ShuttleAssignmentHistorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Lazy-load: phần lớn lượt mở chi tiết chuyến không ai xem tới lịch sử, nên
  // không được gọi API cho tới khi người dùng bấm mở.
  it("chỉ gọi API khi người dùng mở mục lịch sử", async () => {
    vi.mocked(getOperatorShuttleAssignmentHistory).mockResolvedValue(
      page([]) as never,
    );
    const user = userEvent.setup();

    render(<ShuttleAssignmentHistorySection shuttleTripId="shuttle-1" />);

    expect(getOperatorShuttleAssignmentHistory).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /dispatch.assignmentHistory/ }),
    );

    await waitFor(() =>
      expect(getOperatorShuttleAssignmentHistory).toHaveBeenCalledWith(
        "shuttle-1",
        { page: 1, pageSize: 20 },
      ),
    );
    expect(
      await screen.findByText("dispatch.assignmentHistoryEmpty"),
    ).toBeInTheDocument();
  });

  it("hiện đúng nhãn theo action và nối thêm khi tải trang sau", async () => {
    vi.mocked(getOperatorShuttleAssignmentHistory)
      .mockResolvedValueOnce(
        page(
          [
            {
              id: "audit-2",
              action: "REASSIGNED",
              assignedAt: "2026-08-27T15:30:00+07:00",
              assignedBy: actor,
              reason: "Xe cũ gặp sự cố",
              previousDriver: { id: "d1", displayName: "Lê Văn An" },
              currentDriver: { id: "d2", displayName: "Phạm Quốc Huy" },
              previousVehicle: { id: "v1", licensePlate: "51A-123.45" },
              currentVehicle: { id: "v2", licensePlate: "51B-678.90" },
            },
          ],
          true,
        ) as never,
      )
      .mockResolvedValueOnce(
        page(
          [
            {
              id: "audit-1",
              action: "INITIAL_ASSIGNED",
              assignedAt: "2026-08-26T09:00:00+07:00",
              assignedBy: actor,
              reason: null,
              previousDriver: null,
              currentDriver: { id: "d1", displayName: "Lê Văn An" },
              previousVehicle: null,
              currentVehicle: { id: "v1", licensePlate: "51A-123.45" },
            },
          ],
          false,
          2,
        ) as never,
      );
    const user = userEvent.setup();

    render(<ShuttleAssignmentHistorySection shuttleTripId="shuttle-1" />);
    await user.click(
      screen.getByRole("button", { name: /dispatch.assignmentHistory/ }),
    );

    // REASSIGNED dùng nhãn "đổi xe/tài xế", kèm snapshot trước → sau và lý do
    expect(
      await screen.findByText(/dispatch\.assignedByReassigned/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lê Văn An.*Phạm Quốc Huy/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Xe cũ gặp sự cố/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /dispatch.assignmentHistoryLoadMore/,
      }),
    );

    // Trang sau nối thêm chứ không thay: cả hai dòng cùng hiện
    expect(
      await screen.findByText(/dispatch\.assignedByInitial/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dispatch\.assignedByReassigned/),
    ).toBeInTheDocument();
    expect(getOperatorShuttleAssignmentHistory).toHaveBeenNthCalledWith(
      2,
      "shuttle-1",
      { page: 2, pageSize: 20 },
    );
  });
});
