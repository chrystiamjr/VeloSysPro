import { useState, useEffect, useRef } from 'react';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './components/pages/DashboardPage';
import { SchedulingPage } from './components/pages/SchedulingPage';
import { BackupPage } from './components/pages/BackupPage';
import { RestorePointsPage } from './components/pages/RestorePointsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { Icon } from './components/atoms/Icon';
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
  UpdateInfo,
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
  subscribeUpdate,
} from './infrastructure/bridge';

const SCREEN_HEADERS: Record<AppScreen, { title: string; subtitle: string }> = {
  [AppScreen.Dashboard]: { title: 'header.dashboard.title', subtitle: 'header.dashboard.subtitle' },
  [AppScreen.Scheduling]: {
    title: 'header.scheduling.title',
    subtitle: 'header.scheduling.subtitle',
  },
  [AppScreen.Backup]: { title: 'header.backup.title', subtitle: 'header.backup.subtitle' },
  [AppScreen.RestorePoints]: {
    title: 'header.restorePoints.title',
    subtitle: 'header.restorePoints.subtitle',
  },
  [AppScreen.Settings]: { title: 'header.settings.title', subtitle: 'header.settings.subtitle' },
};

function AppContent() {
  const { t, lang, setLang } = useTranslation();
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.Dashboard);
  const [status, setStatus] = useState<LocalizedMessage>({ key: 'status.idle' });
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    language: 'pt_BR',
    createBackupBeforeOptimize: true,
    sidebarCollapsed: false,
  });
  const settingsLoaded = useRef(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([{ key: 'log.appStarted', type: 'success' }]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const [executionHasError, setExecutionHasError] = useState(false);
  const actionLockRef = useRef(false);

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
      if (type === 'error') {
        setExecutionHasError(true);
        setConsoleExpanded(true);
      }
    });

    subscribeStatus((msg) => {
      setStatus(msg);
    });

    subscribeProgress((percent) => {
      setProgressPercent(percent);
      setHealth((prev) => ({ ...prev, status: percent < 100 ? 'executing' : 'ready' }));
      if (percent >= 100) {
        actionLockRef.current = false;
        setActiveAction(null);
      }
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

    subscribeUpdate((info) => {
      setUpdate(info);
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

  const handleToggleSidebar = () => {
    setSettings((prev) => {
      const next = { ...prev, sidebarCollapsed: !prev.sidebarCollapsed };
      sendAction(SystemActions.SAVE_SETTINGS, JSON.stringify(next));
      return next;
    });
  };

  const handleAction = (action: string, payload?: string) => {
    sendAction(action, payload);
  };

  const handleDashboardAction = (action: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setActiveAction(action);
    setExecutionHasError(false);
    sendAction(action);
  };

  const handleSystemMutation = (action: string, payload?: string) => {
    if (actionLockRef.current) return;
    sendAction(action, payload);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  // Translate at render time so logs/status re-localize when the language changes.
  const translatedLogs: LogEntryItem[] = logs.map((log) => ({
    text: log.key === 'log.raw' ? String(log.args?.text ?? '') : t(log.key, log.args),
    type: log.type,
  }));
  const statusMessage = t(status.key, status.args);
  const header = SCREEN_HEADERS[activeScreen];

  return (
    <MainLayout
      activeScreen={activeScreen}
      onNavigate={setActiveScreen}
      onOpenLogs={() => handleAction(SystemActions.OPEN_LOGS)}
      sidebarCollapsed={settings.sidebarCollapsed}
      onToggleSidebar={handleToggleSidebar}
      title={t(header.title)}
      subtitle={t(header.subtitle)}
      statusMessage={statusMessage}
      progressPercent={progressPercent}
    >
      {update && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-textMain">
            <Icon name="info" className="h-4 w-4 text-primary" />{' '}
            {t('updateBanner.text', { version: update.version })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction(SystemActions.OPEN_URL, update.url)}
              className="cursor-pointer rounded-lg border-none bg-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-primary-hover"
            >
              {t('updateBanner.btn')}
            </button>
            <button
              onClick={() => setUpdate(null)}
              className="cursor-pointer rounded-lg border border-borderColor bg-transparent px-3 py-2 text-xs text-textMuted transition-colors hover:text-white"
            >
              {t('updateBanner.dismiss')}
            </button>
          </div>
        </div>
      )}

      {activeScreen === AppScreen.Dashboard && (
        <DashboardPage
          health={health}
          logs={translatedLogs}
          onAction={handleDashboardAction}
          onClearLogs={handleClearLogs}
          onNavigateToBackup={() => setActiveScreen(AppScreen.Backup)}
          onNavigateToRestorePoints={() => setActiveScreen(AppScreen.RestorePoints)}
          onNavigateToScheduling={() => setActiveScreen(AppScreen.Scheduling)}
          activeAction={activeAction}
          consoleExpanded={consoleExpanded}
          executionHasError={executionHasError}
          onToggleConsole={() => setConsoleExpanded((value) => !value)}
        />
      )}

      {activeScreen === AppScreen.Scheduling && (
        <SchedulingPage
          tasks={tasks}
          disabled={activeAction !== null}
          onCreateTask={(payload) => handleSystemMutation(SystemActions.CREATE_TASK, payload)}
          onDeleteTask={(name) => handleSystemMutation(SystemActions.DELETE_TASK, name)}
        />
      )}

      {activeScreen === AppScreen.Backup && (
        <BackupPage
          backups={backups}
          disabled={activeAction !== null}
          onCreateBackup={() => handleSystemMutation(SystemActions.CREATE_MANUAL_BACKUP)}
          onRestoreBackup={(name) => handleSystemMutation(SystemActions.RESTORE_BACKUP, name)}
          onOpenFolder={() => handleAction(SystemActions.OPEN_BACKUPS)}
        />
      )}

      {activeScreen === AppScreen.RestorePoints && (
        <RestorePointsPage
          points={restorePoints}
          disabled={activeAction !== null}
          onCreatePoint={() => handleSystemMutation(SystemActions.CREATE_RESTORE_POINT)}
          onRestore={(seq) => handleSystemMutation(SystemActions.RESTORE_TO_POINT, String(seq))}
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
