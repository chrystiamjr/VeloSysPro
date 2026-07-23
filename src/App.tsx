import { useState, useEffect } from 'react';
import { MainLayout } from './components/templates/MainLayout';
import { DashboardPage } from './components/pages/DashboardPage';
import { SchedulingPage } from './components/pages/SchedulingPage';
import { BackupPage } from './components/pages/BackupPage';
import {
  AppScreen,
  SystemHealth,
  LogEntryItem,
  LogRecord,
  LocalizedMessage,
  BackupItem,
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
} from './infrastructure/bridge';

function AppContent() {
  const { t } = useTranslation();
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.Dashboard);
  const [status, setStatus] = useState<LocalizedMessage>({ key: 'statusIdle' });
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [backups, setBackups] = useState<BackupItem[]>([]);
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
      setHealth((prev) => ({ ...prev, tasksCount: data.length }));
    });

    sendAction(SystemActions.GET_BACKUPS);
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

  const titleKey =
    activeScreen === AppScreen.Dashboard
      ? 'headerDashboardTitle'
      : activeScreen === AppScreen.Scheduling
        ? 'headerSchedulingTitle'
        : 'headerBackupTitle';

  const subtitleKey =
    activeScreen === AppScreen.Dashboard
      ? 'headerDashboardSubtitle'
      : activeScreen === AppScreen.Scheduling
        ? 'headerSchedulingSubtitle'
        : 'headerBackupSubtitle';

  return (
    <MainLayout
      activeScreen={activeScreen}
      onNavigate={setActiveScreen}
      onOpenLogs={() => handleAction(SystemActions.OPEN_LOGS)}
      onOpenRestorePoints={() => handleAction(SystemActions.OPEN_RESTORE_POINTS)}
      title={t(titleKey)}
      subtitle={t(subtitleKey)}
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

      {activeScreen === AppScreen.Scheduling && <SchedulingPage />}

      {activeScreen === AppScreen.Backup && (
        <BackupPage
          backups={backups}
          onCreateBackup={() => handleAction(SystemActions.CREATE_MANUAL_BACKUP)}
          onRestoreBackup={(name) => handleAction(SystemActions.RESTORE_BACKUP, name)}
          onOpenFolder={() => handleAction(SystemActions.OPEN_BACKUPS)}
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
