const actions = [
  ['action-quick', 'runQuickOptimization'],
  ['action-full', 'runFullOptimization'],
  ['action-disk-health', 'diskHealth'],
  ['action-update-cache', 'clearUpdateCache'],
  ['action-prefetch', 'cleanPrefetch'],
] as const;

describe('dashboard actions', () => {
  beforeEach(() => cy.visitApp());

  for (const [selector, action] of actions) {
    it(`sends ${action}`, () => {
      cy.getByCy(selector).find('button').click();
      cy.expectIpc(action);
    });
  }

  it('starts with maintenance expanded and recovery collapsed', () => {
    cy.getByCy('action-disk-health').should('be.visible');
    cy.getByCy('shortcut-backups').should('not.exist');
  });

  it('expands and collapses recovery tools', () => {
    cy.contains('button', 'Segurança e recuperação').click();
    cy.getByCy('shortcut-backups').should('be.visible');
    cy.contains('button', 'Segurança e recuperação').click();
    cy.getByCy('shortcut-backups').should('not.exist');
  });

  it('reverts network defaults after confirmation', () => {
    cy.contains('button', 'Segurança e recuperação').click();
    cy.on('window:confirm', () => true);
    cy.getByCy('action-revert').find('button').click();
    cy.expectIpc('revertDefaults');
  });

  it('does not revert when confirmation is cancelled', () => {
    cy.contains('button', 'Segurança e recuperação').click();
    cy.on('window:confirm', () => false);
    cy.getByCy('action-revert').find('button').click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((call) => call.args[0]?.action === 'revertDefaults')).to.be
          .false
    );
  });

  it('navigates through dashboard shortcuts', () => {
    cy.getByCy('health-backups').click();
    cy.contains('Backups do Registro').should('be.visible');
    cy.getByCy('nav-Dashboard').click();
    cy.getByCy('health-tasks').click();
    cy.contains('Agendar Otimização').should('be.visible');
    cy.getByCy('nav-Dashboard').click();
    cy.contains('button', 'Segurança e recuperação').click();
    cy.getByCy('shortcut-restore-points').find('button').click();
    cy.contains('Pontos de Restauração do Sistema').should('be.visible');
  });
});
