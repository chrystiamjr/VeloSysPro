describe('VeloSys Pro - Dashboard E2E Tests (TypeScript)', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win: Window) {
        win.external = {
          ExecuteAction: cy.stub().as('executeActionStub'),
        };
      },
    });
  });

  it('renders VeloSys Pro branding and health indicators correctly', () => {
    cy.contains('VeloSys Pro').should('be.visible');
    cy.contains('Envolvo Systems LTDA.').should('be.visible');
    cy.contains('Backups Criados').should('be.visible');
  });

  it('triggers Quick Optimization action on card button click', () => {
    cy.contains('h3', 'Otimização Rápida')
      .closest('[aria-busy]')
      .find('button')
      .contains('Executar Agora')
      .click();
    cy.get('@executeActionStub').should('have.been.calledWith', 'runQuickOptimization', '');
  });

  it('triggers Full Optimization action on card button click', () => {
    cy.contains('h3', 'Otimização Completa')
      .closest('[aria-busy]')
      .find('button')
      .contains('Executar Agora')
      .click();
    cy.get('@executeActionStub').should('have.been.calledWith', 'runFullOptimization', '');
  });

  it('groups secondary tools with maintenance open and recovery closed', () => {
    cy.contains('Saúde do Disco').should('exist');
    cy.contains('Backup de Registro').should('not.exist');

    cy.contains('button', 'Segurança e recuperação').scrollIntoView().click();
    cy.contains('Backup de Registro').should('exist');
    cy.contains('Criar Restore Point').should('exist');
  });

  it('confirms before reverting network defaults', () => {
    cy.contains('button', 'Segurança e recuperação').click();
    cy.on('window:confirm', () => true);
    cy.contains('button', 'Reverter').click();

    cy.get('@executeActionStub').should('have.been.calledWith', 'revertDefaults', '');
  });

  it('uses summary metrics as navigation shortcuts', () => {
    cy.contains('button', 'Backups Criados').click();
    cy.contains('Backups do Registro').should('be.visible');
  });

  it('blocks system mutations globally while an optimization is running', () => {
    cy.contains('h3', 'Otimização Rápida')
      .closest('[aria-busy]')
      .find('button')
      .contains('Executar Agora')
      .click();
    cy.contains('Agendamento').click();
    cy.contains('button', 'Agendar').should('be.disabled');
  });
});
