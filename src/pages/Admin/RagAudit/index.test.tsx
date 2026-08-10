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
      pageSize: 8,
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
      pageSize: params.pageSize ?? 8,
      totalItems: 9,
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
        expect.objectContaining({ page: 2, pageSize: 8 }),
      ),
    );
    expect(await screen.findByText("Second page feedback")).toBeInTheDocument();
  });
});
