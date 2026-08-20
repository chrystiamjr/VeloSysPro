import { tweakCatalog } from './support/fixtures';

/**
 * An outcome has to reach the user on the screen they are standing on.
 *
 * Every report the host produced used to arrive as one line in the Dashboard's log panel, so a
 * failure raised from Restore Points or Optimize was announced somewhere the user was not
 * looking — and a Safety Checkpoint that Windows quietly refused read as a success.
 */
describe('action outcomes are reported where the action was taken', () => {
  const startRestorePoint = () => {
    cy.visitApp();
    cy.getByCy('nav-RestorePoints').click();
    cy.getByCy('restore-point-create').click();
  };

  it('reports a failure with the host’s reason, without leaving the screen', () => {
    startRestorePoint();

    cy.emitHost('logReceived', {
      message: { key: 'log.restorePoint.unconfirmed' },
      type: 'error',
    });
    cy.emitHost('actionFinished', { action: 'createRestorePoint', ok: false });

    cy.getByCy('toast-fail').should('be.visible');
    cy.getByCy('toast-fail').contains('O Windows não criou o Ponto de Restauração');
    // Still on Restore Points: the report came to the user, not the other way round.
    cy.getByCy('restore-points-table').should('exist');
  });

  it('offers the full trail and takes the user there', () => {
    startRestorePoint();

    cy.emitHost('actionFinished', { action: 'createRestorePoint', ok: false });
    cy.getByCy('toast-view-log').click();

    cy.getByCy('terminal-content').should('be.visible');
  });

  it('says nothing for the reads the host reports on its own', () => {
    cy.visitApp();
    cy.getByCy('nav-RestorePoints').click();

    cy.emitHost('actionFinished', { action: 'getRestorePoints', ok: true });

    cy.getByCy('toast-host').should('not.exist');
  });

  it('never covers the action bar it reports on', () => {
    // The action bar owns the bottom edge of the content panel and was measured into place;
    // a report that sat on top of the Apply button would undo that.
    cy.visitApp();
    cy.getByCy('nav-Optimize').click();
    cy.emitHost('tweaksLoaded', tweakCatalog);

    // The batch has to be started here, not merely reported: a report is only raised for the
    // mutation this screen dispatched.
    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-apply').click();
    cy.emitHost('actionFinished', { action: 'applyTweaks', ok: false });

    cy.getByCy('toast-fail').then(($toast) => {
      cy.getByCy('tweak-action-bar').then(($bar) => {
        const toast = $toast[0].getBoundingClientRect();
        const bar = $bar[0].getBoundingClientRect();
        const overlaps = toast.bottom > bar.top && toast.top < bar.bottom;

        expect(overlaps, 'report overlaps the action bar').to.equal(false);
      });
    });
  });
});
