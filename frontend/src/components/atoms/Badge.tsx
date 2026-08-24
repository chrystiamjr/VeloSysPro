import React from 'react';
import { Dot } from './Dot';

export interface BadgeProps {
  /** Required so a hardcoded, untranslatable default can never reach the screen. */
  text: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const badgeStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-success/10 border-success/30 text-success',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  danger: 'bg-danger/10 border-danger/30 text-danger',
  info: 'bg-info/10 border-info/30 text-info',
  neutral: 'bg-bgCard border-borderColor text-textMuted',
};

export const Badge: React.FC<BadgeProps> = ({ text, variant = 'success' }) => {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${badgeStyles[variant]}`}
    >
      <Dot variant={variant} />
      <span>{text}</span>
    </div>
  );
};
