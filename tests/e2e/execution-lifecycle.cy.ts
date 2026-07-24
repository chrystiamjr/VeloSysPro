describe('global execution lifecycle', () => {
  beforeEach(() => cy.visitApp());

  it('locks every mutating screen while an action is active', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.getByCy('action-full').find('button').should('be.disabled');
    cy.getByCy('nav-Backup').click();
    cy.getByCy('backup-create').should('be.disabled');
    cy.getByCy('nav-Scheduling').click();
    cy.getByCy('task-create').should('be.disabled');
    cy.getByCy('nav-RestorePoints').click();
    cy.getByCy('restore-point-create').should('be.disabled');
  });

  it('ignores a second mutation while locked', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.getByCy('action-full').find('button').click({ force: true });
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      const fullCalls = stub
        .getCalls()
        .filter((call) => call.args[0]?.action === 'runFullOptimization');
      expect(fullCalls).to.have.length(0);
    });
  });

  it('renders host status and progress', () => {
    cy.emitHost('onStatusUpdated', { key: 'status.quick.dns' });
    cy.emitHost('onProgressUpdated', 35);
    cy.getByCy('status-message').should('contain', '[1/3]');
    cy.getByCy('progress-percent').should('have.text', '35%');
    cy.getByCy('progress-bar').should('have.attr', 'style').and('contain', '35%');
  });

  it('unlocks on the matching completion callback', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('onActionFinished', 'runQuickOptimization', true);
    cy.getByCy('action-full').find('button').should('not.be.disabled');
  });

  it('unlocks after a failed action', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('onActionFinished', 'runQuickOptimization', false);
    cy.getByCy('action-full').find('button').should('not.be.disabled');
  });

  it('does not unlock for an unrelated completion callback', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('onActionFinished', 'diskHealth', true);
    cy.getByCy('action-full').find('button').should('be.disabled');
  });

  it('uses 100 percent progress as a secondary unlock', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('onProgressUpdated', 100);
    cy.getByCy('action-full').find('button').should('not.be.disabled');
  });

  it('shows translated and raw logs and clears the console', () => {
    cy.emitHost('onLogReceived', { key: 'log.quick.start' }, 'info');
    cy.emitHost('onLogReceived', { key: 'log.raw', args: { text: 'native output' } }, 'success');
    cy.getByCy('terminal-toggle').click();
    cy.getByCy('terminal-content')
      .should('contain', 'Iniciando Otimização Rápida')
      .and('contain', 'native output');
    cy.getByCy('terminal-clear').click();
    cy.getByCy('terminal-content').should('contain', 'Aguardando logs');
  });

  it('expands and highlights the console when an error arrives', () => {
    cy.emitHost('onLogReceived', { key: 'log.raw', args: { text: 'failure' } }, 'error');
    cy.getByCy('terminal-content').should('be.visible').and('contain', 'failure');
    cy.getByCy('terminal').should('have.class', 'border-danger/60');
  });

  it('retranslates existing logs after a language change', () => {
    cy.emitHost('onLogReceived', { key: 'log.quick.start' }, 'info');
    cy.getByCy('terminal-toggle').click();
    cy.getByCy('terminal-content').should('contain', 'Iniciando');
    cy.getByCy('nav-Settings').click();
    cy.getByCy('language-en').click();
    cy.getByCy('nav-Dashboard').click();
    cy.getByCy('terminal-content').should('contain', 'Starting Quick Optimization');
  });
});
