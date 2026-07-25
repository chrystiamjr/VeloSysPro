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
  RestorePointItem,
  ScheduledTaskItem,
  UpdateInfo,
} from './schemas';

import type { LogType } from './schemas';

export const SystemActions = {
  RUN_QUICK_OPTIMIZATION: 'runQuickOptimization',
  RUN_FULL_OPTIMIZATION: 'runFullOptimization',
  RUN_GAMING_MODE: 'runGamingMode',
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
} as const;

export type SystemActionType = (typeof SystemActions)[keyof typeof SystemActions];

export enum AppScreen {
  Dashboard = 'Dashboard',
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
  args?: Record<string, unknown>;
  type: LogType;
}
