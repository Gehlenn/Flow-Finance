import React from "react";
import { BadgeInfo, CloudCheck, CloudOff, Loader2 } from "lucide-react";
import type { AppShellSyncStatus } from "../../src/app/appShellLayout";

export interface AppTopStatusProps {
  showTopStatus: boolean;
  isDemoBootstrapActive: boolean;
  syncStatus: AppShellSyncStatus;
}

function getTopStatusClassName(syncStatus: AppShellSyncStatus): string {
  return `flow-status-pill inline-flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-full px-2.5 py-1.5 md:gap-2 md:px-3 md:py-1.5 ${
    syncStatus === "synced"
      ? "bg-emerald-500/90"
      : syncStatus === "error"
        ? "bg-rose-500/95"
        : "bg-slate-900/95"
  } ${
    syncStatus === "syncing"
      ? "animate-in slide-in-from-top-4"
      : "animate-in zoom-in-95"
  }`;
}

export const AppTopStatus: React.FC<AppTopStatusProps> = ({
  showTopStatus,
  isDemoBootstrapActive,
  syncStatus,
}) => {
  if (!showTopStatus) {
    return null;
  }

  return (
    <div className="absolute top-2 left-1/2 z-[100] -translate-x-1/2 px-2 transition-all duration-500 md:fixed md:top-5">
      <div className={getTopStatusClassName(syncStatus)}>
        {isDemoBootstrapActive && (
          <>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-1.5 py-0.5">
              <BadgeInfo size={10} className="text-cyan-300" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-cyan-50 leading-none md:text-[10px]">
                Demo Pro
              </span>
            </span>
            {(syncStatus === "syncing" ||
              syncStatus === "synced" ||
              syncStatus === "error") && (
              <span
                aria-hidden="true"
                className="h-3.5 w-px rounded-full bg-white/15"
              />
            )}
          </>
        )}
        {syncStatus === "syncing" && (
          <div className="flex items-center gap-1.5">
            <Loader2 size={12} className="text-indigo-400 animate-spin" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white md:text-xs">
              Gravando na Nuvem...
            </span>
          </div>
        )}
        {syncStatus === "synced" && (
          <div className="flex items-center gap-1.5">
            <CloudCheck size={12} className="text-white" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white md:text-xs">
              Sincronizado
            </span>
          </div>
        )}
        {syncStatus === "error" && (
          <div className="flex items-center gap-1.5">
            <CloudOff size={12} className="text-white" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white md:text-xs">
              Erro de Conexao
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
