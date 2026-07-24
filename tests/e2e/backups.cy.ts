import { backups } from './support/fixtures';

describe('registry backups', () => {
  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-Backup').click();
  });

  it('shows an empty state', () => {
    cy.contains('Nenhum backup encontrado').should('be.visible');
  });

  it('renders backups received from the host', () => {
    cy.emitHost('onBackupsLoaded', backups);
    cy.contains(backups[0].Name).should('be.visible');
    cy.contains(backups[1].Size).should('be.visible');
  });

  it('creates a backup and opens its folder', () => {
    cy.getByCy('backup-create').click();
    cy.expectIpc('createManualBackup');
    cy.emitHost('onActionFinished', 'createManualBackup', true);
    cy.getByCy('backup-open-folder').click();
    cy.expectIpc('openBackups');
  });

  it('restores a selected backup after confirmation', () => {
    cy.emitHost('onBackupsLoaded', backups);
    cy.on('window:confirm', () => true);
    cy.getByCy(`backup-restore-${backups[0].Name}`).click();
    cy.expectIpc('restoreBackup', backups[0].Name);
  });

  it('does not restore after cancellation', () => {
    cy.emitHost('onBackupsLoaded', backups);
    cy.on('window:confirm', () => false);
    cy.getByCy(`backup-restore-${backups[0].Name}`).click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((call) => call.args[0]?.action === 'restoreBackup')).to.be.false
    );
  });

  it('refreshes the table and dashboard metrics', () => {
    cy.emitHost('onBackupsLoaded', backups);
    cy.contains(backups[0].Name).should('exist');
    cy.getByCy('nav-Dashboard').click();
    cy.getByCy('health-backups').should('contain', '2');
    cy.getByCy('health-latest-backup').should('contain', backups[0].Date);
  });
});
