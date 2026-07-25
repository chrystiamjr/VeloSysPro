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

export type BackupItem = z.infer<typeof BackupItemSchema>;
export type ScheduledTaskItem = z.infer<typeof ScheduledTaskItemSchema>;
export type RestorePointItem = z.infer<typeof RestorePointItemSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type UpdateInfo = z.infer<typeof UpdateInfoSchema>;
export type LogType = z.infer<typeof LogTypeSchema>;
export type LocalizedMessage = z.infer<typeof LocalizedMessageSchema>;
export type IpcEventName = z.infer<typeof IpcEventNameSchema>;
export type IpcEventEnvelope = z.infer<typeof IpcEventEnvelopeSchema>;
