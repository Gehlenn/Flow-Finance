import type { Tab } from '../../hooks/navigationTypes';

export interface MainNavigationItem {
  tab: Tab;
  label: string;
  requiresDevMode?: boolean;
}

export interface NavigationSection {
  id: 'cash' | 'operation' | 'revenue' | 'ai';
  label: string;
  defaultTab: Tab;
  items: MainNavigationItem[];
}

const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'cash',
    label: 'Caixa',
    defaultTab: 'dashboard',
    items: [
      { tab: 'dashboard', label: 'Visao geral' },
      { tab: 'insights', label: 'Insights' },
      { tab: 'settings', label: 'Ajustes' },
    ],
  },
  {
    id: 'operation',
    label: 'Operacao',
    defaultTab: 'history',
    items: [
      { tab: 'history', label: 'Transacoes' },
      { tab: 'import', label: 'Importar' },
      { tab: 'accounts', label: 'Contas' },
      { tab: 'goals', label: 'Metas' },
    ],
  },
  {
    id: 'revenue',
    label: 'Receitas',
    defaultTab: 'flow',
    items: [
      { tab: 'flow', label: 'Fluxo' },
      { tab: 'analytics', label: 'Analises' },
    ],
  },
  {
    id: 'ai',
    label: 'IA',
    defaultTab: 'cfo',
    items: [
      { tab: 'cfo', label: 'Consultor' },
      { tab: 'assistant', label: 'Tarefas' },
      { tab: 'workspaceadmin', label: 'Workspace' },
      { tab: 'workspaceaudit', label: 'Auditoria' },
      { tab: 'aicontrol', label: 'Lab IA', requiresDevMode: true },
      { tab: 'performance', label: 'Performance', requiresDevMode: true },
    ],
  },
];

export function getNavigationSections(canAccessDevTools: boolean): NavigationSection[] {
  return NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requiresDevMode || canAccessDevTools),
  }));
}

export function getMainNavigationItems(canAccessDevTools: boolean): MainNavigationItem[] {
  return getNavigationSections(canAccessDevTools).map((section) => ({
    tab: section.defaultTab,
    label: section.label,
  }));
}

export function getActiveNavigationSection(tab: Tab, canAccessDevTools: boolean): NavigationSection {
  const sections = getNavigationSections(canAccessDevTools);
  return sections.find((section) => section.items.some((item) => item.tab === tab)) || sections[0];
}
