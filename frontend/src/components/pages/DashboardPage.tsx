import React from 'react';
import { HealthCard } from '../molecules/HealthCard';
import { CompactActionItem } from '../molecules/CompactActionItem';
import { ActionCard } from '../organisms/ActionCard';
import { ActionGroup } from '../organisms/ActionGroup';
import { TerminalConsole } from '../organisms/TerminalConsole';
import { Icon } from '../atoms/Icon';
import { SystemHealth, LogEntryItem, SystemActions } from '../../domain/types';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface DashboardPageProps {
  health: SystemHealth;
  logs: LogEntryItem[];
  onAction: (action: string) => void;
  onClearLogs: () => void;
  onNavigateToBackup: () => void;
  onNavigateToRestorePoints: () => void;
  onNavigateToScheduling: () => void;
  activeAction: string | null;
  consoleExpanded: boolean;
  executionHasError: boolean;
  onToggleConsole: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  health,
  logs,
  onAction,
  onClearLogs,
  onNavigateToBackup,
  onNavigateToRestorePoints,
  onNavigateToScheduling,
  activeAction,
  consoleExpanded,
  executionHasError,
  onToggleConsole,
}) => {
  const { t } = useTranslation();
  const actionsDisabled = activeAction !== null;

  const handleRevert = () => {
    if (window.confirm(t('act.revert.confirm'))) {
      onAction(SystemActions.REVERT_DEFAULTS);
    }
  };

  return (
    <div className="flex select-none flex-col gap-6 pb-4 sm:pb-6 lg:pb-8">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <HealthCard
          testId="health-backups"
          title={t('health.backups')}
          value={health.backupsCount}
          variant="info"
          onClick={onNavigateToBackup}
        />
        <HealthCard
          testId="health-latest-backup"
          title={t('health.latestBackup')}
          value={health.latestBackup || t('health.none')}
          variant="purple"
          onClick={onNavigateToBackup}
        />
        <HealthCard
          testId="health-tasks"
          title={t('health.tasks')}
          value={health.tasksCount}
          variant="warning"
          onClick={onNavigateToScheduling}
        />
      </div>

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-textMain">{t('dashboard.primary.title')}</h3>
          <p className="mt-1 text-xs text-textMuted">{t('dashboard.primary.desc')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            testId="action-quick"
            title={t('act.quick.title')}
            desc={t('act.quick.desc')}
            icon={<Icon name="rocket" className="h-5 w-5 text-success" />}
            variant="success"
            buttonText={t('btn.executeNow')}
            disabled={actionsDisabled}
            active={activeAction === SystemActions.RUN_QUICK_OPTIMIZATION}
            onExecute={() => onAction(SystemActions.RUN_QUICK_OPTIMIZATION)}
          />
          <ActionCard
            testId="action-full"
            title={t('act.full.title')}
            desc={t('act.full.desc')}
            icon={<Icon name="settings" className="h-5 w-5 text-primary" />}
            variant="primary"
            buttonText={t('btn.executeNow')}
            disabled={actionsDisabled}
            active={activeAction === SystemActions.RUN_FULL_OPTIMIZATION}
            onExecute={() => onAction(SystemActions.RUN_FULL_OPTIMIZATION)}
          />
          <ActionCard
            testId="action-gaming"
            title={t('act.gaming.title')}
            desc={t('act.gaming.desc')}
            icon={<Icon name="gamepad" className="h-5 w-5 text-purple" />}
            variant="purple"
            buttonText={t('btn.applyMode')}
            disabled={actionsDisabled}
            active={activeAction === SystemActions.RUN_GAMING_MODE}
            onExecute={() => onAction(SystemActions.RUN_GAMING_MODE)}
          />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-textMain">{t('dashboard.tools.title')}</h3>
          <p className="mt-1 text-xs text-textMuted">{t('dashboard.tools.desc')}</p>
        </div>
        <div className="flex flex-col gap-3">
          <ActionGroup
            title={t('dashboard.maintenance.title')}
            description={t('dashboard.maintenance.desc')}
            itemCount={3}
            defaultExpanded
          >
            <CompactActionItem
              testId="action-disk-health"
              title={t('act.diskHealth.title')}
              desc={t('act.diskHealth.desc')}
              icon={<Icon name="hard-drive" className="h-5 w-5 text-success" />}
              variant="success"
              buttonText={t('btn.viewReport')}
              disabled={actionsDisabled}
              onExecute={() => onAction(SystemActions.DISK_HEALTH)}
            />
            <CompactActionItem
              testId="action-update-cache"
              title={t('act.updateCache.title')}
              desc={t('act.updateCache.desc')}
              icon={<Icon name="refresh-cw" className="h-5 w-5 text-primary" />}
              variant="primary"
              buttonText={t('btn.clean')}
              disabled={actionsDisabled}
              onExecute={() => onAction(SystemActions.CLEAR_UPDATE_CACHE)}
            />
            <CompactActionItem
              testId="action-prefetch"
              title={t('act.prefetch.title')}
              desc={t('act.prefetch.desc')}
              icon={<Icon name="zap" className="h-5 w-5 text-warning" />}
              variant="warning"
              buttonText={t('btn.clean')}
              disabled={actionsDisabled}
              onExecute={() => onAction(SystemActions.CLEAN_PREFETCH)}
            />
          </ActionGroup>

          <ActionGroup
            title={t('dashboard.recovery.title')}
            description={t('dashboard.recovery.desc')}
            itemCount={3}
          >
            <CompactActionItem
              testId="shortcut-backups"
              title={t('act.backup.title')}
              desc={t('act.backup.desc')}
              icon={<Icon name="hard-drive" className="h-5 w-5 text-info" />}
              variant="info"
              buttonText={t('btn.openView')}
              onExecute={onNavigateToBackup}
            />
            <CompactActionItem
              testId="shortcut-restore-points"
              title={t('act.restorePoint.title')}
              desc={t('act.restorePoint.desc')}
              icon={<Icon name="shield-check" className="h-5 w-5 text-pink" />}
              variant="pink"
              buttonText={t('btn.openView')}
              onExecute={onNavigateToRestorePoints}
            />
            <CompactActionItem
              testId="action-revert"
              title={t('act.revert.title')}
              desc={t('act.revert.desc')}
              icon={<Icon name="rotate-ccw" className="h-5 w-5 text-warning" />}
              variant="warning"
              buttonText={t('btn.revert')}
              disabled={actionsDisabled}
              onExecute={handleRevert}
            />
          </ActionGroup>
        </div>
      </section>

      <TerminalConsole
        logs={logs}
        onClear={onClearLogs}
        expanded={consoleExpanded}
        hasError={executionHasError}
        onToggle={onToggleConsole}
      />
    </div>
  );
};
