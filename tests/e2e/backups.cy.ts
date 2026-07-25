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

  it('sorts host-formatted backup dates chronologically across years', () => {
    const crossYear = [
      { Name: 'older.reg', Date: '31/12/2025 23:00', Size: '10,0 KB' },
      { Name: 'newer.reg', Date: '01/01/2026 00:00', Size: '10,0 KB' },
    ];
    cy.emitHost('onBackupsLoaded', crossYear);

    cy.getByCy('backups-table').find('tbody tr').first().should('contain', 'newer.reg');
    cy.getByCy('table-sort-date').parent('th').should('have.attr', 'aria-sort', 'descending');
  });

  it('sorts localized backup sizes by magnitude', () => {
    const localizedSizes = [
      { Name: 'medium.reg', Date: '02/01/2026 00:00', Size: '999,9 KB' },
      { Name: 'large.reg', Date: '03/01/2026 00:00', Size: '1.234,5 KB' },
      { Name: 'small.reg', Date: '01/01/2026 00:00', Size: '45,6 KB' },
    ];
    cy.emitHost('onBackupsLoaded', localizedSizes);

    cy.getByCy('table-sort-size').click();
    cy.getByCy('backups-table').find('tbody tr').eq(0).should('contain', 'small.reg');
    cy.getByCy('backups-table').find('tbody tr').eq(1).should('contain', 'medium.reg');
    cy.getByCy('backups-table').find('tbody tr').eq(2).should('contain', 'large.reg');
    cy.getByCy('table-sort-size').parent('th').should('have.attr', 'aria-sort', 'ascending');
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
