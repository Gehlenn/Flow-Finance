import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, Filter, Loader2, Search, ShieldCheck } from 'lucide-react';
import {
  ensureActiveWorkspace,
  type AuditLogCursor,
  getCurrentWorkspaceIdentity,
  listWorkspaceAuditEventsPage,
  type AuditLogDocument,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../src/services/workspaceSession';
import { logWarn } from '../src/utils/logger';
import { canViewWorkspaceAudit } from '../src/security/workspacePermissions';
import type { Tab } from '../hooks/useNavigationTabs';

interface WorkspaceAuditPageProps {
  userId: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceRole?: WorkspaceRole | null;
  onNavigateToTab: (tab: Tab) => void;
}

const RESOURCE_OPTIONS = [
  { value: 'all', label: 'Todos os recursos' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'workspace_member', label: 'Membros' },
  { value: 'billing_hook', label: 'Gatilhos de faturamento' },
  { value: 'accounts', label: 'Contas' },
  { value: 'transactions', label: 'Transações' },
  { value: 'goals', label: 'Metas' },
];

const RANGE_OPTIONS = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o período' },
] as const;

type RangeValue = typeof RANGE_OPTIONS[number]['value'];
const PAGE_SIZE = 20;

function buildAuditErrorDiagnostic(message: string): { title: string; message: string; suggestion: string } {
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('carregar')) {
    return {
      title: 'Falha ao carregar a auditoria',
      message: 'A lista de eventos nao ficou disponivel agora.',
      suggestion: 'Verifique a sessao, o backend e tente novamente.',
    };
  }

  return {
    title: 'Nao foi possivel abrir a auditoria',
    message: 'O workspace nao retornou os eventos esperados.',
    suggestion: 'Atualize a tela ou confirme se voce tem acesso de owner ou admin.',
  };
}

function resolveDateRange(range: RangeValue): { fromDate?: string; toDate?: string } {
  if (range === 'all') {
    return {};
  }

  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const fromDate = new Date(now);
  fromDate.setUTCDate(now.getUTCDate() - days);

  return {
    fromDate: fromDate.toISOString(),
    toDate: now.toISOString(),
  };
}

const WorkspaceAuditPage: React.FC<WorkspaceAuditPageProps> = ({
  userId,
  activeWorkspaceId,
  activeWorkspaceName,
  activeTenantName,
  activeWorkspaceRole,
  onNavigateToTab,
}) => {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [events, setEvents] = useState<AuditLogDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDiagnostic, setErrorDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [range, setRange] = useState<RangeValue>('30d');
  const [resourceType, setResourceType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [nextCursor, setNextCursor] = useState<AuditLogCursor | null>(null);

  const canAccessAudit = canViewWorkspaceAudit(activeWorkspaceRole || workspace?.role);

  useEffect(() => {
    const load = async () => {
      if (!userId || !activeWorkspaceId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setErrorDiagnostic(null);
      try {
        const identity = getCurrentWorkspaceIdentity();
        const resolvedWorkspace = await ensureActiveWorkspace(identity);
        setWorkspace(resolvedWorkspace);

        const dateRange = resolveDateRange(range);
        const page = await listWorkspaceAuditEventsPage({
          tenantId: resolvedWorkspace.tenantId,
          workspaceId: resolvedWorkspace.workspaceId,
          maxItems: PAGE_SIZE,
          resourceType: resourceType === 'all' ? undefined : resourceType,
          ...dateRange,
        });
        setEvents(page.events);
        setNextCursor(page.nextCursor);
      } catch (loadError) {
        logWarn('[WorkspaceAudit] Failed to load audit events', {
          error: loadError,
          workspaceId: activeWorkspaceId,
          fallback: 'workspace-audit-load-failed',
        });
        const message = 'Nao foi possivel carregar os eventos de auditoria deste workspace.';
        setError(message);
        setErrorDiagnostic(buildAuditErrorDiagnostic(message));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeWorkspaceId, range, resourceType, userId]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return events;
    }

    return events.filter((event) => {
      const haystack = [event.action, event.resourceType, event.resourceId, JSON.stringify(event.metadata || {})]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [events, searchTerm]);

  const canLoadMore = Boolean(nextCursor) && searchTerm.trim().length === 0;

  const handleLoadMore = async () => {
    if (!workspace || !nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);
    setErrorDiagnostic(null);
    try {
      const page = await listWorkspaceAuditEventsPage({
        tenantId: workspace.tenantId,
        workspaceId: workspace.workspaceId,
        maxItems: PAGE_SIZE,
        resourceType: resourceType === 'all' ? undefined : resourceType,
        after: nextCursor,
        ...resolveDateRange(range),
      });

      setEvents((current) => [...current, ...page.events]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      logWarn('[WorkspaceAudit] Failed to load more audit events', {
        error: loadError,
        workspaceId: workspace.workspaceId,
        fallback: 'workspace-audit-load-more-failed',
      });
      const message = 'Nao foi possivel carregar mais eventos de auditoria.';
      setError(message);
      setErrorDiagnostic(buildAuditErrorDiagnostic(message));
    } finally {
      setLoadingMore(false);
    }
  };

  if (!canAccessAudit && !loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-[2rem] text-white shadow-lg shadow-slate-900/20">
          <h2 className="text-2xl font-black tracking-tight">Auditoria do workspace</h2>
          <p className="text-xs font-black uppercase tracking-widest text-white/70 mt-2">Owner ou admin necessários</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-100">Sua função atual não pode ver a trilha de auditoria.</p>
          <button
            onClick={() => onNavigateToTab('workspaceadmin')}
            className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-100"
          >
            Voltar para operação do workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 p-6 rounded-[2rem] flex items-center justify-between shadow-lg shadow-blue-900/10">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Auditoria do workspace</h2>
          <p className="text-xs font-black uppercase tracking-widest text-white/70 mt-2">{activeTenantName || workspace?.tenantName || 'Tenant'} · {activeWorkspaceName || workspace?.name || 'Workspace'}</p>
        </div>
        <button
          onClick={() => onNavigateToTab('workspaceadmin')}
          className="px-4 py-3 rounded-2xl bg-white/10 text-white text-xs font-black uppercase tracking-widest border border-white/20 flex items-center gap-2"
        >
          <ChevronLeft size={14} /> Voltar
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><CalendarRange size={14} /> Período</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as RangeValue)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-100"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Filter size={14} /> Recurso</span>
            <select
              value={resourceType}
              onChange={(event) => setResourceType(event.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-100"
            >
              {RESOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Search size={14} /> Buscar</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ação, id ou metadados"
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-100"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm font-bold">Carregando eventos de auditoria...</span>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-rose-500">{error}</p>
            {errorDiagnostic && (
              <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">{errorDiagnostic.title}</p>
                <p className="mt-1 text-[11px] font-bold text-rose-700 dark:text-rose-100">{errorDiagnostic.message}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-300">Próximo passo: {errorDiagnostic.suggestion}</p>
              </div>
            )}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-500 dark:text-slate-300">
            Nenhum evento de auditoria corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Mostrando {filteredEvents.length} evento(s) carregado(s)
              </p>
              {canLoadMore && (
                <button
                  onClick={() => void handleLoadMore()}
                  className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-xs font-black uppercase tracking-widest"
                >
                  {loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
            </div>
            {filteredEvents.map((event) => (
              <div key={event.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-white">{event.action}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{event.resourceType} · {event.resourceId}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-300 flex items-center gap-2">
                    <ShieldCheck size={12} /> {new Date(event.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300">Autor: {event.userId}</p>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 text-[11px] overflow-x-auto">{JSON.stringify(event.metadata, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceAuditPage;

