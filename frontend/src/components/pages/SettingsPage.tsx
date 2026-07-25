import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { UpdateInfo } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SettingsPageProps {
  language: 'pt_BR' | 'en_US';
  createBackupBeforeOptimize: boolean;
  onLanguageChange: (language: 'pt_BR' | 'en_US') => void;
  onToggleBackup: (value: boolean) => void;
  /** Pending update reported by the host, or null when the app is up to date. */
  updateInfo?: UpdateInfo | null;
  onDownloadUpdate?: (url: string) => void;
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
  updateInfo = null,
  onDownloadUpdate,
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
            data-cy="language-pt"
            className={langButtonClass(language === 'pt_BR')}
            onClick={() => onLanguageChange('pt_BR')}
          >
            🇧🇷 {t('settings.langPt')}
          </button>
          <button
            data-cy="language-en"
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
              data-cy="safety-backup-toggle"
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

      {/* Updates — the permanent home for a release the user dismissed on the banner. */}
      <div
        data-cy="settings-update"
        className="flex flex-col gap-5 rounded-xl border border-borderColor bg-bgCard p-6"
      >
        <div>
          <h3 className="text-lg font-bold text-white">{t('settings.updateTitle')}</h3>
          <p className="mt-1 text-xs text-textMuted">{t('settings.updateDesc')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-textMuted">
            {t('settings.updateCurrent')}
          </span>
          <span className="text-xs font-semibold text-textMain">{t('brand.version')}</span>
        </div>

        {updateInfo ? (
          <>
            <span
              data-cy="settings-update-available"
              className="flex items-center gap-2 text-xs font-semibold text-primary"
            >
              <Icon name="info" className="h-4 w-4" />
              {t('settings.updateAvailable', { version: updateInfo.version })}
            </span>
            <Button
              testId="settings-update-download"
              variant="primary"
              className="items-center gap-2 px-5"
              onClick={() => onDownloadUpdate?.(updateInfo.url)}
            >
              <Icon name="rocket" /> {t('updateBanner.btn')}
            </Button>
          </>
        ) : (
          <span
            data-cy="settings-update-latest"
            className="flex items-center gap-2 text-xs font-semibold text-success"
          >
            <Icon name="check-circle" className="h-4 w-4" />
            {t('settings.updateLatest')}
          </span>
        )}
      </div>
    </div>
  );
};
