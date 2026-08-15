import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRagDocuments,
  getRagFeedback,
  type RagFeedback,
} from "../../../api/vietride";
import RagAudit from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../api/vietride", () => ({
  approveRagDocument: vi.fn(),
  getRagDocuments: vi.fn(),
  getRagFeedback: vi.fn(),
}));

vi.mock("./RagDocumentUploadModal", () => ({
  RagDocumentUploadModal: () => null,
}));

const firstFeedback = {
  id: "feedback-1",
  messageId: "message-1",
  rating: 1,
  comment: "First page feedback",
  createdAt: "2026-08-01T00:00:00Z",
} satisfies RagFeedback;

describe("RAG audit feedback pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRagDocuments).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getRagFeedback).mockImplementation(async (params = {}) => ({
      items:
        params.page === 2
          ? [
              {
                ...firstFeedback,
                id: "feedback-9",
                comment: "Second page feedback",
              },
            ]
          : [firstFeedback],
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      // 11 bản ghi / 10 mỗi trang = 2 trang
      totalItems: 11,
      totalPages: 2,
      hasNextPage: params.page !== 2,
      hasPreviousPage: params.page === 2,
    }));
  });

  it("loads the selected feedback page independently from documents", async () => {
    const user = userEvent.setup();
    render(<RagAudit />);

    expect(await screen.findByText("First page feedback")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() =>
      expect(getRagFeedback).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 }),
      ),
    );
    expect(await screen.findByText("Second page feedback")).toBeInTheDocument();
  });

  // Sáu bộ lọc này BE hỗ trợ sẵn từ đầu nhưng màn chưa dựng UI — bảng hiện cột
  // trạng thái và cấp truy cập mà không lọc được theo chúng.
  it("gửi các bộ lọc tài liệu lên BE", async () => {
    const user = userEvent.setup();
    render(<RagAudit />);

    await waitFor(() => expect(getRagDocuments).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "ragAudit.filterStatus" }));
    await user.click(screen.getByRole("option", { name: "ragAudit.status.APPROVED" }));

    await waitFor(() =>
      expect(getRagDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "APPROVED", page: 1 }),
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "ragAudit.filterAccessLevel" }),
    );
    await user.click(screen.getByRole("option", { name: "enumLabels.PUBLIC" }));

    await waitFor(() =>
      expect(getRagDocuments).toHaveBeenLastCalledWith(
        // Các bộ lọc cộng dồn theo AND, không ghi đè nhau
        expect.objectContaining({ status: "APPROVED", accessLevel: "PUBLIC" }),
      ),
    );
  });
});
