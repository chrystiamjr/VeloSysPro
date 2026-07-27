import React from 'react';

export type ButtonVariant =
  'primary' | 'success' | 'purple' | 'warning' | 'pink' | 'info' | 'danger';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
  testId?: string;
  /** Lets a dialog move focus here on open, so backing out is the keyboard default. */
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary hover:bg-primary-hover',
  success: 'bg-success hover:bg-success-hover',
  purple: 'bg-purple hover:bg-purple-hover',
  warning: 'bg-warning hover:bg-warning-hover',
  pink: 'bg-pink hover:bg-pink-hover',
  info: 'bg-info hover:bg-info-hover',
  danger: 'bg-danger hover:bg-danger-hover',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  testId,
  buttonRef,
}) => {
  return (
    <button
      ref={buttonRef}
      data-cy={testId}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border-none px-4 py-3 text-xs font-bold text-textMain shadow-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
