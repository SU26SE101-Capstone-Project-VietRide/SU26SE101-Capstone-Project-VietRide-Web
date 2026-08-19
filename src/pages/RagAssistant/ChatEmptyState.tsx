import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiMessageSquare } from "react-icons/fi";

type ChatEmptyStateProps = {
  /** Bố cục gọn khi chat nằm trong bong bóng nổi, rộng rãi khi ở màn riêng */
  compact: boolean;
  onPickStarter: (question: string) => void;
};

const STARTER_KEYS = [
  "assistant.starterVoucher",
  "assistant.starterDisruption",
  "assistant.starterSettlement",
] as const;

export default function ChatEmptyState({
  compact,
  onPickStarter,
}: ChatEmptyStateProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex h-full flex-col items-center justify-center px-1 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-vr-100 text-vr-800">
        <FiMessageSquare className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mt-4 text-base font-bold text-slate-900">
        {t("assistant.emptyTitle")}
      </p>
      {!compact && (
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
          {t("assistant.emptyDescription")}
        </p>
      )}

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
        {t("assistant.starterLabel")}
      </p>
      <div className="mt-2 flex w-full max-w-md flex-col gap-2">
        {STARTER_KEYS.map((key) => {
          const question = t(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickStarter(question)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-vr-300 hover:bg-vr-50 hover:text-vr-900"
            >
              <span className="min-w-0">{question}</span>
              <FiArrowUpRight
                className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-vr-900"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
