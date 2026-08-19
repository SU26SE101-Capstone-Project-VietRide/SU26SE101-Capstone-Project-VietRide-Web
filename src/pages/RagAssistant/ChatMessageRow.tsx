import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheck,
  FiCopy,
  FiCpu,
  FiFileText,
  FiThumbsDown,
  FiThumbsUp,
} from "react-icons/fi";

import MarkdownAnswer from "../../components/MarkdownAnswer";
import TypingDots from "./TypingDots";
import type { ChatMessage } from "./types";

type ChatMessageRowProps = {
  message: ChatMessage;
  /** Trợ lý đang stream câu trả lời cho tin nhắn này */
  pending: boolean;
  /** Chữ viết tắt của người dùng để vẽ avatar */
  userInitials: string;
  onRate: (message: ChatMessage, rating: -1 | 1) => void;
  onCopyFailed: () => void;
};

const avatarClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold";
const actionButtonClass =
  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition";

function formatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ChatMessageRow({
  message,
  pending,
  userInitials,
  onRate,
  onCopyFailed,
}: ChatMessageRowProps) {
  const { t, i18n } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const locale = i18n.language?.startsWith("en") ? "en-US" : "vi-VN";
  const sourceCount = message.citedChunkIds?.length ?? 0;

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopyFailed();
    }
  }

  return (
    <div
      className={`chat-message-in flex items-end gap-2.5 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div
        className={`${avatarClass} ${
          isUser ? "bg-slate-200 text-slate-600" : "bg-vr-100 text-vr-800"
        }`}
        aria-hidden="true"
      >
        {isUser ? userInitials : <FiCpu className="h-4 w-4" />}
      </div>

      <div className={`flex min-w-0 max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Bo góc lệch về phía avatar — bong bóng "dính" vào người nói thay vì
            là một hình chữ nhật trôi nổi. */}
        <div
          className={`min-w-0 px-4 py-2.5 text-sm leading-6 shadow-sm ${
            isUser
              ? "rounded-2xl rounded-br-md bg-vr-800 text-white"
              : "rounded-2xl rounded-bl-md border border-gray-100 bg-white text-slate-700"
          }`}
        >
          {message.content ? (
            isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <MarkdownAnswer content={message.content} />
            )
          ) : pending ? (
            <span className="flex items-center gap-2 text-gray-500">
              <TypingDots />
              <span className="text-xs">{t("assistant.thinking")}</span>
            </span>
          ) : (
            <p className="text-gray-500">—</p>
          )}
        </div>

        <div
          className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-gray-600 ${
            isUser ? "flex-row-reverse" : ""
          }`}
        >
          <span>{isUser ? t("assistant.you") : t("assistant.title")}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatTime(message.createdAt, locale)}</span>
          {sourceCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-vr-50 px-2 py-0.5 font-medium text-vr-800">
              <FiFileText className="h-3 w-3" aria-hidden="true" />
              {t("assistant.sources", { value: sourceCount })}
            </span>
          )}
        </div>

        {message.role === "assistant" && message.assistantMessageId && (
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => void copyAnswer()}
              className={`${actionButtonClass} text-gray-500 hover:bg-gray-100 hover:text-gray-700`}
              title={t("assistant.copy")}
            >
              {copied ? (
                <FiCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied ? t("assistant.copied") : t("assistant.copy")}
            </button>
            <button
              type="button"
              onClick={() => onRate(message, 1)}
              className={`${actionButtonClass} ${
                message.rating === 1
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-600"
              }`}
              aria-label={t("assistant.helpful")}
              aria-pressed={message.rating === 1}
              title={t("assistant.helpful")}
            >
              <FiThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRate(message, -1)}
              className={`${actionButtonClass} ${
                message.rating === -1
                  ? "bg-rose-50 text-rose-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-600"
              }`}
              aria-label={t("assistant.notHelpful")}
              aria-pressed={message.rating === -1}
              title={t("assistant.notHelpful")}
            >
              <FiThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
