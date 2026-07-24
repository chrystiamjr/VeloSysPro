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

  it('renders tasks received from the host by cadence, not by technical name', () => {
    cy.emitHost('onTasksLoaded', tasks);
    cy.contains('Diária - Otimização Rápida').should('be.visible');
    cy.contains('Todos os dias às 03:00').should('be.visible');
    cy.contains('Semanal - Modo Gaming').should('be.visible');
    cy.contains('Toda segunda-feira às 04:30').should('be.visible');
    cy.contains('Em execução').should('be.visible');
    cy.contains('VeloSysPro_Quick_Daily_0300').should('not.exist');
  });

  // DAILY ignores the day; WEEKLY and MONTHLY default to MON and day 1.
  const defaultDay: Record<string, string> = { DAILY: '', WEEKLY: 'MON', MONTHLY: '1' };

  for (const type of types) {
    for (const frequency of frequencies) {
      it(`creates ${type} with ${frequency}`, () => {
        cy.getByCy('task-type').select(type);
        cy.getByCy('task-frequency').select(frequency);
        cy.getByCy('task-time').clear().type('04:45');
        cy.getByCy('task-create').click();
        cy.expectIpc(
          'createTask',
          JSON.stringify({ type, frequency, time: '04:45', day: defaultDay[frequency] })
        );
      });
    }
  }

  it('reveals a weekday picker only for weekly schedules', () => {
    cy.getByCy('task-weekday').should('not.exist');
    cy.getByCy('task-frequency').select('WEEKLY');
    cy.getByCy('task-weekday').find('option').should('have.length', 7);
    cy.getByCy('task-monthday').should('not.exist');

    cy.getByCy('task-weekday').select('FRI');
    cy.getByCy('task-create').click();
    cy.expectIpc(
      'createTask',
      JSON.stringify({ type: 'quick', frequency: 'WEEKLY', time: '03:00', day: 'FRI' })
    );
  });

  it('reveals a day-of-month picker only for monthly schedules', () => {
    cy.getByCy('task-frequency').select('MONTHLY');
    cy.getByCy('task-monthday').find('option').should('have.length', 31);
    cy.getByCy('task-weekday').should('not.exist');

    cy.getByCy('task-monthday').select('15');
    cy.getByCy('task-create').click();
    cy.expectIpc(
      'createTask',
      JSON.stringify({ type: 'quick', frequency: 'MONTHLY', time: '03:00', day: '15' })
    );
  });

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
