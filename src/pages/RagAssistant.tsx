import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiBookOpen,
  FiSend,
  FiThumbsDown,
  FiThumbsUp,
} from "react-icons/fi";
import {
  createRagFeedback,
  streamRagChat,
  type RagChatDoneEvent,
} from "../api/vietride";
import { getAuthUser } from "../auth";
import { useToastFeedback } from "../hooks/useToastFeedback";
import { translateApiErrorMessage } from "../utils/apiErrorMessage";

type RagAssistantProps = {
  embedded?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  assistantMessageId?: string;
  citedChunkIds?: string[];
  rating?: -1 | 1;
};

const starterQuestions = [
  "Quy trình xử lý voucher của nhà xe là gì?",
  "Làm thế nào để xử lý chuyến bị gián đoạn?",
  "Cách đối soát ví và settlement?",
];

export default function RagAssistant({ embedded = false }: RagAssistantProps) {
  const { t } = useTranslation("common");
  const user = getAuthUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  useToastFeedback({ error });

  const canScopeOperator = user?.role === "SYSTEM_ADMIN";
  const latestMessages = useMemo(() => messages.slice(-30), [messages]);

  async function sendMessage(
    event: FormEvent | undefined,
    suggestedMessage?: string,
  ) {
    event?.preventDefault();
    const message = (suggestedMessage ?? input).trim();
    if (!message || streaming) return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setInput("");
    setError("");
    setStreaming(true);

    let doneEvent: RagChatDoneEvent | null = null;
    try {
      await streamRagChat(
        {
          message,
          conversationId,
          operatorId:
            canScopeOperator && operatorId.trim()
              ? operatorId.trim()
              : undefined,
        },
        (streamEvent) => {
          if (streamEvent.type === "token") {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? { ...item, content: item.content + streamEvent.content }
                  : item,
              ),
            );
          } else if (streamEvent.type === "done") {
            doneEvent = streamEvent;
            setConversationId(streamEvent.conversationId);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      assistantMessageId: streamEvent.assistantMessageId,
                      citedChunkIds: streamEvent.citedChunkIds,
                    }
                  : item,
              ),
            );
          } else {
            // Event lỗi của SSE không đi qua createApiRequestError nên phải tự
            // dịch, nếu không sẽ hiện nguyên "RAG_xxx: <message tiếng Anh>".
            setError(
              translateApiErrorMessage(streamEvent.code, streamEvent.message),
            );
          }
        },
      );
      if (!doneEvent) {
        setError("Trợ lý AI đã dừng trước khi hoàn tất câu trả lời.");
      }
    } catch (streamError) {
      setError(
        streamError instanceof Error
          ? streamError.message
          : "Không thể kết nối với trợ lý AI.",
      );
    } finally {
      setStreaming(false);
    }
  }

  async function rateMessage(message: ChatMessage, rating: -1 | 1) {
    if (!message.assistantMessageId) return;
    setError("");
    try {
      await createRagFeedback(message.assistantMessageId, { rating });
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, rating } : item,
        ),
      );
    } catch (feedbackError) {
      setError(
        feedbackError instanceof Error
          ? feedbackError.message
          : "Không thể gửi feedback.",
      );
    }
  }

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col" : "mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col gap-5"}>
      {!embedded && <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
          <span className="rounded-xl bg-vr-50 p-2 text-vr-700">
            <FiBookOpen />
          </span>
          VietRide Knowledge Assistant
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Hỏi đáp theo knowledge base và phạm vi role/operator đang đăng nhập.
        </p>
      </header>}

      {canScopeOperator && !embedded && (
        <label className="block max-w-xl">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Giới hạn theo mã nhà xe (không bắt buộc)
          </span>
          <input
            value={operatorId}
            onChange={(event) => {
              setOperatorId(event.target.value);
              setConversationId(undefined);
              setMessages([]);
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-vr-500"
            placeholder="Mã nhà xe"
          />
        </label>
      )}

      <section className={embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white" : "flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"}>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {latestMessages.length === 0 && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <FiBookOpen className="h-12 w-12 text-vr-300" />
              <p className="mt-4 font-semibold text-gray-900">
                Bắt đầu với một câu hỏi nghiệp vụ
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {starterQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(undefined, question)}
                    className="rounded-full border border-vr-100 bg-vr-50 px-3 py-2 text-sm text-vr-700 hover:bg-vr-100"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
          {latestMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-vr-600 text-white"
                    : "border border-gray-100 bg-slate-50 text-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {message.content ||
                    (streaming ? "Đang truy xuất knowledge base..." : "-")}
                </p>
                {message.role === "assistant" &&
                  message.assistantMessageId && (
                    <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-2">
                      <button
                        type="button"
                        onClick={() => void rateMessage(message, 1)}
                        className={`rounded-lg p-1.5 ${
                          message.rating === 1
                            ? "bg-emerald-100 text-emerald-700"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        aria-label="Hữu ích"
                        title="Hữu ích"
                      >
                        <FiThumbsUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => void rateMessage(message, -1)}
                        className={`rounded-lg p-1.5 ${
                          message.rating === -1
                            ? "bg-rose-100 text-rose-700"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        aria-label="Không hữu ích"
                        title="Không hữu ích"
                      >
                        <FiThumbsDown />
                      </button>
                      {(message.citedChunkIds?.length ?? 0) > 0 && (
                        <span className="ml-auto text-[11px] text-gray-400">
                          {message.citedChunkIds?.length} nguồn
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(event) => void sendMessage(event)}
          className="flex gap-3 border-t border-gray-100 p-4"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={4000}
            className="min-h-12 flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-vr-500"
            placeholder="Nhập câu hỏi..."
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-vr-500 text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("send", { defaultValue: "Gửi" })}
            title={t("send", { defaultValue: "Gửi" })}
          >
            <FiSend />
          </button>
        </form>
      </section>
    </div>
  );
}


