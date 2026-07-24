import React from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { RestorePointItem } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface RestorePointsPageProps {
  points: RestorePointItem[];
  onCreatePoint: () => void;
  onRestore: (sequence: number) => void;
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
  disabled = false,
}) => {
  const { t } = useTranslation();

  const handleRestore = (sequence: number) => {
    if (window.confirm(t('rp.restoreConfirm1')) && window.confirm(t('rp.restoreConfirm2'))) {
      onRestore(sequence);
    }
  };

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

      <div className="overflow-x-auto rounded-xl border border-borderColor bg-bgCard">
        {points.length === 0 ? (
          <p className="p-8 text-center text-xs text-textMuted">{t('rp.empty')}</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-borderColor text-textMuted">
                <th className="px-5 py-3 font-semibold">{t('rp.colSeq')}</th>
                <th className="px-5 py-3 font-semibold">{t('rp.colDate')}</th>
                <th className="px-5 py-3 font-semibold">{t('rp.colDescription')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('rp.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr
                  key={point.Sequence}
                  className="border-b border-borderColor/50 last:border-none hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-mono text-textMain">{point.Sequence}</td>
                  <td className="px-5 py-3 text-textMuted">{point.Date}</td>
                  <td className="px-5 py-3 text-textMuted">{point.Description}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      testId={`restore-point-restore-${point.Sequence}`}
                      variant="warning"
                      className="ml-auto flex w-auto items-center gap-1.5 px-4 py-2"
                      disabled={disabled}
                      onClick={() => handleRestore(point.Sequence)}
                    >
                      <Icon name="rotate-ccw" /> {t('rp.restoreBtn')}
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
