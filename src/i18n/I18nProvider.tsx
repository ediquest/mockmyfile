import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import type { I18nKey, Lang } from './translations';
import { translations } from './translations';

type I18nContextValue = {
  lang: Lang;
  setLang: (value: Lang) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const LANG_STORAGE_KEY = 'messagelab.lang';

const detectLang = (): Lang => {
  if (typeof window === 'undefined') return 'pl';
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'pl' || stored === 'en') return stored;
  const browser = window.navigator.language?.toLowerCase();
  if (browser && browser.startsWith('en')) return 'en';
  return 'pl';
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  const setLang = (value: Lang) => {
    setLangState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANG_STORAGE_KEY, value);
    }
  };

  const t = useMemo(() => {
    const dict = translations[lang];
    return (key: I18nKey, vars?: Record<string, string | number>) => {
      let text: string = dict[key] ?? translations.pl[key] ?? String(key);
      if (vars) {
        Object.entries(vars).forEach(([token, value]) => {
          text = text.replaceAll(`{${token}}`, String(value));
        });
      }
      return text;
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
