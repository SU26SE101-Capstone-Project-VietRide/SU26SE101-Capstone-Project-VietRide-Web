import { useTranslation } from "react-i18next";
import { FiGlobe } from "react-icons/fi";
import {
  SUPPORTED_LANGUAGES,
  type AppLanguage,
  LANGUAGE_STORAGE_KEY,
} from "../i18n";

type LanguageSwitcherProps = {
  compact?: boolean;
};

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation("common");
  const current = (i18n.language?.startsWith("en") ? "en" : "vi") as AppLanguage;

  const switchLanguage = (lang: AppLanguage) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 ${
        compact ? "" : ""
      }`}
      role="group"
      aria-label={t("language.label")}
    >
      {!compact && (
        <span className="hidden items-center gap-1 px-2 text-xs text-gray-500 lg:flex">
          <FiGlobe size={14} />
          {t("language.label")}
        </span>
      )}
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => switchLanguage(lang)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            current === lang
              ? "bg-white text-vr-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-pressed={current === lang}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
