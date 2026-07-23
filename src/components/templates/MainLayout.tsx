import React from 'react';
import { SidebarNav } from '../organisms/SidebarNav';
import { AppScreen } from '../../domain/types';

export interface MainLayoutProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onOpenLogs: () => void;
  title: string;
  subtitle: string;
  statusMessage: string;
  progressPercent: number;
  children: React.ReactNode;
}

/**
 * Application shell (Atomic Design "template" layer): sidebar navigation plus a
 * header with the active screen's title, subtitle, and global progress bar.
 * Page content is injected via `children`.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  activeScreen,
  onNavigate,
  onOpenLogs,
  title,
  subtitle,
  statusMessage,
  progressPercent,
  children,
}) => {
  return (
    <div className="flex h-screen select-none overflow-hidden bg-bgMain text-textMain">
      <SidebarNav activeScreen={activeScreen} onNavigate={onNavigate} onOpenLogs={onOpenLogs} />

      <main className="flex h-screen flex-1 flex-col overflow-y-auto p-8">
        <header className="mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-xs text-textMuted">{subtitle}</p>

          <div className="mt-4 rounded-xl border border-borderColor bg-bgCard p-4">
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-primary to-success transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-semibold text-textMuted">
              <span>{statusMessage}</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
};
