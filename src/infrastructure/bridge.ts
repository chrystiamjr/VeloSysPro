/**
 * VeloSys Pro - TypeScript IPC Bridge Infrastructure Layer
 */
import { BackupItem, ScheduledTaskItem } from '../domain/types';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: { action: string; payload: string }) => void;
        addEventListener: (type: string, listener: (event: Event) => void) => void;
      };
    };
    onLogReceived?: (message: string, type: 'info' | 'error' | 'success') => void;
    onStatusUpdated?: (statusMessage: string) => void;
    onProgressUpdated?: (percent: number) => void;
    onBackupsLoaded?: (backupsJson: string | BackupItem[]) => void;
    onTasksLoaded?: (tasksJson: string | ScheduledTaskItem[]) => void;
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

export function subscribeLogs(
  callback: (message: string, type: 'info' | 'error' | 'success') => void
): void {
  window.onLogReceived = (message, type) => {
    if (typeof callback === 'function') callback(message, type);
  };
}

export function subscribeStatus(callback: (statusMessage: string) => void): void {
  window.onStatusUpdated = (statusMessage) => {
    if (typeof callback === 'function') callback(statusMessage);
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
