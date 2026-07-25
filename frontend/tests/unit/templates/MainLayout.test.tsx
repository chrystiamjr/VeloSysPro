import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainLayout } from '../../../src/components/templates/MainLayout';
import { AppScreen } from '../../../src/domain/types';
import { LanguageProvider } from '../../../src/infrastructure/i18nContext';

describe('MainLayout (Atomic Design template layer)', () => {
  it('renders the title, subtitle, progress and injected children', () => {
    render(
      <LanguageProvider>
        <MainLayout
          activeScreen={AppScreen.Backup}
          onNavigate={vi.fn()}
          onOpenLogs={vi.fn()}
          sidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
          title="Título da Tela de Teste"
          subtitle="Subtítulo descritivo da tela"
          statusMessage="Status: Pronto"
          progressPercent={42}
        >
          <div>Conteúdo da Página</div>
        </MainLayout>
      </LanguageProvider>
    );

    expect(screen.getByText('Título da Tela de Teste')).toBeInTheDocument();
    expect(screen.getByText('Subtítulo descritivo da tela')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo da Página')).toBeInTheDocument();
  });

  it('can expand the navigation as a full-screen overlay on narrow windows', () => {
    window.innerWidth = 500;
    window.dispatchEvent(new Event('resize'));

    render(
      <LanguageProvider>
        <MainLayout
          activeScreen={AppScreen.Backup}
          onNavigate={vi.fn()}
          onOpenLogs={vi.fn()}
          sidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
          title="Backup"
          subtitle="Subtitle"
          statusMessage="Ready"
          progressPercent={0}
        >
          <div>Content</div>
        </MainLayout>
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Expandir menu/i }));

    expect(screen.getByText('Painel Inicial')).toBeVisible();
    expect(screen.getByRole('complementary')).toHaveClass('fixed', 'inset-0', 'w-full');
  });
});
