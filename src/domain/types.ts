/**
 * VeloSys Pro - TypeScript Domain Interfaces & Contracts
 */

export const SystemActions = {
  RUN_QUICK_OPTIMIZATION: 'runQuickOptimization',
  RUN_FULL_OPTIMIZATION: 'runFullOptimization',
  RUN_GAMING_MODE: 'runGamingMode',
  REVERT_DEFAULTS: 'revertDefaults',
  CREATE_MANUAL_BACKUP: 'createManualBackup',
  RESTORE_BACKUP: 'restoreBackup',
  CREATE_RESTORE_POINT: 'createRestorePoint',
  OPEN_LOGS: 'openLogs',
  OPEN_BACKUPS: 'openBackups',
  OPEN_RESTORE_POINTS: 'openRestorePoints',
  GET_BACKUPS: 'getBackups',
  GET_TASKS: 'getTasks',
} as const;

export type SystemActionType = (typeof SystemActions)[keyof typeof SystemActions];

export enum AppScreen {
  Dashboard = 'Dashboard',
  Scheduling = 'Scheduling',
  Backup = 'Backup',
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

export interface LogEntryItem {
  text: string;
  type: 'info' | 'error' | 'success';
  timestamp?: string;
}
