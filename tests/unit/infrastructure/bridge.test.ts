import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitHostEventForTest,
  sendAction,
  subscribeActionFinished,
  subscribeBackups,
  subscribeLogs,
  subscribeProgress,
  subscribeSettings,
  subscribeTasks,
  subscribeUpdate,
} from '../../../src/infrastructure/bridge';

const validTask = {
  Name: 'VeloSysPro_Quick_Daily_0300',
  State: 'Ready',
  Path: '\\VeloSysPro_Quick_Daily_0300',
  Type: 'quick',
  Frequency: 'DAILY',
  Day: '',
  Time: '03:00',
};
const validBackup = {
  Name: 'backup.reg',
  CreatedAt: '2026-07-24T13:30:00.000Z',
  SizeBytes: 43520,
};
const validSettings = {
  language: 'pt_BR' as const,
  createBackupBeforeOptimize: true,
  sidebarCollapsed: false,
};

describe('IPC Event module', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Actions only through the WebView2 transport', () => {
    sendAction('getTasks', 'payload');

    expect(window.chrome?.webview?.postMessage).toHaveBeenCalledWith({
      action: 'getTasks',
      payload: 'payload',
    });
  });

  it('registers one native WebView2 message listener', () => {
    subscribeTasks(vi.fn());
    subscribeBackups(vi.fn());

    expect(window.chrome?.webview?.addEventListener).toHaveBeenCalledTimes(1);
    expect(window.chrome?.webview?.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    );
  });

  it('routes a valid Event to its subscriber', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeTasks(callback);

    emitHostEventForTest('tasksLoaded', [validTask]);

    expect(callback).toHaveBeenCalledWith([validTask]);
    unsubscribe();
  });

  it('keeps the last valid collection when a later payload is invalid', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeBackups(callback);
    emitHostEventForTest('backupsLoaded', [validBackup]);
    emitHostEventForTest('backupsLoaded', [{ Name: 'broken' }]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([validBackup]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('backupsLoaded payload rejected'),
      expect.anything()
    );
    unsubscribe();
  });

  it('strips unknown record fields', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeTasks(callback);

    emitHostEventForTest('tasksLoaded', [{ ...validTask, FutureHostField: 42 }]);

    expect(callback).toHaveBeenCalledWith([validTask]);
    unsubscribe();
  });

  it('validates log Events as one payload', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeLogs(callback);

    emitHostEventForTest('logReceived', {
      message: { key: 'log.appStarted' },
      type: 'success',
    });
    emitHostEventForTest('logReceived', {
      message: { key: 42 },
      type: 'catastrophe',
    });

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ key: 'log.appStarted' }, 'success');
    unsubscribe();
  });

  it('validates progress and authoritative completion Events', () => {
    const progress = vi.fn();
    const finished = vi.fn();
    const unsubscribeProgress = subscribeProgress(progress);
    const unsubscribeFinished = subscribeActionFinished(finished);

    emitHostEventForTest('progressUpdated', 100);
    emitHostEventForTest('actionFinished', { action: 'getTasks', ok: true });
    emitHostEventForTest('actionFinished', { action: 'getTasks', ok: 'yes' });

    expect(progress).toHaveBeenCalledWith(100);
    expect(finished).toHaveBeenCalledOnce();
    expect(finished).toHaveBeenCalledWith('getTasks', true);
    unsubscribeProgress();
    unsubscribeFinished();
  });

  it('keeps settings defaults and update state when payloads are invalid', () => {
    const settings = vi.fn();
    const update = vi.fn();
    const unsubscribeSettings = subscribeSettings(settings);
    const unsubscribeUpdate = subscribeUpdate(update);

    emitHostEventForTest('settingsLoaded', validSettings);
    emitHostEventForTest('settingsLoaded', { language: 'fr_FR' });
    emitHostEventForTest('updateAvailable', { version: '', url: 42 });

    expect(settings).toHaveBeenCalledOnce();
    expect(settings).toHaveBeenCalledWith(validSettings);
    expect(update).not.toHaveBeenCalled();
    unsubscribeSettings();
    unsubscribeUpdate();
  });
});
