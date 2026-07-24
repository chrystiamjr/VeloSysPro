import React, { useState } from 'react';
import { Icon } from '../atoms/Icon';

export interface ActionGroupProps {
  title: string;
  description: string;
  itemCount: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export const ActionGroup: React.FC<ActionGroupProps> = ({
  title,
  description,
  itemCount,
  defaultExpanded = false,
  children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="overflow-hidden rounded-container border border-borderColor bg-bgCard">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 bg-transparent px-5 py-4 text-left transition-colors hover:bg-bgCardHover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
      >
        <span>
          <span className="flex items-center gap-2 text-sm font-bold text-textMain">
            {title}
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-textMuted">
              {itemCount}
            </span>
          </span>
          <span className="mt-1 block text-xs text-textMuted">{description}</span>
        </span>
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-right'}
          className="h-5 w-5 shrink-0 text-textMuted"
        />
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-3 border-t border-borderColor p-4 lg:grid-cols-2 xl:grid-cols-3">
          {children}
        </div>
      )}
    </section>
  );
};
