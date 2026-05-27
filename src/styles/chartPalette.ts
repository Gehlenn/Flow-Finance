export const FLOW_CHART_COLORS = {
  income: 'var(--flow-chart-income)',
  expenses: 'var(--flow-chart-expenses)',
  balance: 'var(--flow-chart-balance)',
  categories: [
    'var(--flow-chart-balance)',
    'var(--flow-chart-violet)',
    'var(--flow-chart-pink)',
    'var(--flow-chart-amber)',
    'var(--flow-chart-income)',
    'var(--flow-chart-cyan)',
    'var(--flow-chart-lime)',
    'var(--flow-chart-orange)',
    'var(--flow-chart-sky)',
    'var(--flow-chart-slate)',
  ],
} as const;

export const FLOW_CHART_UI = {
  grid: 'var(--flow-chart-grid)',
  axis: 'var(--flow-chart-axis)',
  tooltipBackground: 'var(--flow-chart-tooltip-bg)',
  tooltipBorder: 'var(--flow-chart-tooltip-border)',
  tooltipText: 'var(--flow-chart-tooltip-text)',
  tooltipShadow: 'var(--flow-chart-tooltip-shadow)',
} as const;
