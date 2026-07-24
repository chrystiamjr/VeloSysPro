import React from 'react';
import { Button, ButtonVariant } from '../atoms/Button';

export interface CompactActionItemProps {
  title: string;
  desc: string;
  icon: React.ReactNode;
  buttonText: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onExecute: () => void;
  testId?: string;
}

export const CompactActionItem: React.FC<CompactActionItemProps> = ({
  title,
  desc,
  icon,
  buttonText,
  variant = 'primary',
  disabled = false,
  onExecute,
  testId,
}) => (
  <div
    data-cy={testId}
    className="flex min-h-32 flex-col justify-between rounded-container border border-borderColor bg-bgMain/40 p-4 transition-colors hover:bg-bgCardHover"
  >
    <div>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
          {icon}
        </div>
        <h4 className="text-sm font-bold text-textMain">{title}</h4>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-textMuted">{desc}</p>
    </div>
    <Button variant={variant} disabled={disabled} onClick={onExecute} className="mt-3 py-2.5">
      {buttonText}
    </Button>
  </div>
);
