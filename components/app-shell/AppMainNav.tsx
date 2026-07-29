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

interface AppMainNavProps {
  items: MainNavigationItem[];
  activeSectionTab: Tab;
  onSelectTab: (tab: Tab) => void;
}

const NAV_BUTTON_CLASS_MAP = {
  buttonBase:
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors duration-200 md:min-h-12 md:min-w-[7rem] md:flex-none md:flex-row md:gap-2 md:px-3 md:py-2.5 xl:min-w-0 xl:flex-col xl:gap-1 xl:px-2 xl:py-2",
  active:
    "bg-slate-100 text-slate-950 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-700/70",
  inactive:
    "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/80 dark:hover:text-slate-200",
  iconActive:
    "flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm md:h-8 md:w-8 md:rounded-xl dark:bg-slate-100 dark:text-slate-900",
  iconInactive:
    "flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-slate-500 md:h-8 md:w-8 md:rounded-xl dark:text-slate-300",
  label:
    "hidden max-w-[4.25rem] text-center text-[10px] font-medium uppercase leading-tight tracking-[0.03em] md:block md:max-w-none md:text-xs md:tracking-[0.06em] xl:text-[10px] xl:tracking-[0.04em]",
};

function renderTabIcon(tab: string): React.ReactNode {
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

const NavButton: React.FC<{
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
    className="flow-nav mb-3 grid grid-cols-4 items-stretch gap-1.5 rounded-2xl border border-slate-200/70 bg-white/90 px-2 py-2 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 md:justify-center md:gap-2 md:px-2.5 md:py-2 xl:fixed xl:bottom-auto xl:left-5 xl:right-auto xl:top-1/2 xl:z-[60] xl:mb-0 xl:w-[5.5rem] xl:-translate-y-1/2 xl:grid-cols-1 xl:gap-2 xl:px-2 xl:py-2.5"
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
