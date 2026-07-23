import React, { useRef, useEffect } from 'react';
import { LogEntryItem } from '../../domain/types';

export interface TerminalConsoleProps {
  logs?: LogEntryItem[];
  onClear: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ logs = [], onClear }) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="mb-6 rounded-container border border-borderColor bg-[#0d0f15] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold text-textMain">
          <span>📜</span> Log em Tempo Real
        </h3>
        <button
          onClick={onClear}
          className="cursor-pointer rounded border border-borderColor bg-transparent px-3 py-1 text-[11px] text-textMuted transition-colors hover:text-white"
        >
          Limpar Console
        </button>
      </div>

      <div
        ref={boxRef}
        className="h-40 overflow-y-auto rounded-lg border border-white/5 bg-[#090a0e] p-3 font-mono text-xs leading-relaxed text-gray-300"
      >
        {logs.length === 0 ? (
          <div className="italic text-textMuted">[SISTEMA] Aguardando logs de execução...</div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className={`mb-1 ${
                log.type === 'error'
                  ? 'text-rose-400'
                  : log.type === 'success'
                    ? 'text-emerald-400'
                    : 'text-sky-400'
              }`}
            >
              {log.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
