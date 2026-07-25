import { restorePoints } from './support/fixtures';

describe('system restore points', () => {
  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-RestorePoints').click();
  });

  it('shows an empty state', () => {
    cy.contains('Nenhum ponto de restauração').should('be.visible');
  });

  it('renders restore points received from the host', () => {
    cy.emitHost('restorePointsLoaded', restorePoints);
    cy.contains(restorePoints[0].Description).should('be.visible');
    cy.contains(String(restorePoints[1].Sequence)).should('be.visible');
  });

  it('creates a restore point', () => {
    cy.getByCy('restore-point-create').click();
    cy.expectIpc('createRestorePoint');
  });

  it('lists the newest point first and reorders when a header is clicked', () => {
    cy.emitHost('restorePointsLoaded', restorePoints);

    // Default sort is sequence descending, so the newest point leads.
    cy.get('tbody tr').first().should('contain', restorePoints[0].Description);

    cy.getByCy('table-sort-seq').click();
    cy.get('tbody tr').first().should('contain', restorePoints[1].Description);
    cy.get('th').first().should('have.attr', 'aria-sort', 'ascending');
  });

  it('paginates long restore point histories', () => {
    const many = Array.from({ length: 24 }, (_, i) => ({
      Sequence: 115 + i,
      CreatedAt: '2026-07-23T06:00:00.000Z',
      Description: `Point ${115 + i}`,
    }));
    cy.emitHost('restorePointsLoaded', many);

    cy.get('tbody tr').should('have.length', 10);
    cy.getByCy('table-range').should('contain', 'de 24');
    cy.getByCy('table-page').should('contain', '1/3');

    cy.getByCy('table-next').click();
    cy.getByCy('table-page').should('contain', '2/3');
    cy.contains('Point 128').should('be.visible');
  });

  it('restores after both confirmations', () => {
    cy.emitHost('restorePointsLoaded', restorePoints);
    cy.on('window:confirm', () => true);
    cy.getByCy(`restore-point-restore-${restorePoints[0].Sequence}`).click();
    cy.expectIpc('restoreToPoint', restorePoints[0].Sequence);
  });

  it('stops after the first confirmation is cancelled', () => {
    cy.emitHost('restorePointsLoaded', restorePoints);
    cy.on('window:confirm', () => false);
    cy.getByCy(`restore-point-restore-${restorePoints[0].Sequence}`).click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((call) => call.args[0]?.action === 'restoreToPoint')).to.be
          .false
    );
  });

  it('stops after the second confirmation is cancelled', () => {
    cy.emitHost('restorePointsLoaded', restorePoints);
    let call = 0;
    cy.on('window:confirm', () => ++call === 1);
    cy.getByCy(`restore-point-restore-${restorePoints[0].Sequence}`).click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((entry) => entry.args[0]?.action === 'restoreToPoint')).to.be
          .false
    );
  });
});
