import { create } from "zustand";
import { en } from "./i18n/en";
import { zh } from "./i18n/zh";
import { setOwnedLocalStorageItem } from "./system/persistenceGate";

export type Language = "zh" | "en";
export type TranslationKey = keyof typeof zh;
type Translate = (key: TranslationKey) => string;

const LANGUAGE_STORAGE_KEY = "neko-virt-os.language.v1";

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

const translateZh: Translate = (key) => zh[key];
const translateEn: Translate = (key) => en[key];

function translateFor(language: Language): Translate {
  return language === "zh" ? translateZh : translateEn;
}

const initialLanguage = readLanguage();

export const useLanguageStore = create<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
}>((set) => ({
  language: initialLanguage,
  setLanguage: (language) => {
    setOwnedLocalStorageItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    set({ language, t: translateFor(language) });
  },
  t: translateFor(initialLanguage),
}));

document.documentElement.lang = initialLanguage === "zh" ? "zh-CN" : "en";
