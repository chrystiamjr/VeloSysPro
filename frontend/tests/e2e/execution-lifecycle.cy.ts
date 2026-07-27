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
    cy.emitHost('statusUpdated', { key: 'status.quick.dns' });
    cy.emitHost('progressUpdated', 35);
    cy.getByCy('status-message').should('contain', '[1/3]');
    cy.getByCy('progress-percent').should('have.text', '35%');
    cy.getByCy('progress-bar').should('have.attr', 'style').and('contain', '35%');
  });

  it('unlocks on the matching completion Event', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('actionFinished', { action: 'runQuickOptimization', ok: true });
    cy.getByCy('action-full').find('button').should('not.be.disabled');
  });

  it('unlocks after a failed action', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('actionFinished', { action: 'runQuickOptimization', ok: false });
    cy.getByCy('action-full').find('button').should('not.be.disabled');
    cy.getByCy('terminal').should('have.class', 'border-danger/60');
  });

  it('does not unlock for an unrelated completion Event', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('actionFinished', { action: 'diskHealth', ok: true });
    cy.getByCy('action-full').find('button').should('be.disabled');
  });

  it('keeps the mutation locked when progress reaches 100 percent', () => {
    cy.getByCy('action-quick').find('button').click();
    cy.emitHost('progressUpdated', 100);
    cy.getByCy('action-full').find('button').should('be.disabled');
  });

  it('shows translated and raw logs and clears the console', () => {
    cy.emitHost('logReceived', { message: { key: 'log.quick.start' }, type: 'info' });
    cy.emitHost('logReceived', {
      message: { key: 'log.raw', args: { text: 'native output' } },
      type: 'success',
    });
    cy.getByCy('terminal-toggle').click();
    cy.getByCy('terminal-content')
      .should('contain', 'Iniciando Limpeza Rápida')
      .and('contain', 'native output');
    cy.getByCy('terminal-clear').click();
    cy.getByCy('terminal-content').should('contain', 'Aguardando logs');
  });

  it('expands the console when an error log arrives', () => {
    cy.emitHost('logReceived', {
      message: { key: 'log.raw', args: { text: 'failure' } },
      type: 'error',
    });
    cy.getByCy('terminal-content').should('be.visible').and('contain', 'failure');
  });

  it('retranslates existing logs after a language change', () => {
    cy.emitHost('logReceived', { message: { key: 'log.quick.start' }, type: 'info' });
    cy.getByCy('terminal-toggle').click();
    cy.getByCy('terminal-content').should('contain', 'Iniciando');
    cy.getByCy('nav-Settings').click();
    cy.getByCy('language-en').click();
    cy.getByCy('nav-Dashboard').click();
    cy.getByCy('terminal-content').should('contain', 'Starting Quick Cleanup');
  });
});
