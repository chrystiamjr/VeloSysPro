import { useState, useEffect } from 'react';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './components/pages/DashboardPage';
import { OptimizePage } from './components/pages/OptimizePage';
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
  SnapshotCapturedPayload,
  UpdateInfo,
  SystemActions,
} from './domain/types';
import { useTranslation, LanguageProvider } from './infrastructure/i18nContext';
import {
  subscribeLogs,
  subscribeSnapshot,
  subscribeStatus,
  subscribeUpdate,
} from './infrastructure/bridge';
import { formatDateTime } from './domain/formatters';
import { useExecutionLifecycle } from './infrastructure/useExecutionLifecycle';
import { useOsBackedLists } from './infrastructure/useOsBackedLists';
import { usePreferences } from './infrastructure/usePreferences';

const SCREEN_HEADERS: Record<AppScreen, { title: string; subtitle: string }> = {
  [AppScreen.Dashboard]: { title: 'header.dashboard.title', subtitle: 'header.dashboard.subtitle' },
  [AppScreen.Optimize]: { title: 'header.optimize.title', subtitle: 'header.optimize.subtitle' },
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
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  // Dismissing only hides the banner; Settings keeps the release reachable without a restart.
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [logs, setLogs] = useState<LogRecord[]>([{ key: 'log.appStarted', type: 'success' }]);
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotCapturedPayload | null>(null);
  const { activeAction, progressPercent, executionHasError, runRead, runMutation } =
    useExecutionLifecycle();
  const {
    backups,
    tasks,
    restorePoints,
    tweakCatalog,
    history,
    refreshBackups,
    refreshTasks,
    refreshRestorePoints,
    refreshTweaks,
  } = useOsBackedLists(activeScreen);
  const { settings, setLanguage, setSafetyBackup, toggleSidebar } = usePreferences(setLang);

  useEffect(() => {
    const unsubscribers = [
      subscribeLogs((msg, type) => {
        setLogs((prev) => [...prev, { key: msg.key, args: msg.args, type }]);
        if (type === 'error') {
          setConsoleExpanded(true);
        }
      }),

      subscribeStatus((msg) => {
        setStatus(msg);
      }),

      subscribeSnapshot((payload) => {
        setSnapshot(payload);
      }),

      subscribeUpdate((info) => {
        setUpdate(info);
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [setLang]);

  const handleClearLogs = () => {
    setLogs([]);
  };

  // The live measurement wins while the app is open; otherwise fall back to the last pair on disk,
  // so the comparison is still there after a restart. A batch appends its before and after
  // consecutively, and nothing else writes to the history, so the last two rows are that pair.
  // The changes list is not persisted, hence empty — only the metrics come back.
  const displayedSnapshot: SnapshotCapturedPayload | null =
    snapshot ??
    (history.length >= 2
      ? { before: history[history.length - 2], after: history[history.length - 1], changes: [] }
      : null);

  // Translate at render time so logs/status re-localize when the language changes.
  const translatedLogs: LogEntryItem[] = logs.map((log) => ({
    text: log.key === 'log.raw' ? String(log.args?.text ?? '') : t(log.key, log.args),
    type: log.type,
  }));
  const statusMessage = t(status.key, status.args);
  const header = SCREEN_HEADERS[activeScreen];
  const displayHealth: SystemHealth = {
    admin: 'Sim',
    backupsCount: backups.length,
    tasksCount: tasks.length,
    status: progressPercent < 100 ? 'executing' : 'ready',
    latestBackup: backups.length > 0 ? formatDateTime(backups[0].CreatedAt, lang) : '',
  };

  return (
    <MainLayout
      activeScreen={activeScreen}
      onNavigate={setActiveScreen}
      onOpenLogs={() => runRead(SystemActions.OPEN_LOGS)}
      sidebarCollapsed={settings.sidebarCollapsed}
      onToggleSidebar={toggleSidebar}
      title={t(header.title)}
      subtitle={t(header.subtitle)}
      statusMessage={statusMessage}
      progressPercent={progressPercent}
    >
      {update && !updateDismissed && (
        <div
          data-cy="update-banner"
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-textMain">
            <Icon name="info" className="h-4 w-4 text-primary" />{' '}
            {t('updateBanner.text', { version: update.version })}
          </span>
          <div className="flex items-center gap-2">
            <button
              data-cy="update-download"
              onClick={() => runRead(SystemActions.OPEN_URL, update.url)}
              className="cursor-pointer rounded-lg border-none bg-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-primary-hover"
            >
              {t('updateBanner.btn')}
            </button>
            <button
              data-cy="update-dismiss"
              onClick={() => setUpdateDismissed(true)}
              className="cursor-pointer rounded-lg border border-borderColor bg-transparent px-3 py-2 text-xs text-textMuted transition-colors hover:text-white"
            >
              {t('updateBanner.dismiss')}
            </button>
          </div>
        </div>
      )}

      {activeScreen === AppScreen.Dashboard && (
        <DashboardPage
          health={displayHealth}
          logs={translatedLogs}
          onAction={(action) => runMutation(action)}
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

      {activeScreen === AppScreen.Optimize && (
        <OptimizePage
          catalog={tweakCatalog}
          snapshot={displayedSnapshot}
          disabled={activeAction !== null}
          onApply={(change) => runMutation(SystemActions.APPLY_TWEAKS, change)}
          onRevert={(tweakId) => runMutation(SystemActions.REVERT_TWEAK, tweakId)}
          onRefresh={refreshTweaks}
          onEnableProtection={() => runMutation(SystemActions.ENABLE_SYSTEM_PROTECTION)}
        />
      )}

      {activeScreen === AppScreen.Scheduling && (
        <SchedulingPage
          tasks={tasks}
          disabled={activeAction !== null}
          onCreateTask={(payload) => runMutation(SystemActions.CREATE_TASK, payload)}
          onDeleteTask={(name) => runMutation(SystemActions.DELETE_TASK, name)}
          onRefresh={refreshTasks}
        />
      )}

      {activeScreen === AppScreen.Backup && (
        <BackupPage
          backups={backups}
          disabled={activeAction !== null}
          onCreateBackup={() => runMutation(SystemActions.CREATE_MANUAL_BACKUP)}
          onRestoreBackup={(name) => runMutation(SystemActions.RESTORE_BACKUP, name)}
          onOpenFolder={() => runRead(SystemActions.OPEN_BACKUPS)}
          onRefresh={refreshBackups}
        />
      )}

      {activeScreen === AppScreen.RestorePoints && (
        <RestorePointsPage
          points={restorePoints}
          disabled={activeAction !== null}
          onCreatePoint={() => runMutation(SystemActions.CREATE_RESTORE_POINT)}
          onRestore={(seq) => runMutation(SystemActions.RESTORE_TO_POINT, seq)}
          onRefresh={refreshRestorePoints}
        />
      )}

      {activeScreen === AppScreen.Settings && (
        <SettingsPage
          language={lang}
          createBackupBeforeOptimize={settings.createBackupBeforeOptimize}
          onLanguageChange={setLanguage}
          onToggleBackup={setSafetyBackup}
          updateInfo={update}
          onDownloadUpdate={(url) => runRead(SystemActions.OPEN_URL, url)}
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
