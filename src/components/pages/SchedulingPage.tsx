import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { ScheduledTaskItem } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SchedulingPageProps {
  tasks: ScheduledTaskItem[];
  onCreateTask: (payload: string) => void;
  onDeleteTask: (name: string) => void;
}

const OPT_TYPES = [
  { value: 'quick', labelKey: 'actQuickTitle' },
  { value: 'full', labelKey: 'actFullTitle' },
  { value: 'gaming', labelKey: 'actGamingTitle' },
  { value: 'revert', labelKey: 'actRevertTitle' },
] as const;

const FREQUENCIES = [
  { value: 'DAILY', labelKey: 'schedFreqDaily' },
  { value: 'WEEKLY', labelKey: 'schedFreqWeekly' },
  { value: 'MONTHLY', labelKey: 'schedFreqMonthly' },
] as const;

const selectClass =
  'rounded-lg border border-borderColor bg-bgMain px-3.5 py-2.5 text-xs text-textMain outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20';

export const SchedulingPage: React.FC<SchedulingPageProps> = ({
  tasks,
  onCreateTask,
  onDeleteTask,
}) => {
  const { t } = useTranslation();
  const [type, setType] = useState<string>('quick');
  const [frequency, setFrequency] = useState<string>('DAILY');
  const [time, setTime] = useState<string>('03:00');

  const handleCreate = () => {
    onCreateTask(JSON.stringify({ type, frequency, time }));
  };

  const handleDelete = (name: string) => {
    if (window.confirm(t('schedulingDeleteConfirm'))) {
      onDeleteTask(name);
    }
  };

  return (
    <div className="flex select-none flex-col gap-6">
      {/* Create form */}
      <div className="rounded-xl border border-borderColor bg-bgCard p-6">
        <h3 className="text-lg font-bold text-white">{t('schedulingFormTitle')}</h3>
        <p className="mt-1 text-xs text-textMuted">{t('schedulingFormDesc')}</p>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-textMuted">
              {t('schedulingTypeLabel')}
            </span>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              {OPT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-textMuted">
              {t('schedulingFreqLabel')}
            </span>
            <select
              className={selectClass}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-textMuted">
              {t('schedulingTimeLabel')}
            </span>
            <input
              type="time"
              className={selectClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>

          <Button variant="success" className="w-auto px-5" onClick={handleCreate}>
            📅 {t('schedulingCreateBtn')}
          </Button>
        </div>
      </div>

      {/* Task list */}
      <div className="overflow-hidden rounded-xl border border-borderColor bg-bgCard">
        {tasks.length === 0 ? (
          <p className="p-8 text-center text-xs text-textMuted">{t('schedulingEmpty')}</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-borderColor text-textMuted">
                <th className="px-5 py-3 font-semibold">{t('schedulingColName')}</th>
                <th className="px-5 py-3 font-semibold">{t('schedulingColState')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('schedulingColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.Name}
                  className="border-b border-borderColor/50 last:border-none hover:bg-white/5"
                >
                  <td className="px-5 py-3 font-mono text-textMain">{task.Name}</td>
                  <td className="px-5 py-3 text-textMuted">{task.State}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="danger"
                      className="w-auto px-4 py-2"
                      onClick={() => handleDelete(task.Name)}
                    >
                      🗑️ {t('schedulingDeleteBtn')}
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
