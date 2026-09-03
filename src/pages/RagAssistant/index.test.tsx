import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRagFeedback, streamRagChat } from "../../api/vietride";
import { getAuthUser } from "../../auth";
import RagAssistant from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "value" in options ? `${key} ${String(options.value)}` : key,
    i18n: { language: "vi" },
  }),
}));

vi.mock("../../api/vietride", () => ({
  createRagFeedback: vi.fn(),
  streamRagChat: vi.fn(),
}));

vi.mock("../../auth", () => ({
  getAuthUser: vi.fn(),
}));

const streamMock = vi.mocked(streamRagChat);
const feedbackMock = vi.mocked(createRagFeedback);
const authMock = vi.mocked(getAuthUser);

/** Giả lập BE stream: nhả vài token rồi kết thúc bằng `done`. */
function mockAnswer(answer: string, citedChunkIds: string[] = ["chunk-1"]) {
  streamMock.mockImplementation(async (_request, onEvent) => {
    for (const chunk of answer.split(" ")) {
      onEvent({ type: "token", content: `${chunk} ` });
    }
    onEvent({
      type: "done",
      conversationId: "conversation-1",
      userMessageId: "user-message-1",
      assistantMessageId: "assistant-message-1",
      citedChunkIds,
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  authMock.mockReturnValue({
    id: "user-1",
    email: "staff@vietride.vn",
    displayName: "Nguyễn Nhật Hào",
    phone: "0900000000",
    role: "OPERATOR_ADMIN",
  });
});

describe("RagAssistant", () => {
  it("mở màn với câu hỏi gợi ý, bấm là gửi luôn", async () => {
    const user = userEvent.setup();
    mockAnswer("Quy trình gồm ba bước");

    render(<RagAssistant />);

    const starter = screen.getByRole("button", {
      name: "assistant.starterVoucher",
    });
    await user.click(starter);

    await waitFor(() => {
      expect(streamMock).toHaveBeenCalledTimes(1);
    });
    expect(streamMock.mock.calls[0][0]).toMatchObject({
      message: "assistant.starterVoucher",
    });
  });

  it("hiện câu trả lời kèm số nguồn tham chiếu sau khi stream xong", async () => {
    const user = userEvent.setup();
    mockAnswer("Đối soát ví theo ngày", ["chunk-1", "chunk-2"]);

    render(<RagAssistant />);
    await user.type(screen.getByRole("textbox"), "Đối soát ví thế nào?");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(screen.getByText(/Đối soát ví theo ngày/)).toBeTruthy();
    });
    expect(screen.getByText("assistant.sources 2")).toBeTruthy();
    // Bong bóng người dùng vẫn còn trong khung chat
    expect(screen.getByText("Đối soát ví thế nào?")).toBeTruthy();
  });

  it("Enter gửi tin, Shift+Enter chỉ xuống dòng", async () => {
    const user = userEvent.setup();
    mockAnswer("Đã nhận");

    render(<RagAssistant />);
    const textbox = screen.getByRole("textbox");

    await user.type(textbox, "dòng một{Shift>}{Enter}{/Shift}dòng hai");
    expect(streamMock).not.toHaveBeenCalled();

    await user.type(textbox, "{Enter}");
    await waitFor(() => {
      expect(streamMock).toHaveBeenCalledTimes(1);
    });
    expect(streamMock.mock.calls[0][0].message).toContain("dòng một");
    expect(streamMock.mock.calls[0][0].message).toContain("dòng hai");
  });

  it("không gửi khi ô nhập trống", async () => {
    render(<RagAssistant />);

    const sendButton = screen.getByRole("button", { name: "send" });
    expect(sendButton.hasAttribute("disabled")).toBe(true);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("đánh giá câu trả lời gửi rating lên BE", async () => {
    const user = userEvent.setup();
    mockAnswer("Có ba bước");
    feedbackMock.mockResolvedValue(undefined as never);

    render(<RagAssistant />);
    await user.type(screen.getByRole("textbox"), "Quy trình?");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "assistant.helpful" })).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: "assistant.helpful" }));

    await waitFor(() => {
      expect(feedbackMock).toHaveBeenCalledWith("assistant-message-1", {
        rating: 1,
      });
    });
  });

  it("nút hội thoại mới xoá lịch sử và trả về màn gợi ý", async () => {
    const user = userEvent.setup();
    mockAnswer("Trả lời cũ");

    render(<RagAssistant />);
    await user.type(screen.getByRole("textbox"), "Câu hỏi cũ");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(screen.getByText(/Trả lời cũ/)).toBeTruthy();
    });

    await user.click(
      screen.getByRole("button", { name: "assistant.newConversation" }),
    );

    expect(screen.queryByText(/Trả lời cũ/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "assistant.starterVoucher" }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        window.localStorage.getItem("vietride.rag-assistant.session.user-1"),
      ).toBeNull();
    });
  });

  it("khôi phục lịch sử và conversationId sau khi component được mở lại", async () => {
    const user = userEvent.setup();
    mockAnswer("Câu trả lời đã lưu");

    const firstView = render(<RagAssistant embedded />);
    await user.type(screen.getByRole("textbox"), "Câu hỏi cần lưu");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(
        window.localStorage.getItem("vietride.rag-assistant.session.user-1"),
      ).toContain("Câu trả lời đã lưu");
    });
    firstView.unmount();

    render(<RagAssistant embedded />);
    expect(screen.getByText("Câu hỏi cần lưu")).toBeTruthy();
    expect(screen.getByText(/Câu trả lời đã lưu/)).toBeTruthy();

    await user.type(screen.getByRole("textbox"), "Câu hỏi tiếp theo");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(streamMock).toHaveBeenCalledTimes(2);
    });
    expect(streamMock.mock.calls[1][0]).toMatchObject({
      message: "Câu hỏi tiếp theo",
      conversationId: "conversation-1",
    });
  });

  it("bản nhúng trong bong bóng không hiện tiêu đề trang", () => {
    render(<RagAssistant embedded />);

    expect(screen.queryByText("assistant.pageTitle")).toBeNull();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});
