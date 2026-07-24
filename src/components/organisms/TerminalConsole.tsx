import React, { useRef, useEffect } from 'react';
import { LogEntryItem } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';
import { Icon } from '../atoms/Icon';

export interface TerminalConsoleProps {
  logs?: LogEntryItem[];
  onClear: () => void;
  expanded: boolean;
  hasError?: boolean;
  onToggle: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  logs = [],
  onClear,
  expanded,
  hasError = false,
  onToggle,
}) => {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      data-cy="terminal"
      className={`mb-6 rounded-container border bg-bgMain p-4 ${hasError ? 'border-danger/60' : 'border-borderColor'}`}
    >
      <div
        className={
          expanded
            ? 'mb-3 flex items-center justify-between gap-4'
            : 'flex items-center justify-between gap-4'
        }
      >
        <button
          data-cy="terminal-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 bg-transparent text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Icon
            name="file-text"
            className={`h-4 w-4 shrink-0 ${hasError ? 'text-danger' : 'text-primary'}`}
          />
          <span className="shrink-0 text-xs font-bold text-textMain">{t('terminal.title')}</span>
          <span className={`truncate text-xs ${hasError ? 'text-danger' : 'text-textMuted'}`}>
            {logs.length > 0 ? logs[logs.length - 1].text : t('terminal.waiting')}
          </span>
          <Icon
            name={expanded ? 'chevron-down' : 'chevron-right'}
            className="h-4 w-4 shrink-0 text-textMuted"
          />
        </button>
        {expanded && (
          <button
            data-cy="terminal-clear"
            onClick={onClear}
            className="cursor-pointer rounded border border-borderColor bg-transparent px-3 py-1 text-[11px] text-textMuted transition-colors hover:text-white"
          >
            {t('btn.clearConsole')}
          </button>
        )}
      </div>

      {expanded && (
        <div
          data-cy="terminal-content"
          ref={boxRef}
          className="h-40 overflow-y-auto rounded-lg border border-white/5 bg-bgMain p-3 font-mono text-xs leading-relaxed text-textMuted"
        >
          {logs.length === 0 ? (
            <div className="italic text-textMuted">{t('terminal.waiting')}</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`mb-1 ${
                  log.type === 'error'
                    ? 'text-danger'
                    : log.type === 'success'
                      ? 'text-success'
                      : 'text-info'
                }`}
              >
                {log.text}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
