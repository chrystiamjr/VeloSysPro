import type {
  AppSettings,
  BackupItem,
  RestorePointItem,
  ScheduledTaskItem,
  UpdateInfo,
} from '../../../src/domain/types';

export const defaultSettings: AppSettings = {
  language: 'pt_BR',
  createBackupBeforeOptimize: true,
  sidebarCollapsed: false,
};

export const backups: BackupItem[] = [
  { Name: 'backup_rede_2026-07-24_10-30-00.reg', Date: '24/07/2026 10:30', Size: '42.5 KB' },
  { Name: 'backup_rede_2026-07-23_09-15-00.reg', Date: '23/07/2026 09:15', Size: '39.0 KB' },
];

export const tasks: ScheduledTaskItem[] = [
  { Name: 'VeloSysPro_Quick', State: 'Ready', Path: '\\VeloSysPro_Quick' },
  { Name: 'VeloSysPro_Gaming', State: 'Running', Path: '\\VeloSysPro_Gaming' },
];

export const restorePoints: RestorePointItem[] = [
  { Sequence: 12, Date: '24/07/2026 08:00', Description: 'VeloSysPro_2026-07-24' },
  { Sequence: 7, Date: '20/07/2026 12:00', Description: 'Windows Update' },
];

export const updateInfo: UpdateInfo = {
  version: '0.9.0',
  url: 'https://github.com/chrystiamjr/VeloSysPro/releases/tag/v0.9.0',
};
