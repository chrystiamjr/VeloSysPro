import React from 'react';
import { Button } from '../atoms/Button';
import { BackupItem } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface BackupPageProps {
  backups: BackupItem[];
  onCreateBackup: () => void;
  onRestoreBackup: (name: string) => void;
  onOpenFolder: () => void;
}

/**
 * Functional Backup & Restore screen: lists registry backups exposed by the C# host
 * (getBackups), creates new ones, and restores a selected backup after confirmation.
 */
export const BackupPage: React.FC<BackupPageProps> = ({
  backups,
  onCreateBackup,
  onRestoreBackup,
  onOpenFolder,
}) => {
  const { t } = useTranslation();

  const handleRestore = (name: string) => {
    if (window.confirm(t('backupRestoreConfirm'))) {
      onRestoreBackup(name);
    }
  };

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">{t('backupSectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('backupSectionDesc')}</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant="info" className="w-auto px-5" onClick={onCreateBackup}>
              💾 {t('backupCreateBtn')}
            </Button>
            <Button variant="primary" className="w-auto px-5" onClick={onOpenFolder}>
              📂 {t('backupOpenFolderBtn')}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-borderColor bg-bgCard">
        {backups.length === 0 ? (
          <p className="p-8 text-center text-xs text-textMuted">{t('backupEmpty')}</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-borderColor text-textMuted">
                <th className="px-5 py-3 font-semibold">{t('backupColName')}</th>
                <th className="px-5 py-3 font-semibold">{t('backupColDate')}</th>
                <th className="px-5 py-3 font-semibold">{t('backupColSize')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('backupColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr
                  key={backup.Name}
                  className="border-b border-borderColor/50 last:border-none hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-mono text-textMain">{backup.Name}</td>
                  <td className="px-5 py-3 text-textMuted">{backup.Date}</td>
                  <td className="px-5 py-3 text-textMuted">{backup.Size}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="warning"
                      className="w-auto px-4 py-2"
                      onClick={() => handleRestore(backup.Name)}
                    >
                      ↺ {t('backupRestoreBtn')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
