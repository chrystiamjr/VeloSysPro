import React from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  id?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

/** Shared field styling for selects and any native input that must match them. */
export const fieldClass =
  'w-full rounded-lg border border-borderColor bg-bgMain px-3.5 py-2.5 text-xs text-textMain outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Select with the native arrow replaced by a chevron inset from the border.
 * The browser's own arrow sits flush against the edge, so `appearance-none` plus right
 * padding is what creates the breathing room.
 */
export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  id,
  disabled = false,
  className = '',
  testId,
}) => {
  return (
    <div className="relative">
      <select
        id={id}
        data-cy={testId}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} cursor-pointer appearance-none pr-10 ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted"
      />
    </div>
  );
};
