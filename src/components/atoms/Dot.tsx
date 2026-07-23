import React from 'react';

export interface DotProps {
  variant?: 'success' | 'warning' | 'danger' | 'info';
}

const dotColors: Record<NonNullable<DotProps['variant']>, string> = {
  success: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
  warning: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
  danger: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
  info: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
};

export const Dot: React.FC<DotProps> = ({ variant = 'success' }) => {
  return <div className={`h-2 w-2 rounded-full ${dotColors[variant]}`} />;
};
