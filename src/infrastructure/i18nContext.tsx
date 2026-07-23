import React, { createContext, useContext, useState } from 'react';
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

  const setLang = (newLang: Language) => {
    i18n.locale(newLang);
    setLangState(newLang);
  };

  const t = (key: string, params?: Record<string, unknown> | unknown[]): string => {
    return i18n.t(key, params) || key;
  };

  const value = {
    lang,
    setLang,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = () => useContext(LanguageContext);
