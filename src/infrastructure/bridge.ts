/**
 * VeloSys Pro - TypeScript IPC Bridge Infrastructure Layer
 */
import { z } from 'zod';
import {
  BackupItem,
  ScheduledTaskItem,
  RestorePointItem,
  AppSettings,
  UpdateInfo,
  LocalizedMessage,
  LogType,
} from '../domain/types';
import {
  AppSettingsSchema,
  BackupItemSchema,
  LocalizedMessageSchema,
  LogTypeSchema,
  RestorePointItemSchema,
  ScheduledTaskItemSchema,
  UpdateInfoSchema,
} from '../domain/schemas';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: { action: string; payload: string }) => void;
        addEventListener: (type: string, listener: (event: Event) => void) => void;
      };
    };
    onLogReceived?: (message: LocalizedMessage, type: LogType) => void;
    onStatusUpdated?: (status: LocalizedMessage) => void;
    onProgressUpdated?: (percent: number) => void;
    onBackupsLoaded?: (backupsJson: string | BackupItem[]) => void;
    onTasksLoaded?: (tasksJson: string | ScheduledTaskItem[]) => void;
    onRestorePointsLoaded?: (pointsJson: string | RestorePointItem[]) => void;
    onSettingsLoaded?: (settingsJson: string | AppSettings) => void;
    onUpdateAvailable?: (info: UpdateInfo) => void;
    onActionFinished?: (action: string, ok: boolean) => void;
  }
}

export function sendAction(action: string, payload: string = ''): void {
  try {
    const winExt = (
      window as unknown as { external?: { ExecuteAction?: (a: string, p: string) => void } }
    ).external;
    if (winExt && typeof winExt.ExecuteAction === 'function') {
      winExt.ExecuteAction(action, payload);
    } else if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ action, payload });
    } else {
      console.info(`[IPC Bridge Mock] Action triggered: ${action}`, payload);
    }
  } catch (error) {
    console.error(`[IPC Bridge Error] Failed to send action: ${action}`, error);
  }
}

/**
 * Validates one inbound payload as received.
 *
 * Returns `null` and logs the reason on failure, so a host contract change becomes a
 * diagnosable console error instead of a blank screen. Callers decide the fallback.
 */
function readPayload<T>(channel: string, schema: z.ZodType<T>, raw: unknown): T | null {
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.error(`[IPC Bridge] ${channel} payload rejected`, result.error.issues);
    return null;
  }

  return result.data;
}

/**
 * Same, for the channels the host may send either as an object or as a JSON string.
 *
 * Kept separate on purpose: unwrapping every string as JSON would break channels whose payload
 * is legitimately a bare string, such as a log severity.
 */
function readJsonPayload<T>(channel: string, schema: z.ZodType<T>, raw: unknown): T | null {
  if (typeof raw !== 'string') return readPayload(channel, schema, raw);

  try {
    return readPayload(channel, schema, JSON.parse(raw));
  } catch {
    console.error(`[IPC Bridge] ${channel} received malformed JSON`);
    return null;
  }
}

export function subscribeLogs(callback: (message: LocalizedMessage, type: LogType) => void): void {
  window.onLogReceived = (message, type) => {
    if (typeof callback !== 'function') return;

    const parsedMessage = readPayload('onLogReceived', LocalizedMessageSchema, message);
    const parsedType = readPayload('onLogReceived.type', LogTypeSchema, type);
    if (!parsedMessage || !parsedType) return;

    callback(parsedMessage, parsedType);
  };
}

export function subscribeStatus(callback: (status: LocalizedMessage) => void): void {
  window.onStatusUpdated = (status) => {
    if (typeof callback !== 'function') return;

    const parsed = readPayload('onStatusUpdated', LocalizedMessageSchema, status);
    if (parsed) callback(parsed);
  };
}

export function subscribeProgress(callback: (percent: number) => void): void {
  window.onProgressUpdated = (percent) => {
    if (typeof callback === 'function') callback(percent);
  };
}

export function subscribeBackups(callback: (data: BackupItem[]) => void): void {
  window.onBackupsLoaded = (backupsJson) => {
    if (typeof callback !== 'function') return;

    const data = readJsonPayload('onBackupsLoaded', z.array(BackupItemSchema), backupsJson);
    callback(data ?? []);
  };
}

export function subscribeTasks(callback: (data: ScheduledTaskItem[]) => void): void {
  window.onTasksLoaded = (tasksJson) => {
    if (typeof callback !== 'function') return;

    const data = readJsonPayload('onTasksLoaded', z.array(ScheduledTaskItemSchema), tasksJson);
    callback(data ?? []);
  };
}

export function subscribeRestorePoints(callback: (data: RestorePointItem[]) => void): void {
  window.onRestorePointsLoaded = (pointsJson) => {
    if (typeof callback !== 'function') return;

    const data = readJsonPayload(
      'onRestorePointsLoaded',
      z.array(RestorePointItemSchema),
      pointsJson
    );
    callback(data ?? []);
  };
}

export function subscribeSettings(callback: (data: AppSettings) => void): void {
  window.onSettingsLoaded = (settingsJson) => {
    if (typeof callback !== 'function') return;

    // Unlike the collections, an unusable payload here keeps the app's defaults rather than
    // handing down an empty object that would blank out every preference.
    const data = readJsonPayload('onSettingsLoaded', AppSettingsSchema, settingsJson);
    if (data) callback(data);
  };
}

export function subscribeUpdate(callback: (info: UpdateInfo) => void): void {
  window.onUpdateAvailable = (info) => {
    if (typeof callback !== 'function') return;

    // The schema requires a non-empty version, which is what the old `info.version` guard did.
    const parsed = readPayload('onUpdateAvailable', UpdateInfoSchema, info);
    if (parsed) callback(parsed);
  };
}

export function subscribeActionFinished(callback: (action: string, ok: boolean) => void): void {
  window.onActionFinished = (action, ok) => {
    if (typeof callback === 'function') callback(action, ok);
  };
}
