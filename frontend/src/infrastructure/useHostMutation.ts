import { useCallback, useEffect, useRef, useState } from 'react';
import { sendAction, subscribeActionFinished, subscribeLogs, subscribeProgress } from './bridge';
import { LocalizedMessage } from '../domain/types';

export interface ActionFeedbackItem {
  id: number;
  action: string;
  ok: boolean;
  /** The host's own last word on this run, or null when it said nothing quotable. */
  detail: LocalizedMessage | null;
}

export interface HostMutation {
  activeAction: string | null;
  progressPercent: number;
  executionHasError: boolean;
  feedbackItems: ActionFeedbackItem[];
  runRead: (action: string, payload?: unknown) => void;
  runMutation: (action: string, payload?: unknown) => boolean;
  dismissFeedback: (id: number) => void;
}

/**
 * Deep hook owning the full host mutation lifecycle: execution lock, progress tracking,
 * scoped log pairing, and outcome toasts behind one cohesive interface.
 */
export function useHostMutation(): HostMutation {
  const activeActionRef = useRef<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(100);
  const [executionHasError, setExecutionHasError] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<ActionFeedbackItem[]>([]);
  const outcomeSeqRef = useRef(0);
  const pendingRef = useRef<{ error: LocalizedMessage | null; success: LocalizedMessage | null }>({
    error: null,
    success: null,
  });

  useEffect(() => {
    const unsubscribeProgress = subscribeProgress(setProgressPercent);

    const unsubscribeLogs = subscribeLogs((message, type) => {
      if (type === 'error') pendingRef.current.error = message;
      if (type === 'success') pendingRef.current.success = message;
    });

    const unsubscribeFinished = subscribeActionFinished((action, ok) => {
      if (action !== activeActionRef.current) return;

      activeActionRef.current = null;
      setActiveAction(null);
      setExecutionHasError(!ok);

      outcomeSeqRef.current += 1;
      const pending = pendingRef.current;
      const detail = ok ? pending.success : pending.error;

      setFeedbackItems((prev) => [
        ...prev,
        {
          id: outcomeSeqRef.current,
          action,
          ok,
          detail,
        },
      ]);

      pendingRef.current = { error: null, success: null };
    });

    return () => {
      unsubscribeProgress();
      unsubscribeLogs();
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

  const dismissFeedback = useCallback((id: number) => {
    setFeedbackItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    activeAction,
    progressPercent,
    executionHasError,
    feedbackItems,
    runRead,
    runMutation,
    dismissFeedback,
  };
}
