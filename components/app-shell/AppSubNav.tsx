import React from "react";
import type { NavigationSection } from "../../src/app/mainNavigation";
import type { Tab } from "../../hooks/navigationTypes";

export interface AppSubNavProps {
  label: string;
  items: NavigationSection["items"];
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
}

export const AppSubNav: React.FC<AppSubNavProps> = ({
  label,
  items,
  activeTab,
  onSelectTab,
}) => {
  if (items.length <= 1) {
    return null;
  }

  const mobileGridClass = items.length === 2 || items.length === 4
    ? "grid-cols-2"
    : "grid-cols-3";

  return (
    <div className="mb-3">
      <div
        role="tablist"
        aria-label={`${label} subsecoes`}
        className={`grid ${mobileGridClass} gap-2 rounded-xl border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-slate-900/80 md:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] md:gap-2 md:p-2`}
      >
        {items.map((item) => {
          const active = activeTab === item.tab;

          return (
            <button
              key={item.tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectTab(item.tab)}
              className={`min-h-11 min-w-0 rounded-lg px-2.5 py-2 text-center text-[11px] font-medium leading-tight transition-colors sm:text-xs md:w-full md:px-3 md:py-2.5 md:text-sm ${
                active
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
