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
  LOAD_TWEAKS: 'loadTweaks',
  APPLY_TWEAKS: 'applyTweaks',
  REVERT_TWEAK: 'revertTweak',
  CAPTURE_SNAPSHOT: 'captureSnapshot',
  LOAD_HISTORY: 'loadHistory',
  ENABLE_SYSTEM_PROTECTION: 'enableSystemProtection',
} as const;

export type SystemActionType = (typeof SystemActions)[keyof typeof SystemActions];

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
  args?: Record<string, unknown>;
  type: LogType;
}
