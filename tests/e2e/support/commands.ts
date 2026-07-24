import type {
  AppSettings,
  BackupItem,
  LocalizedMessage,
  LogType,
  RestorePointItem,
  ScheduledTaskItem,
  UpdateInfo,
} from '../../../src/domain/types';
import { defaultSettings } from './fixtures';

type HostCallback =
  | 'onLogReceived'
  | 'onStatusUpdated'
  | 'onProgressUpdated'
  | 'onBackupsLoaded'
  | 'onTasksLoaded'
  | 'onRestorePointsLoaded'
  | 'onSettingsLoaded'
  | 'onUpdateAvailable'
  | 'onActionFinished';

interface VisitAppOptions {
  transport?: 'webview' | 'external' | 'none';
  settings?: AppSettings | string | null;
}

declare global {
  namespace Cypress {
    interface Chainable {
      visitApp(options?: VisitAppOptions): Chainable<void>;
      emitHost(callback: HostCallback, ...args: unknown[]): Chainable<Window>;
      getByCy(value: string): Chainable<JQuery<HTMLElement>>;
      expectIpc(action: string, payload?: string): Chainable<Sinon.SinonStub>;
    }
  }

  interface Window {
    onLogReceived?: (message: LocalizedMessage, type: LogType) => void;
    onStatusUpdated?: (status: LocalizedMessage) => void;
    onProgressUpdated?: (percent: number) => void;
    onBackupsLoaded?: (data: string | BackupItem[]) => void;
    onTasksLoaded?: (data: string | ScheduledTaskItem[]) => void;
    onRestorePointsLoaded?: (data: string | RestorePointItem[]) => void;
    onSettingsLoaded?: (data: string | AppSettings) => void;
    onUpdateAvailable?: (info: UpdateInfo) => void;
    onActionFinished?: (action: string, ok: boolean) => void;
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
      } else if (transport === 'external') {
        win.external = {
          ExecuteAction: cy.stub().as('ipcStub'),
        };
      }
    },
  });

  const settings = options.settings === undefined ? defaultSettings : options.settings;
  if (settings !== null) {
    cy.emitHost('onSettingsLoaded', settings);
  }
});

Cypress.Commands.add('emitHost', (callback: HostCallback, ...args: unknown[]) => {
  return cy
    .window()
    .should((win) => {
      expect(win[callback], `${callback} subscription`).to.be.a('function');
    })
    .then((win) => {
      const fn = win[callback] as ((...values: unknown[]) => void) | undefined;
      fn?.(...args);
      return win;
    });
});

Cypress.Commands.add('getByCy', (value: string) => cy.get(`[data-cy="${value}"]`));

Cypress.Commands.add('expectIpc', (action: string, payload = '') => {
  return cy.get<Sinon.SinonStub>('@ipcStub').should((stub) => {
    const matched = stub.getCalls().some((call) => {
      const [first, second] = call.args;
      return typeof first === 'object'
        ? first.action === action && first.payload === payload
        : first === action && second === payload;
    });
    expect(matched, `IPC ${action}(${payload})`).to.equal(true);
  });
});

export {};
