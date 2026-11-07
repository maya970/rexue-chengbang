import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { helpOf, type HelpSection } from "./help";
import {
  applyDocumentLocale,
  detectLocale,
  LOCALES,
  persistLocale,
  type LocaleId,
} from "./locales";
import { tUi, type UiKey } from "./ui";

export type I18n = {
  locale: LocaleId;
  setLocale: (id: LocaleId) => void;
  t: (key: UiKey) => string;
  help: HelpSection[];
  locales: typeof LOCALES;
};

const LocaleContext = createContext<I18n | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(() => detectLocale());

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const value = useMemo<I18n>(() => ({
    locale,
    setLocale(id) {
      setLocaleState(id);
      persistLocale(id);
      applyDocumentLocale(id);
    },
    t: (key) => tUi(locale, key),
    help: helpOf(locale),
    locales: LOCALES,
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n needs LocaleProvider");
  return ctx;
}

export function LangSelect({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, locales, t } = useI18n();
  return (
    <label className={`lang-select${compact ? " compact" : ""}`}>
      {compact ? null : <span className="muted">{t("language")}</span>}
      <select
        value={locale}
        aria-label={t("language")}
        onChange={(e) => setLocale(e.target.value as LocaleId)}
      >
        {locales.map((l) => (
          <option key={l.id} value={l.id}>{l.native}</option>
        ))}
      </select>
    </label>
  );
}

export { LOCALES, type LocaleId } from "./locales";
export type { UiKey } from "./ui";
export type { HelpSection } from "./help";
