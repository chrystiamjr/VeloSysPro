import {
  appliedTweakCatalog,
  mixedTweakCatalog,
  snapshotAfter,
  snapshotAfterReboot,
  snapshotBefore,
  tweakCatalog,
  unsupportedTweakCatalog,
} from './support/fixtures';

const countOf = (stub: Sinon.SinonStub, action: string) =>
  stub.getCalls().filter((call) => call.args[0]?.action === action).length;

describe('à-la-carte optimizations', () => {
  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-Optimize').click();
  });

  it('asks the host for the catalog and the history when the screen is opened', () => {
    cy.expectIpc('loadTweaks');
    cy.expectIpc('loadHistory');
  });

  it('says it is querying the system before the host has answered', () => {
    cy.getByCy('tweak-catalog-loading').should('be.visible');
    cy.contains('Nenhuma otimização disponível').should('not.exist');
  });

  it('shows an empty state once the host answers with nothing', () => {
    cy.emitHost('tweaksLoaded', { ...tweakCatalog, tweaks: [], presets: [] });

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

  it('starts with the boxes mirroring the live system and nothing to submit', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-select-services.sysMain').should('be.checked');
    cy.getByCy('tweak-apply').should('be.disabled');
    cy.contains('Nenhuma alteração pendente').should('be.visible');
  });

  it('submits only the newly ticked Tweaks', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-apply').click();

    cy.expectIpc('applyTweaks', {
      tweakIds: [
        'cpu.win32PrioritySeparation',
        'boot.disableDynamicTick',
        'services.sysMain',
        'system.powerPlan',
      ],
      revertIds: [],
    });
  });

  it('lets the user drop a Tweak from a preset before applying', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-select-boot.disableDynamicTick').click();
    cy.getByCy('tweak-apply').click();

    cy.expectIpc('applyTweaks', {
      tweakIds: ['cpu.win32PrioritySeparation', 'services.sysMain', 'system.powerPlan'],
      revertIds: [],
    });
  });

  it('names what will be undone before undoing it', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-select-services.sysMain').click();
    cy.getByCy('tweak-apply').click();

    cy.getByCy('revert-confirm').should('be.visible');
    cy.getByCy('revert-confirm-items').should('contain', 'SysMain em início Manual');
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) =>
      expect(countOf(stub, 'applyTweaks')).to.equal(0)
    );
  });

  it('submits both directions as one batch once confirmed', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-select-services.sysMain').click();
    cy.getByCy('tweak-apply').click();
    cy.getByCy('revert-confirm-confirm').click();

    cy.expectIpc('applyTweaks', { tweakIds: [], revertIds: ['services.sysMain'] });
  });

  it('turns clearing the selection into undoing everything applied', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-clear').click();
    cy.contains('0 para aplicar · 4 para reverter').should('be.visible');
    cy.getByCy('tweak-apply').click();
    cy.getByCy('revert-confirm-confirm').click();

    cy.expectIpc('applyTweaks', {
      tweakIds: [],
      revertIds: [
        'cpu.win32PrioritySeparation',
        'boot.disableDynamicTick',
        'services.sysMain',
        'system.powerPlan',
      ],
    });
  });

  it('dispatches nothing when the revert confirmation is dismissed', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-select-services.sysMain').click();
    cy.getByCy('tweak-apply').click();
    cy.getByCy('revert-confirm-cancel').click();

    cy.getByCy('revert-confirm').should('not.exist');
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) =>
      expect(countOf(stub, 'applyTweaks')).to.equal(0)
    );
  });

  it('closes the revert confirmation on Escape without dispatching', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-select-services.sysMain').click();
    cy.getByCy('tweak-apply').click();
    cy.get('body').type('{esc}');

    cy.getByCy('revert-confirm').should('not.exist');
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) =>
      expect(countOf(stub, 'applyTweaks')).to.equal(0)
    );
  });

  it('refreshes the badges and shows the gain after a batch completes', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-apply').click();

    // What the host does on success: publish the measurement, re-emit the catalog, then finish.
    cy.emitHost('snapshotCaptured', {
      before: snapshotBefore,
      after: snapshotAfter,
      changes: [
        {
          tweakId: 'services.sysMain',
          setting: 'StartType',
          before: 'Automatic',
          after: 'Manual',
        },
      ],
    });
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);
    cy.emitHost('actionFinished', { action: 'applyTweaks', ok: true });

    cy.getByCy('tweak-state-cpu.win32PrioritySeparation').should('contain', 'Aplicada');
    cy.getByCy('tweak-state-services.sysMain').should('contain', 'Aplicada');
    cy.getByCy('snapshot-metric-runningServices').should('contain', '80').and('contain', '71');
    cy.getByCy('snapshot-change-services.sysMain')
      .should('contain', 'Automatic')
      .and('contain', 'Manual');
    // The refreshed catalog is the authority: the drawn intent goes back to matching it.
    cy.getByCy('tweak-apply').should('be.disabled');
  });

  it('refuses to pass two unrelated readings off as a batch comparison', () => {
    // Shipped in v0.4.1: a standalone reading persisted weeks later became the second half of an
    // old batch's pair, and the drift between them was presented as an optimization result.
    cy.emitHost('tweaksLoaded', tweakCatalog);

    // Establish a real comparison first, so the assertion below observes it *disappearing*. The
    // panel starts empty, and asserting the empty state against a fresh screen would pass whether
    // the guard exists or not.
    cy.emitHost('historyLoaded', [snapshotBefore, snapshotAfter]);
    cy.getByCy('snapshot-metric-automaticServices').should('exist');

    cy.emitHost('historyLoaded', [snapshotBefore, snapshotAfterReboot]);
    cy.getByCy('snapshot-metric-automaticServices').should('not.exist');
    cy.getByCy('snapshot-diff').should('contain', 'Aplique otimizações para ver o que mudou');
  });

  it('brings the last comparison back from disk when there is no live measurement', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.emitHost('historyLoaded', [snapshotBefore, snapshotAfter]);

    cy.getByCy('snapshot-diff').find('table').should('exist');
    cy.getByCy('snapshot-metric-runningServices').should('contain', '80').and('contain', '71');
  });

  it('does not pass off an unchanged boot figure as the batch making no difference', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.emitHost('snapshotCaptured', {
      // Both readings come from the same session, so the event log reports one boot twice.
      before: snapshotBefore,
      after: snapshotAfter,
      changes: [],
    });

    cy.getByCy('snapshot-metric-bootDuration').should('contain', 'reinicie para medir');
  });

  it('asks the host to measure on launch, so a post-restart figure can ever exist', () => {
    // Without this the hint above is permanent: nothing else ever produces a measurement from a
    // later boot, so the batch's own pair is reloaded from disk unchanged, forever.
    cy.expectIpc('captureSnapshot');
  });

  it('resolves the restart hint once a measurement from a later boot arrives', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.emitHost('snapshotCaptured', { before: snapshotBefore, after: snapshotAfter, changes: [] });
    cy.getByCy('snapshot-metric-bootDuration').should('contain', 'reinicie para medir');

    // The machine restarted and the app measured on launch. That reading is a standalone one —
    // no `before` — and it never enters the history series.
    cy.emitHost('snapshotCaptured', { before: null, after: snapshotAfterReboot, changes: [] });

    cy.getByCy('snapshot-metric-bootDuration')
      .should('not.contain', 'reinicie para medir')
      // Anchored to the state before the change (32,0 s), not to the post-batch reading that
      // carries the same old boot.
      .and('contain', '32,0 s')
      .and('contain', '18,2 s');
  });

  it('warns and offers a fix when System Protection is off', () => {
    cy.emitHost('tweaksLoaded', { ...tweakCatalog, systemProtectionEnabled: false });

    cy.getByCy('system-protection-notice').should('be.visible');
    cy.contains('Painel de Controle').should('be.visible');

    cy.getByCy('system-protection-enable').click();
    cy.expectIpc('enableSystemProtection');
  });

  it('keeps the warning out of the way once protection is on', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('system-protection-notice').should('not.exist');
  });

  it('reverts a single applied Tweak from its row and flips its badge back', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-revert-services.sysMain').click();
    cy.getByCy('single-revert-confirm-items').should('contain', 'SysMain em início Manual');
    cy.getByCy('single-revert-confirm-confirm').click();
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

  it('does not revert a single Tweak when that confirmation is cancelled', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);

    cy.getByCy('tweak-revert-services.sysMain').click();
    cy.getByCy('single-revert-confirm-cancel').click();

    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) =>
      expect(countOf(stub, 'revertTweak')).to.equal(0)
    );
  });

  it('locks the screen while a batch is in flight and releases it on completion', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-apply').click();

    cy.getByCy('tweak-refresh').should('be.disabled');
    cy.getByCy('tweak-select-services.sysMain').should('be.disabled');

    cy.emitHost('actionFinished', { action: 'applyTweaks', ok: true });
    cy.getByCy('tweak-refresh').should('not.be.disabled');
  });

  it('keeps the drawn selection through a refresh that found nothing new', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-select-cpu.win32PrioritySeparation').click();
    cy.getByCy('tweak-refresh').click();
    // The host answers with the same catalog: the selection must survive it.
    cy.emitHost('tweaksLoaded', { ...tweakCatalog });

    cy.getByCy('tweak-select-cpu.win32PrioritySeparation').should('be.checked');
    cy.getByCy('tweak-apply').should('not.be.disabled');
  });

  it('holds Advanced Tweaks behind a collapsed section and its own confirmation', () => {
    cy.emitHost('tweaksLoaded', mixedTweakCatalog);

    // Scrolled to first: it sits below the fold, and the layout's outer overflow-hidden makes
    // Cypress treat anything past those bounds as hidden.
    cy.getByCy('tweak-advanced-section').scrollIntoView().should('be.visible');
    cy.getByCy('tweak-select-advanced.memoryIntegrity').should('not.exist');

    cy.getByCy('tweak-advanced-toggle').click();
    cy.getByCy('tweak-select-advanced.memoryIntegrity').should('not.be.checked').click();
    cy.getByCy('tweak-apply').click();

    cy.contains('reduzem sua segurança').should('be.visible');
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) =>
      expect(countOf(stub, 'applyTweaks')).to.equal(0)
    );

    cy.getByCy('revert-confirm-confirm').click();
    cy.expectIpc('applyTweaks', { tweakIds: ['advanced.memoryIntegrity'], revertIds: [] });
  });

  it('never lets a preset or the recommended set tick an Advanced Tweak', () => {
    cy.emitHost('tweaksLoaded', mixedTweakCatalog);
    cy.getByCy('tweak-advanced-toggle').click();

    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-select-advanced.memoryIntegrity').should('not.be.checked');

    cy.getByCy('tweak-recommended').click();
    cy.getByCy('tweak-select-advanced.memoryIntegrity').should('not.be.checked');
  });

  it('locks a Tweak this machine cannot use and says why', () => {
    cy.emitHost('tweaksLoaded', unsupportedTweakCatalog);

    cy.getByCy('tweak-state-services.sysMain').should('contain', 'Indisponível');
    cy.getByCy('tweak-select-services.sysMain').should('be.disabled');
    cy.getByCy('tweak-unsupported-services.sysMain')
      .scrollIntoView()
      .should('be.visible')
      .and('contain', 'não tem o recurso');
  });

  it('draws one fewer box for a preset naming an unavailable Tweak, and submits the rest', () => {
    cy.emitHost('tweaksLoaded', unsupportedTweakCatalog);

    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('tweak-select-services.sysMain').should('not.be.checked');
    cy.getByCy('tweak-select-cpu.win32PrioritySeparation').should('be.checked');

    cy.getByCy('tweak-apply').click();
    cy.expectIpc('applyTweaks', {
      tweakIds: [
        'cpu.win32PrioritySeparation',
        'boot.disableDynamicTick',
        'system.powerPlan',
      ],
      revertIds: [],
    });
  });

  it('renders a category it does not have copy for instead of dropping it', () => {
    cy.emitHost('tweaksLoaded', mixedTweakCatalog);

    cy.getByCy('tweak-category-other').should('contain', 'Outras');
    cy.getByCy('tweak-select-network.tcpTuning').should('exist');
  });

  it('says when a preset has been edited by hand', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);

    cy.getByCy('tweak-preset-gaming').click();
    cy.getByCy('preset-modified').should('not.exist');

    // Ticking a row scrolls the catalog, and the layout's outer overflow-hidden makes Cypress
    // treat anything past the scrollport as hidden — so scroll back before asserting.
    cy.getByCy('tweak-select-services.sysMain').click();
    cy.getByCy('preset-modified').scrollIntoView().should('be.visible');
  });

  it('keeps the last valid catalog and says so when the host sends garbage', () => {
    cy.emitHost('tweaksLoaded', tweakCatalog);
    cy.emitHost('tweaksLoaded', { tweaks: [{ id: 'broken' }], presets: [] });

    cy.getByCy('tweak-catalog-stale').should('be.visible');
    cy.getByCy('tweak-category-cpu').should('be.visible');
    cy.getByCy('tweak-select-services.sysMain').should('exist');
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
