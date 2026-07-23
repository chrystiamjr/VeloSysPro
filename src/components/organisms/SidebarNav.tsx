import React from 'react';
import { AppScreen } from '../../domain/types';
import { Badge } from '../atoms/Badge';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SidebarNavProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onOpenLogs: () => void;
  onOpenRestorePoints: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeScreen,
  onNavigate,
  onOpenLogs,
  onOpenRestorePoints,
}) => {
  const { lang, setLang, t } = useTranslation();

  return (
    <aside className="flex h-screen w-64 select-none flex-col border-r border-borderColor bg-bgSidebar p-6">
      <div className="mb-5 flex items-start justify-between border-b border-borderColor pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">⚡ VeloSys Pro</h1>
          <p className="mt-1 text-[11px] text-textMuted">{t('brandSubtitle')}</p>
        </div>

        {/* Language Switcher */}
        <div className="flex gap-1 rounded-lg border border-borderColor bg-bgMain p-1">
          <button
            onClick={() => setLang('pt_BR')}
            className={`cursor-pointer rounded border-none px-2 py-0.5 text-[10px] font-bold ${
              lang === 'pt_BR' ? 'bg-primary text-white' : 'text-textMuted hover:text-white'
            }`}
          >
            PT
          </button>
          <button
            onClick={() => setLang('en_US')}
            className={`cursor-pointer rounded border-none px-2 py-0.5 text-[10px] font-bold ${
              lang === 'en_US' ? 'bg-primary text-white' : 'text-textMuted hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        <button
          onClick={() => onNavigate(AppScreen.Dashboard)}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-none px-4 py-3 text-xs font-semibold transition-all ${
            activeScreen === AppScreen.Dashboard
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'bg-transparent text-textMuted hover:bg-white/5 hover:text-white'
          }`}
        >
          <span>🚀</span> {t('navDashboard')}
        </button>

        <button
          onClick={() => onNavigate(AppScreen.Scheduling)}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-none px-4 py-3 text-xs font-semibold transition-all ${
            activeScreen === AppScreen.Scheduling
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'bg-transparent text-textMuted hover:bg-white/5 hover:text-white'
          }`}
        >
          <span>📅</span> {t('navScheduling')}
        </button>

        <button
          onClick={() => onNavigate(AppScreen.Backup)}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-none px-4 py-3 text-xs font-semibold transition-all ${
            activeScreen === AppScreen.Backup
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'bg-transparent text-textMuted hover:bg-white/5 hover:text-white'
          }`}
        >
          <span>💾</span> {t('navBackup')}
        </button>

        <button
          onClick={onOpenLogs}
          className="flex cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent px-4 py-3 text-xs font-semibold text-textMuted transition-all hover:bg-white/5 hover:text-white"
        >
          <span>📂</span> {t('navLogsFolder')}
        </button>

        <button
          onClick={onOpenRestorePoints}
          className="flex cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent px-4 py-3 text-xs font-semibold text-textMuted transition-all hover:bg-white/5 hover:text-white"
        >
          <span>🛡️</span> {t('navRestorePoints')}
        </button>
      </nav>

      <div className="border-t border-borderColor pt-4">
        <Badge text={t('adminBadge')} variant="success" />
        <p className="mt-3 text-[11px] text-textMuted">{t('version')}</p>
      </div>
    </aside>
  );
};
