/**
 * VeloSys Pro - TypeScript Domain Interfaces & Contracts
 */

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
  OPEN_BACKUPS: 'openBackups',
  OPEN_RESTORE_POINTS: 'openRestorePoints',
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

export interface AppSettings {
  language: 'pt_BR' | 'en_US';
  createBackupBeforeOptimize: boolean;
}

export interface SystemHealth {
  admin: string;
  backupsCount: number;
  latestBackup: string;
  tasksCount: number;
  status: string;
}

export interface BackupItem {
  Name: string;
  Date: string;
  Size: string;
}

export interface ScheduledTaskItem {
  Name: string;
  State: string;
  Path: string;
}

export interface RestorePointItem {
  Sequence: number;
  Date: string;
  Description: string;
}

export type LogType = 'info' | 'error' | 'success';

/** Display-ready log line (already translated) consumed by TerminalConsole. */
export interface LogEntryItem {
  text: string;
  type: LogType;
  timestamp?: string;
}

/** Translatable message sent by the C# host: an i18n key plus optional interpolation args. */
export interface LocalizedMessage {
  key: string;
  args?: Record<string, unknown>;
}

/** Log entry stored in state as an i18n key, translated at render time so it follows language switches. */
export interface LogRecord {
  key: string;
  args?: Record<string, unknown>;
  type: LogType;
}
