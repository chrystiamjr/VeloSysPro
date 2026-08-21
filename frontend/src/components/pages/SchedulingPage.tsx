import React, { useState } from 'react';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import { Select, fieldClass } from '../atoms/Select';
import { DayOfMonthPicker } from '../molecules/DayOfMonthPicker';
import { FormField } from '../molecules/FormField';
import { DataTable, DataTableColumn } from '../organisms/DataTable';
import { ScheduledTaskItem } from '../../domain/types';
import {
  FREQUENCIES,
  OPT_TYPES,
  WEEKDAYS,
  describeSchedule,
  describeTaskState,
  taskDisplayName,
} from '../../domain/scheduling';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SchedulingPageProps {
  tasks: ScheduledTaskItem[];
  onCreateTask: (payload: { type: string; frequency: string; time: string; day: string }) => void;
  onDeleteTask: (name: string) => void;
  onRefresh?: () => void;
  disabled?: boolean;
}

export const SchedulingPage: React.FC<SchedulingPageProps> = ({
  tasks,
  onCreateTask,
  onDeleteTask,
  onRefresh,
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
    onCreateTask({ type, frequency, time, day });
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
      sortValue: (task) => taskDisplayName(task, t),
      render: (task) => taskDisplayName(task, t),
    },
    {
      key: 'schedule',
      header: t('scheduling.colSchedule'),
      sortValue: (task) => `${task.Frequency}:${task.Day}:${task.Time}`,
      render: (task) => describeSchedule(task, t),
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
          fullWidth={false}
          className="ml-auto flex items-center gap-1.5 px-4 py-2"
          disabled={disabled}
          onClick={() => handleDelete(task.Name)}
        >
          <Icon name="trash" /> {t('scheduling.deleteBtn')}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex select-none flex-col gap-6 pb-4 sm:pb-6 lg:pb-8">
      {/* Create form */}
      <div className="flex flex-col gap-5 rounded-xl border border-borderColor bg-bgCard p-6">
        <div>
          <h3 className="text-lg font-bold text-white">{t('scheduling.formTitle')}</h3>
          <p className="mt-1 text-xs text-textMuted">{t('scheduling.formDesc')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t('scheduling.typeLabel')} htmlFor="task-type">
            <Select
              id="task-type"
              testId="task-type"
              value={type}
              onChange={setType}
              options={OPT_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            />
          </FormField>

          <FormField label={t('scheduling.freqLabel')} htmlFor="task-frequency">
            <Select
              id="task-frequency"
              testId="task-frequency"
              value={frequency}
              onChange={setFrequency}
              options={FREQUENCIES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            />
          </FormField>

          <FormField label={t('scheduling.timeLabel')} htmlFor="task-time">
            <input
              id="task-time"
              data-cy="task-time"
              type="time"
              className={fieldClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </FormField>

          {frequency === 'WEEKLY' && (
            <FormField label={t('scheduling.weekdayLabel')} htmlFor="task-weekday">
              <Select
                id="task-weekday"
                testId="task-weekday"
                value={weekday}
                onChange={setWeekday}
                options={WEEKDAYS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              />
            </FormField>
          )}

          {frequency === 'MONTHLY' && (
            <FormField
              label={t('scheduling.dayOfMonthLabel')}
              className="sm:col-span-2 lg:col-span-3"
            >
              <DayOfMonthPicker
                value={monthDay}
                onChange={setMonthDay}
                ariaLabel={t('scheduling.dayOfMonthLabel')}
              />
            </FormField>
          )}
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
        onRefresh={onRefresh}
        disabled={disabled}
      />
    </div>
  );
};
