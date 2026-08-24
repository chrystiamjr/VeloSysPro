import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DebloatPage } from '../../../src/components/pages/DebloatPage';
import type { DebloatPackage } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const packages: DebloatPackage[] = [
  { id: 'weather', group: 'Safe', caveat: 'store', installed: true },
  { id: 'news', group: 'Safe', caveat: 'store', installed: true },
  { id: 'solitaire', group: 'Safe', caveat: 'store', installed: false },
  { id: 'camera', group: 'Optional', caveat: 'store', installed: true },
  { id: 'oneDrive', group: 'Optional', caveat: 'oneDrive', installed: true },
];

const renderPage = (props: Partial<React.ComponentProps<typeof DebloatPage>> = {}) => {
  const merged = {
    packages,
    results: [],
    onRemove: vi.fn(),
    onRefresh: vi.fn(),
    ...props,
  };
  const { container, rerender } = render(
    <LanguageProvider>
      <DebloatPage {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container, rerender };
};

const click = (container: HTMLElement, testId: string) =>
  fireEvent.click(container.querySelector(`[data-cy="${testId}"]`)!);

const box = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-cy="debloat-select-${id}"]`) as HTMLInputElement;

describe('DebloatPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('splits the allow-list into its Safe and Optional groups', () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-cy="debloat-group-safe"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="debloat-group-optional"]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-cy="debloat-group-safe"] [data-cy="debloat-row-weather"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-cy="debloat-group-optional"] [data-cy="debloat-row-camera"]')
    ).toBeInTheDocument();
  });

  it('leaves every box unticked, Optional included', () => {
    // Nothing here is a default. An Optional entry ticked on the user's behalf is how someone
    // uninstalls their camera by clicking the one button on the screen.
    const { container } = renderPage();

    for (const pkg of packages) {
      if (pkg.installed) expect(box(container, pkg.id)).not.toBeChecked();
    }
    expect(container.querySelector('[data-cy="debloat-remove"]')).toBeDisabled();
  });

  it('cannot select an app the machine does not have', () => {
    const { container } = renderPage();

    expect(box(container, 'solitaire')).toBeDisabled();
  });

  it('names every selected app and its reinstall caveat before removing anything', () => {
    const { container, onRemove } = renderPage();

    click(container, 'debloat-select-weather');
    click(container, 'debloat-select-oneDrive');
    click(container, 'debloat-remove');

    const items = container.querySelector('[data-cy="debloat-confirm-items"]')!;
    expect(items).toHaveTextContent('Clima');
    expect(items).toHaveTextContent('OneDrive');
    expect(items).toHaveTextContent(/Microsoft Store/i);
    expect(items).toHaveTextContent(/OneDrive da Microsoft/i);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('submits the exact invariant ids once, on confirm', () => {
    const { container, onRemove } = renderPage();

    click(container, 'debloat-select-weather');
    click(container, 'debloat-select-news');
    click(container, 'debloat-remove');
    click(container, 'debloat-confirm-confirm');

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(['weather', 'news']);
  });

  it('removes nothing when the confirmation is cancelled', () => {
    const { container, onRemove } = renderPage();

    click(container, 'debloat-select-weather');
    click(container, 'debloat-remove');
    click(container, 'debloat-confirm-cancel');

    expect(onRemove).not.toHaveBeenCalled();
    // The selection survives, so backing out is not the same as losing what was ticked.
    expect(box(container, 'weather')).toBeChecked();
  });

  it('drops a selected app the host stopped reporting as installed', () => {
    // The list refreshes underneath the screen; a tick drawn before that must not survive it.
    const { container, rerender, onRemove } = renderPage();

    click(container, 'debloat-select-weather');
    click(container, 'debloat-select-news');

    rerender(
      <LanguageProvider>
        <DebloatPage
          packages={packages.map((pkg) =>
            pkg.id === 'weather' ? { ...pkg, installed: false } : pkg
          )}
          results={[]}
          onRemove={onRemove}
          onRefresh={vi.fn()}
        />
      </LanguageProvider>
    );

    click(container, 'debloat-remove');
    click(container, 'debloat-confirm-confirm');

    expect(onRemove).toHaveBeenCalledWith(['news']);
  });

  it('shows what each app in the last batch really did', () => {
    const { container } = renderPage({
      results: [
        { id: 'weather', ok: true },
        { id: 'news', ok: false },
      ],
    });

    expect(container.querySelector('[data-cy="debloat-result-weather"]')).toHaveTextContent(
      /Removido/i
    );
    expect(container.querySelector('[data-cy="debloat-result-news"]')).toHaveTextContent(
      /Ainda instalado/i
    );
    // An app that was not part of the batch reports nothing at all.
    expect(container.querySelector('[data-cy="debloat-result-camera"]')).toBeNull();
  });

  it('says it is querying the system before the host has answered', () => {
    const { container } = renderPage({ packages: [], loaded: false });

    expect(container.querySelector('[data-cy="debloat-loading"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="debloat-list"]')).toBeNull();
  });

  it('keeps the previous list on screen and says so when a read is refused', () => {
    const { container } = renderPage({ stale: true });

    expect(container.querySelector('[data-cy="debloat-stale"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="debloat-row-weather"]')).toBeInTheDocument();
  });

  it('never describes a removal as reversible', () => {
    const { container } = renderPage();

    const warning = container.querySelector('[data-cy="debloat-warning"]')!;
    expect(warning).toHaveTextContent(/não pode|não consegue|reinstal/i);
    expect(screen.queryByText(/reverter/i)).toBeNull();
    expect(screen.queryByText(/desfazer com um clique/i)).toBeNull();
  });

  it('locks every control while another action is running', () => {
    const { container } = renderPage({ disabled: true });

    expect(box(container, 'weather')).toBeDisabled();
    expect(container.querySelector('[data-cy="debloat-remove"]')).toBeDisabled();
    expect(container.querySelector('[data-cy="debloat-refresh"]')).toBeDisabled();
  });

  it('clears the whole selection on request', () => {
    const { container } = renderPage();

    click(container, 'debloat-select-weather');
    click(container, 'debloat-clear');

    expect(box(container, 'weather')).not.toBeChecked();
    expect(container.querySelector('[data-cy="debloat-remove"]')).toBeDisabled();
  });
});
