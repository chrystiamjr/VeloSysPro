import React, { useState } from 'react';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { DataTable, DataTableColumn } from '../organisms/DataTable';
import { ScheduledTaskItem } from '../../domain/types';
import {
  FREQUENCIES,
  MONTH_DAYS,
  OPT_TYPES,
  WEEKDAYS,
  describeSchedule,
  describeTaskState,
  taskDisplayName,
} from '../../domain/scheduling';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SchedulingPageProps {
  tasks: ScheduledTaskItem[];
  onCreateTask: (payload: string) => void;
  onDeleteTask: (name: string) => void;
  disabled?: boolean;
}

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
  const [weekday, setWeekday] = useState<string>('MON');
  const [monthDay, setMonthDay] = useState<string>('1');

  // The host ignores `day` for DAILY, but sending the active selection keeps the payload
  // aligned with what the form shows.
  const day = frequency === 'WEEKLY' ? weekday : frequency === 'MONTHLY' ? monthDay : '';

  const handleCreate = () => {
    onCreateTask(JSON.stringify({ type, frequency, time, day }));
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
      className: 'font-semibold text-textMain',
      sortValue: (task) => taskDisplayName(task.Name, t),
      render: (task) => taskDisplayName(task.Name, t),
    },
    {
      key: 'schedule',
      header: t('scheduling.colSchedule'),
      sortValue: (task) => describeSchedule(task.Name, t),
      render: (task) => describeSchedule(task.Name, t),
    },
    {
      key: 'state',
      header: t('scheduling.colState'),
      sortValue: (task) => describeTaskState(task.State, t).label,
      render: (task) => {
        const { label, variant } = describeTaskState(task.State, t);
        return <Badge text={label} variant={variant} />;
      },
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

          {frequency === 'WEEKLY' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-textMuted">
                {t('scheduling.weekdayLabel')}
              </span>
              <select
                data-cy="task-weekday"
                className={selectClass}
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
              >
                {WEEKDAYS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {frequency === 'MONTHLY' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-textMuted">
                {t('scheduling.dayOfMonthLabel')}
              </span>
              <select
                data-cy="task-monthday"
                className={selectClass}
                value={monthDay}
                onChange={(e) => setMonthDay(e.target.value)}
              >
                {MONTH_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}

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
