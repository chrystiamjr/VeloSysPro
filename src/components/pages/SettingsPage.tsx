import React from 'react';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SettingsPageProps {
  language: 'pt_BR' | 'en_US';
  createBackupBeforeOptimize: boolean;
  onLanguageChange: (language: 'pt_BR' | 'en_US') => void;
  onToggleBackup: (value: boolean) => void;
}

const langButtonClass = (active: boolean) =>
  `cursor-pointer rounded-lg border px-4 py-2 text-xs font-bold transition-all ${
    active
      ? 'border-primary bg-primary text-white'
      : 'border-borderColor bg-bgMain text-textMuted hover:text-white'
  }`;

export const SettingsPage: React.FC<SettingsPageProps> = ({
  language,
  createBackupBeforeOptimize,
  onLanguageChange,
  onToggleBackup,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex select-none flex-col gap-6">
      {/* Language */}
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <h3 className="text-lg font-bold text-white">{t('settings.languageTitle')}</h3>
        <p className="mt-1 text-xs text-textMuted">{t('settings.languageDesc')}</p>
        <div className="mt-4 flex gap-3">
          <button
            className={langButtonClass(language === 'pt_BR')}
            onClick={() => onLanguageChange('pt_BR')}
          >
            🇧🇷 {t('settings.langPt')}
          </button>
          <button
            className={langButtonClass(language === 'en_US')}
            onClick={() => onLanguageChange('en_US')}
          >
            🇺🇸 {t('settings.langEn')}
          </button>
        </div>
      </div>

      {/* Safety backup toggle */}
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">{t('settings.backupTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('settings.backupDesc')}</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-1">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={createBackupBeforeOptimize}
              onChange={(e) => onToggleBackup(e.target.checked)}
            />
            <span className="text-xs font-semibold text-textMain">
              {createBackupBeforeOptimize ? t('settings.enabled') : t('settings.disabled')}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
