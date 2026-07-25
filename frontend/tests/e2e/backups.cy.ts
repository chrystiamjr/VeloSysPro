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
    cy.emitHost('backupsLoaded', backups);
    cy.contains(backups[0].Name).should('be.visible');
    cy.contains('39,0 KB').should('be.visible');
  });

  it('sorts canonical backup timestamps chronologically across years', () => {
    const crossYear = [
      { Name: 'older.reg', CreatedAt: '2025-12-31T23:00:00.000Z', SizeBytes: 10240 },
      { Name: 'newer.reg', CreatedAt: '2026-01-01T00:00:00.000Z', SizeBytes: 10240 },
    ];
    cy.emitHost('backupsLoaded', crossYear);

    cy.getByCy('backups-table').find('tbody tr').first().should('contain', 'newer.reg');
    cy.getByCy('table-sort-date').parent('th').should('have.attr', 'aria-sort', 'descending');
  });

  it('sorts backup byte counts by magnitude', () => {
    const localizedSizes = [
      { Name: 'medium.reg', CreatedAt: '2026-01-02T00:00:00.000Z', SizeBytes: 1023898 },
      { Name: 'large.reg', CreatedAt: '2026-01-03T00:00:00.000Z', SizeBytes: 1264128 },
      { Name: 'small.reg', CreatedAt: '2026-01-01T00:00:00.000Z', SizeBytes: 46694 },
    ];
    cy.emitHost('backupsLoaded', localizedSizes);

    cy.getByCy('table-sort-size').click();
    cy.getByCy('backups-table').find('tbody tr').eq(0).should('contain', 'small.reg');
    cy.getByCy('backups-table').find('tbody tr').eq(1).should('contain', 'medium.reg');
    cy.getByCy('backups-table').find('tbody tr').eq(2).should('contain', 'large.reg');
    cy.getByCy('table-sort-size').parent('th').should('have.attr', 'aria-sort', 'ascending');
  });

  it('creates a backup and opens its folder', () => {
    cy.getByCy('backup-create').click();
    cy.expectIpc('createManualBackup');
    cy.emitHost('actionFinished', { action: 'createManualBackup', ok: true });
    cy.getByCy('backup-open-folder').click();
    cy.expectIpc('openBackups');
  });

  it('restores a selected backup after confirmation', () => {
    cy.emitHost('backupsLoaded', backups);
    cy.on('window:confirm', () => true);
    cy.getByCy(`backup-restore-${backups[0].Name}`).click();
    cy.expectIpc('restoreBackup', backups[0].Name);
  });

  it('does not restore after cancellation', () => {
    cy.emitHost('backupsLoaded', backups);
    cy.on('window:confirm', () => false);
    cy.getByCy(`backup-restore-${backups[0].Name}`).click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((call) => call.args[0]?.action === 'restoreBackup')).to.be.false
    );
  });

  it('refreshes the table and dashboard metrics', () => {
    cy.emitHost('backupsLoaded', backups);
    cy.contains(backups[0].Name).should('exist');
    cy.getByCy('nav-Dashboard').click();
    cy.getByCy('health-backups').should('contain', '2');
    cy.getByCy('health-latest-backup').should('not.contain', 'Nenhum');
  });
});
