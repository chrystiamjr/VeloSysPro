import React from 'react';
import { MONTH_DAYS } from '../../domain/scheduling';

export interface DayOfMonthPickerProps {
  value: string;
  onChange: (day: string) => void;
  disabled?: boolean;
  /**
   * A radiogroup is not a labelable element, so `<label for>` cannot reach it. The accessible
   * name is supplied here instead.
   */
  ariaLabel: string;
}

/**
 * Calendar-style grid for picking a day of the month.
 *
 * Replaces a 31-option `<select>`, which forces the user to scroll a long list to reach a
 * number they can already see at a glance in a grid.
 */
export const DayOfMonthPicker: React.FC<DayOfMonthPickerProps> = ({
  value,
  onChange,
  disabled = false,
  ariaLabel,
}) => {
  return (
    <div
      data-cy="task-monthday"
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-7 gap-1.5 rounded-lg border border-borderColor bg-bgMain p-2.5"
    >
      {MONTH_DAYS.map((day) => {
        const selected = day === value;

        return (
          <button
            key={day}
            type="button"
            role="radio"
            aria-checked={selected}
            data-cy={`task-monthday-${day}`}
            disabled={disabled}
            onClick={() => onChange(day)}
            className={`rounded-md py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'bg-primary text-white'
                : 'text-textMuted hover:bg-bgCardHover hover:text-textMain'
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
};
