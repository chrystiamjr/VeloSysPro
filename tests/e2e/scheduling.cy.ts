import { tasks } from './support/fixtures';

const types = ['quick', 'full', 'gaming', 'revert'];
const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];

describe('scheduled optimizations', () => {
  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-Scheduling').click();
  });

  it('shows an empty state and all supported options', () => {
    cy.contains('Nenhuma tarefa agendada').should('be.visible');
    cy.getByCy('task-type').find('option').should('have.length', 4);
    cy.getByCy('task-frequency').find('option').should('have.length', 3);
  });

  it('renders tasks received from the host', () => {
    cy.emitHost('onTasksLoaded', tasks);
    cy.contains('VeloSysPro_Quick').should('be.visible');
    cy.contains('Running').should('be.visible');
  });

  for (const type of types) {
    for (const frequency of frequencies) {
      it(`creates ${type} with ${frequency}`, () => {
        cy.getByCy('task-type').select(type);
        cy.getByCy('task-frequency').select(frequency);
        cy.getByCy('task-time').clear().type('04:45');
        cy.getByCy('task-create').click();
        cy.expectIpc('createTask', JSON.stringify({ type, frequency, time: '04:45' }));
      });
    }
  }

  it('deletes a task after confirmation', () => {
    cy.emitHost('onTasksLoaded', tasks);
    cy.on('window:confirm', () => true);
    cy.getByCy(`task-delete-${tasks[0].Name}`).click();
    cy.expectIpc('deleteTask', tasks[0].Name);
  });

  it('keeps a task after cancellation', () => {
    cy.emitHost('onTasksLoaded', tasks);
    cy.on('window:confirm', () => false);
    cy.getByCy(`task-delete-${tasks[0].Name}`).click();
    cy.get<Sinon.SinonStub>('@ipcStub').should(
      (stub) =>
        expect(stub.getCalls().some((call) => call.args[0]?.action === 'deleteTask')).to.be.false
    );
  });
});
