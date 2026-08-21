import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../../../src/components/pages/DashboardPage';
import { SystemActions } from '../../../src/domain/types';
import { i18n } from '../../../src/domain/i18n';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const defaultProps = {
  health: {
    admin: 'Sim',
    backupsCount: 2,
    latestBackup: '23/07/2026 17:07',
    tasksCount: 1,
    status: 'ready',
  },
  logs: [],
  onAction: vi.fn(),
  onClearLogs: vi.fn(),
  onNavigateToBackup: vi.fn(),
  onNavigateToRestorePoints: vi.fn(),
  onNavigateToScheduling: vi.fn(),
  activeAction: null,
  consoleExpanded: false,
  executionHasError: false,
  onToggleConsole: vi.fn(),
};

const renderDashboard = (overrides = {}) =>
  render(
    <LanguageProvider>
      <DashboardPage {...defaultProps} {...overrides} />
    </LanguageProvider>
  );

describe('DashboardPage', () => {
  beforeEach(() => {
    i18n.locale('pt_BR');
    vi.clearAllMocks();
  });

  it('prioritizes primary actions and opens only the maintenance group initially', () => {
    renderDashboard();

    expect(screen.getByText('Manutenção')).toBeVisible();
    expect(screen.getByText('Saúde do Disco')).toBeVisible();
    expect(screen.queryByText('Backup de Registro')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /segurança e recuperação/i }));
    expect(screen.getByText('Backup de Registro')).toBeVisible();
  });

  it('no longer offers Modo Gaming, which cannot be undone from here', () => {
    // E2-03 re-delivered its TCP settings as reversible Tweaks on the Optimize screen. This card
    // was the last thing in the app that changed a persistent setting with no capture and no way
    // back, so its absence is the point rather than an incidental layout detail.
    renderDashboard();

    expect(screen.queryByText('Modo Gaming')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aplicar Modo' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Executar Agora' })).toHaveLength(2);
  });

  it('navigates from summary metrics and recovery shortcuts', () => {
    const onNavigateToBackup = vi.fn();
    const onNavigateToRestorePoints = vi.fn();
    renderDashboard({ onNavigateToBackup, onNavigateToRestorePoints });

    fireEvent.click(screen.getByRole('button', { name: /backups criados/i }));
    expect(onNavigateToBackup).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /segurança e recuperação/i }));
    const openButtons = screen.getAllByRole('button', { name: 'Abrir Tela' });
    fireEvent.click(openButtons[0]);
    expect(onNavigateToBackup).toHaveBeenCalledTimes(2);
    fireEvent.click(openButtons[1]);
    expect(onNavigateToRestorePoints).toHaveBeenCalledOnce();
  });

  it('confirms network reset before dispatching the action', () => {
    const onAction = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDashboard({ onAction });

    fireEvent.click(screen.getByRole('button', { name: /segurança e recuperação/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reverter' }));

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith(SystemActions.REVERT_DEFAULTS);
  });

  it('disables operational actions while another routine is active', () => {
    renderDashboard({ activeAction: SystemActions.RUN_QUICK_OPTIMIZATION });

    expect(screen.getAllByRole('button', { name: 'Executar Agora' })[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver Relatório' })).toBeDisabled();
  });
});
