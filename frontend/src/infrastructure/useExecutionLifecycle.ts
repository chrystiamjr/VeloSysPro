import { useCallback, useEffect, useRef, useState } from 'react';
import { sendAction, subscribeActionFinished, subscribeProgress } from './bridge';

/**
 * The authoritative outcome of one mutation the user started here.
 *
 * `seq` increments per outcome because the identity of an outcome is the run, not its contents:
 * creating a restore point twice and failing both times must be two separate reports, and an
 * object compared by value would collapse them into one.
 */
export interface MutationOutcome {
  seq: number;
  action: string;
  ok: boolean;
}

export interface ExecutionLifecycle {
  activeAction: string | null;
  progressPercent: number;
  executionHasError: boolean;
  lastOutcome: MutationOutcome | null;
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
  const [lastOutcome, setLastOutcome] = useState<MutationOutcome | null>(null);

  useEffect(() => {
    const unsubscribeProgress = subscribeProgress(setProgressPercent);
    const unsubscribeFinished = subscribeActionFinished((action, ok) => {
      // The host reports every Action, reads included. Matching against the mutation this hook
      // started is what keeps a routine list refresh from being announced to the user.
      if (action !== activeActionRef.current) return;

      activeActionRef.current = null;
      setActiveAction(null);
      setExecutionHasError(!ok);
      setLastOutcome((previous) => ({ seq: (previous?.seq ?? 0) + 1, action, ok }));
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
    lastOutcome,
    runRead,
    runMutation,
  };
}
