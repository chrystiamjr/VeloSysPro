import type { AppSettings } from '../../../src/domain/types';
import type { IpcEventName } from '../../../src/domain/schemas';
import { defaultSettings } from './fixtures';

interface VisitAppOptions {
  transport?: 'webview' | 'none';
  settings?: AppSettings | null;
}

declare global {
  namespace Cypress {
    interface Chainable {
      visitApp(options?: VisitAppOptions): Chainable<void>;
      emitHost(event: IpcEventName, payload: unknown): Chainable<Window>;
      getByCy(value: string): Chainable<JQuery<HTMLElement>>;
      expectIpc(action: string, payload?: unknown): Chainable<Sinon.SinonStub>;
    }
  }
}

Cypress.Commands.add('visitApp', (options: VisitAppOptions = {}) => {
  const transport = options.transport ?? 'webview';

  cy.visit('/', {
    onBeforeLoad(win) {
      if (transport === 'webview') {
        win.chrome = {
          webview: {
            postMessage: cy.stub().as('ipcStub'),
            addEventListener: cy.stub(),
          },
        };
      }
    },
  });

  const settings = options.settings === undefined ? defaultSettings : options.settings;
  if (settings !== null) {
    cy.emitHost('settingsLoaded', settings);
  }
});

Cypress.Commands.add('emitHost', (event: IpcEventName, payload: unknown) => {
  return cy
    .window()
    .should((win) => {
      const addEventListener = win.chrome?.webview?.addEventListener as
        | Sinon.SinonStub
        | undefined;
      const listener = addEventListener?.getCalls().find((call) => call.args[0] === 'message')
        ?.args[1];
      expect(listener, `${event} listener`).to.be.a('function');
    })
    .then((win) => {
      const addEventListener = win.chrome?.webview?.addEventListener as
        | Sinon.SinonStub
        | undefined;
      const listener = addEventListener?.getCalls().find((call) => call.args[0] === 'message')
        ?.args[1] as ((message: { data: unknown }) => void) | undefined;
      expect(listener, `${event} listener`).to.be.a('function');
      listener?.({ data: { event, payload } });
      return win;
    });
});

Cypress.Commands.add('getByCy', (value: string) => cy.get(`[data-cy="${value}"]`));

Cypress.Commands.add('expectIpc', (action: string, payload: unknown = null) => {
  return cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
    const matched = stub.getCalls().some((call) => {
      const [first, second] = call.args;
      return typeof first === 'object'
        ? first.action === action && Cypress._.isEqual(first.payload, payload)
        : first === action && Cypress._.isEqual(second, payload);
    });
    expect(matched, `IPC ${action}(${payload})`).to.equal(true);
  });
});

export {};
