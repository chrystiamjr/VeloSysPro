import React from 'react';

export interface DotProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const dotColors: Record<NonNullable<DotProps['variant']>, string> = {
  success: 'bg-success shadow-glow-success',
  warning: 'bg-warning shadow-glow-warning',
  danger: 'bg-danger shadow-glow-danger',
  info: 'bg-info shadow-glow-info',
  // No glow: neutral marks a state nothing can be done about, and the glow is what makes the other
  // four read as live.
  neutral: 'bg-textMuted',
};

export const Dot: React.FC<DotProps> = ({ variant = 'success' }) => {
  return <div className={`h-2 w-2 rounded-full ${dotColors[variant]}`} />;
};
