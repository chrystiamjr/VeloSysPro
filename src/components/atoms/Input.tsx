import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  return (
    <input
      {...props}
      className={`rounded-lg border border-borderColor bg-bgMain px-3.5 py-2.5 text-xs text-textMain outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
    />
  );
};
