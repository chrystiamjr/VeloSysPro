import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';
import { TerminalConsole } from '../../../src/components/organisms/TerminalConsole';

describe('TerminalConsole Organism Component', () => {
  it('shows the latest message while collapsed and delegates expansion', () => {
    const onToggle = vi.fn();
    render(
      <LanguageProvider>
        <TerminalConsole
          logs={[{ text: 'Operação concluída com êxito.', type: 'success' }]}
          expanded={false}
          onToggle={onToggle}
          onClear={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('Operação concluída com êxito.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders accented output unchanged when expanded', () => {
    render(
      <LanguageProvider>
        <TerminalConsole
          logs={[{ text: 'A operação foi concluída com êxito.', type: 'success' }]}
          expanded
          hasError
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getAllByText('A operação foi concluída com êxito.')).toHaveLength(2);
  });
  it('stacks the expanded header controls on narrow screens', () => {
    render(
      <LanguageProvider>
        <TerminalConsole
          logs={[{ text: 'VeloSys Pro iniciado com sucesso.', type: 'success' }]}
          expanded
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByRole('button', { name: /Limpar Console/i }).parentElement).toHaveClass(
      'flex-col',
      'sm:flex-row'
    );
  });
});
