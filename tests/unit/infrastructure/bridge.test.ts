import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  subscribeBackups,
  subscribeLogs,
  subscribeRestorePoints,
  subscribeSettings,
  subscribeStatus,
  subscribeTasks,
  subscribeUpdate,
} from '../../../src/infrastructure/bridge';

const validTask = {
  Name: 'VeloSysPro_Quick_Daily_0300',
  State: 'Ready',
  Path: '\\VeloSysPro_Quick_Daily_0300',
};
const validBackup = { Name: 'backup.reg', Date: '24/07/2026 10:30', Size: '42.5 KB' };
const validPoint = { Sequence: 12, Date: '24/07/2026 08:00', Description: 'Windows Update' };
const validSettings = {
  language: 'pt_BR',
  createBackupBeforeOptimize: true,
  sidebarCollapsed: false,
};

describe('IPC bridge payload validation', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collections', () => {
    it('accepts a well-formed array', () => {
      const callback = vi.fn();
      subscribeTasks(callback);
      window.onTasksLoaded!([validTask]);

      expect(callback).toHaveBeenCalledWith([validTask]);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('accepts the same array serialized as JSON', () => {
      const callback = vi.fn();
      subscribeBackups(callback);
      window.onBackupsLoaded!(JSON.stringify([validBackup]));

      expect(callback).toHaveBeenCalledWith([validBackup]);
    });

    // This is the case the old unchecked cast let through: parseable JSON of the wrong shape.
    it('rejects a well-formed payload whose shape is wrong', () => {
      const callback = vi.fn();
      subscribeTasks(callback);
      window.onTasksLoaded!(JSON.stringify([{ Name: 'x', Status: 'Ready' }]));

      expect(callback).toHaveBeenCalledWith([]);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('onTasksLoaded payload rejected'),
        expect.anything()
      );
    });

    // One field at a time, so each schema field is independently load-bearing. A test that
    // omits several fields at once would still pass if any single one were relaxed.
    it.each([
      ['Sequence as a string', { ...validPoint, Sequence: '12' }],
      ['Date as a number', { ...validPoint, Date: 20260724 }],
      ['Description as a number', { ...validPoint, Description: 42 }],
      ['Description missing', { Sequence: 12, Date: '24/07/2026 08:00' }],
    ])('rejects a restore point with %s', (_label, point) => {
      const callback = vi.fn();
      subscribeRestorePoints(callback);
      window.onRestorePointsLoaded!([point] as never);

      expect(callback).toHaveBeenCalledWith([]);
      expect(errorSpy).toHaveBeenCalled();
    });

    it.each([
      ['Name missing', { State: 'Ready', Path: '\\x' }],
      ['State as a number', { ...validTask, State: 42 }],
      ['Path as a number', { ...validTask, Path: 7 }],
      ['Path missing', { Name: 'x', State: 'Ready' }],
    ])('rejects a task with %s', (_label, task) => {
      const callback = vi.fn();
      subscribeTasks(callback);
      window.onTasksLoaded!([task] as never);

      expect(callback).toHaveBeenCalledWith([]);
      expect(errorSpy).toHaveBeenCalled();
    });

    it.each([
      ['Name as a number', { ...validBackup, Name: 7 }],
      ['Date as a number', { ...validBackup, Date: 20260724 }],
      ['Size as a number', { ...validBackup, Size: 43520 }],
      ['Size missing', { Name: 'backup.reg', Date: '24/07/2026 10:30' }],
    ])('rejects a backup with %s', (_label, backup) => {
      const callback = vi.fn();
      subscribeBackups(callback);
      window.onBackupsLoaded!([backup] as never);

      expect(callback).toHaveBeenCalledWith([]);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('rejects a bare object where an array is expected', () => {
      const callback = vi.fn();
      subscribeTasks(callback);
      window.onTasksLoaded!(validTask as never);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it('falls back to an empty list for malformed JSON', () => {
      const callback = vi.fn();
      subscribeTasks(callback);
      window.onTasksLoaded!('{invalid');

      expect(callback).toHaveBeenCalledWith([]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('malformed JSON'));
    });

    it('strips fields the frontend does not know about', () => {
      const callback = vi.fn();
      subscribeTasks(callback);
      window.onTasksLoaded!([{ ...validTask, FutureHostField: 42 }] as never);

      expect(callback).toHaveBeenCalledWith([validTask]);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('settings', () => {
    it('accepts valid settings', () => {
      const callback = vi.fn();
      subscribeSettings(callback);
      window.onSettingsLoaded!(validSettings);

      expect(callback).toHaveBeenCalledWith(validSettings);
    });

    // Unlike collections, handing down an empty object would blank every preference.
    it.each([
      ['an unsupported locale', { ...validSettings, language: 'fr_FR' }],
      [
        'createBackupBeforeOptimize as a string',
        { ...validSettings, createBackupBeforeOptimize: 'yes' },
      ],
      ['sidebarCollapsed as a number', { ...validSettings, sidebarCollapsed: 1 }],
      ['missing preferences', { language: 'pt_BR' }],
    ])('keeps app defaults when settings arrive with %s', (_label, settings) => {
      const callback = vi.fn();
      subscribeSettings(callback);
      window.onSettingsLoaded!(settings as never);

      expect(callback).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('keeps app defaults for malformed settings JSON', () => {
      const callback = vi.fn();
      subscribeSettings(callback);
      window.onSettingsLoaded!('{invalid');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('update notice', () => {
    it('accepts a release with a version', () => {
      const callback = vi.fn();
      subscribeUpdate(callback);
      window.onUpdateAvailable!({ version: '0.9.0', url: 'https://example.test' });

      expect(callback).toHaveBeenCalledWith({ version: '0.9.0', url: 'https://example.test' });
    });

    it('ignores a release with no version, as the previous guard did', () => {
      const callback = vi.fn();
      subscribeUpdate(callback);
      window.onUpdateAvailable!({ version: '', url: 'https://example.test' });

      expect(callback).not.toHaveBeenCalled();
    });

    // The url is handed straight to openUrl, so a non-string would reach the host.
    it('ignores a release whose url is not a string', () => {
      const callback = vi.fn();
      subscribeUpdate(callback);
      window.onUpdateAvailable!({ version: '0.9.0', url: 42 } as never);

      expect(callback).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('log and status channels', () => {
    it('accepts a localized message', () => {
      const callback = vi.fn();
      subscribeLogs(callback);
      window.onLogReceived!({ key: 'log.task.created', args: { name: 'x' } }, 'success');

      expect(callback).toHaveBeenCalledWith(
        { key: 'log.task.created', args: { name: 'x' } },
        'success'
      );
    });

    // App.tsx reads `message.key` directly, so a null payload used to throw mid-callback.
    it('drops a message with no key instead of letting the consumer crash', () => {
      const callback = vi.fn();
      subscribeLogs(callback);

      expect(() => window.onLogReceived!(null as never, 'info')).not.toThrow();
      expect(callback).not.toHaveBeenCalled();
    });

    it('drops a message whose key is not a string', () => {
      const callback = vi.fn();
      subscribeLogs(callback);
      window.onLogReceived!({ key: 42 } as never, 'info');

      expect(callback).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('drops a message whose severity is not a known log type', () => {
      const callback = vi.fn();
      subscribeLogs(callback);
      window.onLogReceived!({ key: 'log.appStarted' }, 'catastrophe' as never);

      expect(callback).not.toHaveBeenCalled();
    });

    it('validates the status channel too', () => {
      const callback = vi.fn();
      subscribeStatus(callback);

      window.onStatusUpdated!({ key: 'status.idle' });
      expect(callback).toHaveBeenCalledWith({ key: 'status.idle' });

      callback.mockClear();
      window.onStatusUpdated!({ notAKey: true } as never);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
