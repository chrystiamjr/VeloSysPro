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
  {
    Name: 'backup_rede_2026-07-24_10-30-00.reg',
    CreatedAt: '2026-07-24T13:30:00.000Z',
    SizeBytes: 43520,
  },
  {
    Name: 'backup_rede_2026-07-23_09-15-00.reg',
    CreatedAt: '2026-07-23T12:15:00.000Z',
    SizeBytes: 39936,
  },
];

export const tasks: ScheduledTaskItem[] = [
  {
    Name: 'VeloSysPro_Quick_Daily_0300',
    State: 'Ready',
    Path: '\\VeloSysPro_Quick_Daily_0300',
    Type: 'quick',
    Frequency: 'DAILY',
    Day: '',
    Time: '03:00',
  },
  {
    Name: 'VeloSysPro_Gaming_Weekly_MON_0430',
    State: 'Running',
    Path: '\\VeloSysPro_Gaming_Weekly_MON_0430',
    Type: 'gaming',
    Frequency: 'WEEKLY',
    Day: 'MON',
    Time: '04:30',
  },
];

export const restorePoints: RestorePointItem[] = [
  {
    Sequence: 12,
    CreatedAt: '2026-07-24T11:00:00.000Z',
    Description: 'VeloSysPro_2026-07-24',
  },
  {
    Sequence: 7,
    CreatedAt: '2026-07-20T15:00:00.000Z',
    Description: 'Windows Update',
  },
];

export const updateInfo: UpdateInfo = {
  version: '0.9.0',
  url: 'https://github.com/chrystiamjr/VeloSysPro/releases/tag/v0.9.0',
};
