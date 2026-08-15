import { useEffect, useRef, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiSend } from "react-icons/fi";

export const MESSAGE_MAX_LENGTH = 4000;

/** Ô nhập cao tối đa ~6 dòng rồi tự cuộn, không đẩy khung chat co lại nữa. */
const MAX_TEXTAREA_HEIGHT = 148;

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  streaming: boolean;
  compact: boolean;
};

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  streaming,
  compact,
}: ChatComposerProps) {
  const { t } = useTranslation("common");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tự giãn theo nội dung: gõ một dòng thì ô cao một dòng, không phải hộp
  // vuông cứng chiếm sẵn ba dòng như trước.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !streaming;

  return (
    <form onSubmit={onSubmit} className={compact ? "p-3" : "p-4"}>
      <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-vr-500 focus-within:ring-4 focus-within:ring-vr-500/15">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-gray-400"
          placeholder={t("assistant.placeholder")}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vr-500 text-white shadow-sm transition hover:bg-vr-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          aria-label={t("send", { defaultValue: "Gửi" })}
          title={t("send", { defaultValue: "Gửi" })}
        >
          {streaming ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <FiSend className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-gray-400">{t("assistant.composerHint")}</p>
        {value.length > MESSAGE_MAX_LENGTH * 0.8 && (
          <p className="text-[11px] tabular-nums text-gray-400">
            {value.length}/{MESSAGE_MAX_LENGTH}
          </p>
        )}
      </div>
    </form>
  );
}
