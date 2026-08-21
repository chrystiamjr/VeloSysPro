import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeLogs } from './bridge';
import { LocalizedMessage } from '../domain/types';
import { MutationOutcome } from './useExecutionLifecycle';

export interface ActionFeedbackItem {
  id: number;
  action: string;
  ok: boolean;
  /** The host's own last word on this run, or null when it said nothing quotable. */
  detail: LocalizedMessage | null;
}

export interface ActionFeedback {
  items: ActionFeedbackItem[];
  dismiss: (id: number) => void;
}

/**
 * Turns the outcome of a mutation into a report the user sees on the screen they are on.
 *
 * Every outcome the host reports used to reach the user only as a line in the Dashboard's log
 * panel, so a failure raised from Optimize, Backup or Restore Points was announced on a screen
 * the user was not looking at. The outcome itself carries no reason — `actionFinished` is
 * `{ action, ok }` — so the reason is recovered by holding on to the last log the host emitted
 * during the run, which is already a translatable key rather than baked English.
 */
export function useActionFeedback(
  activeAction: string | null,
  lastOutcome: MutationOutcome | null
): ActionFeedback {
  const [items, setItems] = useState<ActionFeedbackItem[]>([]);
  const pendingRef = useRef<{ error: LocalizedMessage | null; success: LocalizedMessage | null }>({
    error: null,
    success: null,
  });

  useEffect(() => {
    return subscribeLogs((message, type) => {
      if (type === 'error') pendingRef.current.error = message;
      if (type === 'success') pendingRef.current.success = message;
    });
  }, []);

  // Keep track of the last error or success message emitted during mutations.
  // pendingRef is safely reset upon recording each outcome in the lastOutcome effect.

  useEffect(() => {
    if (!lastOutcome) return;

    const pending = pendingRef.current;
    setItems((previous) => [
      ...previous,
      {
        id: lastOutcome.seq,
        action: lastOutcome.action,
        ok: lastOutcome.ok,
        detail: lastOutcome.ok ? pending.success : pending.error,
      },
    ]);
    pendingRef.current = { error: null, success: null };
    // Keyed on seq alone: two identical outcomes are still two runs, and each deserves its report.
  }, [lastOutcome?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  return { items, dismiss };
}
