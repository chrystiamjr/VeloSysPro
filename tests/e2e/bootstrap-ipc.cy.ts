import { backups, defaultSettings, restorePoints, tasks } from './support/fixtures';

describe('bootstrap and IPC contracts', () => {
  it('requests every initial data set through the WebView2 transport', () => {
    cy.visitApp();
    for (const action of ['getBackups', 'getTasks', 'getRestorePoints', 'getSettings']) {
      cy.expectIpc(action);
    }
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

  it('supports the legacy window.external transport', () => {
    cy.visitApp({ transport: 'external' });
    cy.expectIpc('getSettings');
  });

  it('renders safely when no desktop host is available', () => {
    cy.visitApp({ transport: 'none', settings: null });
    cy.contains('Painel de Otimização').should('be.visible');
  });

  it('accepts host collections as objects', () => {
    cy.visitApp();
    cy.emitHost('onBackupsLoaded', backups);
    cy.emitHost('onTasksLoaded', tasks);
    cy.emitHost('onRestorePointsLoaded', restorePoints);
    cy.getByCy('health-backups').should('contain', '2');
    cy.getByCy('health-tasks').should('contain', '2');
  });

  it('accepts host collections as serialized JSON', () => {
    cy.visitApp();
    cy.emitHost('onBackupsLoaded', JSON.stringify(backups));
    cy.emitHost('onTasksLoaded', JSON.stringify(tasks));
    cy.getByCy('health-latest-backup').should('contain', backups[0].Date);
  });

  it('falls back to empty collections for malformed JSON', () => {
    cy.visitApp();
    cy.emitHost('onBackupsLoaded', '{invalid');
    cy.emitHost('onTasksLoaded', '{invalid');
    cy.getByCy('health-backups').should('contain', '0');
    cy.getByCy('health-tasks').should('contain', '0');
  });

  it('loads serialized settings from the host', () => {
    cy.visitApp({ settings: JSON.stringify({ ...defaultSettings, language: 'en_US' }) });
    cy.contains('Optimization Dashboard').should('be.visible');
  });
});
