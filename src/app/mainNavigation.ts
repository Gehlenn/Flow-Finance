import type { Tab } from '../../hooks/navigationTypes';

export interface MainNavigationItem {
  tab: Tab;
  label: string;
  requiresDevMode?: boolean;
  requiresWorkspaceAdmin?: boolean;
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
      { tab: 'workspaceadmin', label: 'Workspace', requiresWorkspaceAdmin: true },
      { tab: 'workspaceaudit', label: 'Auditoria', requiresWorkspaceAdmin: true },
      { tab: 'aicontrol', label: 'Lab IA', requiresDevMode: true },
      { tab: 'performance', label: 'Performance', requiresDevMode: true },
    ],
  },
];

export interface NavigationAccessOptions {
  canAccessDevTools: boolean;
  canAccessWorkspaceAdmin?: boolean;
}

function normalizeNavigationAccess(access: boolean | NavigationAccessOptions): NavigationAccessOptions {
  if (typeof access === 'boolean') {
    return {
      canAccessDevTools: access,
      canAccessWorkspaceAdmin: false,
    };
  }

  return {
    canAccessDevTools: access.canAccessDevTools,
    canAccessWorkspaceAdmin: Boolean(access.canAccessWorkspaceAdmin),
  };
}

export function getNavigationSections(access: boolean | NavigationAccessOptions): NavigationSection[] {
  const options = normalizeNavigationAccess(access);

  return NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.requiresDevMode && !options.canAccessDevTools) {
        return false;
      }
      if (item.requiresWorkspaceAdmin && !options.canAccessWorkspaceAdmin) {
        return false;
      }
      return true;
    }),
  }));
}

export function getMainNavigationItems(access: boolean | NavigationAccessOptions): MainNavigationItem[] {
  return getNavigationSections(access).map((section) => ({
    tab: section.defaultTab,
    label: section.label,
  }));
}

export function getActiveNavigationSection(tab: Tab, access: boolean | NavigationAccessOptions): NavigationSection {
  const sections = getNavigationSections(access);
  return sections.find((section) => section.items.some((item) => item.tab === tab)) || sections[0];
}
