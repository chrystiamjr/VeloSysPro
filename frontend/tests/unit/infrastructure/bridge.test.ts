import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitHostEventForTest,
  sendAction,
  subscribeActionFinished,
  subscribeBackups,
  subscribeHistory,
  subscribeLogs,
  subscribeProgress,
  subscribeSettings,
  subscribeSnapshot,
  subscribeTasks,
  subscribeTweaks,
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
const validTweak = {
  id: 'cpu.win32PrioritySeparation',
  category: 'cpu',
  riskTier: 'Safe',
  kind: 'registry',
  state: 'NotApplied',
};
const validCatalog = {
  tweaks: [validTweak],
  presets: [{ id: 'quick', tweakIds: ['cpu.win32PrioritySeparation'] }],
  systemProtectionEnabled: true,
};
const validSnapshot = {
  capturedAt: '2026-07-25T10:00:00.000Z',
  bootDurationMs: 21345,
  freeMemoryBytes: 8589934592,
  totalMemoryBytes: 17179869184,
  freeDiskBytes: 120000000000,
  totalDiskBytes: 500000000000,
  automaticServices: 94,
  runningServices: 71,
  startupApps: 13,
  pendingReboot: false,
  lastBootUpTime: '2026-07-25T08:00:00.000Z',
};
const validChange = {
  tweakId: 'cpu.win32PrioritySeparation',
  setting: 'Win32PrioritySeparation',
  before: '0x2',
  after: '0x26',
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

  it('routes a valid Tweak catalog to its subscriber', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeTweaks(callback);

    emitHostEventForTest('tweaksLoaded', validCatalog);

    expect(callback).toHaveBeenCalledWith(validCatalog);
    unsubscribe();
  });

  it.each([
    ['an unknown Tweak state', { ...validTweak, state: 'Pending' }],
    ['an unknown risk tier', { ...validTweak, riskTier: 'Dangerous' }],
    ['an unknown capture kind', { ...validTweak, kind: 'powershell' }],
    ['a non-string id', { ...validTweak, id: 42 }],
    ['an empty id', { ...validTweak, id: '' }],
    ['a non-string category', { ...validTweak, category: 7 }],
    ['no state at all', { id: 'cpu.a', category: 'cpu', riskTier: 'Safe', kind: 'registry' }],
  ])('keeps the last valid catalog when a Tweak has %s', (_label, tweak) => {
    const callback = vi.fn();
    const unsubscribe = subscribeTweaks(callback);
    emitHostEventForTest('tweaksLoaded', validCatalog);

    emitHostEventForTest('tweaksLoaded', {
      tweaks: [tweak],
      presets: [],
      systemProtectionEnabled: true,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(validCatalog);
    unsubscribe();
  });

  it('rejects a catalog whose presets are malformed', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeTweaks(callback);

    emitHostEventForTest('tweaksLoaded', {
      tweaks: [validTweak],
      presets: [{ id: 'quick', tweakIds: 'cpu.win32PrioritySeparation' }],
      systemProtectionEnabled: true,
    });

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it.each([
    ['a stringly-typed protection flag', 'yes'],
    ['a missing protection flag', undefined],
  ])('rejects a catalog with %s', (_label, systemProtectionEnabled) => {
    // The screen warns the user off optimizing on this value; a wrong one would hide the warning.
    const callback = vi.fn();
    const unsubscribe = subscribeTweaks(callback);

    emitHostEventForTest('tweaksLoaded', { ...validCatalog, systemProtectionEnabled });

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('carries the settings a batch actually changed', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', {
      before: validSnapshot,
      after: validSnapshot,
      changes: [validChange],
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ changes: [validChange] })
    );
    unsubscribe();
  });

  it.each([
    ['a non-string before value', { ...validChange, before: 38 }],
    ['a non-string after value', { ...validChange, after: 38 }],
    ['an empty setting name', { ...validChange, setting: '' }],
    ['an empty tweak id', { ...validChange, tweakId: '' }],
    ['no changes array at all', undefined],
  ])('rejects a measurement carrying %s', (_label, change) => {
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', {
      before: null,
      after: validSnapshot,
      changes: change === undefined ? undefined : [change],
    });

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('accepts a Snapshot whose boot identity could not be read', () => {
    // Rows written before the field existed, and machines where the query failed.
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', {
      before: null,
      after: { ...validSnapshot, lastBootUpTime: '' },
      changes: [],
    });

    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('rejects a Snapshot whose boot identity is neither a timestamp nor empty', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', {
      before: null,
      after: { ...validSnapshot, lastBootUpTime: '25/07/2026 08:00' },
      changes: [],
    });

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('accepts a standalone measurement with no baseline', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', { before: null, after: validSnapshot, changes: [] });

    expect(callback).toHaveBeenCalledWith({ before: null, after: validSnapshot, changes: [] });
    unsubscribe();
  });

  it.each([
    ['a non-ISO timestamp', { ...validSnapshot, capturedAt: '25/07/2026 10:00' }],
    ['a formatted memory figure', { ...validSnapshot, freeMemoryBytes: '8,0 GB' }],
    ['a formatted disk figure', { ...validSnapshot, freeDiskBytes: '120 GB' }],
    ['a negative boot duration', { ...validSnapshot, bootDurationMs: -1 }],
    ['a fractional service count', { ...validSnapshot, runningServices: 71.5 }],
    ['a stringly-typed pending reboot', { ...validSnapshot, pendingReboot: 'yes' }],
    ['a missing startup count', { ...validSnapshot, startupApps: undefined }],
  ])('rejects a Snapshot carrying %s', (_label, after) => {
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', { before: null, after, changes: [] });

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('rejects a snapshotCaptured Event with no measurement at all', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSnapshot(callback);

    emitHostEventForTest('snapshotCaptured', { before: validSnapshot, after: null, changes: [] });

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('validates the Optimization History as a series', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeHistory(callback);

    emitHostEventForTest('historyLoaded', [validSnapshot, validSnapshot]);
    emitHostEventForTest('historyLoaded', [validSnapshot, { capturedAt: 'nope' }]);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith([validSnapshot, validSnapshot]);
    unsubscribe();
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
