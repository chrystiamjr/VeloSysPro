import React from 'react';
import { HealthCard } from '../molecules/HealthCard';
import { ActionCard } from '../organisms/ActionCard';
import { TerminalConsole } from '../organisms/TerminalConsole';
import { SystemHealth, LogEntryItem, SystemActions } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface DashboardPageProps {
  health: SystemHealth;
  logs: LogEntryItem[];
  onAction: (action: string) => void;
  onClearLogs: () => void;
  onNavigateToBackup: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  health,
  logs,
  onAction,
  onClearLogs,
  onNavigateToBackup,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex select-none flex-col gap-6">
      {/* Health Grid */}
      <div className="grid grid-cols-5 gap-4">
        <HealthCard
          title={t('healthAdmin')}
          value={health.admin === 'Sim' ? t('healthYes') : t('healthNo')}
          variant="success"
        />
        <HealthCard title={t('healthBackups')} value={health.backupsCount} variant="info" />
        <HealthCard
          title={t('healthLatestBackup')}
          value={health.latestBackup === 'Nenhum' ? t('healthNone') : health.latestBackup}
          variant="purple"
        />
        <HealthCard title={t('healthTasks')} value={health.tasksCount} variant="warning" />
        <HealthCard
          title={t('healthStatus')}
          value={t(health.status === 'executing' ? 'healthStatusExecuting' : 'healthStatusReady')}
          variant="primary"
        />
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-3 gap-5">
        <ActionCard
          title={t('actQuickTitle')}
          desc={t('actQuickDesc')}
          icon="🚀"
          variant="success"
          buttonText={t('btnExecuteNow')}
          onExecute={() => onAction(SystemActions.RUN_QUICK_OPTIMIZATION)}
        />

        <ActionCard
          title={t('actFullTitle')}
          desc={t('actFullDesc')}
          icon="⚙️"
          variant="primary"
          buttonText={t('btnExecuteNow')}
          onExecute={() => onAction(SystemActions.RUN_FULL_OPTIMIZATION)}
        />

        <ActionCard
          title={t('actGamingTitle')}
          desc={t('actGamingDesc')}
          icon="🎮"
          variant="purple"
          buttonText={t('btnApplyMode')}
          onExecute={() => onAction(SystemActions.RUN_GAMING_MODE)}
        />

        <ActionCard
          title={t('actRevertTitle')}
          desc={t('actRevertDesc')}
          icon="↺"
          variant="warning"
          buttonText={t('btnRevert')}
          onExecute={() => onAction(SystemActions.REVERT_DEFAULTS)}
        />

        <ActionCard
          title={t('actRestorePointTitle')}
          desc={t('actRestorePointDesc')}
          icon="🛡️"
          variant="pink"
          buttonText={t('btnCreateNow')}
          onExecute={() => onAction(SystemActions.CREATE_RESTORE_POINT)}
        />

        <ActionCard
          title={t('actBackupTitle')}
          desc={t('actBackupDesc')}
          icon="💾"
          variant="info"
          buttonText={t('btnOpenView')}
          onExecute={onNavigateToBackup}
        />
      </div>

      {/* Terminal Console */}
      <TerminalConsole logs={logs} onClear={onClearLogs} />
    </div>
  );
};
