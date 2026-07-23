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
    cy.contains('⚡ VeloSys Pro').should('be.visible');
    cy.contains('Envolvo Systems LTDA.').should('be.visible');
    cy.contains('Administrador').should('be.visible');
  });

  it('triggers Quick Optimization action on card button click', () => {
    cy.contains('Otimização Rápida').parents('div').contains('Executar Agora').click();
    cy.get('@executeActionStub').should('have.been.calledWith', 'runQuickOptimization', '');
  });

  it('triggers Full Optimization action on card button click', () => {
    cy.contains('Otimização Completa').parents('div').contains('Executar Agora').click();
    cy.get('@executeActionStub').should('have.been.calledWith', 'runFullOptimization', '');
  });
});
