import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import viCommon from "./locales/vi/common.json";
import enCommon from "./locales/en/common.json";
import viNav from "./locales/vi/nav.json";
import enNav from "./locales/en/nav.json";
import viLogin from "./locales/vi/login.json";
import enLogin from "./locales/en/login.json";
import viAdmin from "./locales/vi/admin.json";
import enAdmin from "./locales/en/admin.json";
import viManager from "./locales/vi/manager.json";
import enManager from "./locales/en/manager.json";

export const SUPPORTED_LANGUAGES = ["vi", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "vietride_lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: {
        common: viCommon,
        nav: viNav,
        login: viLogin,
        admin: viAdmin,
        manager: viManager,
      },
      en: {
        common: enCommon,
        nav: enNav,
        login: enLogin,
        admin: enAdmin,
        manager: enManager,
      },
    },
    fallbackLng: "vi",
    defaultNS: "common",
    ns: ["common", "nav", "login", "admin", "manager"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
  });

document.documentElement.lang = i18n.language?.startsWith("en") ? "en" : "vi";

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng.startsWith("en") ? "en" : "vi";
});

export default i18n;
