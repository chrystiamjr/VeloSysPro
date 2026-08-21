import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DebloatRow } from '../../../src/components/molecules/DebloatRow';
import type { DebloatPackage } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const weather: DebloatPackage = {
  id: 'weather',
  group: 'Safe',
  caveat: 'store',
  installed: true,
};

const renderRow = (props: Partial<React.ComponentProps<typeof DebloatRow>> = {}) => {
  const merged = { pkg: weather, selected: false, onToggle: vi.fn(), ...props };
  const { container } = render(
    <LanguageProvider>
      <DebloatRow {...merged} />
    </LanguageProvider>
  );
  return { ...merged, container };
};

describe('DebloatRow', () => {
  it('renders the translated name and description from the id alone', () => {
    const { container } = renderRow();

    expect(container).toHaveTextContent('Clima');
    expect(container).not.toHaveTextContent('debloat.package');
  });

  it('states how the app comes back, from the invariant caveat token', () => {
    const store = renderRow();
    expect(store.container.querySelector('[data-cy="debloat-caveat-weather"]')).toHaveTextContent(
      /Microsoft Store/i
    );

    const oneDrive = renderRow({
      pkg: { id: 'oneDrive', group: 'Optional', caveat: 'oneDrive', installed: true },
    });
    expect(
      oneDrive.container.querySelector('[data-cy="debloat-caveat-oneDrive"]')
    ).toHaveTextContent(/baixando o OneDrive/i);
  });

  it('reports the state the host detected', () => {
    const present = renderRow();
    expect(present.container.querySelector('[data-cy="debloat-state-weather"]')).toHaveTextContent(
      /Instalado/i
    );

    const absent = renderRow({ pkg: { ...weather, installed: false } });
    expect(absent.container.querySelector('[data-cy="debloat-state-weather"]')).toHaveTextContent(
      /Não instalado/i
    );
  });

  it('cannot be ticked when the machine does not have the app', () => {
    // Only the attribute is asserted: jsdom happily forwards a synthetic click through the
    // wrapping label to a disabled input, which a real browser does not. What keeps an absent
    // app out of a batch for real is DebloatPage's filter, tested there.
    const { container } = renderRow({ pkg: { ...weather, installed: false } });

    expect(container.querySelector('[data-cy="debloat-select-weather"]')).toBeDisabled();
  });

  it('reports the app once, and only once a batch has touched it', () => {
    const untouched = renderRow();
    expect(untouched.container.querySelector('[data-cy="debloat-result-weather"]')).toBeNull();

    const failed = renderRow({ result: { id: 'weather', ok: false } });
    expect(failed.container.querySelector('[data-cy="debloat-result-weather"]')).toHaveTextContent(
      /Ainda instalado/i
    );
  });

  it('passes the invariant id up when toggled', () => {
    const { container, onToggle } = renderRow();

    fireEvent.click(container.querySelector('[data-cy="debloat-select-weather"]')!);

    expect(onToggle).toHaveBeenCalledWith('weather');
  });
});
