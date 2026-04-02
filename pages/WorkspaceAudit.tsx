import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, Filter, Loader2, Search, ShieldCheck } from 'lucide-react';
import {
  ensureActiveWorkspace,
  getCurrentWorkspaceIdentity,
  listWorkspaceAuditEvents,
  type AuditLogDocument,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../src/services/workspaceSession';
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
  { value: 'all', label: 'All resources' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'workspace_member', label: 'Members' },
  { value: 'billing_hook', label: 'Billing hooks' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'goals', label: 'Goals' },
];

const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
] as const;

type RangeValue = typeof RANGE_OPTIONS[number]['value'];
const PAGE_SIZE = 20;

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
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeValue>('30d');
  const [resourceType, setResourceType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const canAccessAudit = canViewWorkspaceAudit(activeWorkspaceRole || workspace?.role);

  useEffect(() => {
    const load = async () => {
      if (!userId || !activeWorkspaceId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const identity = getCurrentWorkspaceIdentity();
        const resolvedWorkspace = await ensureActiveWorkspace(identity);
        setWorkspace(resolvedWorkspace);

        const dateRange = resolveDateRange(range);
        const auditEvents = await listWorkspaceAuditEvents({
          tenantId: resolvedWorkspace.tenantId,
          workspaceId: resolvedWorkspace.workspaceId,
          maxItems: 100,
          resourceType: resourceType === 'all' ? undefined : resourceType,
          ...dateRange,
        });
        setEvents(auditEvents);
        setVisibleCount(PAGE_SIZE);
      } catch (loadError) {
        console.error(loadError);
        setError('Could not load audit events for this workspace.');
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

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount],
  );

  const canLoadMore = visibleCount < filteredEvents.length;

  if (!canAccessAudit && !loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-6 rounded-[2rem] text-white shadow-lg shadow-slate-900/20">
          <h2 className="text-2xl font-black tracking-tight">Workspace Audit</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mt-2">Admin or owner required</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-100">Your current workspace role cannot view the audit trail.</p>
          <button
            onClick={() => onNavigateToTab('workspaceadmin')}
            className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100"
          >
            Back to workspace admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] p-6 rounded-[2rem] flex items-center justify-between shadow-lg shadow-blue-900/10">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Workspace Audit</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mt-2">{activeTenantName || workspace?.tenantName || 'Tenant'} · {activeWorkspaceName || workspace?.name || 'Workspace'}</p>
        </div>
        <button
          onClick={() => onNavigateToTab('workspaceadmin')}
          className="px-4 py-3 rounded-2xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest border border-white/20 flex items-center gap-2"
        >
          <ChevronLeft size={14} /> Admin
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><CalendarRange size={14} /> Range</span>
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
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Filter size={14} /> Resource</span>
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
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Search size={14} /> Search</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="action, id or metadata"
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-100"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm font-bold">Loading audit events...</span>
          </div>
        ) : error ? (
          <p className="text-sm font-bold text-rose-500">{error}</p>
        ) : filteredEvents.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-500 dark:text-slate-300">
            No audit events matched the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Showing {visibleEvents.length} of {filteredEvents.length} event(s)
              </p>
              {canLoadMore && (
                <button
                  onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                  className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase tracking-widest"
                >
                  Load more
                </button>
              )}
            </div>
            {visibleEvents.map((event) => (
              <div key={event.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-white">{event.action}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{event.resourceType} · {event.resourceId}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300 flex items-center gap-2">
                    <ShieldCheck size={12} /> {new Date(event.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300">Actor: {event.userId}</p>
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
