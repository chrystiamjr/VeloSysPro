import { useCallback } from 'react';
import { useTranslation } from './i18nContext';

export interface ManagementAction {
  confirmAction: (confirmKeys: string | string[], onConfirmed: () => void) => void;
}

/**
 * Deep hook providing unified confirmation and execution flow for destructive/impactful
 * management actions across BackupPage, RestorePointsPage, and SchedulingPage.
 */
export function useManagementAction(): ManagementAction {
  const { t } = useTranslation();

  const confirmAction = useCallback(
    (confirmKeys: string | string[], onConfirmed: () => void) => {
      const keys = Array.isArray(confirmKeys) ? confirmKeys : [confirmKeys];
      const confirmedAll = keys.every((key) => window.confirm(t(key)));
      if (confirmedAll) {
        onConfirmed();
      }
    },
    [t]
  );

  return { confirmAction };
}
