/**
 * VeloSys Pro - Runtime schemas for everything the C# host sends us.
 *
 * TypeScript types are erased at runtime, so `JSON.parse(...) as ScheduledTaskItem[]` is a
 * promise the compiler cannot keep. The host serializes its own records and injects them
 * straight into the page (`MainWindow.xaml.cs` -> `EvalJs`), so a shape change on the C# side
 * used to surface as a blank or wrong table with no diagnostic.
 *
 * These schemas are the single source of truth: the interfaces in `types.ts` are inferred from
 * them, so a schema and its type cannot drift apart.
 */
import { z } from 'zod';

/** Objects are non-strict on purpose: the host may add fields, and extras are stripped. */
export const BackupItemSchema = z.object({
  Name: z.string(),
  CreatedAt: z.iso.datetime(),
  SizeBytes: z.number().int().nonnegative(),
});

export const ScheduledTaskItemSchema = z.object({
  Name: z.string(),
  // Left open: Get-ScheduledTask reports Ready/Running/Disabled/Queued/Unknown, and
  // describeTaskState already falls back for anything it does not recognize.
  State: z.string(),
  Path: z.string(),
  Type: z.enum(['quick', 'full', 'gaming', 'revert']).or(z.literal('')),
  Frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).or(z.literal('')),
  Day: z.string(),
  Time: z.string(),
});

export const RestorePointItemSchema = z.object({
  Sequence: z.number(),
  CreatedAt: z.iso.datetime(),
  Description: z.string(),
});

export const AppSettingsSchema = z.object({
  // Narrow: an unknown locale would leave the UI untranslated, so reject it and keep defaults.
  language: z.enum(['pt_BR', 'en_US']),
  createBackupBeforeOptimize: z.boolean(),
  sidebarCollapsed: z.boolean(),
});

export const UpdateInfoSchema = z.object({
  version: z.string().min(1),
  url: z.string(),
});

/** Narrow: the badge and the Revert control branch on this, so an unknown state must be rejected. */
export const TweakStateSchema = z.enum(['Applied', 'NotApplied', 'Partial']);

export const RiskTierSchema = z.enum(['Safe', 'Advanced']);

export const TweakSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  riskTier: RiskTierSchema,
  kind: z.enum(['registry', 'bcd', 'service', 'power']),
  state: TweakStateSchema,
  /** Curated by the host: what the catalog stands behind for someone who will not read every entry. */
  recommended: z.boolean(),
  /**
   * Written immediately, but only in effect after a restart. Structured rather than a sentence in
   * the description, so the badge cannot depend on which language the description was written in.
   */
  requiresReboot: z.boolean(),
});

export const PresetSchema = z.object({
  id: z.string().min(1),
  tweakIds: z.array(z.string().min(1)),
});

export const TweakCatalogSchema = z.object({
  tweaks: z.array(TweakSchema),
  presets: z.array(PresetSchema),
  /** Whether Windows System Protection is on — the precondition for every Safety Checkpoint. */
  systemProtectionEnabled: z.boolean(),
});

/**
 * One setting a batch actually moved, read off the live system before and after. An empty string
 * means the setting was absent at that point; the values are raw registry/service data, never
 * localized text.
 */
export const TweakChangeSchema = z.object({
  tweakId: z.string().min(1),
  setting: z.string().min(1),
  before: z.string(),
  after: z.string(),
});

/**
 * Every metric is a number the host measured, never a formatted string: the diff is rendered and
 * compared in React, so a culture-formatted value would break both.
 */
export const OptimizationSnapshotSchema = z.object({
  capturedAt: z.iso.datetime(),
  bootDurationMs: z.number().int().nonnegative(),
  freeMemoryBytes: z.number().int().nonnegative(),
  totalMemoryBytes: z.number().int().nonnegative(),
  freeDiskBytes: z.number().int().nonnegative(),
  totalDiskBytes: z.number().int().nonnegative(),
  automaticServices: z.number().int().nonnegative(),
  runningServices: z.number().int().nonnegative(),
  startupApps: z.number().int().nonnegative(),
  pendingReboot: z.boolean(),
  /**
   * The Snapshot's boot identity. Two Snapshots sharing it came from the same session, so their
   * boot duration cannot differ. Empty when unreadable, or on rows written before this existed.
   */
  lastBootUpTime: z.union([z.iso.datetime(), z.literal('')]),
});

/**
 * `before` is null for a standalone measurement, which has no baseline to compare against.
 * `changes` is the attributable half of the report; the Snapshots around it are context.
 */
export const SnapshotCapturedPayloadSchema = z.object({
  before: OptimizationSnapshotSchema.nullable(),
  after: OptimizationSnapshotSchema,
  changes: z.array(TweakChangeSchema),
});

export const LogTypeSchema = z.enum(['info', 'error', 'success']);

export const LocalizedMessageSchema = z.object({
  key: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
});

export const IpcEventNameSchema = z.enum([
  'logReceived',
  'statusUpdated',
  'progressUpdated',
  'backupsLoaded',
  'tasksLoaded',
  'restorePointsLoaded',
  'settingsLoaded',
  'updateAvailable',
  'actionFinished',
  'tweaksLoaded',
  'snapshotCaptured',
  'historyLoaded',
]);

export const IpcEventEnvelopeSchema = z.object({
  event: IpcEventNameSchema,
  payload: z.unknown(),
});

export const LogReceivedPayloadSchema = z.object({
  message: LocalizedMessageSchema,
  type: LogTypeSchema,
});

export const ActionFinishedPayloadSchema = z.object({
  action: z.string(),
  ok: z.boolean(),
});

export type Tweak = z.infer<typeof TweakSchema>;
export type TweakState = z.infer<typeof TweakStateSchema>;
export type RiskTier = z.infer<typeof RiskTierSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type TweakCatalog = z.infer<typeof TweakCatalogSchema>;
export type TweakChange = z.infer<typeof TweakChangeSchema>;
export type OptimizationSnapshot = z.infer<typeof OptimizationSnapshotSchema>;
export type SnapshotCapturedPayload = z.infer<typeof SnapshotCapturedPayloadSchema>;
export type BackupItem = z.infer<typeof BackupItemSchema>;
export type ScheduledTaskItem = z.infer<typeof ScheduledTaskItemSchema>;
export type RestorePointItem = z.infer<typeof RestorePointItemSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type UpdateInfo = z.infer<typeof UpdateInfoSchema>;
export type LogType = z.infer<typeof LogTypeSchema>;
export type LocalizedMessage = z.infer<typeof LocalizedMessageSchema>;
export type IpcEventName = z.infer<typeof IpcEventNameSchema>;
export type IpcEventEnvelope = z.infer<typeof IpcEventEnvelopeSchema>;
