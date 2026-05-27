import type { Tab } from '../../hooks/navigationTypes';

export interface MainNavigationItem {
  tab: Tab;
  label: string;
  requiresDevMode?: boolean;
}

const MAIN_NAV_ITEMS: MainNavigationItem[] = [
  { tab: 'dashboard', label: 'Caixa' },
  { tab: 'history', label: 'Transações' },
  { tab: 'flow', label: 'Receitas' },
  { tab: 'cfo', label: 'Consultor IA' },
  { tab: 'aicontrol', label: 'Lab IA', requiresDevMode: true },
];

export function getMainNavigationItems(isDevMode: boolean): MainNavigationItem[] {
  return MAIN_NAV_ITEMS.filter((item) => !item.requiresDevMode || isDevMode);
}
