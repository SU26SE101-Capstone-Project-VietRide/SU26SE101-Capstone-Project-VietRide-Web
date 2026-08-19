import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiBookOpen, FiRefreshCw } from "react-icons/fi";

import {
  createRagFeedback,
  streamRagChat,
  type RagChatDoneEvent,
} from "../../api/vietride";
import { getAuthUser } from "../../auth";
import { useToastFeedback } from "../../hooks/useToastFeedback";
import { translateApiErrorMessage } from "../../utils/apiErrorMessage";
import ChatComposer from "./ChatComposer";
import ChatEmptyState from "./ChatEmptyState";
import ChatMessageRow from "./ChatMessageRow";
import type { ChatMessage } from "./types";

type RagAssistantProps = {
  embedded?: boolean;
};

/** Chỉ giữ 30 lượt gần nhất trong khung nhìn cho nhẹ DOM. */
const VISIBLE_MESSAGE_LIMIT = 30;

/** Người dùng đã cuộn lên đọc lại thì không giật màn về đáy khi có token mới. */
const STICK_TO_BOTTOM_THRESHOLD_PX = 120;

function initialsOf(displayName: string | undefined): string {
  const source = (displayName ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0][0];
  return letters.toUpperCase();
}

export default function RagAssistant({ embedded = false }: RagAssistantProps) {
  const { t } = useTranslation("common");
  const user = getAuthUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  useToastFeedback({ error });

  const canScopeOperator = user?.role === "SYSTEM_ADMIN";
  const latestMessages = useMemo(
    () => messages.slice(-VISIBLE_MESSAGE_LIMIT),
    [messages],
  );
  const userInitials = useMemo(() => initialsOf(user?.displayName), [user?.displayName]);
  const lastMessageId = latestMessages.at(-1)?.id;
  const streamingContent = latestMessages.at(-1)?.content.length ?? 0;

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_TO_BOTTOM_THRESHOLD_PX;
  }, []);

  // Bám đáy khi có tin nhắn mới hoặc token mới stream về — trước đây phải tự
  // cuộn tay mới thấy câu trả lời đang chạy.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !stickToBottomRef.current) return;
    // jsdom (và vài WebView cũ) không có Element.scrollTo — rơi về gán scrollTop.
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [lastMessageId, streamingContent]);

  async function sendMessage(
    event: FormEvent | undefined,
    suggestedMessage?: string,
  ) {
    event?.preventDefault();
    const message = (suggestedMessage ?? input).trim();
    if (!message || streaming) return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    stickToBottomRef.current = true;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message, createdAt },
      { id: assistantId, role: "assistant", content: "", createdAt },
    ]);
    setInput("");
    setError("");
    setStreaming(true);

    let doneEvent: RagChatDoneEvent | null = null;
    // BE có thể kết thúc stream bằng event `error` (vd RAG_PROVIDER_UNAVAILABLE)
    // thay vì `done`. Phải nhớ lại để không ghi đè mã lỗi thật bằng thông báo chung.
    let receivedErrorEvent = false;
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
            receivedErrorEvent = true;
            setError(
              translateApiErrorMessage(streamEvent.code, streamEvent.message),
            );
          }
        },
      );
      if (!doneEvent && !receivedErrorEvent) {
        setError(t("assistant.streamStopped"));
      }
    } catch (streamError) {
      setError(
        streamError instanceof Error
          ? streamError.message
          : t("assistant.connectionFailed"),
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
          : t("assistant.feedbackFailed"),
      );
    }
  }

  function startNewConversation() {
    setMessages([]);
    setConversationId(undefined);
    setError("");
    stickToBottomRef.current = true;
  }

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col"
          : "mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col gap-5"
      }
    >
      {!embedded && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 sm:text-3xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-vr-100 text-vr-900">
                <FiBookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              {t("assistant.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {t("assistant.pageSubtitle")}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startNewConversation}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-gray-100"
            >
              <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("assistant.newConversation")}
            </button>
          )}
        </header>
      )}

      {canScopeOperator && !embedded && (
        <label className="block max-w-xl">
          <span className="mb-2 block text-sm font-semibold text-slate-800">
            {t("assistant.operatorScopeLabel")}
          </span>
          <input
            value={operatorId}
            onChange={(event) => {
              setOperatorId(event.target.value);
              setConversationId(undefined);
              setMessages([]);
            }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-gray-500 focus:border-vr-500 focus:ring-2 focus:ring-vr-500/25"
            placeholder={t("assistant.operatorScopePlaceholder")}
          />
        </label>
      )}

      <section
        className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 ${
          embedded
            ? ""
            : "min-h-[460px] rounded-2xl border border-gray-200 shadow-sm"
        }`}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          aria-live="polite"
          className={`flex-1 overflow-y-auto ${
            latestMessages.length === 0
              ? "p-4"
              : embedded
                ? "space-y-4 p-3"
                : "space-y-5 p-5"
          }`}
        >
          {latestMessages.length === 0 ? (
            <ChatEmptyState
              compact={embedded}
              onPickStarter={(question) => void sendMessage(undefined, question)}
            />
          ) : (
            latestMessages.map((message) => (
              <ChatMessageRow
                key={message.id}
                message={message}
                pending={streaming && message.id === lastMessageId}
                userInitials={userInitials}
                onRate={(target, rating) => void rateMessage(target, rating)}
                onCopyFailed={() => setError(t("assistant.copyFailed"))}
              />
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={(event) => void sendMessage(event)}
            streaming={streaming}
            compact={embedded}
          />
        </div>
      </section>
    </div>
  );
}
