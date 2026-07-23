import React from 'react';
import { Button, ButtonVariant } from '../atoms/Button';

export interface ActionCardProps {
  title: string;
  desc: string;
  icon: React.ReactNode;
  variant?: ButtonVariant;
  buttonText?: string;
  onExecute: () => void;
}

const borderStripe: Record<ButtonVariant, string> = {
  primary: 'before:bg-primary',
  success: 'before:bg-success',
  purple: 'before:bg-purple',
  warning: 'before:bg-warning',
  pink: 'before:bg-pink',
  info: 'before:bg-info',
  danger: 'before:bg-danger',
};

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  desc,
  icon,
  variant = 'primary',
  buttonText = 'Executar Agora',
  onExecute,
}) => {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-card border border-borderColor bg-bgCard p-5 transition-all duration-200 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-[''] hover:-translate-y-1 hover:bg-bgCardHover hover:shadow-xl ${borderStripe[variant]}`}
    >
      <div>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-lg">
            {icon}
          </div>
          <h3 className="text-base font-bold text-textMain">{title}</h3>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-textMuted">{desc}</p>
      </div>
      <Button variant={variant} onClick={onExecute}>
        {buttonText}
      </Button>
    </div>
  );
};
