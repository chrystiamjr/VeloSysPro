import { useCallback, useEffect, useRef, useState } from 'react';
import { sendAction, subscribeActionFinished, subscribeProgress } from './bridge';

export interface ExecutionLifecycle {
  activeAction: string | null;
  progressPercent: number;
  executionHasError: boolean;
  runRead: (action: string, payload?: unknown) => void;
  runMutation: (action: string, payload?: unknown) => boolean;
}

/**
 * Owns the lifecycle of host execution behind one interface.
 *
 * Reads never acquire the mutation lock. A mutation stays locked until its matching,
 * authoritative actionFinished Event arrives; progress is visual state only.
 */
export function useExecutionLifecycle(): ExecutionLifecycle {
  const activeActionRef = useRef<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(100);
  const [executionHasError, setExecutionHasError] = useState(false);

  useEffect(() => {
    const unsubscribeProgress = subscribeProgress(setProgressPercent);
    const unsubscribeFinished = subscribeActionFinished((action, ok) => {
      if (action !== activeActionRef.current) return;

      activeActionRef.current = null;
      setActiveAction(null);
      setExecutionHasError(!ok);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeFinished();
    };
  }, []);

  const runRead = useCallback((action: string, payload?: unknown) => {
    sendAction(action, payload);
  }, []);

  const runMutation = useCallback((action: string, payload?: unknown): boolean => {
    if (activeActionRef.current) return false;

    activeActionRef.current = action;
    setActiveAction(action);
    setExecutionHasError(false);
    sendAction(action, payload);
    return true;
  }, []);

  return {
    activeAction,
    progressPercent,
    executionHasError,
    runRead,
    runMutation,
  };
}
