export const VISUAL_SURFACES = {
  workspace: 'rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_50px_-40px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900',
  section: 'rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-900',
  quietSection: 'rounded-2xl border border-slate-200/80 bg-slate-50/70 shadow-none dark:border-slate-800 dark:bg-slate-900/35',
  interactiveCard: 'rounded-xl border border-slate-200 bg-slate-50 shadow-none transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900',
  alert: 'rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  decision: 'rounded-2xl border border-slate-200/80 bg-slate-950 text-white shadow-[0_26px_60px_-36px_rgba(15,23,42,0.65)] dark:border-slate-700 dark:bg-slate-100 dark:text-slate-950',
  modal: 'rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900',
} as const;

export const VISUAL_MOTION = {
  state: 'transition-colors duration-200',
  action: 'transition-all duration-200 active:scale-[0.98]',
  entrance: 'animate-in fade-in duration-300',
  critical: 'animate-in fade-in slide-in-from-top-2 duration-200',
} as const;
