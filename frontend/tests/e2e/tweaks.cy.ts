import {
  appliedTweakCatalog,
  snapshotAfter,
  snapshotBefore,
  tweakCatalog,
} from './support/fixtures';

const countOf = (stub: Sinon.SinonStub, action: string) =>
  stub.getCalls().filter((call) => call.args[0]?.action === action).length;

describe('à-la-carte optimizations', () => {
  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-Optimize').click();
  });

  it('asks the host for the catalog when the screen is opened', () => {
    cy.expectIpc('loadTweaks');
  });

  it('shows an empty state until the host answers', () => {
    cy.contains('Nenhuma otimização disponível').should('be.visible');
  });

  it('renders the catalog grouped by category with the state the host detected', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-category-cpu').should('be.visible');
    cy.getByCy('tweak-category-boot').should('be.visible');
    cy.getByCy('tweak-category-services').should('be.visible');
    cy.getByCy('tweak-state-cpu.win32PrioritySeparation').should('contain', 'Não aplicada');
    cy.getByCy('tweak-revert-cpu.win32PrioritySeparation').should('not.exist');
  });

  it('applies exactly the Tweaks a preset selected', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-preset-quick').click();
    cy.getByCy('tweak-apply').click();

    cy.expectIpc('applyTweaks', {
      tweakIds: [
        'cpu.win32PrioritySeparation',
        'boot.disableDynamicTick',
        'services.sysMain',
      ],
    });
  });

  it('lets the user drop a Tweak from a preset before applying', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-preset-quick').click();
    cy.getByCy('tweak-select-boot.disableDynamicTick').click();
    cy.getByCy('tweak-apply').click();

    cy.expectIpc('applyTweaks', {
      tweakIds: ['cpu.win32PrioritySeparation', 'services.sysMain'],
    });
  });

  it('refreshes the badges and shows the gain after a batch completes', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.getByCy('tweak-preset-quick').click();
    cy.getByCy('tweak-apply').click();

    // What the host does on success: publish the measurement, re-emit the catalog, then finish.
    cy.emitHost('snapshotCaptured', { before: snapshotBefore, after: snapshotAfter });
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);
    cy.emitHost('actionFinished', { action: 'applyTweaks', ok: true });

    cy.getByCy('tweak-state-cpu.win32PrioritySeparation').should('contain', 'Aplicada');
    cy.getByCy('tweak-state-services.sysMain').should('contain', 'Aplicada');
    cy.getByCy('snapshot-metric-runningServices').should('contain', '80').and('contain', '71');
    cy.getByCy('snapshot-metric-bootDuration').should('contain', '21,5 s');
  });

  it('reverts a single applied Tweak and flips its badge back', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);
    cy.on('window:confirm', () => true);

    cy.getByCy('tweak-revert-services.sysMain').click();
    cy.expectIpc('revertTweak', 'services.sysMain');

    cy.emitHost('tweaksLoaded', {
      ...appliedTweakCatalog,
      tweaks: appliedTweakCatalog.tweaks.map((tweak) =>
        tweak.id === 'services.sysMain' ? { ...tweak, state: 'NotApplied' } : tweak
      ),
    });
    cy.emitHost('actionFinished', { action: 'revertTweak', ok: true });

    cy.getByCy('tweak-state-services.sysMain').should('contain', 'Não aplicada');
    cy.getByCy('tweak-revert-services.sysMain').should('not.exist');
  });

  it('does not revert when the confirmation is cancelled', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);
    cy.on('window:confirm', () => false);

    cy.getByCy('tweak-revert-services.sysMain').click();

    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) =>
      expect(countOf(stub, 'revertTweak')).to.equal(0)
    );
  });

  it('locks the screen while a batch is in flight and releases it on completion', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.getByCy('tweak-preset-quick').click();
    cy.getByCy('tweak-apply').click();

    cy.getByCy('tweak-refresh').should('be.disabled');
    cy.getByCy('tweak-select-services.sysMain').should('be.disabled');

    cy.emitHost('actionFinished', { action: 'applyTweaks', ok: true });
    cy.getByCy('tweak-refresh').should('not.be.disabled');
  });

  it('re-queries the catalog on navigation and on the explicit refresh', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    // Deltas, never absolute counts: StrictMode double-invokes effects in development.
    cy.get<Sinon.SinonStub>('@ipcStub').then((stub) => {
      const before = countOf(stub, 'loadTweaks');

      cy.getByCy('nav-Dashboard').click();
      cy.getByCy('nav-Optimize').click();
      cy.get<Sinon.SinonStub>('@ipcStub').should((after) =>
        expect(countOf(after, 'loadTweaks')).to.be.greaterThan(before)
      );

      cy.get<Sinon.SinonStub>('@ipcStub').then((navigated) => {
        const afterNav = countOf(navigated, 'loadTweaks');
        cy.getByCy('tweak-refresh').click();
        cy.get<Sinon.SinonStub>('@ipcStub').should((refreshed) =>
          expect(countOf(refreshed, 'loadTweaks')).to.be.greaterThan(afterNav)
        );
      });
    });
  });
});
