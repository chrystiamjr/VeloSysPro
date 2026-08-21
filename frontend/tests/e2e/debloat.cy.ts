import { debloatCatalog } from './support/fixtures';

const countOf = (stub: Sinon.SinonStub, action: string) =>
  stub.getCalls().filter((call) => call.args[0]?.action === action).length;

/** Every package name the host would actually uninstall, as it appears in a command. */
const PACKAGE_NAMES = [
  'Microsoft.BingWeather',
  'Microsoft.BingNews',
  'Microsoft.WindowsCamera',
  'Microsoft.MicrosoftSolitaireCollection',
];

describe('debloat (preinstalled app removal)', () => {
  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-Debloat').click();
  });

  it('asks the host for the installed apps when the screen is opened', () => {
    cy.expectIpc('loadDebloat');
  });

  it('says it is querying the system before the host has answered', () => {
    cy.getByCy('debloat-loading').should('be.visible');
    cy.getByCy('debloat-list').should('not.exist');
  });

  it('shows an empty state once the host answers with nothing', () => {
    cy.emitHost('debloatLoaded', { packages: [] });

    cy.contains('Nenhum aplicativo removível encontrado').should('be.visible');
  });

  it('warns that a removal cannot be undone from the app, before anything is selected', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-warning')
      .should('be.visible')
      .and('contain', 'Remoções não podem ser desfeitas por este aplicativo');
  });

  it('renders the allow-list split into Safe and Optional, with what the host detected', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-group-safe').should('contain', 'Seguros para remover');
    cy.getByCy('debloat-group-optional').should('contain', 'Opcionais');
    cy.getByCy('debloat-state-weather').should('contain', 'Instalado');
    cy.getByCy('debloat-state-solitaire').should('contain', 'Não instalado');
    cy.getByCy('debloat-caveat-oneDrive').should('contain', 'baixando o OneDrive');
  });

  it('starts with nothing ticked and nothing to submit', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    for (const pkg of debloatCatalog.packages) {
      if (pkg.installed) cy.getByCy(`debloat-select-${pkg.id}`).should('not.be.checked');
    }
    cy.getByCy('debloat-remove').should('be.disabled');
    cy.contains('Nenhum aplicativo selecionado').should('be.visible');
  });

  it('cannot select an app the machine no longer has', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-solitaire').should('be.disabled');
  });

  it('names every selected app and its caveat, and removes nothing until confirmed', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-select-camera').click();
    cy.getByCy('debloat-remove').click();

    cy.getByCy('debloat-confirm').should('be.visible');
    cy.getByCy('debloat-confirm-items').should('contain', 'Clima').and('contain', 'Câmera');
    cy.getByCy('debloat-confirm-items').should('contain', 'Microsoft Store');
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      expect(countOf(stub, 'runDebloat')).to.equal(0);
    });
  });

  it('dispatches nothing when the confirmation is cancelled', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-cancel').click();

    cy.getByCy('debloat-confirm').should('not.exist');
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      expect(countOf(stub, 'runDebloat')).to.equal(0);
    });
  });

  it('submits the exact invariant ids exactly once on confirm', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-select-news').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.expectIpc('runDebloat', { packageIds: ['weather', 'news'] });
    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      expect(countOf(stub, 'runDebloat')).to.equal(1);
    });
  });

  it('never puts a package family name on the wire', () => {
    // The security boundary is that the frontend cannot name what gets uninstalled: it submits the
    // host's own ids, and the host looks the package names up in its allow-list. If a family name
    // ever appeared in a payload, a near-match one could too.
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      const wire = JSON.stringify(stub.getCalls().map((call) => call.args));
      for (const name of PACKAGE_NAMES) expect(wire).to.not.contain(name);
    });
  });

  it('submits the host id byte for byte, never a near-match of it', () => {
    // The host matches ids ordinally and exactly, so anything the frontend normalises — case,
    // trimming, a prefix — becomes an id the allow-list rejects, or worse, a different app's.
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-oneDrive').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.expectIpc('runDebloat', { packageIds: ['oneDrive'] });
  });

  it('claims nothing was removed when the host refuses the batch outright', () => {
    // A Safety Checkpoint that could not be built means the host issued no removal command at all,
    // and says so by finishing without a debloatCompleted. The screen must not fill that silence
    // in — neither with results nor with a list that implies something happened.
    cy.emitHost('debloatLoaded', debloatCatalog);
    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.emitHost('logReceived', {
      message: { key: 'log.checkpoint.protectionDisabled' },
      type: 'error',
    });
    cy.emitHost('actionFinished', { action: 'runDebloat', ok: false });

    cy.getByCy('debloat-result-weather').should('not.exist');
    cy.getByCy('debloat-state-weather').should('contain', 'Instalado');
    cy.getByCy('toast-host').should('contain', 'Proteção do Sistema do Windows está desativada');
  });

  it('drops an app the host stopped reporting as installed before submitting', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-select-news').click();

    // The list is re-read while the user is deciding, and weather turns out to be gone already.
    cy.emitHost('debloatLoaded', {
      packages: debloatCatalog.packages.map((pkg) =>
        pkg.id === 'weather' ? { ...pkg, installed: false } : pkg
      ),
    });

    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.expectIpc('runDebloat', { packageIds: ['news'] });
  });

  it('renders the per-package outcome of the batch beside the refreshed list', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);
    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-select-news').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.emitHost('debloatCompleted', {
      results: [
        { id: 'weather', ok: true },
        { id: 'news', ok: false },
      ],
    });
    cy.emitHost('debloatLoaded', {
      packages: debloatCatalog.packages.map((pkg) =>
        pkg.id === 'weather' ? { ...pkg, installed: false } : pkg
      ),
    });

    cy.getByCy('debloat-result-weather').should('contain', 'Removido');
    cy.getByCy('debloat-result-news').should('contain', 'Ainda instalado');
    cy.getByCy('debloat-state-weather').should('contain', 'Não instalado');
    // The batch is over; the selection is not still sitting there ready to be sent again.
    cy.getByCy('debloat-remove').should('be.disabled');
  });

  it('keeps the last valid list and says so when the host answers with something unreadable', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.emitHost('debloatLoaded', { packages: [{ id: 'weather', group: 'Whatever' }] });

    cy.getByCy('debloat-stale').should('be.visible');
    cy.getByCy('debloat-row-weather').should('be.visible');
    cy.getByCy('debloat-state-weather').should('contain', 'Instalado');
  });

  it('reports a failed removal on the screen that started it', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);
    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    cy.emitHost('logReceived', {
      message: { key: 'log.debloat.removeFailed', args: { id: 'weather' } },
      type: 'error',
    });
    cy.emitHost('actionFinished', { action: 'runDebloat', ok: false });

    cy.getByCy('toast-host').should('contain', 'O aplicativo continua instalado');
  });

  it('re-reads the list on request', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);

    cy.getByCy('debloat-refresh').click();

    cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
      expect(countOf(stub, 'loadDebloat')).to.be.greaterThan(1);
    });
  });

  it('locks the screen while another action is running', () => {
    cy.emitHost('debloatLoaded', debloatCatalog);
    cy.getByCy('debloat-select-weather').click();
    cy.getByCy('debloat-remove').click();
    cy.getByCy('debloat-confirm-confirm').click();

    // The mutation is in flight until the host reports it finished.
    cy.getByCy('debloat-refresh').should('be.disabled');
    cy.getByCy('debloat-select-news').should('be.disabled');
  });
});
