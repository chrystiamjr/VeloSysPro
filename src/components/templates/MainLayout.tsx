import React, { useState, useEffect } from 'react';
import { SidebarNav } from '../organisms/SidebarNav';
import { AppScreen } from '../../domain/types';

export interface MainLayoutProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onOpenLogs: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  title: string;
  subtitle: string;
  statusMessage: string;
  progressPercent: number;
  children: React.ReactNode;
}

const NARROW_BREAKPOINT = 1024;

/**
 * Application shell (Atomic Design "template" layer): sidebar navigation plus a
 * header with the active screen's title, subtitle, and global progress bar.
 * The sidebar collapses on narrow windows automatically, and honors the user's
 * saved manual preference (`sidebarCollapsed`) when the window is wide.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  activeScreen,
  onNavigate,
  onOpenLogs,
  sidebarCollapsed,
  onToggleSidebar,
  title,
  subtitle,
  statusMessage,
  progressPercent,
  children,
}) => {
  const [isNarrow, setIsNarrow] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < NARROW_BREAKPOINT : false
  );

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const effectiveCollapsed = sidebarCollapsed || isNarrow;

  return (
    <div className="flex h-screen select-none overflow-hidden bg-bgMain text-textMain">
      <SidebarNav
        activeScreen={activeScreen}
        onNavigate={onNavigate}
        onOpenLogs={onOpenLogs}
        collapsed={effectiveCollapsed}
        onToggleCollapse={onToggleSidebar}
      />

      <main data-cy="app-main" className="flex h-screen flex-1 flex-col overflow-y-auto p-8">
        <header className="mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-xs text-textMuted">{subtitle}</p>

          <div className="mt-4 rounded-xl border border-borderColor bg-bgCard p-4">
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                data-cy="progress-bar"
                className="h-full bg-gradient-to-r from-primary to-success transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-semibold text-textMuted">
              <span data-cy="status-message">{statusMessage}</span>
              <span data-cy="progress-percent">{progressPercent}%</span>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
};
