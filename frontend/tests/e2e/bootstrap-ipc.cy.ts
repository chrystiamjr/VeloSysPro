import { backups, defaultSettings, restorePoints, tasks } from './support/fixtures';

describe('bootstrap and IPC contracts', () => {
  it('requests settings and only the Dashboard lists initially', () => {
    cy.visitApp();
    for (const action of ['getBackups', 'getTasks', 'getSettings']) {
      cy.expectIpc(action);
    }
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      expect(stub.getCalls().some((call) => call.args[0]?.action === 'getRestorePoints')).to.equal(
        false
      );
    });
  });

  // Counts are compared before/after rather than asserted absolutely: StrictMode double-invokes
  // effects in dev, so the bootstrap total is an implementation detail. The delta is not.
  const countOf = (stub: Sinon.SinonStub, action: string) =>
    stub.getCalls().filter((call) => call.args[0]?.action === action).length;

  // Windows owns tasks and restore points, so anything changed outside the app would stay on
  // screen until restart if opening a screen did not re-query.
  for (const [screen, action] of [
    ['Scheduling', 'getTasks'],
    ['Backup', 'getBackups'],
    ['RestorePoints', 'getRestorePoints'],
  ]) {
    it(`re-queries ${action} when entering the ${screen} screen`, () => {
      cy.visitApp();
      cy.get<Sinon.SinonStub>('@ipcStub').then((stub) => {
        const before = countOf(stub, action);
        cy.getByCy(`nav-${screen}`).click();
        cy.get<Sinon.SinonStub>('@ipcStub').should((after) => {
          expect(countOf(after, action)).to.be.greaterThan(before);
        });
      });
    });
  }

  it('does not re-query settings on navigation, which would clobber unsaved edits', () => {
    cy.visitApp();
    cy.get<Sinon.SinonStub>('@ipcStub').then((stub) => {
      const before = countOf(stub, 'getSettings');
      cy.getByCy('nav-Settings').click();
      cy.contains('Idioma').should('be.visible');
      cy.get<Sinon.SinonStub>('@ipcStub').should((after) => {
        expect(countOf(after, 'getSettings')).to.equal(before);
      });
    });
  });

  it('renders safely when no desktop host is available', () => {
    cy.visitApp({ transport: 'none', settings: null });
    cy.contains('Painel de Otimização').should('be.visible');
  });

  it('accepts host collections as objects', () => {
    cy.visitApp();
    cy.emitHost('backupsLoaded', backups);
    cy.emitHost('tasksLoaded', tasks);
    cy.emitHost('restorePointsLoaded', restorePoints);
    cy.getByCy('health-backups').should('contain', '2');
    cy.getByCy('health-tasks').should('contain', '2');
  });

  it('preserves valid collections when a later Event is malformed', () => {
    cy.visitApp();
    cy.emitHost('backupsLoaded', backups);
    cy.emitHost('tasksLoaded', tasks);
    cy.emitHost('backupsLoaded', [{ Name: 'broken' }]);
    cy.emitHost('tasksLoaded', [{ Name: 'broken' }]);
    cy.getByCy('health-backups').should('contain', '2');
    cy.getByCy('health-tasks').should('contain', '2');
  });

  // Parseable JSON of the wrong shape used to sail through the unchecked cast and only surface
  // as a wrong or blank table. It must now be rejected outright.
  it('rejects a well-formed payload whose shape does not match the contract', () => {
    cy.visitApp();
    cy.emitHost('backupsLoaded', [{ Name: 'x.reg', Timestamp: '2026-07-24', Bytes: 4096 }]);
    cy.emitHost('tasksLoaded', [{ Name: 'VeloSysPro_Quick_Daily_0300', Status: 'Ready' }]);

    cy.getByCy('health-backups').should('contain', '0');
    cy.getByCy('health-tasks').should('contain', '0');

    cy.getByCy('nav-Scheduling').click();
    cy.contains('Nenhuma tarefa agendada').should('be.visible');
  });

  it('keeps rendering when the host sends a log with no key', () => {
    cy.visitApp();
    cy.emitHost('logReceived', null);
    cy.contains('Painel de Otimização').should('be.visible');
  });

  it('loads settings from the host', () => {
    cy.visitApp({ settings: { ...defaultSettings, language: 'en_US' } });
    cy.contains('Optimization Dashboard').should('be.visible');
  });
});
