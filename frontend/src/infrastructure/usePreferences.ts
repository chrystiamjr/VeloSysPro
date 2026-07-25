import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings } from '../domain/types';
import { SystemActions } from '../domain/types';
import { sendAction, subscribeSettings } from './bridge';
import type { Language } from '../domain/i18n';

const defaults: AppSettings = {
  language: 'pt_BR',
  createBackupBeforeOptimize: true,
  sidebarCollapsed: false,
};

export interface Preferences {
  settings: AppSettings;
  setLanguage: (language: Language) => void;
  setSafetyBackup: (enabled: boolean) => void;
  toggleSidebar: () => void;
}

export function usePreferences(applyLanguage: (language: Language) => void): Preferences {
  const [settings, setSettings] = useState(defaults);
  const hydrated = useRef(false);

  const persist = useCallback((next: AppSettings) => {
    setSettings(next);
    sendAction(SystemActions.SAVE_SETTINGS, next);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSettings((loaded) => {
      setSettings(loaded);
      applyLanguage(loaded.language);
      hydrated.current = true;
    });
    sendAction(SystemActions.GET_SETTINGS);
    return unsubscribe;
  }, [applyLanguage]);

  const setLanguage = useCallback(
    (language: Language) => {
      applyLanguage(language);
      if (!hydrated.current) return;
      persist({ ...settings, language });
    },
    [applyLanguage, persist, settings]
  );

  const setSafetyBackup = useCallback(
    (enabled: boolean) => {
      persist({ ...settings, createBackupBeforeOptimize: enabled });
    },
    [persist, settings]
  );

  const toggleSidebar = useCallback(() => {
    persist({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed });
  }, [persist, settings]);

  return { settings, setLanguage, setSafetyBackup, toggleSidebar };
}
