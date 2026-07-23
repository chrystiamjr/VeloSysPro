import { useState, useEffect } from 'react';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './components/pages/DashboardPage';
import { SchedulingPage } from './components/pages/SchedulingPage';
import { BackupPage } from './components/pages/BackupPage';
import { RestorePointsPage } from './components/pages/RestorePointsPage';
import {
  AppScreen,
  SystemHealth,
  LogEntryItem,
  LogRecord,
  LocalizedMessage,
  BackupItem,
  ScheduledTaskItem,
  RestorePointItem,
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
} from './infrastructure/bridge';

const SCREEN_HEADERS: Record<AppScreen, { title: string; subtitle: string }> = {
  [AppScreen.Dashboard]: { title: 'headerDashboardTitle', subtitle: 'headerDashboardSubtitle' },
  [AppScreen.Scheduling]: { title: 'headerSchedulingTitle', subtitle: 'headerSchedulingSubtitle' },
  [AppScreen.Backup]: { title: 'headerBackupTitle', subtitle: 'headerBackupSubtitle' },
  [AppScreen.RestorePoints]: { title: 'headerRestorePointsTitle', subtitle: 'headerRestorePointsSubtitle' },
};

function AppContent() {
  const { t } = useTranslation();
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.Dashboard);
  const [status, setStatus] = useState<LocalizedMessage>({ key: 'statusIdle' });
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointItem[]>([]);
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

    sendAction(SystemActions.GET_BACKUPS);
    sendAction(SystemActions.GET_TASKS);
    sendAction(SystemActions.GET_RESTORE_POINTS);
  }, []);

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
