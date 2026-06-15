import React from "react";
import {
  Activity,
  LayoutDashboard,
  History,
  MessageSquare,
  Settings as SettingsIcon,
  Terminal,
  TrendingUp,
} from "lucide-react";
import type { MainNavigationItem } from "../../src/app/mainNavigation";
import type { Tab } from "../../hooks/navigationTypes";

export interface AppMainNavProps {
  items: MainNavigationItem[];
  activeSectionTab: Tab;
  onSelectTab: (tab: Tab) => void;
}

const NAV_BUTTON_CLASS_MAP = {
  buttonBase:
    "flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-lg px-1 py-1 transition-colors duration-200 md:min-h-12 md:min-w-[7rem] md:flex-none md:flex-row md:gap-2 md:rounded-xl md:px-3 md:py-2 xl:min-w-0 xl:flex-col xl:gap-1 xl:px-1 xl:py-2",
  active:
    "bg-slate-100 text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white",
  inactive:
    "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200",
  iconActive:
    "flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm md:h-8 md:w-8 md:rounded-xl dark:bg-slate-100 dark:text-slate-900",
  iconInactive:
    "flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 md:h-8 md:w-8 md:rounded-xl dark:bg-slate-800 dark:text-slate-300",
  label:
    "hidden max-w-[4.25rem] text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.02em] md:block md:max-w-none md:text-xs md:leading-tight md:tracking-[0.08em] xl:text-[10px] xl:tracking-[0.04em]",
};

export function renderTabIcon(tab: string): React.ReactNode {
  switch (tab) {
    case "dashboard":
      return <LayoutDashboard size={18} />;
    case "history":
      return <History size={18} />;
    case "flow":
      return <TrendingUp size={18} />;
    case "cfo":
      return <MessageSquare size={18} />;
    case "insights":
      return <Activity size={18} />;
    case "settings":
      return <SettingsIcon size={18} />;
    case "aicontrol":
      return <Terminal size={18} />;
    default:
      return <LayoutDashboard size={18} />;
  }
}

export const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`${NAV_BUTTON_CLASS_MAP.buttonBase} ${
      active ? NAV_BUTTON_CLASS_MAP.active : NAV_BUTTON_CLASS_MAP.inactive
    }`}
  >
    <div
      className={
        active ? NAV_BUTTON_CLASS_MAP.iconActive : NAV_BUTTON_CLASS_MAP.iconInactive
      }
    >
      {icon}
    </div>
    <span className={NAV_BUTTON_CLASS_MAP.label}>{label}</span>
  </button>
);

export const AppMainNav: React.FC<AppMainNavProps> = ({
  items,
  activeSectionTab,
  onSelectTab,
}) => (
  <nav
    aria-label="Navegacao principal"
    className="flow-nav fixed bottom-[calc(0.35rem+env(safe-area-inset-bottom))] left-3 right-3 z-[60] grid grid-cols-4 items-stretch gap-1 rounded-xl border border-slate-200/80 bg-white/95 px-1 py-1 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.36)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:left-1/2 md:right-auto md:bottom-5 md:w-[min(92vw,44rem)] md:-translate-x-1/2 md:justify-center md:gap-1.5 md:rounded-2xl md:px-2 md:py-1.5 md:shadow-[0_16px_40px_-26px_rgba(15,23,42,0.35)] xl:bottom-auto xl:left-5 xl:right-auto xl:top-1/2 xl:w-[5.25rem] xl:-translate-x-0 xl:-translate-y-1/2 xl:grid-cols-1 xl:gap-1.5 xl:px-1.5 xl:py-2"
  >
    {items.map((item) => (
      <NavButton
        key={item.tab}
        active={activeSectionTab === item.tab}
        onClick={() => onSelectTab(item.tab)}
        icon={renderTabIcon(item.tab)}
        label={item.label}
      />
    ))}
  </nav>
);
