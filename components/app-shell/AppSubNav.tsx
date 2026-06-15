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

  return (
    <div className="mb-4">
      <div
        role="tablist"
        aria-label={`${label} subsecoes`}
        className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm [scrollbar-width:none] dark:border-slate-800 dark:bg-slate-900/80 md:grid md:gap-2 md:p-2 md:overflow-visible"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(8.5rem, 1fr))" }}
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
              className={`min-w-[10.5rem] shrink-0 rounded-xl px-3 py-2 text-center text-sm font-semibold leading-tight transition-colors md:w-full md:min-w-0 md:py-2.5 ${
                active
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
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
