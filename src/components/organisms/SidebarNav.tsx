import React from 'react';
import { AppScreen } from '../../domain/types';
import { Badge } from '../atoms/Badge';
import { Icon, IconName } from '../atoms/Icon';
import { useTranslation } from '../../infrastructure/i18nContext';

export interface SidebarNavProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onOpenLogs: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  screen: AppScreen;
  icon: IconName;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { screen: AppScreen.Dashboard, icon: 'rocket', labelKey: 'nav.dashboard' },
  { screen: AppScreen.Scheduling, icon: 'calendar', labelKey: 'nav.scheduling' },
  { screen: AppScreen.Backup, icon: 'hard-drive', labelKey: 'nav.backup' },
  { screen: AppScreen.RestorePoints, icon: 'shield-check', labelKey: 'nav.restorePoints' },
  { screen: AppScreen.Settings, icon: 'settings', labelKey: 'nav.settings' },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeScreen,
  onNavigate,
  onOpenLogs,
  collapsed,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();

  const itemClass = (active: boolean) =>
    `flex cursor-pointer items-center gap-3 rounded-lg border-none px-4 py-3 text-xs font-semibold transition-all ${
      collapsed ? 'justify-center px-0' : ''
    } ${
      active
        ? 'bg-primary text-white shadow-lg shadow-primary/30'
        : 'bg-transparent text-textMuted hover:bg-white/5 hover:text-white'
    }`;

  return (
    <aside
      className={`flex h-screen select-none flex-col border-r border-borderColor bg-bgSidebar p-4 transition-all duration-200 ${
        collapsed ? 'w-20' : 'w-64 p-6'
      }`}
    >
      <div
        className={`mb-5 flex items-start border-b border-borderColor pb-5 ${
          collapsed ? 'flex-col items-center gap-3' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-white">
              <Icon name="zap" className="h-6 w-6 text-primary" /> VeloSys Pro
            </h1>
            <p className="mt-1 text-[11px] text-textMuted">{t('brand.subtitle')}</p>
          </div>
        )}
        {collapsed && <Icon name="zap" className="h-6 w-6 text-primary" />}

        <button
          onClick={onToggleCollapse}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-textMuted transition-all hover:bg-white/5 hover:text-white"
        >
          <Icon name={collapsed ? 'chevrons-right' : 'chevrons-left'} className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.screen}
            onClick={() => onNavigate(item.screen)}
            title={collapsed ? t(item.labelKey) : undefined}
            aria-label={t(item.labelKey)}
            className={itemClass(activeScreen === item.screen)}
          >
            <Icon name={item.icon} />
            {!collapsed && t(item.labelKey)}
          </button>
        ))}

        <button
          onClick={onOpenLogs}
          title={collapsed ? t('nav.logsFolder') : undefined}
          aria-label={t('nav.logsFolder')}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent px-4 py-3 text-xs font-semibold text-textMuted transition-all hover:bg-white/5 hover:text-white ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Icon name="folder-open" />
          {!collapsed && t('nav.logsFolder')}
        </button>
      </nav>

      {!collapsed && (
        <div className="border-t border-borderColor pt-4">
          <Badge text={t('brand.adminBadge')} variant="success" />
          <p className="mt-3 text-[11px] text-textMuted">{t('brand.version')}</p>
        </div>
      )}
    </aside>
  );
};
