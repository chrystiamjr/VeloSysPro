import { backups, defaultSettings, restorePoints, tasks } from './support/fixtures';

describe('bootstrap and IPC contracts', () => {
  it('requests every initial data set through the WebView2 transport', () => {
    cy.visitApp();
    for (const action of ['getBackups', 'getTasks', 'getRestorePoints', 'getSettings']) {
      cy.expectIpc(action);
    }
  });

  it('supports the legacy window.external transport', () => {
    cy.visitApp({ transport: 'external' });
    cy.expectIpc('getSettings');
  });

  it('renders safely when no desktop host is available', () => {
    cy.visitApp({ transport: 'none', settings: null });
    cy.contains('Painel de Otimização').should('be.visible');
  });

  it('accepts host collections as objects', () => {
    cy.visitApp();
    cy.emitHost('onBackupsLoaded', backups);
    cy.emitHost('onTasksLoaded', tasks);
    cy.emitHost('onRestorePointsLoaded', restorePoints);
    cy.getByCy('health-backups').should('contain', '2');
    cy.getByCy('health-tasks').should('contain', '2');
  });

  it('accepts host collections as serialized JSON', () => {
    cy.visitApp();
    cy.emitHost('onBackupsLoaded', JSON.stringify(backups));
    cy.emitHost('onTasksLoaded', JSON.stringify(tasks));
    cy.getByCy('health-latest-backup').should('contain', backups[0].Date);
  });

  it('falls back to empty collections for malformed JSON', () => {
    cy.visitApp();
    cy.emitHost('onBackupsLoaded', '{invalid');
    cy.emitHost('onTasksLoaded', '{invalid');
    cy.getByCy('health-backups').should('contain', '0');
    cy.getByCy('health-tasks').should('contain', '0');
  });

  it('loads serialized settings from the host', () => {
    cy.visitApp({ settings: JSON.stringify({ ...defaultSettings, language: 'en_US' }) });
    cy.contains('Optimization Dashboard').should('be.visible');
  });
});
