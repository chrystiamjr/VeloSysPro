import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { DataTable, DataTableColumn } from '../organisms/DataTable';
import { BackupItem } from '../../domain/types';
import { formatBytes, formatDateTime, timestampValue } from '../../domain/formatters';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface BackupPageProps {
  backups: BackupItem[];
  onCreateBackup: () => void;
  onRestoreBackup: (name: string) => void;
  onOpenFolder: () => void;
  onRefresh?: () => void;
  disabled?: boolean;
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
  onRefresh,
  disabled = false,
}) => {
  const { t, lang } = useTranslation();

  const handleRestore = (name: string) => {
    if (window.confirm(t('backup.restoreConfirm'))) {
      onRestoreBackup(name);
    }
  };

  const columns: DataTableColumn<BackupItem>[] = [
    {
      key: 'name',
      header: t('backup.colName'),
      className: 'font-mono text-textMain',
      sortValue: (backup) => backup.Name,
      render: (backup) => backup.Name,
    },
    {
      key: 'date',
      header: t('backup.colDate'),
      sortValue: (backup) => timestampValue(backup.CreatedAt),
      render: (backup) => formatDateTime(backup.CreatedAt, lang),
    },
    {
      key: 'size',
      header: t('backup.colSize'),
      sortValue: (backup) => backup.SizeBytes,
      render: (backup) => formatBytes(backup.SizeBytes, lang),
    },
    {
      key: 'actions',
      header: t('backup.colActions'),
      align: 'right',
      render: (backup) => (
        <Button
          testId={`backup-restore-${backup.Name}`}
          variant="warning"
          className="ml-auto flex w-auto items-center gap-1.5 px-4 py-2"
          disabled={disabled}
          onClick={() => handleRestore(backup.Name)}
        >
          <Icon name="rotate-ccw" /> {t('backup.restoreBtn')}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-bold text-white">{t('backup.sectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('backup.sectionDesc')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              testId="backup-create"
              variant="info"
              className="items-center gap-2 px-5"
              disabled={disabled}
              onClick={onCreateBackup}
            >
              <Icon name="hard-drive" /> {t('backup.createBtn')}
            </Button>
            <Button
              testId="backup-open-folder"
              variant="primary"
              className="items-center gap-2 px-5"
              onClick={onOpenFolder}
            >
              <Icon name="folder-open" /> {t('backup.openFolderBtn')}
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        testId="backups-table"
        columns={columns}
        rows={backups}
        rowKey={(backup) => backup.Name}
        emptyMessage={t('backup.empty')}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRefresh={onRefresh}
        disabled={disabled}
      />
    </div>
  );
};
