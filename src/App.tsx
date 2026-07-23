import { useState, useEffect, useRef } from 'react';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './components/pages/DashboardPage';
import { SchedulingPage } from './components/pages/SchedulingPage';
import { BackupPage } from './components/pages/BackupPage';
import { RestorePointsPage } from './components/pages/RestorePointsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import {
  AppScreen,
  SystemHealth,
  LogEntryItem,
  LogRecord,
  LocalizedMessage,
  BackupItem,
  ScheduledTaskItem,
  RestorePointItem,
  AppSettings,
  SystemActions,
} from './domain/types';
import { useTranslation, LanguageProvider } from './infrastructure/i18nContext';
import {
  sendAction,
  subscribeLogs,
  subscribeStatus,
  subscribeProgress,
  subscribeBackups,
  subscribeTasks,
  subscribeRestorePoints,
  subscribeSettings,
} from './infrastructure/bridge';

const SCREEN_HEADERS: Record<AppScreen, { title: string; subtitle: string }> = {
  [AppScreen.Dashboard]: { title: 'headerDashboardTitle', subtitle: 'headerDashboardSubtitle' },
  [AppScreen.Scheduling]: { title: 'headerSchedulingTitle', subtitle: 'headerSchedulingSubtitle' },
  [AppScreen.Backup]: { title: 'headerBackupTitle', subtitle: 'headerBackupSubtitle' },
  [AppScreen.RestorePoints]: {
    title: 'headerRestorePointsTitle',
    subtitle: 'headerRestorePointsSubtitle',
  },
  [AppScreen.Settings]: { title: 'headerSettingsTitle', subtitle: 'headerSettingsSubtitle' },
};

function AppContent() {
  const { t, lang, setLang } = useTranslation();
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.Dashboard);
  const [status, setStatus] = useState<LocalizedMessage>({ key: 'statusIdle' });
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    language: 'pt_BR',
    createBackupBeforeOptimize: true,
  });
  const settingsLoaded = useRef(false);
  const [logs, setLogs] = useState<LogRecord[]>([{ key: 'logAppStarted', type: 'success' }]);

  const [health, setHealth] = useState<SystemHealth>({
    admin: 'Sim',
    backupsCount: 0,
    latestBackup: 'Nenhum',
    tasksCount: 0,
    status: 'ready',
  });

  useEffect(() => {
    subscribeLogs((msg, type) => {
      setLogs((prev) => [...prev, { key: msg.key, args: msg.args, type }]);
    });

    subscribeStatus((msg) => {
      setStatus(msg);
    });

    subscribeProgress((percent) => {
      setProgressPercent(percent);
      setHealth((prev) => ({ ...prev, status: percent < 100 ? 'executing' : 'ready' }));
    });

    subscribeBackups((data) => {
      setBackups(data);
      setHealth((prev) => ({
        ...prev,
        backupsCount: data.length,
        latestBackup: data.length > 0 ? data[0].Date : 'Nenhum',
      }));
    });

    subscribeTasks((data) => {
      setTasks(data);
      setHealth((prev) => ({ ...prev, tasksCount: data.length }));
    });

    subscribeRestorePoints((data) => {
      setRestorePoints(data);
    });

    subscribeSettings((data) => {
      setSettings(data);
      if (data.language === 'pt_BR' || data.language === 'en_US') setLang(data.language);
      settingsLoaded.current = true;
    });

    sendAction(SystemActions.GET_BACKUPS);
    sendAction(SystemActions.GET_TASKS);
    sendAction(SystemActions.GET_RESTORE_POINTS);
    sendAction(SystemActions.GET_SETTINGS);
  }, [setLang]);

  // Persist language whenever it changes (including the sidebar quick-switch).
  useEffect(() => {
    if (!settingsLoaded.current) return;
    setSettings((prev) => {
      const next = { ...prev, language: lang };
      sendAction(SystemActions.SAVE_SETTINGS, JSON.stringify(next));
      return next;
    });
  }, [lang]);

  const handleToggleBackup = (value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, createBackupBeforeOptimize: value };
      sendAction(SystemActions.SAVE_SETTINGS, JSON.stringify(next));
      return next;
    });
  };

  const handleAction = (action: string, payload?: string) => {
    sendAction(action, payload);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  // Translate at render time so logs/status re-localize when the language changes.
  const translatedLogs: LogEntryItem[] = logs.map((log) => ({
    text: log.key === 'logRaw' ? String(log.args?.text ?? '') : t(log.key, log.args),
    type: log.type,
  }));
  const statusMessage = t(status.key, status.args);
  const header = SCREEN_HEADERS[activeScreen];

  return (
    <MainLayout
      activeScreen={activeScreen}
      onNavigate={setActiveScreen}
      onOpenLogs={() => handleAction(SystemActions.OPEN_LOGS)}
      title={t(header.title)}
      subtitle={t(header.subtitle)}
      statusMessage={statusMessage}
      progressPercent={progressPercent}
    >
      {activeScreen === AppScreen.Dashboard && (
        <DashboardPage
          health={health}
          logs={translatedLogs}
          onAction={handleAction}
          onClearLogs={handleClearLogs}
          onNavigateToBackup={() => setActiveScreen(AppScreen.Backup)}
        />
      )}

      {activeScreen === AppScreen.Scheduling && (
        <SchedulingPage
          tasks={tasks}
          onCreateTask={(payload) => handleAction(SystemActions.CREATE_TASK, payload)}
          onDeleteTask={(name) => handleAction(SystemActions.DELETE_TASK, name)}
        />
      )}

      {activeScreen === AppScreen.Backup && (
        <BackupPage
          backups={backups}
          onCreateBackup={() => handleAction(SystemActions.CREATE_MANUAL_BACKUP)}
          onRestoreBackup={(name) => handleAction(SystemActions.RESTORE_BACKUP, name)}
          onOpenFolder={() => handleAction(SystemActions.OPEN_BACKUPS)}
        />
      )}

      {activeScreen === AppScreen.RestorePoints && (
        <RestorePointsPage
          points={restorePoints}
          onCreatePoint={() => handleAction(SystemActions.CREATE_RESTORE_POINT)}
          onRestore={(seq) => handleAction(SystemActions.RESTORE_TO_POINT, String(seq))}
        />
      )}

      {activeScreen === AppScreen.Settings && (
        <SettingsPage
          language={lang}
          createBackupBeforeOptimize={settings.createBackupBeforeOptimize}
          onLanguageChange={setLang}
          onToggleBackup={handleToggleBackup}
        />
      )}
    </MainLayout>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
