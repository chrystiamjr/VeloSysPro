import { useCallback, useEffect, useState } from 'react';
import { AppScreen, SystemActions } from '../domain/types';
import type { BackupItem, RestorePointItem, ScheduledTaskItem } from '../domain/types';
import { sendAction, subscribeBackups, subscribeRestorePoints, subscribeTasks } from './bridge';

const refreshActions: Record<AppScreen, readonly string[]> = {
  [AppScreen.Dashboard]: [SystemActions.GET_BACKUPS, SystemActions.GET_TASKS],
  [AppScreen.Scheduling]: [SystemActions.GET_TASKS],
  [AppScreen.Backup]: [SystemActions.GET_BACKUPS],
  [AppScreen.RestorePoints]: [SystemActions.GET_RESTORE_POINTS],
  [AppScreen.Settings]: [],
};

export interface OsBackedLists {
  backups: BackupItem[];
  tasks: ScheduledTaskItem[];
  restorePoints: RestorePointItem[];
  refreshBackups: () => void;
  refreshTasks: () => void;
  refreshRestorePoints: () => void;
}

export function useOsBackedLists(activeScreen: AppScreen): OsBackedLists {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointItem[]>([]);

  useEffect(() => {
    const unsubscribers = [
      subscribeBackups(setBackups),
      subscribeTasks(setTasks),
      subscribeRestorePoints(setRestorePoints),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, []);

  useEffect(() => {
    for (const action of refreshActions[activeScreen]) sendAction(action);
  }, [activeScreen]);

  const refreshBackups = useCallback(() => sendAction(SystemActions.GET_BACKUPS), []);
  const refreshTasks = useCallback(() => sendAction(SystemActions.GET_TASKS), []);
  const refreshRestorePoints = useCallback(() => sendAction(SystemActions.GET_RESTORE_POINTS), []);

  return {
    backups,
    tasks,
    restorePoints,
    refreshBackups,
    refreshTasks,
    refreshRestorePoints,
  };
}
