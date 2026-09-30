import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

import { setApiLanguage } from '@/api/client';
import ar from './ar';
import en from './en';
import fr, { type Lang, type TranslationTree } from './fr';
import { getLanguage, setLanguage as persistLanguage } from '@/storage/language';
import { applyRtlAndReload } from '@/utils/rtl';

const catalogs: Record<Lang, TranslationTree> = { fr, en, ar };

type Params = Record<string, string | number>;

type LanguageContextValue = {
  ready: boolean;
  lang: Lang;
  isRTL: boolean;
  hasChosenLanguage: boolean;
  t: (key: string, params?: Params) => string;
  setLang: (lang: Lang) => Promise<boolean>;
  confirmLanguage: (lang: Lang) => Promise<boolean>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectDeviceLang(): Lang {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() ?? 'fr';
  if (code === 'ar' || code === 'en' || code === 'fr') {
    return code;
  }
  return 'fr';
}

function lookup(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | TranslationTree | undefined = tree;
  for (const part of parts) {
    if (current === undefined || typeof current === 'string') {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

export function LanguageProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>('fr');
  const [hasChosenLanguage, setHasChosenLanguage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getLanguage();
      if (cancelled) {
        return;
      }
      if (stored) {
        setLangState(stored);
        setHasChosenLanguage(true);
      } else {
        setLangState(detectDeviceLang());
        setHasChosenLanguage(false);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const t = useCallback(
    (key: string, params?: Params) => {
      const value =
        lookup(catalogs[lang], key) ?? lookup(catalogs.fr, key) ?? key;
      return interpolate(value, params);
    },
    [lang],
  );

  useEffect(() => {
    setApiLanguage(lang);
  }, [lang]);

  const applyLanguage = useCallback(async (next: Lang, persist: boolean) => {
    if (persist) {
      await persistLanguage(next);
      setHasChosenLanguage(true);
    }
    setLangState(next);
    setApiLanguage(next);
    const shouldRtl = next === 'ar';
    const message =
      (lookup(catalogs[next], 'rtlRestart') as string | undefined) ??
      "L'application va redémarrer";
    return applyRtlAndReload(shouldRtl, message);
  }, []);

  const setLang = useCallback(
    async (next: Lang) => applyLanguage(next, true),
    [applyLanguage],
  );

  const confirmLanguage = useCallback(
    async (next: Lang) => applyLanguage(next, true),
    [applyLanguage],
  );

  const value = useMemo(
    () => ({
      ready,
      lang,
      isRTL: lang === 'ar' || I18nManager.isRTL,
      hasChosenLanguage,
      t,
      setLang,
      confirmLanguage,
    }),
    [ready, lang, hasChosenLanguage, t, setLang, confirmLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{props.children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

export function statusLabel(t: (key: string) => string, code: string): string {
  const key = `status.${code}`;
  const label = t(key);
  return label === key ? code : label;
}
