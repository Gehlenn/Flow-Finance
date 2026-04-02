import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Users, ReceiptText, Sparkles } from 'lucide-react';
import {
  addWorkspaceMember,
  ensureActiveWorkspace,
  getCurrentWorkspaceIdentity,
  listUserWorkspaces,
  listWorkspaceAuditEvents,
  listWorkspaceMembers,
  removeWorkspaceMember,
  setActiveWorkspaceId,
  type AuditLogDocument,
  type WorkspaceMemberDocument,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../src/services/workspaceSession';
import {
  getWorkspaceBillingOverview,
  listWorkspaceBillingHooks,
  updateWorkspacePlan,
  type WorkspaceBillingHookDocument,
} from '../src/services/firestoreBillingStore';
import {
  canManageWorkspaceBilling,
  canManageWorkspaceMembers,
  canViewWorkspaceAudit,
} from '../src/security/workspacePermissions';
import type { Tab } from '../hooks/useNavigationTabs';

interface WorkspaceAdminPageProps {
  userId: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceRole?: WorkspaceRole | null;
  onNavigateToTab: (tab: Tab) => void;
}

const WorkspaceAdminPage: React.FC<WorkspaceAdminPageProps> = ({
  userId,
  activeWorkspaceId,
  activeWorkspaceName,
  activeTenantName,
  activeWorkspaceRole,
  onNavigateToTab,
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberDocument[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditLogDocument[]>([]);
  const [billingHooks, setBillingHooks] = useState<WorkspaceBillingHookDocument[]>([]);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro'>('free');
  const [monthlyUsageSummary, setMonthlyUsageSummary] = useState('0 transactions · 0 AI · 0 bank connections');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('member');

  const canManageMembers = canManageWorkspaceMembers(activeWorkspace?.role || activeWorkspaceRole);
  const canManageBilling = canManageWorkspaceBilling(activeWorkspace?.role || activeWorkspaceRole);
  const canSeeAudit = canViewWorkspaceAudit(activeWorkspace?.role || activeWorkspaceRole);

  const workspaceLabel = useMemo(() => {
    return activeWorkspace?.name || activeWorkspaceName || 'Workspace';
  }, [activeWorkspace?.name, activeWorkspaceName]);

  const tenantLabel = useMemo(() => {
    return activeWorkspace?.tenantName || activeTenantName || 'Tenant';
  }, [activeTenantName, activeWorkspace?.tenantName]);

  const loadWorkspaceData = async (workspace: WorkspaceSummary) => {
    const [billingOverview, members, audit, hooks] = await Promise.all([
      getWorkspaceBillingOverview({ tenantId: workspace.tenantId, workspaceId: workspace.workspaceId }),
      canManageWorkspaceMembers(workspace.role) ? listWorkspaceMembers(workspace.workspaceId) : Promise.resolve([]),
      canViewWorkspaceAudit(workspace.role)
        ? listWorkspaceAuditEvents({ tenantId: workspace.tenantId, workspaceId: workspace.workspaceId, maxItems: 12 })
        : Promise.resolve([]),
      listWorkspaceBillingHooks({ workspaceId: workspace.workspaceId, maxItems: 12 }),
    ]);

    setCurrentPlan(billingOverview.currentPlan);
    setMonthlyUsageSummary(
      `${billingOverview.currentMonthUsage.transactions} transactions · ` +
      `${billingOverview.currentMonthUsage.aiQueries} AI · ` +
      `${billingOverview.currentMonthUsage.bankConnections} bank connections`,
    );
    setWorkspaceMembers(members);
    setAuditEvents(audit);
    setBillingHooks(hooks);
  };

  const reload = async (workspaceIdOverride?: string) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const availableWorkspaces = await listUserWorkspaces(userId);
      const identity = getCurrentWorkspaceIdentity();
      const resolvedWorkspace = await ensureActiveWorkspace(identity);
      const active = availableWorkspaces.find((workspace) => workspace.workspaceId === (workspaceIdOverride || resolvedWorkspace.workspaceId)) || resolvedWorkspace;

      setWorkspaces(availableWorkspaces.length > 0 ? availableWorkspaces : [active]);
      setActiveWorkspace(active);
      await loadWorkspaceData(active);
    } catch (loadError) {
      console.error(loadError);
      setError('Could not load workspace administration right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload(activeWorkspaceId || undefined);
  }, [activeWorkspaceId, userId]);

  const handleWorkspaceChange = async (workspaceId: string) => {
    const nextWorkspace = workspaces.find((workspace) => workspace.workspaceId === workspaceId);
    if (!nextWorkspace) {
      return;
    }

    setBusy(true);
    setActiveWorkspaceId(workspaceId);
    setActiveWorkspace(nextWorkspace);
    try {
      await loadWorkspaceData(nextWorkspace);
    } catch (switchError) {
      console.error(switchError);
      setError('Could not switch workspace.');
    } finally {
      setBusy(false);
    }
  };

  const handlePlanChange = async (plan: 'free' | 'pro') => {
    if (!activeWorkspace || !userId || currentPlan === plan) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateWorkspacePlan({
        tenantId: activeWorkspace.tenantId,
        workspaceId: activeWorkspace.workspaceId,
        userId,
        plan,
      });
      await loadWorkspaceData({ ...activeWorkspace, plan });
    } catch (planError) {
      console.error(planError);
      setError('Could not update the workspace plan.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async () => {
    if (!activeWorkspace || !userId || !memberUserId.trim()) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await addWorkspaceMember({
        tenantId: activeWorkspace.tenantId,
        workspaceId: activeWorkspace.workspaceId,
        userId: memberUserId.trim(),
        role: memberRole,
        invitedByUserId: userId,
      });
      setMemberUserId('');
      setMemberRole('member');
      await loadWorkspaceData(activeWorkspace);
    } catch (memberError) {
      console.error(memberError);
      setError('Could not add the workspace member.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberUserIdToRemove: string) => {
    if (!activeWorkspace || !userId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await removeWorkspaceMember({
        tenantId: activeWorkspace.tenantId,
        workspaceId: activeWorkspace.workspaceId,
        userId: memberUserIdToRemove,
        removedByUserId: userId,
      });
      await loadWorkspaceData(activeWorkspace);
    } catch (memberError) {
      console.error(memberError);
      setError('Could not remove the workspace member.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="bg-gradient-to-r from-[#0f766e] to-[#0f766e]/80 p-6 rounded-[2rem] text-white shadow-lg shadow-emerald-900/10">
          <h2 className="text-2xl font-black tracking-tight">Workspace Admin</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mt-2">Loading workspace state</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={18} />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-100">Preparing workspace administration...</span>
        </div>
      </div>
    );
  }

  if (!canManageMembers && !canManageBilling && !canSeeAudit) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-6 rounded-[2rem] text-white shadow-lg shadow-slate-900/20">
          <h2 className="text-2xl font-black tracking-tight">Workspace Admin</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mt-2">Read-only workspace role</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-100">
            Your current role is view-only for {workspaceLabel}. Ask an owner or admin for elevated access.
          </p>
          <button
            onClick={() => onNavigateToTab('settings')}
            className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100"
          >
            Back to settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="bg-gradient-to-r from-[#0f766e] to-[#0f766e]/80 p-6 rounded-[2rem] flex items-center justify-between shadow-lg shadow-emerald-900/10">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Workspace Admin</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mt-2">{tenantLabel} · {workspaceLabel}</p>
        </div>
        <button
          onClick={() => onNavigateToTab('settings')}
          className="px-4 py-3 rounded-2xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest border border-white/20"
        >
          Settings
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workspace</label>
          <select
            value={activeWorkspace?.workspaceId || ''}
            onChange={(event) => void handleWorkspaceChange(event.target.value)}
            disabled={loading || busy}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-100"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.workspaceId} value={workspace.workspaceId}>
                {workspace.name} · {workspace.role}
              </option>
            ))}
          </select>
        </div>

        <>
            {error && <p className="text-sm font-bold text-rose-500">{error}</p>}

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-600" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Billing and usage</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="text-sm font-black text-slate-800 dark:text-white">Plan: {currentPlan.toUpperCase()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current month: {monthlyUsageSummary}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => void handlePlanChange('free')}
                    disabled={!canManageBilling || busy || currentPlan === 'free'}
                    className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100 disabled:opacity-50"
                  >
                    Set Free
                  </button>
                  <button
                    onClick={() => void handlePlanChange('pro')}
                    disabled={!canManageBilling || busy || currentPlan === 'pro'}
                    className="p-4 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                  >
                    Set Pro
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {billingHooks.length === 0 ? (
                  <div className="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    No billing events recorded for this workspace yet.
                  </div>
                ) : billingHooks.map((hook) => (
                  <div key={hook.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                    <p className="text-sm font-black text-slate-800 dark:text-white">{hook.event}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{hook.plan.toUpperCase()} · {new Date(hook.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </section>

            {canManageMembers && (
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-indigo-600" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Members</h3>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    value={memberUserId}
                    onChange={(event) => setMemberUserId(event.target.value)}
                    placeholder="Member user id"
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-100"
                  />
                  <select
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-100"
                  >
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    onClick={() => void handleAddMember()}
                    disabled={busy || !memberUserId.trim()}
                    className="px-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {workspaceMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white">{member.userId}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{member.role}</p>
                      </div>
                      <button
                        onClick={() => void handleRemoveMember(member.userId)}
                        disabled={busy || member.role === 'owner'}
                        className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {canSeeAudit && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ReceiptText size={18} className="text-amber-600" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Audit trail</h3>
                  </div>
                  <button
                    onClick={() => onNavigateToTab('workspaceaudit')}
                    className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest"
                  >
                    Full audit
                  </button>
                </div>
                <div className="space-y-2">
                  {auditEvents.length === 0 ? (
                    <div className="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      No audit events for this workspace yet.
                    </div>
                  ) : auditEvents.map((event) => (
                    <div key={event.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                      <p className="text-sm font-black text-slate-800 dark:text-white">{event.action}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{event.resourceType} · {event.resourceId} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-violet-600" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Workspace readiness</h3>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-100">
                Firestore is now the source of truth for workspace members, billing state, billing hooks, usage tracking and audit events.
              </div>
            </section>
        </>
      </div>
    </div>
  );
};

export default WorkspaceAdminPage;
