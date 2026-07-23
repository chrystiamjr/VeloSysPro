describe('VeloSys Pro - Screen Navigation E2E', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win: Window) {
        win.external = {
          ExecuteAction: cy.stub().as('executeActionStub'),
        };
      },
    });
  });

  it('navigates to the Backup screen and shows its section', () => {
    cy.contains('Backup & Restauração').click();
    cy.contains('Backups do Registro').should('be.visible');
    cy.contains('Criar Backup Agora').should('be.visible');
  });

  it('navigates to the Scheduling screen and can schedule a task', () => {
    cy.contains('Agendamento').click();
    cy.contains('Agendar Otimização').should('be.visible');
    cy.contains('button', 'Agendar').click();
    cy.get('@executeActionStub').should('have.been.calledWithMatch', 'createTask');
  });

  it('navigates to the Restore Points screen', () => {
    cy.contains('Restore Points').click();
    cy.contains('Pontos de Restauração do Sistema').should('be.visible');
    cy.contains('Criar Ponto de Restauração').should('be.visible');
  });

  it('navigates to Settings and switches language to English', () => {
    cy.contains('Configurações').click();
    cy.contains('Idioma').should('be.visible');
    cy.contains('button', 'English').click();
    // Header re-renders in English after the language switch.
    cy.contains('Settings').should('be.visible');
  });
});
