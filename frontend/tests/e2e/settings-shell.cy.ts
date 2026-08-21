import { defaultSettings, updateInfo } from './support/fixtures';

describe('settings and application shell', () => {
  it('navigates to every screen and marks it active', () => {
    cy.visitApp();
    for (const [screen, heading] of [
      ['Scheduling', 'Agendamento Automático'],
      ['Backup', 'Backup & Restauração'],
      ['RestorePoints', 'Pontos de Restauração'],
      ['Settings', 'Configurações'],
      ['Dashboard', 'Painel de Otimização'],
    ]) {
      cy.getByCy(`nav-${screen}`).click().should('have.class', 'bg-primary');
      cy.contains('h2', heading).should('be.visible');
    }
  });

  it('persists a language change with the complete settings payload', () => {
    cy.visitApp();
    cy.getByCy('nav-Settings').click();
    cy.getByCy('language-en').click();
    cy.contains('Settings').should('be.visible');
    cy.expectIpc('saveSettings', { ...defaultSettings, language: 'en_US' });
  });

  it('persists both safety-backup states', () => {
    cy.visitApp();
    cy.getByCy('nav-Settings').click();
    cy.getByCy('safety-backup-toggle').uncheck();
    cy.expectIpc('saveSettings', { ...defaultSettings, createBackupBeforeOptimize: false });
    cy.getByCy('safety-backup-toggle').check();
    cy.expectIpc('saveSettings', defaultSettings);
  });

  it('loads a collapsed sidebar and persists expansion', () => {
    cy.visitApp({ settings: { ...defaultSettings, sidebarCollapsed: true } });
    cy.getByCy('sidebar-toggle').should('have.attr', 'aria-label', 'Expandir menu').click();
    cy.expectIpc('saveSettings', defaultSettings);
  });

  it('collapses automatically on a narrow viewport', () => {
    cy.viewport(800, 900);
    cy.visitApp();
    cy.getByCy('sidebar-toggle').should('have.attr', 'aria-label', 'Expandir menu');
    cy.viewport(1280, 900);
    cy.getByCy('sidebar-toggle').should('have.attr', 'aria-label', 'Recolher menu');
  });

  it('opens the logs folder', () => {
    cy.visitApp();
    cy.getByCy('open-logs').click();
    cy.expectIpc('openLogs');
  });

  it('downloads and dismisses an available update', () => {
    cy.visitApp();
    cy.emitHost('updateAvailable', updateInfo);
    cy.getByCy('update-banner').should('contain', updateInfo.version);
    cy.getByCy('update-download').click();
    cy.expectIpc('openUrl', updateInfo.url);
    cy.getByCy('update-dismiss').click();
    cy.getByCy('update-banner').should('not.exist');
  });

  it('keeps a dismissed update reachable from settings', () => {
    cy.visitApp();
    cy.emitHost('updateAvailable', updateInfo);
    cy.getByCy('update-dismiss').click();
    cy.getByCy('update-banner').should('not.exist');

    cy.getByCy('nav-Settings').click();
    cy.getByCy('settings-update-available').should('contain', updateInfo.version);
    cy.getByCy('settings-update-download').click();
    cy.expectIpc('openUrl', updateInfo.url);
  });

  it('reports being up to date when no update was announced', () => {
    cy.visitApp();
    cy.getByCy('nav-Settings').click();
    cy.getByCy('settings-update-latest').should('be.visible');
    cy.getByCy('settings-update-download').should('not.exist');
  });

  it('ignores update callbacks without a version', () => {
    cy.visitApp();
    cy.emitHost('updateAvailable', { version: '', url: updateInfo.url });
    cy.getByCy('update-banner').should('not.exist');
  });
});
