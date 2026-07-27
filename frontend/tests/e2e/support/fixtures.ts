import type {
  AppSettings,
  BackupItem,
  OptimizationSnapshot,
  RestorePointItem,
  ScheduledTaskItem,
  TweakCatalog,
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

/** Mirrors what TweakCatalog.CreateDefault seeds: one Tweak per revert mechanism. */
export const tweakCatalog: TweakCatalog = {
  tweaks: [
    {
      id: 'cpu.win32PrioritySeparation',
      category: 'cpu',
      riskTier: 'Safe',
      kind: 'registry',
      state: 'NotApplied',
      recommended: false,
    },
    {
      id: 'boot.disableDynamicTick',
      category: 'boot',
      riskTier: 'Safe',
      kind: 'bcd',
      state: 'NotApplied',
      recommended: false,
    },
    {
      id: 'services.sysMain',
      category: 'services',
      riskTier: 'Safe',
      kind: 'service',
      state: 'NotApplied',
      recommended: false,
    },
  ],
  systemProtectionEnabled: true,
  presets: [
    {
      id: 'quick',
      tweakIds: ['cpu.win32PrioritySeparation', 'boot.disableDynamicTick', 'services.sysMain'],
    },
  ],
};

export const appliedTweakCatalog: TweakCatalog = {
  ...tweakCatalog,
  tweaks: tweakCatalog.tweaks.map((tweak) => ({ ...tweak, state: 'Applied' as const })),
};

/**
 * Mixed tiers and an unknown category. No Advanced Tweak ships yet — E5 adds them — so this is the
 * only place the gate around them can be exercised end to end.
 */
export const mixedTweakCatalog: TweakCatalog = {
  ...tweakCatalog,
  tweaks: [
    ...tweakCatalog.tweaks,
    {
      id: 'advanced.memoryIntegrity',
      category: 'security',
      riskTier: 'Advanced',
      kind: 'registry',
      state: 'NotApplied',
      recommended: false,
    },
    {
      id: 'network.tcpTuning',
      category: 'somethingNewTheHostInvented',
      riskTier: 'Safe',
      kind: 'registry',
      state: 'NotApplied',
      recommended: false,
    },
  ],
};

export const snapshotBefore: OptimizationSnapshot = {
  capturedAt: '2026-07-25T10:00:00.000Z',
  bootDurationMs: 32000,
  freeMemoryBytes: 4194304,
  totalMemoryBytes: 17179869184,
  freeDiskBytes: 10485760,
  totalDiskBytes: 500000000000,
  automaticServices: 100,
  runningServices: 80,
  startupApps: 15,
  pendingReboot: false,
  lastBootUpTime: '2026-07-25T08:00:00.000Z',
};

export const snapshotAfter: OptimizationSnapshot = {
  ...snapshotBefore,
  capturedAt: '2026-07-25T10:04:00.000Z',
  bootDurationMs: 21500,
  freeMemoryBytes: 8388608,
  automaticServices: 94,
  runningServices: 71,
};

export const updateInfo: UpdateInfo = {
  version: '0.9.0',
  url: 'https://github.com/chrystiamjr/VeloSysPro/releases/tag/v0.9.0',
};
