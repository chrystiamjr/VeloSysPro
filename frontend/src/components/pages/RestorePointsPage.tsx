import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { DataTable, DataTableColumn } from '../organisms/DataTable';
import { RestorePointItem } from '../../domain/types';
import { formatDateTime, timestampValue } from '../../domain/formatters';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface RestorePointsPageProps {
  points: RestorePointItem[];
  onCreatePoint: () => void;
  onRestore: (sequence: number) => void;
  onRefresh?: () => void;
  disabled?: boolean;
}

/**
 * System Restore Points screen: list, create, and roll back to a restore point.
 * Rolling back reboots the machine, so it is gated behind a double confirmation.
 */
export const RestorePointsPage: React.FC<RestorePointsPageProps> = ({
  points,
  onCreatePoint,
  onRestore,
  onRefresh,
  disabled = false,
}) => {
  const { t, lang } = useTranslation();

  const handleRestore = (sequence: number) => {
    if (window.confirm(t('rp.restoreConfirm1')) && window.confirm(t('rp.restoreConfirm2'))) {
      onRestore(sequence);
    }
  };

  const columns: DataTableColumn<RestorePointItem>[] = [
    {
      key: 'seq',
      header: t('rp.colSeq'),
      className: 'font-mono text-textMain',
      sortValue: (point) => point.Sequence,
      render: (point) => point.Sequence,
    },
    {
      key: 'date',
      header: t('rp.colDate'),
      sortValue: (point) => timestampValue(point.CreatedAt),
      render: (point) => formatDateTime(point.CreatedAt, lang),
    },
    {
      key: 'description',
      header: t('rp.colDescription'),
      sortValue: (point) => point.Description,
      render: (point) => point.Description,
    },
    {
      key: 'actions',
      header: t('rp.colActions'),
      align: 'right',
      render: (point) => (
        <Button
          testId={`restore-point-restore-${point.Sequence}`}
          variant="warning"
          className="ml-auto flex w-auto items-center gap-1.5 px-4 py-2"
          disabled={disabled}
          onClick={() => handleRestore(point.Sequence)}
        >
          <Icon name="rotate-ccw" /> {t('rp.restoreBtn')}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-bold text-white">{t('rp.sectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('rp.sectionDesc')}</p>
          </div>
          <Button
            testId="restore-point-create"
            variant="pink"
            className="items-center gap-2 px-5"
            disabled={disabled}
            onClick={onCreatePoint}
          >
            <Icon name="shield-check" /> {t('rp.createBtn')}
          </Button>
        </div>
      </div>

      <DataTable
        testId="restore-points-table"
        columns={columns}
        rows={points}
        rowKey={(point) => point.Sequence}
        emptyMessage={t('rp.empty')}
        initialSort={{ key: 'seq', dir: 'desc' }}
        onRefresh={onRefresh}
        disabled={disabled}
      />
    </div>
  );
};
