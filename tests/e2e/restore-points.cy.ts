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
    cy.emitHost('onRestorePointsLoaded', restorePoints);
    cy.contains(restorePoints[0].Description).should('be.visible');
    cy.contains(String(restorePoints[1].Sequence)).should('be.visible');
  });

  it('creates a restore point', () => {
    cy.getByCy('restore-point-create').click();
    cy.expectIpc('createRestorePoint');
  });

  it('restores after both confirmations', () => {
    cy.emitHost('onRestorePointsLoaded', restorePoints);
    cy.on('window:confirm', () => true);
    cy.getByCy(`restore-point-restore-${restorePoints[0].Sequence}`).click();
    cy.expectIpc('restoreToPoint', String(restorePoints[0].Sequence));
  });

  it('stops after the first confirmation is cancelled', () => {
    cy.emitHost('onRestorePointsLoaded', restorePoints);
    cy.on('window:confirm', () => false);
    cy.getByCy(`restore-point-restore-${restorePoints[0].Sequence}`).click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((call) => call.args[0]?.action === 'restoreToPoint')).to.be
          .false
    );
  });

  it('stops after the second confirmation is cancelled', () => {
    cy.emitHost('onRestorePointsLoaded', restorePoints);
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
