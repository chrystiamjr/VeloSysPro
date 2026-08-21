/**
 * VeloSys Pro IPC Bridge.
 *
 * React sends Actions to the Windows host. The host emits facts through one WebView2 Event
 * channel, and this module owns dispatch plus runtime validation for every Event payload.
 */
import { z } from 'zod';
import {
  ActionFinishedPayloadSchema,
  AppSettingsSchema,
  BackupItemSchema,
  IpcEventEnvelopeSchema,
  LocalizedMessageSchema,
  LogReceivedPayloadSchema,
  OptimizationSnapshotSchema,
  RestorePointItemSchema,
  ScheduledTaskItemSchema,
  SnapshotCapturedPayloadSchema,
  TweakCatalogSchema,
  UpdateInfoSchema,
  type AppSettings,
  type BackupItem,
  type IpcEventName,
  type LocalizedMessage,
  type LogType,
  type OptimizationSnapshot,
  type RestorePointItem,
  type ScheduledTaskItem,
  type SnapshotCapturedPayload,
  type TweakCatalog,
  type UpdateInfo,
} from '../domain/schemas';

interface WebViewMessageEvent extends Event {
  data: unknown;
}

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: { action: string; payload: unknown }) => void;
        addEventListener: (type: 'message', listener: (event: WebViewMessageEvent) => void) => void;
        removeEventListener?: (
          type: 'message',
          listener: (event: WebViewMessageEvent) => void
        ) => void;
      };
    };
  }
}

type EventListener = (payload: unknown) => void;
type Unsubscribe = () => void;
type WebViewTransport = NonNullable<NonNullable<Window['chrome']>['webview']>;

const listeners = new Map<IpcEventName, Set<EventListener>>();
const rejectionListeners = new Set<(channel: string) => void>();
let listeningWebView: WebViewTransport | undefined;

function reject(channel: string, issues: unknown): void {
  console.error(`[IPC Bridge] ${channel} payload rejected`, issues);
  for (const listener of rejectionListeners) listener(channel);
}

/**
 * Observes payloads this module refused.
 *
 * Rejecting keeps the last valid state on screen, which is the right behaviour and also an
 * invisible one: the user sees data that silently stopped updating. Screens subscribe here to say
 * so, without every one of them having to re-validate anything.
 */
export function subscribeRejections(callback: (channel: string) => void): Unsubscribe {
  rejectionListeners.add(callback);
  return () => {
    rejectionListeners.delete(callback);
  };
}

function readPayload<T>(channel: string, schema: z.ZodType<T>, raw: unknown): T | null {
  const result = schema.safeParse(raw);
  if (!result.success) {
    reject(channel, result.error.issues);
    return null;
  }
  return result.data;
}

function dispatchHostEvent(raw: unknown): void {
  const envelope = IpcEventEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    reject('event envelope', envelope.error.issues);
    return;
  }

  for (const listener of listeners.get(envelope.data.event) ?? []) {
    listener(envelope.data.payload);
  }
}

function onWebViewMessage(event: WebViewMessageEvent): void {
  dispatchHostEvent(event.data);
}

function ensureEventChannel(): void {
  const webview = window.chrome?.webview;
  if (!webview || webview === listeningWebView) return;

  listeningWebView?.removeEventListener?.('message', onWebViewMessage);
  webview.addEventListener('message', onWebViewMessage);
  listeningWebView = webview;
}

function subscribe(event: IpcEventName, listener: EventListener): Unsubscribe {
  ensureEventChannel();
  const eventListeners = listeners.get(event) ?? new Set<EventListener>();
  eventListeners.add(listener);
  listeners.set(event, eventListeners);
  return () => {
    eventListeners.delete(listener);
  };
}

export function sendAction(action: string, payload: unknown = null): void {
  try {
    const webview = window.chrome?.webview;
    if (webview) {
      webview.postMessage({ action, payload });
    } else {
      console.info(`[IPC Bridge Mock] Action triggered: ${action}`, payload);
    }
  } catch (error) {
    console.error(`[IPC Bridge Error] Failed to send action: ${action}`, error);
  }
}

export function subscribeLogs(
  callback: (message: LocalizedMessage, type: LogType) => void
): Unsubscribe {
  return subscribe('logReceived', (raw) => {
    const payload = readPayload('logReceived', LogReceivedPayloadSchema, raw);
    if (payload) callback(payload.message, payload.type);
  });
}

export function subscribeStatus(callback: (status: LocalizedMessage) => void): Unsubscribe {
  return subscribe('statusUpdated', (raw) => {
    const payload = readPayload('statusUpdated', LocalizedMessageSchema, raw);
    if (payload) callback(payload);
  });
}

export function subscribeProgress(callback: (percent: number) => void): Unsubscribe {
  return subscribe('progressUpdated', (raw) => {
    const payload = readPayload('progressUpdated', z.number().finite(), raw);
    if (payload !== null) callback(payload);
  });
}

function subscribeCollection<T>(
  event: IpcEventName,
  schema: z.ZodType<T>,
  callback: (data: T) => void
): Unsubscribe {
  return subscribe(event, (raw) => {
    const payload = readPayload(event, schema, raw);
    if (payload) callback(payload);
  });
}

export function subscribeBackups(callback: (data: BackupItem[]) => void): Unsubscribe {
  return subscribeCollection('backupsLoaded', z.array(BackupItemSchema), callback);
}

export function subscribeTasks(callback: (data: ScheduledTaskItem[]) => void): Unsubscribe {
  return subscribeCollection('tasksLoaded', z.array(ScheduledTaskItemSchema), callback);
}

export function subscribeRestorePoints(callback: (data: RestorePointItem[]) => void): Unsubscribe {
  return subscribeCollection('restorePointsLoaded', z.array(RestorePointItemSchema), callback);
}

export function subscribeTweaks(callback: (data: TweakCatalog) => void): Unsubscribe {
  return subscribeCollection('tweaksLoaded', TweakCatalogSchema, callback);
}

export function subscribeSnapshot(
  callback: (payload: SnapshotCapturedPayload) => void
): Unsubscribe {
  return subscribeCollection('snapshotCaptured', SnapshotCapturedPayloadSchema, callback);
}

export function subscribeHistory(callback: (data: OptimizationSnapshot[]) => void): Unsubscribe {
  return subscribeCollection('historyLoaded', z.array(OptimizationSnapshotSchema), callback);
}

export function subscribeSettings(callback: (data: AppSettings) => void): Unsubscribe {
  return subscribe('settingsLoaded', (raw) => {
    const payload = readPayload('settingsLoaded', AppSettingsSchema, raw);
    if (payload) callback(payload);
  });
}

export function subscribeUpdate(callback: (info: UpdateInfo) => void): Unsubscribe {
  return subscribe('updateAvailable', (raw) => {
    const payload = readPayload('updateAvailable', UpdateInfoSchema, raw);
    if (payload) callback(payload);
  });
}

export function subscribeActionFinished(
  callback: (action: string, ok: boolean) => void
): Unsubscribe {
  return subscribe('actionFinished', (raw) => {
    const payload = readPayload('actionFinished', ActionFinishedPayloadSchema, raw);
    if (payload) callback(payload.action, payload.ok);
  });
}

/** Test adapter: exercises the same envelope and validation path as WebView2. */
export function emitHostEventForTest(event: IpcEventName, payload: unknown): void {
  dispatchHostEvent({ event, payload });
}
