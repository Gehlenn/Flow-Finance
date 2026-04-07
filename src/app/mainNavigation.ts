import type { Tab } from '../../hooks/useNavigationTabs';

export interface MainNavigationItem {
  tab: Tab;
  label: string;
  requiresDevMode?: boolean;
}

const MAIN_NAV_ITEMS: MainNavigationItem[] = [
  { tab: 'dashboard', label: 'Inicio' },
  { tab: 'history', label: 'Transacoes' },
  { tab: 'flow', label: 'Fluxo' },
  { tab: 'cfo', label: 'Consultor IA' },
  { tab: 'settings', label: 'Ajustes' },
  { tab: 'aicontrol', label: 'AI Lab', requiresDevMode: true },
];

export function getMainNavigationItems(isDevMode: boolean): MainNavigationItem[] {
  return MAIN_NAV_ITEMS.filter((item) => !item.requiresDevMode || isDevMode);
}
