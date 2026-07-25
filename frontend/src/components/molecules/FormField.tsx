import React from 'react';

export interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  /**
   * Id of the control being labelled. Provide it whenever the control is not a single native
   * input, since only then does implicit `<label>` wrapping stop associating them.
   */
  htmlFor?: string;
  /** Grid placement, e.g. spanning the full row for a wide control. */
  className?: string;
}

/** Label above a form control, with the spacing shared by every field in the app. */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  htmlFor,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[11px] font-semibold text-textMuted">
        {label}
      </label>
      {children}
    </div>
  );
};
