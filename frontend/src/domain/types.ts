/**
 * VeloSys Pro - TypeScript Domain Interfaces & Contracts
 */

/**
 * Shapes the C# host sends are defined once as Zod schemas and re-exported here, so the
 * runtime check and the compile-time type can never disagree. See `./schemas.ts`.
 */
export type {
  AppSettings,
  BackupItem,
  LocalizedMessage,
  LogType,
  OptimizationSnapshot,
  Preset,
  RestorePointItem,
  RiskTier,
  ScheduledTaskItem,
  SnapshotCapturedPayload,
  Tweak,
  TweakCatalog,
  TweakChange,
  TweakState,
  UpdateInfo,
} from './schemas';

import type { AppSettings, LogType } from './schemas';

export const SystemActions = {
  RUN_QUICK_OPTIMIZATION: 'runQuickOptimization',
  RUN_FULL_OPTIMIZATION: 'runFullOptimization',
  REVERT_DEFAULTS: 'revertDefaults',
  CLEAR_UPDATE_CACHE: 'clearUpdateCache',
  CLEAN_PREFETCH: 'cleanPrefetch',
  DISK_HEALTH: 'diskHealth',
  CREATE_MANUAL_BACKUP: 'createManualBackup',
  RESTORE_BACKUP: 'restoreBackup',
  CREATE_RESTORE_POINT: 'createRestorePoint',
  OPEN_LOGS: 'openLogs',
  OPEN_URL: 'openUrl',
  OPEN_BACKUPS: 'openBackups',
  GET_BACKUPS: 'getBackups',
  GET_TASKS: 'getTasks',
  CREATE_TASK: 'createTask',
  DELETE_TASK: 'deleteTask',
  GET_RESTORE_POINTS: 'getRestorePoints',
  RESTORE_TO_POINT: 'restoreToPoint',
  GET_SETTINGS: 'getSettings',
  SAVE_SETTINGS: 'saveSettings',
  LOAD_TWEAKS: 'loadTweaks',
  APPLY_TWEAKS: 'applyTweaks',
  REVERT_TWEAK: 'revertTweak',
  CAPTURE_SNAPSHOT: 'captureSnapshot',
  LOAD_HISTORY: 'loadHistory',
  ENABLE_SYSTEM_PROTECTION: 'enableSystemProtection',
} as const;

export type SystemActionType = (typeof SystemActions)[keyof typeof SystemActions];

export interface SystemActionPayloads {
  [SystemActions.RUN_QUICK_OPTIMIZATION]: void | null;
  [SystemActions.RUN_FULL_OPTIMIZATION]: void | null;
  [SystemActions.REVERT_DEFAULTS]: void | null;
  [SystemActions.CLEAR_UPDATE_CACHE]: void | null;
  [SystemActions.CLEAN_PREFETCH]: void | null;
  [SystemActions.DISK_HEALTH]: void | null;
  [SystemActions.CREATE_MANUAL_BACKUP]: void | null;
  [SystemActions.RESTORE_BACKUP]: string;
  [SystemActions.CREATE_RESTORE_POINT]: void | null;
  [SystemActions.OPEN_LOGS]: void | null;
  [SystemActions.OPEN_URL]: string;
  [SystemActions.OPEN_BACKUPS]: void | null;
  [SystemActions.GET_BACKUPS]: void | null;
  [SystemActions.GET_TASKS]: void | null;
  [SystemActions.CREATE_TASK]: { type: string; frequency: string; day?: string; time: string };
  [SystemActions.DELETE_TASK]: string;
  [SystemActions.GET_RESTORE_POINTS]: void | null;
  [SystemActions.RESTORE_TO_POINT]: number;
  [SystemActions.GET_SETTINGS]: void | null;
  [SystemActions.SAVE_SETTINGS]: AppSettings;
  [SystemActions.LOAD_TWEAKS]: void | null;
  [SystemActions.APPLY_TWEAKS]: { tweakIds?: string[]; revertIds?: string[] };
  [SystemActions.REVERT_TWEAK]: string;
  [SystemActions.CAPTURE_SNAPSHOT]: void | null;
  [SystemActions.LOAD_HISTORY]: void | null;
  [SystemActions.ENABLE_SYSTEM_PROTECTION]: void | null;
}

export enum AppScreen {
  Dashboard = 'Dashboard',
  Optimize = 'Optimize',
  Scheduling = 'Scheduling',
  Backup = 'Backup',
  RestorePoints = 'RestorePoints',
  Settings = 'Settings',
}

export interface SystemHealth {
  admin: string;
  backupsCount: number;
  latestBackup: string;
  tasksCount: number;
  status: string;
}

/** Display-ready log line (already translated) consumed by TerminalConsole. */
export interface LogEntryItem {
  text: string;
  type: LogType;
  timestamp?: string;
}

/** Log entry stored in state as an i18n key, translated at render time so it follows language switches. */
export interface LogRecord {
  key: string;
  args?: Record<string, unknown> | null;
  type: LogType;
}
