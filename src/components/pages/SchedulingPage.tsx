import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { DataTable, DataTableColumn } from '../organisms/DataTable';
import { ScheduledTaskItem } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SchedulingPageProps {
  tasks: ScheduledTaskItem[];
  onCreateTask: (payload: string) => void;
  onDeleteTask: (name: string) => void;
  disabled?: boolean;
}

const OPT_TYPES = [
  { value: 'quick', labelKey: 'act.quick.title' },
  { value: 'full', labelKey: 'act.full.title' },
  { value: 'gaming', labelKey: 'act.gaming.title' },
  { value: 'revert', labelKey: 'act.revert.title' },
] as const;

const FREQUENCIES = [
  { value: 'DAILY', labelKey: 'scheduling.freqDaily' },
  { value: 'WEEKLY', labelKey: 'scheduling.freqWeekly' },
  { value: 'MONTHLY', labelKey: 'scheduling.freqMonthly' },
] as const;

const selectClass =
  'w-full rounded-lg border border-borderColor bg-bgMain px-3.5 py-2.5 text-xs text-textMain outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20';

export const SchedulingPage: React.FC<SchedulingPageProps> = ({
  tasks,
  onCreateTask,
  onDeleteTask,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [type, setType] = useState<string>('quick');
  const [frequency, setFrequency] = useState<string>('DAILY');
  const [time, setTime] = useState<string>('03:00');

  const handleCreate = () => {
    onCreateTask(JSON.stringify({ type, frequency, time }));
  };

  const handleDelete = (name: string) => {
    if (window.confirm(t('scheduling.deleteConfirm'))) {
      onDeleteTask(name);
    }
  };

  const columns: DataTableColumn<ScheduledTaskItem>[] = [
    {
      key: 'name',
      header: t('scheduling.colName'),
      className: 'font-mono text-textMain',
      sortValue: (task) => task.Name,
      render: (task) => task.Name,
    },
    {
      key: 'state',
      header: t('scheduling.colState'),
      sortValue: (task) => task.State,
      render: (task) => task.State,
    },
    {
      key: 'actions',
      header: t('scheduling.colActions'),
      align: 'right',
      render: (task) => (
        <Button
          testId={`task-delete-${task.Name}`}
          variant="danger"
          className="ml-auto flex w-auto items-center gap-1.5 px-4 py-2"
          disabled={disabled}
          onClick={() => handleDelete(task.Name)}
        >
          <Icon name="trash" /> {t('scheduling.deleteBtn')}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex select-none flex-col gap-6">
      {/* Create form */}
      <div className="flex flex-col gap-5 rounded-xl border border-borderColor bg-bgCard p-6">
        <div>
          <h3 className="text-lg font-bold text-white">{t('scheduling.formTitle')}</h3>
          <p className="mt-1 text-xs text-textMuted">{t('scheduling.formDesc')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-textMuted">
              {t('scheduling.typeLabel')}
            </span>
            <select
              data-cy="task-type"
              className={selectClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {OPT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-textMuted">
              {t('scheduling.freqLabel')}
            </span>
            <select
              data-cy="task-frequency"
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
              {t('scheduling.timeLabel')}
            </span>
            <input
              data-cy="task-time"
              type="time"
              className={selectClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>

        <Button
          testId="task-create"
          variant="success"
          className="items-center gap-2 px-5"
          disabled={disabled}
          onClick={handleCreate}
        >
          <Icon name="calendar" /> {t('scheduling.createBtn')}
        </Button>
      </div>

      {/* Task list */}
      <DataTable
        testId="tasks-table"
        columns={columns}
        rows={tasks}
        rowKey={(task) => task.Name}
        emptyMessage={t('scheduling.empty')}
        initialSort={{ key: 'name', dir: 'asc' }}
      />
    </div>
  );
};
