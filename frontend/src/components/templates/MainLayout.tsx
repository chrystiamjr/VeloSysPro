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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const narrow = window.innerWidth < NARROW_BREAKPOINT;
      setIsNarrow(narrow);
      if (!narrow) setMobileSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const effectiveCollapsed = isNarrow ? !mobileSidebarOpen : sidebarCollapsed;
  const handleToggleSidebar = () => {
    if (isNarrow) {
      setMobileSidebarOpen((open) => !open);
    } else {
      onToggleSidebar();
    }
  };
  const handleNavigate = (screen: AppScreen) => {
    if (isNarrow) setMobileSidebarOpen(false);
    onNavigate(screen);
  };

  return (
    <div className="flex h-screen select-none overflow-hidden bg-bgMain text-textMain">
      <SidebarNav
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        onOpenLogs={onOpenLogs}
        collapsed={effectiveCollapsed}
        onToggleCollapse={handleToggleSidebar}
        overlay={isNarrow && mobileSidebarOpen}
      />

      <main
        data-cy="app-main"
        className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8"
      >
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
