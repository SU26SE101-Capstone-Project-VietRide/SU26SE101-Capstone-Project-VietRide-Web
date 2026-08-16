import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveRagDocument,
  getRagDocuments,
  getRagFeedback,
  type RagDocument,
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

// BE trả nội dung phản hồi trong `message.content` — bảng message_feedback
// không có cột comment nào, xem apps/rag/prisma/schema.prisma.
const firstFeedback = {
  id: "feedback-1",
  messageId: "message-1",
  rating: 1,
  message: { id: "message-1", content: "First page feedback" },
  createdAt: "2026-08-01T00:00:00Z",
} satisfies RagFeedback;

const pendingDocument = {
  id: "doc-pending",
  title: "Quy trình huỷ vé",
  accessLevel: "ADMIN",
  category: "PLATFORM_ADMIN",
  documentType: "SOP",
  status: "PENDING_REVIEW",
} satisfies RagDocument;

const approvedDocument = {
  ...pendingDocument,
  id: "doc-approved",
  title: "Điều khoản sử dụng",
  status: "APPROVED",
} satisfies RagDocument;

function documentPage(items: RagDocument[]) {
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
                message: { id: "message-9", content: "Second page feedback" },
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

describe("duyệt tài liệu RAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRagFeedback).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("chỉ hiện nút duyệt cho tài liệu đang chờ duyệt", async () => {
    vi.mocked(getRagDocuments).mockResolvedValue(
      documentPage([pendingDocument, approvedDocument]),
    );

    render(<RagAudit />);

    expect(
      await screen.findByRole("button", { name: "approve" }),
    ).toBeInTheDocument();
    // Tài liệu đã xử lý không được có nút thứ hai
    expect(screen.getAllByRole("button", { name: "approve" })).toHaveLength(1);
    expect(
      screen.getByText("ragAudit.alreadyProcessed"),
    ).toBeInTheDocument();
  });

  it("gọi approveRagDocument và cập nhật trạng thái tại chỗ", async () => {
    const user = userEvent.setup();
    vi.mocked(getRagDocuments).mockResolvedValue(
      documentPage([pendingDocument]),
    );
    vi.mocked(approveRagDocument).mockResolvedValue({
      ...pendingDocument,
      status: "APPROVED",
    });

    render(<RagAudit />);

    await user.click(await screen.findByRole("button", { name: "approve" }));

    await waitFor(() =>
      expect(approveRagDocument).toHaveBeenCalledWith("doc-pending"),
    );
    // Hàng chuyển sang APPROVED mà không phải tải lại cả bảng
    expect(
      await screen.findByText("ragAudit.status.APPROVED"),
    ).toBeInTheDocument();
    expect(getRagDocuments).toHaveBeenCalledTimes(1);
  });
});
