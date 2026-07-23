import React from 'react';
import { Button } from '../atoms/Button';
import { RestorePointItem } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface RestorePointsPageProps {
  points: RestorePointItem[];
  onCreatePoint: () => void;
  onRestore: (sequence: number) => void;
}

/**
 * System Restore Points screen: list, create, and roll back to a restore point.
 * Rolling back reboots the machine, so it is gated behind a double confirmation.
 */
export const RestorePointsPage: React.FC<RestorePointsPageProps> = ({
  points,
  onCreatePoint,
  onRestore,
}) => {
  const { t } = useTranslation();

  const handleRestore = (sequence: number) => {
    if (window.confirm(t('rpRestoreConfirm1')) && window.confirm(t('rpRestoreConfirm2'))) {
      onRestore(sequence);
    }
  };

  return (
    <div className="flex select-none flex-col gap-6">
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">{t('rpSectionTitle')}</h3>
            <p className="mt-1 text-xs text-textMuted">{t('rpSectionDesc')}</p>
          </div>
          <Button variant="pink" className="w-auto shrink-0 px-5" onClick={onCreatePoint}>
            🛡️ {t('rpCreateBtn')}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-borderColor bg-bgCard">
        {points.length === 0 ? (
          <p className="p-8 text-center text-xs text-textMuted">{t('rpEmpty')}</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-borderColor text-textMuted">
                <th className="px-5 py-3 font-semibold">{t('rpColSeq')}</th>
                <th className="px-5 py-3 font-semibold">{t('rpColDate')}</th>
                <th className="px-5 py-3 font-semibold">{t('rpColDescription')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('rpColActions')}</th>
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
                      variant="warning"
                      className="w-auto px-4 py-2"
                      onClick={() => handleRestore(point.Sequence)}
                    >
                      ↺ {t('rpRestoreBtn')}
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
