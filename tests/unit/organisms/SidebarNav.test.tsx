import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SidebarNav } from '../../../src/components/organisms/SidebarNav';
import { AppScreen } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

const renderNav = (props: Partial<React.ComponentProps<typeof SidebarNav>> = {}) => {
  const merged = {
    activeScreen: AppScreen.Dashboard,
    onNavigate: vi.fn(),
    onOpenLogs: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
    ...props,
  };
  render(
    <LanguageProvider>
      <SidebarNav {...merged} />
    </LanguageProvider>
  );
  return merged;
};

describe('SidebarNav', () => {
  it('shows nav labels when expanded and no language switcher', () => {
    renderNav({ collapsed: false });
    expect(screen.getByText('Painel Inicial')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    // Language is now consolidated in Settings — the sidebar has no PT/EN switch.
    expect(screen.queryByText('PT')).not.toBeInTheDocument();
    expect(screen.queryByText('EN')).not.toBeInTheDocument();
  });

  it('hides labels when collapsed (icons only)', () => {
    renderNav({ collapsed: true });
    expect(screen.queryByText('Painel Inicial')).not.toBeInTheDocument();
    expect(screen.queryByText('VeloSys Pro')).not.toBeInTheDocument();
  });

  it('fires onToggleCollapse when the toggle button is clicked', () => {
    const props = renderNav({ collapsed: false });
    fireEvent.click(screen.getByRole('button', { name: /Recolher menu/i }));
    expect(props.onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('navigates when a nav item is clicked', () => {
    const props = renderNav();
    fireEvent.click(screen.getByText('Backup & Restauração'));
    expect(props.onNavigate).toHaveBeenCalledWith(AppScreen.Backup);
  });
});
