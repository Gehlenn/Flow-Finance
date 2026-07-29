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
  type WorkspaceBillingHookDocument,
} from '../src/services/firestoreBillingStore';
import {
  buildBillingReturnUrl as buildSaasBillingReturnUrl,
  changeWorkspacePlan,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  getWorkspacePlanCatalog,
  type WorkspacePlanCatalog,
} from '../src/saas';
import {
  canManageWorkspaceBilling,
  canManageWorkspaceMembers,
  canViewWorkspaceAudit,
} from '../src/security/workspacePermissions';
import { trackProductEvent } from '../src/app/productAnalytics';
import { logWarn } from '../src/utils/logger';
import type { Tab } from '../hooks/navigationTypes';
import { getDemoBootstrapPlan } from '../src/demo/demoBootstrap';

interface WorkspaceAdminPageProps {
  userId: string | null;
  activeWorkspaceId: string | null;
  activeWorkspaceName?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceRole?: WorkspaceRole | null;
  onNavigateToTab: (tab: Tab) => void;
}

function buildWorkspaceAdminDiagnostic(action: string): { title: string; message: string; suggestion: string } {
  if (/checkout|portal|faturamento/i.test(action)) {
    return {
      title: 'Falha de faturamento',
      message: 'A operacao de faturamento nao concluiu agora.',
      suggestion: 'Confirme a sessao, o workspace e tente novamente.',
    };
  }

  if (/membro/i.test(action)) {
    return {
      title: 'Falha na gestao de membros',
      message: 'A operacao de membros nao concluiu agora.',
      suggestion: 'Revise a permissao do usuario e tente novamente.',
    };
  }

  if (/plano/i.test(action) || /workspace/i.test(action)) {
    return {
      title: 'Falha na operacao do workspace',
      message: 'A operacao do workspace nao concluiu agora.',
      suggestion: 'Atualize a tela e tente novamente com a mesma sessao.',
    };
  }

  return {
    title: 'Falha na operacao do workspace',
    message: 'A operacao nao concluiu agora.',
    suggestion: 'Tente novamente em alguns instantes.',
  };
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
  const [billingCatalog, setBillingCatalog] = useState<WorkspacePlanCatalog | null>(null);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro'>('free');
  const [monthlyUsageSummary, setMonthlyUsageSummary] = useState('0 transações · 0 consultas de IA · 0 conexões bancárias');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDiagnostic, setErrorDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('member');
  const demoWorkspacePlan = useMemo(() => getDemoBootstrapPlan(), []);
  const demoMode = demoWorkspacePlan !== null;

  const canManageMembers = !demoMode && canManageWorkspaceMembers(activeWorkspace?.role || activeWorkspaceRole);
  const canManageBilling = canManageWorkspaceBilling(activeWorkspace?.role || activeWorkspaceRole);
  const canSeeAudit = canViewWorkspaceAudit(activeWorkspace?.role || activeWorkspaceRole);

  const workspaceLabel = useMemo(() => {
    return activeWorkspace?.name || activeWorkspaceName || 'Workspace';
  }, [activeWorkspace?.name, activeWorkspaceName]);

  const tenantLabel = useMemo(() => {
    return activeWorkspace?.tenantName || activeTenantName || 'Tenant';
  }, [activeTenantName, activeWorkspace?.tenantName]);

  const loadWorkspaceData = async (workspace: WorkspaceSummary) => {
    if (demoWorkspacePlan) {
      const [billingOverview, planCatalog] = await Promise.all([
        getWorkspaceBillingOverview({ tenantId: workspace.tenantId, workspaceId: workspace.workspaceId }),
        getWorkspacePlanCatalog({
          workspaceId: workspace.workspaceId,
          currentPlan: demoWorkspacePlan,
        }),
      ]);

      setBillingCatalog(planCatalog);
      setCurrentPlan(planCatalog.currentPlan || billingOverview.currentPlan);
      setMonthlyUsageSummary(
        `${billingOverview.currentMonthUsage.transactions} transações · ` +
        `${billingOverview.currentMonthUsage.aiQueries} AI · ` +
        `${billingOverview.currentMonthUsage.bankConnections} conexões bancárias`,
      );
      setWorkspaceMembers([]);
      setAuditEvents([]);
      setBillingHooks([]);
      return;
    }

    const [billingOverview, planCatalog, members, audit, hooks] = await Promise.all([
      getWorkspaceBillingOverview({ tenantId: workspace.tenantId, workspaceId: workspace.workspaceId }),
      getWorkspacePlanCatalog({
        workspaceId: workspace.workspaceId,
        currentPlan: workspace.plan,
      }),
      canManageWorkspaceMembers(workspace.role) ? listWorkspaceMembers(workspace.workspaceId) : Promise.resolve([]),
      canViewWorkspaceAudit(workspace.role)
        ? listWorkspaceAuditEvents({ tenantId: workspace.tenantId, workspaceId: workspace.workspaceId, maxItems: 12 })
        : Promise.resolve([]),
      listWorkspaceBillingHooks({ workspaceId: workspace.workspaceId, maxItems: 12 }),
    ]);

    setBillingCatalog(planCatalog);
    setCurrentPlan(planCatalog.currentPlan || billingOverview.currentPlan);
    setMonthlyUsageSummary(
      `${billingOverview.currentMonthUsage.transactions} transações · ` +
      `${billingOverview.currentMonthUsage.aiQueries} AI · ` +
      `${billingOverview.currentMonthUsage.bankConnections} conexões bancárias`,
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
    setErrorDiagnostic(null);
    try {
      const availableWorkspaces = await listUserWorkspaces(userId);
      const identity = getCurrentWorkspaceIdentity();
      const resolvedWorkspace = await ensureActiveWorkspace(identity);
      const active = availableWorkspaces.find((workspace) => workspace.workspaceId === (workspaceIdOverride || resolvedWorkspace.workspaceId)) || resolvedWorkspace;

      setWorkspaces(availableWorkspaces.length > 0 ? availableWorkspaces : [active]);
      setActiveWorkspace(active);
      await loadWorkspaceData(active);
    } catch (loadError) {
      logWarn('[WorkspaceAdmin] Failed to load workspace administration', {
        error: loadError,
        userId,
        activeWorkspaceId: workspaceIdOverride || activeWorkspaceId,
        fallback: 'workspace-admin-load-failed',
      });
      setError('Nao foi possivel carregar a administracao do workspace agora.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('carregar a administracao'));
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
      logWarn('[WorkspaceAdmin] Failed to switch workspace', {
        error: switchError,
        workspaceId,
        fallback: 'workspace-admin-switch-failed',
      });
      setError('Nao foi possivel trocar o workspace.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('trocar o workspace'));
    } finally {
      setBusy(false);
    }
  };

  const handlePlanChange = async (plan: 'free' | 'pro') => {
    if (!activeWorkspace || currentPlan === plan) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await changeWorkspacePlan({
        workspaceId: activeWorkspace.workspaceId,
        plan,
      });
      const updatedWorkspace = { ...activeWorkspace, plan: result.currentPlan };
      setActiveWorkspace(updatedWorkspace);
      setWorkspaces((currentWorkspaces) => currentWorkspaces.map((workspace) => (
        workspace.workspaceId === updatedWorkspace.workspaceId ? updatedWorkspace : workspace
      )));
      await loadWorkspaceData(updatedWorkspace);
    } catch (planError) {
      logWarn('[WorkspaceAdmin] Failed to update workspace plan', {
        error: planError,
        workspaceId: activeWorkspace.workspaceId,
        tenantId: activeWorkspace.tenantId,
        plan,
        fallback: 'workspace-admin-plan-update-failed',
      });
      setError('Nao foi possivel atualizar o plano do workspace.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('atualizar o plano do workspace'));
    } finally {
      setBusy(false);
    }
  };

  const buildBillingReturnUrl = () => {
    return buildSaasBillingReturnUrl({ tab: 'workspaceadmin' });
  };

  const redirectToBillingUrl = (url: string | null | undefined) => {
    if (!url || typeof window === 'undefined') {
      throw new Error('A URL de redirecionamento de faturamento nao foi informada.');
    }

    window.location.assign(url);
  };

  const handleStartCheckout = async () => {
    if (!activeWorkspace || !canManageBilling) {
      return;
    }

    setBusy(true);
    setError(null);
    let checkoutSessionUrl: string | null | undefined;
    try {
      const session = await createWorkspaceCheckoutSession({
        workspaceId: activeWorkspace.workspaceId,
        returnUrl: buildBillingReturnUrl(),
        source: 'workspace_admin',
      });
      checkoutSessionUrl = session.url;
      trackProductEvent('billing_checkout_redirected', {
        source: 'workspace_admin',
        plan: 'pro',
      });
      redirectToBillingUrl(checkoutSessionUrl);
    } catch (billingError) {
      if (checkoutSessionUrl !== undefined) {
        trackProductEvent('billing_checkout_failed', {
          source: 'workspace_admin',
          plan: 'pro',
        });
      }
      logWarn('[WorkspaceAdmin] Failed to start Stripe checkout', {
        error: billingError,
        workspaceId: activeWorkspace.workspaceId,
        tenantId: activeWorkspace.tenantId,
        fallback: 'workspace-admin-checkout-failed',
      });
      setError('Nao foi possivel iniciar o checkout do Stripe para este workspace.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('iniciar o checkout do Stripe'));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!activeWorkspace || !canManageBilling) {
      return;
    }

    setBusy(true);
    setError(null);
    let portalSessionUrl: string | undefined;
    try {
      const session = await createWorkspacePortalSession({
        workspaceId: activeWorkspace.workspaceId,
        returnUrl: buildBillingReturnUrl(),
        source: 'workspace_admin',
      });
      portalSessionUrl = session.url;
      trackProductEvent('billing_portal_redirected', {
        source: 'workspace_admin',
        plan: activeWorkspace.plan || 'pro',
      });
      redirectToBillingUrl(portalSessionUrl);
    } catch (billingError) {
      if (portalSessionUrl !== undefined) {
        trackProductEvent('billing_portal_failed', {
          source: 'workspace_admin',
          plan: activeWorkspace.plan || 'pro',
        });
      }
      logWarn('[WorkspaceAdmin] Failed to open Stripe billing portal', {
        error: billingError,
        workspaceId: activeWorkspace.workspaceId,
        tenantId: activeWorkspace.tenantId,
        fallback: 'workspace-admin-portal-failed',
      });
      setError('Nao foi possivel abrir o portal de faturamento do Stripe agora.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('abrir o portal de faturamento do Stripe'));
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
      logWarn('[WorkspaceAdmin] Failed to add workspace member', {
        error: memberError,
        workspaceId: activeWorkspace.workspaceId,
        tenantId: activeWorkspace.tenantId,
        memberUserId: memberUserId.trim(),
        fallback: 'workspace-admin-add-member-failed',
      });
      setError('Nao foi possivel adicionar o membro ao workspace.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('adicionar membro'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberUserIdToRemover: string) => {
    if (!activeWorkspace || !userId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await removeWorkspaceMember({
        tenantId: activeWorkspace.tenantId,
        workspaceId: activeWorkspace.workspaceId,
        userId: memberUserIdToRemover,
        removedByUserId: userId,
      });
      await loadWorkspaceData(activeWorkspace);
    } catch (memberError) {
      logWarn('[WorkspaceAdmin] Failed to remove workspace member', {
        error: memberError,
        workspaceId: activeWorkspace.workspaceId,
        tenantId: activeWorkspace.tenantId,
        memberUserId: memberUserIdToRemover,
        fallback: 'workspace-admin-remove-member-failed',
      });
      setError('Nao foi possivel remover o membro do workspace.');
      setErrorDiagnostic(buildWorkspaceAdminDiagnostic('remover membro'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Operacao do workspace</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 mt-2">Carregando estado do workspace</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={18} />
          <span className="text-sm text-slate-700 dark:text-slate-100">Preparando a operacao do workspace...</span>
        </div>
      </div>
    );
  }

  if (!canManageMembers && !canManageBilling && !canSeeAudit) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500 pb-24">
        <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Operacao do workspace</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 mt-2">Funcao apenas leitura</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-100">
            Sua funcao atual e apenas leitura para {workspaceLabel}. Peça acesso de owner ou admin.
          </p>
          <button
            onClick={() => onNavigateToTab('settings')}
            className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 dark:text-slate-100"
          >
            Voltar para configuracoes
          </button>
        </div>
      </div>
    );
  }

  const stripeConfigured = billingCatalog?.stripeConfigured === true;
  const stripePortalEnabled = billingCatalog?.stripePortalEnabled === true;
  const manualPlanChangeAllowed = billingCatalog?.manualPlanChangeAllowed === true;
  const showMockPlanButtons = !demoMode && canManageBilling && manualPlanChangeAllowed && !stripeConfigured;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">Operacao do workspace</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 mt-2">{tenantLabel} · {workspaceLabel}</p>
        </div>
        <button
          onClick={() => onNavigateToTab('settings')}
          className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-semibold uppercase tracking-[0.08em] border border-slate-200 dark:border-slate-600"
        >
          Configurações
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Workspace</label>
          <select
            value={activeWorkspace?.workspaceId || ''}
            onChange={(event) => void handleWorkspaceChange(event.target.value)}
            disabled={loading || busy}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-100"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.workspaceId} value={workspace.workspaceId}>
                {workspace.name} · {workspace.role}
              </option>
            ))}
          </select>
        </div>

        <>
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-rose-500">{error}</p>
            {errorDiagnostic && (
              <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">{errorDiagnostic.title}</p>
                <p className="text-xs text-rose-700 dark:text-rose-100">{errorDiagnostic.message}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-300">Próximo passo: {errorDiagnostic.suggestion}</p>
              </div>
            )}
          </div>
        )}

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-600" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-800 dark:text-white">Faturamento e uso do workspace</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Plano atual: {currentPlan.toUpperCase()}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Mes atual: {monthlyUsageSummary}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Modo de faturamento: {demoMode ? 'beta demo' : (billingCatalog?.billingProvider || 'none')}
                  </p>
                </div>
                <div className="space-y-3">
                  {demoMode ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-200">
                        Beta com Pro liberado
                      </p>
                      <p className="text-sm font-medium leading-relaxed">
                        Este workspace demo já está no Pro. As rotas de Stripe ficam para uma etapa futura e não devem bloquear a navegação nesta beta.
                      </p>
                    </div>
                  ) : stripeConfigured ? (
                    <div className="space-y-2">
                      {currentPlan === 'pro' ? (
                        <>
                          <button
                            onClick={() => void handleOpenBillingPortal()}
                            disabled={!canManageBilling || busy || !stripePortalEnabled}
                            className="w-full p-4 rounded-2xl bg-emerald-600 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                          >
                            Abrir portal financeiro
                          </button>
                          {!stripePortalEnabled && (
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                              O portal ficara disponivel depois que o workspace estiver vinculado a um cliente Stripe.
                            </p>
                          )}
                        </>
                      ) : (
                          <button
                            onClick={() => void handleStartCheckout()}
                            disabled={!canManageBilling || busy}
                            className="w-full p-4 rounded-2xl bg-emerald-600 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                          >
                          Iniciar upgrade Pro
                          </button>
                      )}
                    </div>
                  ) : showMockPlanButtons ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => void handlePlanChange('free')}
                          disabled={!canManageBilling || busy || currentPlan === 'free'}
                          className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 dark:text-slate-100 disabled:opacity-50"
                        >
                        Definir Free
                        </button>
                        <button
                          onClick={() => void handlePlanChange('pro')}
                          disabled={!canManageBilling || busy || currentPlan === 'pro'}
                          className="p-4 rounded-2xl bg-emerald-600 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50"
                        >
                        Definir Pro
                        </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      As acoes de faturamento ficam indisponiveis ate que o Stripe ou o faturamento simulado estejam configurados neste ambiente.
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {billingHooks.length === 0 ? (
                  <div className="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Nenhum evento de faturamento registrado para este workspace ainda.
                  </div>
                ) : billingHooks.map((hook) => (
                  <div key={hook.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{hook.event}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{hook.plan.toUpperCase()} · {new Date(hook.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </section>

            {canManageMembers && (
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-slate-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-800 dark:text-white">Membros do workspace</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    value={memberUserId}
                    onChange={(event) => setMemberUserId(event.target.value)}
                    placeholder="ID do usuario do membro"
                    className="min-w-0 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-100"
                  />
                  <select
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}
                    className="min-w-0 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-100"
                  >
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    onClick={() => void handleAddMember()}
                    disabled={busy || !memberUserId.trim()}
                    className="min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 sm:w-auto"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {workspaceMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{member.userId}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{member.role}</p>
                      </div>
                      <button
                        onClick={() => void handleRemoveMember(member.userId)}
                        disabled={busy || member.role === 'owner'}
                        className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-40"
                      >
                        Remover
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
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-800 dark:text-white">Trilha de auditoria do workspace</h3>
                  </div>
                  <button
                    onClick={() => onNavigateToTab('workspaceaudit')}
                    className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 text-xs font-semibold uppercase tracking-[0.08em]"
                  >
                    Auditoria completa
                  </button>
                </div>
                <div className="space-y-2">
                  {auditEvents.length === 0 ? (
                    <div className="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Nenhum evento de auditoria para este workspace ainda.
                    </div>
                  ) : auditEvents.map((event) => (
                    <div key={event.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{event.action}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{event.resourceType} · {event.resourceId} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-slate-500" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-800 dark:text-white">Prontidão do workspace</h3>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-100">
                O Firestore agora é a fonte de verdade para membros do workspace, estado de faturamento, webhooks de faturamento, acompanhamento de uso e eventos de auditoria.
              </div>
            </section>
        </>
      </div>
    </div>
  );
};

export default WorkspaceAdminPage;



