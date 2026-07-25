import React from 'react';
import { Icon } from '../atoms/Icon';

export interface HealthCardProps {
  title: string;
  value: string | number;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'purple';
  onClick?: () => void;
  testId?: string;
}

const valueColors: Record<NonNullable<HealthCardProps['variant']>, string> = {
  primary: 'text-primary',
  success: 'text-emerald-400',
  warning: 'text-warning',
  info: 'text-info',
  purple: 'text-purple',
};

export const HealthCard: React.FC<HealthCardProps> = ({
  title,
  value,
  variant = 'primary',
  onClick,
  testId,
}) => {
  const content = (
    <>
      <div className="text-xs font-semibold text-textMuted">{title}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className={`truncate text-lg font-bold ${valueColors[variant]}`}>{value}</div>
        {onClick && <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-textMuted" />}
      </div>
    </>
  );

  const className =
    'rounded-container border border-borderColor bg-bgCard px-4 py-3 text-left shadow-sm transition-all';

  return onClick ? (
    <button
      data-cy={testId}
      type="button"
      onClick={onClick}
      className={`${className} cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:bg-bgCardHover focus:outline-none focus:ring-2 focus:ring-primary/40`}
    >
      {content}
    </button>
  ) : (
    <div data-cy={testId} className={className}>
      {content}
    </div>
  );
};
