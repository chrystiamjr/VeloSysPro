import { useCallback, useEffect, useState } from 'react';
import { AppScreen, SystemActions } from '../domain/types';
import type {
  BackupItem,
  OptimizationSnapshot,
  RestorePointItem,
  ScheduledTaskItem,
  TweakCatalog,
} from '../domain/types';
import {
  sendAction,
  subscribeBackups,
  subscribeHistory,
  subscribeRejections,
  subscribeRestorePoints,
  subscribeTasks,
  subscribeTweaks,
} from './bridge';

const refreshActions: Record<AppScreen, readonly string[]> = {
  [AppScreen.Dashboard]: [SystemActions.GET_BACKUPS, SystemActions.GET_TASKS],
  // History too: the last comparison lives on disk, so it survives closing the app.
  [AppScreen.Optimize]: [SystemActions.LOAD_TWEAKS, SystemActions.LOAD_HISTORY],
  [AppScreen.Scheduling]: [SystemActions.GET_TASKS],
  [AppScreen.Backup]: [SystemActions.GET_BACKUPS],
  [AppScreen.RestorePoints]: [SystemActions.GET_RESTORE_POINTS],
  [AppScreen.Settings]: [],
};

// Assume protection is on until the host says otherwise, so the warning appears as a fact the
// host reported rather than flashing on every load before the first tweaksLoaded arrives.
const emptyCatalog: TweakCatalog = { tweaks: [], presets: [], systemProtectionEnabled: true };

export interface OsBackedLists {
  backups: BackupItem[];
  tasks: ScheduledTaskItem[];
  restorePoints: RestorePointItem[];
  tweakCatalog: TweakCatalog;
  /** False until the host has answered once, so "loading" is distinguishable from "empty". */
  tweakCatalogLoaded: boolean;
  /** True when the host's last catalog was refused, so the screen can say it is showing older data. */
  tweakCatalogStale: boolean;
  history: OptimizationSnapshot[];
  refreshBackups: () => void;
  refreshTasks: () => void;
  refreshRestorePoints: () => void;
  refreshTweaks: () => void;
}

export function useOsBackedLists(activeScreen: AppScreen): OsBackedLists {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointItem[]>([]);
  const [tweakCatalog, setTweakCatalog] = useState<TweakCatalog>(emptyCatalog);
  const [tweakCatalogLoaded, setTweakCatalogLoaded] = useState(false);
  const [tweakCatalogStale, setTweakCatalogStale] = useState(false);
  const [history, setHistory] = useState<OptimizationSnapshot[]>([]);

  useEffect(() => {
    const unsubscribers = [
      subscribeBackups(setBackups),
      subscribeTasks(setTasks),
      subscribeRestorePoints(setRestorePoints),
      subscribeTweaks((catalog) => {
        setTweakCatalog(catalog);
        setTweakCatalogLoaded(true);
        // A good read clears the warning left by a previous bad one.
        setTweakCatalogStale(false);
      }),
      subscribeHistory(setHistory),
      subscribeRejections((channel) => {
        if (channel === 'tweaksLoaded') setTweakCatalogStale(true);
      }),
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
  const refreshTweaks = useCallback(() => sendAction(SystemActions.LOAD_TWEAKS), []);

  return {
    backups,
    tasks,
    restorePoints,
    tweakCatalog,
    tweakCatalogLoaded,
    tweakCatalogStale,
    history,
    refreshBackups,
    refreshTasks,
    refreshRestorePoints,
    refreshTweaks,
  };
}
