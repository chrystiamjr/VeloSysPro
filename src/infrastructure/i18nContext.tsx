import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Language, i18n } from '../domain/i18n';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, unknown> | unknown[]) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'pt_BR',
  setLang: () => {},
  t: (key: string) => i18n.t(key),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('pt_BR');

  // Stable identity matters: consumers list `setLang` in effect dependencies, so recreating it
  // on every render made a mount-only effect re-run and re-request all host data.
  const setLang = useCallback((newLang: Language) => {
    i18n.locale(newLang);
    setLangState(newLang);
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      // Recreated per locale so consumers re-render with the new translations.
      t: (key: string, params?: Record<string, unknown> | unknown[]): string =>
        i18n.t(key, params) || key,
    }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = () => useContext(LanguageContext);
