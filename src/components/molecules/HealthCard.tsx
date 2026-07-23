import React from 'react';

export interface HealthCardProps {
  title: string;
  value: string | number;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'purple';
}

const valueColors: Record<NonNullable<HealthCardProps['variant']>, string> = {
  primary: 'text-primary',
  success: 'text-emerald-400',
  warning: 'text-warning',
  info: 'text-info',
  purple: 'text-purple',
};

export const HealthCard: React.FC<HealthCardProps> = ({ title, value, variant = 'primary' }) => {
  return (
    <div className="rounded-container border border-borderColor bg-bgCard p-4 shadow-sm transition-transform hover:-translate-y-0.5">
      <div className="text-xs font-semibold text-textMuted">{title}</div>
      <div className={`mt-2 text-xl font-bold ${valueColors[variant]}`}>{value}</div>
    </div>
  );
};
