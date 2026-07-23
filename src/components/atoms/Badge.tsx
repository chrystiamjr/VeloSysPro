import React from 'react';
import { Dot } from './Dot';

export interface BadgeProps {
  text?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info';
}

const badgeStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  danger: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  info: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
};

export const Badge: React.FC<BadgeProps> = ({
  text = 'Administrador Ativo',
  variant = 'success',
}) => {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${badgeStyles[variant]}`}
    >
      <Dot variant={variant} />
      <span>{text}</span>
    </div>
  );
};
