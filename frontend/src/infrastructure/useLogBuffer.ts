import { useCallback, useEffect, useState } from 'react';
import type { LogRecord } from '../domain/types';
import { subscribeLogs } from './bridge';

export interface LogBuffer {
  logs: LogRecord[];
  consoleExpanded: boolean;
  setConsoleExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  clearLogs: () => void;
}

const DEFAULT_BUFFER_CAPACITY = 500;

/**
 * Deep hook managing the live terminal log ring buffer, auto-expansion on host errors,
 * and memory boundedness.
 */
export function useLogBuffer(capacity = DEFAULT_BUFFER_CAPACITY): LogBuffer {
  const [logs, setLogs] = useState<LogRecord[]>([{ key: 'log.appStarted', type: 'success' }]);
  const [consoleExpanded, setConsoleExpanded] = useState(false);

  useEffect(() => {
    return subscribeLogs((msg, type) => {
      setLogs((prev) => {
        const next = [...prev, { key: msg.key, args: msg.args, type }];
        return next.length > capacity ? next.slice(next.length - capacity) : next;
      });

      if (type === 'error') {
        setConsoleExpanded(true);
      }
    });
  }, [capacity]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    consoleExpanded,
    setConsoleExpanded,
    clearLogs,
  };
}
