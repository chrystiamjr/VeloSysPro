/**
 * VeloSys Pro - TypeScript IPC Bridge Infrastructure Layer
 */
import {
  BackupItem,
  ScheduledTaskItem,
  RestorePointItem,
  AppSettings,
  UpdateInfo,
  LocalizedMessage,
  LogType,
} from '../domain/types';

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

export function subscribeLogs(callback: (message: LocalizedMessage, type: LogType) => void): void {
  window.onLogReceived = (message, type) => {
    if (typeof callback === 'function') callback(message, type);
  };
}

export function subscribeStatus(callback: (status: LocalizedMessage) => void): void {
  window.onStatusUpdated = (status) => {
    if (typeof callback === 'function') callback(status);
  };
}

export function subscribeProgress(callback: (percent: number) => void): void {
  window.onProgressUpdated = (percent) => {
    if (typeof callback === 'function') callback(percent);
  };
}

export function subscribeBackups(callback: (data: BackupItem[]) => void): void {
  window.onBackupsLoaded = (backupsJson) => {
    try {
      const data: BackupItem[] =
        typeof backupsJson === 'string' ? JSON.parse(backupsJson) : backupsJson;
      if (typeof callback === 'function') callback(data);
    } catch {
      if (typeof callback === 'function') callback([]);
    }
  };
}

export function subscribeTasks(callback: (data: ScheduledTaskItem[]) => void): void {
  window.onTasksLoaded = (tasksJson) => {
    try {
      const data: ScheduledTaskItem[] =
        typeof tasksJson === 'string' ? JSON.parse(tasksJson) : tasksJson;
      if (typeof callback === 'function') callback(data);
    } catch {
      if (typeof callback === 'function') callback([]);
    }
  };
}

export function subscribeRestorePoints(callback: (data: RestorePointItem[]) => void): void {
  window.onRestorePointsLoaded = (pointsJson) => {
    try {
      const data: RestorePointItem[] =
        typeof pointsJson === 'string' ? JSON.parse(pointsJson) : pointsJson;
      if (typeof callback === 'function') callback(data);
    } catch {
      if (typeof callback === 'function') callback([]);
    }
  };
}

export function subscribeSettings(callback: (data: AppSettings) => void): void {
  window.onSettingsLoaded = (settingsJson) => {
    try {
      const data: AppSettings =
        typeof settingsJson === 'string' ? JSON.parse(settingsJson) : settingsJson;
      if (typeof callback === 'function') callback(data);
    } catch {
      /* keep defaults */
    }
  };
}

export function subscribeUpdate(callback: (info: UpdateInfo) => void): void {
  window.onUpdateAvailable = (info) => {
    if (typeof callback === 'function' && info && info.version) callback(info);
  };
}
