import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  User, LogOut, Moon, Sliders, Sun, Edit2,
  ChevronRight, Phone, BrainCircuit, X, Loader2, Send,
  Link2, CheckCircle2, AlertCircle, Copyright, Scale, ShieldCheck,
  Zap, Key, RefreshCw, Trash2, Copy,
} from 'lucide-react';
import NamePromptModal from './NamePromptModal';
import LegalModal from './LegalModal';
import { apiRequest, API_ENDPOINTS } from '../src/config/api.config';
import { auth, googleProvider, appleProvider, linkWithPopup } from '../services/firebase';
import type { AuthProvider } from 'firebase/auth';
import {
  ensureActiveWorkspace,
  getCurrentWorkspaceIdentity,
  listUserWorkspaces,
  setActiveWorkspaceId,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../src/services/workspaceSession';
import { getWorkspaceBillingOverview } from '../src/services/firestoreBillingStore';
import {
  buildBillingReturnUrl,
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
import { logWarn } from '../src/utils/logger';
import { FREE_LIMITS, MONETIZATION_PRICING } from '../src/app/monetizationPlan';
import { trackProductEvent } from '../src/app/productAnalytics';
import { getDemoBootstrapPlan } from '../src/demo/demoBootstrap';

function buildSettingsDiagnostic(message: string): { title: string; message: string; suggestion: string } {
  const normalized = message.toLowerCase();

  if (normalized.includes('carregar') || normalized.includes('plano')) {
    return {
      title: 'Falha ao carregar a configuracao',
      message: 'O workspace nao retornou os dados esperados agora.',
      suggestion: 'Verifique a sessao, o backend e tente atualizar a tela.',
    };
  }

  if (normalized.includes('chave') || normalized.includes('integracao') || normalized.includes('integra')) {
    return {
      title: 'Falha na chave de integracao',
      message: 'A operacao de geracao ou revogacao nao concluiu agora.',
      suggestion: 'Tente novamente e confirme se seu workspace tem permissão de administracao.',
    };
  }

  return {
    title: 'Ajuste necessario',
    message: 'A operacao de settings nao concluiu como esperado.',
    suggestion: 'Atualize a tela e tente de novo com a mesma sessao.',
  };
}

function buildLinkDiagnostic(code?: string, providerLabel: string = 'o provedor'): { title: string; message: string; suggestion: string } {
  if (code === 'auth/credential-already-in-use') {
    return {
      title: 'Credencial ja vinculada',
      message: `Esta credencial ja esta associada a outra conta no ${providerLabel}.`,
      suggestion: 'Use outra conta social ou revise qual usuario Firebase esta ativo nesta sessao.',
    };
  }

  return {
    title: 'Falha ao vincular provedor',
    message: `Nao foi possivel concluir o vinculo com ${providerLabel} agora.`,
    suggestion: 'Confirme a sessao, as permissoes do provedor e tente novamente.',
  };
}

interface SettingsProps {
  userName: string | null;
  userEmail: string | null;
  theme: 'light' | 'dark';
  activeWorkspaceName?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceRole?: WorkspaceRole | null;
  onUpdateProfile: (name: string) => void;
  onLogout: () => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onOpenWorkspaceAdmin?: () => void;
}

const Settings: React.FC<SettingsProps> = ({
  userName,
  userEmail,
  theme,
  activeWorkspaceName,
  activeTenantName,
  activeWorkspaceRole,
  onUpdateProfile,
  onLogout,
  onThemeChange,
  onOpenWorkspaceAdmin,
}) => {
  const [showNameModal, setShowNameModal] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'privacy_terms' | 'copyright' | null>(null);
  const [showAiSupport, setShowAiSupport] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<{ type: 'success' | 'error'; msg: string; diagnostic?: { title: string; message: string; suggestion: string } } | null>(null);
  const [supportQuery, setSupportQuery] = useState('');
  const [supportResponse, setSupportResponse] = useState('');
  const [supportDiagnostic, setSupportDiagnostic] = useState<{ message: string; suggestion: string } | null>(null);
  const [isGeneratingSupport, setIsGeneratingSupport] = useState(false);
  const [isAnimatingTheme, setIsAnimatingTheme] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingDiagnostic, setBillingDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro'>('free');
  const [planName, setPlanName] = useState('Free');
  const [billingCatalog, setBillingCatalog] = useState<WorkspacePlanCatalog | null>(null);
  const [billingActionBusy, setBillingActionBusy] = useState(false);
  const [billingActionError, setBillingActionError] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [monthlyUsageSummary, setMonthlyUsageSummary] = useState('0 transacoes - 0 consultas IA');
  const demoWorkspacePlan = useMemo(() => getDemoBootstrapPlan(), []);
  const demoMode = demoWorkspacePlan !== null;

  // Integration keys state
  const [integrationKeyConfigured, setIntegrationKeyConfigured] = useState(false);
  const [integrationKeyPrefix, setIntegrationKeyPrefix] = useState<string | null>(null);
  const [integrationKeyCreatedAt, setIntegrationKeyCreatedAt] = useState<string | null>(null);
  const [integrationKeyLoading, setIntegrationKeyLoading] = useState(false);
  const [integrationKeyGenerated, setIntegrationKeyGenerated] = useState<string | null>(null);
  const [integrationKeyError, setIntegrationKeyError] = useState<string | null>(null);
  const [integrationKeyDiagnostic, setIntegrationKeyDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [integrationKeyMetaError, setIntegrationKeyMetaError] = useState<string | null>(null);
  const [integrationKeyMetaDiagnostic, setIntegrationKeyMetaDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [integrationKeyCopied, setIntegrationKeyCopied] = useState(false);
  const [integrationPayloadCopied, setIntegrationPayloadCopied] = useState(false);
  const [integrationCurlCopied, setIntegrationCurlCopied] = useState(false);
  const [clipboardDiagnostic, setClipboardDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const integrationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void loadBillingOverview();
  }, []);

  useEffect(() => {
    void loadIntegrationKeyMetaWithDiagnostic();
  }, []);

  const loadIntegrationKeyMetaWithDiagnostic = useCallback(async () => {
    try {
      const res = await apiRequest<{ configured: boolean; keyPrefix?: string; createdAt?: string }>(
        API_ENDPOINTS.INTEGRATION_KEYS.ROOT,
        { method: 'GET' },
      );
      setIntegrationKeyConfigured(res.configured);
      setIntegrationKeyPrefix(res.keyPrefix ?? null);
      setIntegrationKeyCreatedAt(res.createdAt ?? null);
      setIntegrationKeyMetaError(null);
      setIntegrationKeyMetaDiagnostic(null);
    } catch (error) {
      logWarn('[Settings] Failed to load integration key metadata', {
        error,
        fallback: 'settings-integration-key-meta-load-failed',
      });
      const message = 'Nao foi possivel carregar os metadados da chave de integracao agora.';
      setIntegrationKeyMetaError(message);
      setIntegrationKeyMetaDiagnostic(buildSettingsDiagnostic(message));
    }
  }, []);

  const handleGenerateIntegrationKey = async () => {
    setIntegrationKeyLoading(true);
    setIntegrationKeyError(null);
    setIntegrationKeyDiagnostic(null);
    setIntegrationKeyGenerated(null);
    try {
      const res = await apiRequest<{ key: string; keyPrefix: string; createdAt: string; warning: string }>(
        API_ENDPOINTS.INTEGRATION_KEYS.GENERATE,
        { method: 'POST' },
      );
      setIntegrationKeyGenerated(res.key);
      integrationKeyRef.current = res.key;
      setIntegrationKeyConfigured(true);
      setIntegrationKeyPrefix(res.keyPrefix);
      setIntegrationKeyCreatedAt(res.createdAt);
    } catch (error) {
      logWarn('[Settings] Failed to generate integration key', {
        error,
        fallback: 'settings-generate-integration-key-failed',
      });
      const message = 'Nao foi possivel gerar a chave. Tente novamente.';
      setIntegrationKeyError(message);
      setIntegrationKeyDiagnostic(buildSettingsDiagnostic(message));
    } finally {
      setIntegrationKeyLoading(false);
    }
  };

  const handleRevokeIntegrationKey = async () => {
    setIntegrationKeyLoading(true);
    setIntegrationKeyError(null);
    setIntegrationKeyDiagnostic(null);
    try {
      await apiRequest(API_ENDPOINTS.INTEGRATION_KEYS.ROOT, { method: 'DELETE' });
      setIntegrationKeyConfigured(false);
      setIntegrationKeyPrefix(null);
      setIntegrationKeyCreatedAt(null);
      setIntegrationKeyGenerated(null);
      integrationKeyRef.current = null;
    } catch (error) {
      logWarn('[Settings] Failed to revoke integration key', {
        error,
        fallback: 'settings-revoke-integration-key-failed',
      });
      const message = 'Nao foi possivel revogar a chave.';
      setIntegrationKeyError(message);
      setIntegrationKeyDiagnostic(buildSettingsDiagnostic(message));
    } finally {
      setIntegrationKeyLoading(false);
    }
  };

  const copyDiagnostic = (label: string) => ({
    title: 'Falha ao copiar',
    message: `Nao foi possivel copiar ${label} agora.`,
    suggestion: 'Confirme as permissoes do navegador ou copie o trecho manualmente.',
  });

  const handleCopyKey = async () => {
    const key = integrationKeyRef.current ?? integrationKeyGenerated;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setClipboardDiagnostic(null);
      setIntegrationKeyCopied(true);
      setTimeout(() => setIntegrationKeyCopied(false), 2000);
    } catch (error) {
      logWarn('[Settings] Failed to copy integration key', {
        error,
        fallback: 'settings-copy-integration-key-failed',
      });
      setClipboardDiagnostic(copyDiagnostic('a chave de integracao'));
    }
  };

  const handleCopyPayload = async () => {
    const payload = JSON.stringify({
      eventType: 'payment_received',
      workspaceId: 'SEU_WORKSPACE_ID',
      externalEventId: 'ID_UNICO',
      sourceSystem: 'meu-sistema',
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: 'cli-1',
        externalReceivableId: 'rec-1',
        amount: 350.00,
        currency: 'BRL',
        category: 'Trabalho / Consultório',
        description: 'Consulta - Maria',
      },
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setClipboardDiagnostic(null);
      setIntegrationPayloadCopied(true);
      setTimeout(() => setIntegrationPayloadCopied(false), 2000);
    } catch (error) {
      logWarn('[Settings] Failed to copy integration payload', {
        error,
        fallback: 'settings-copy-integration-payload-failed',
      });
      setClipboardDiagnostic(copyDiagnostic('o payload de integracao'));
    }
  };

  const handleCopyCurl = async () => {
    const keyValue = integrationKeyRef.current ?? integrationKeyGenerated ?? 'flw_sua_chave';
    const parts = [
      'curl -X POST https://SEU_BACKEND.vercel.app/api/integrations/external/events',
      '  -H "Content-Type: application/json"',
      `  -H "X-Integration-Key: ${keyValue}"`,
      `  -d '{"eventType":"payment_received","workspaceId":"SEU_WORKSPACE_ID","externalEventId":"teste-1","sourceSystem":"curl","occurredAt":"${new Date().toISOString()}","payload":{"externalCustomerId":"cli-1","externalReceivableId":"rec-1","amount":100,"currency":"BRL","category":"Pessoal","description":"Teste"}}'`,
    ];
    try {
      await navigator.clipboard.writeText(parts.join(' \\\n'));
      setClipboardDiagnostic(null);
      setIntegrationCurlCopied(true);
      setTimeout(() => setIntegrationCurlCopied(false), 2000);
    } catch (error) {
      logWarn('[Settings] Failed to copy integration curl', {
        error,
        fallback: 'settings-copy-integration-curl-failed',
      });
      setClipboardDiagnostic(copyDiagnostic('o comando curl de integracao'));
    }
  };

  const handleThemeChange = (nextTheme: 'light' | 'dark') => {
    setIsAnimatingTheme(true);
    onThemeChange(nextTheme);
    setTimeout(() => setIsAnimatingTheme(false), 700);
  };

  const loadBillingOverview = async () => {
    setBillingLoading(true);
    setBillingError(null);
    setBillingDiagnostic(null);
    try {
      const identity = getCurrentWorkspaceIdentity();
      let availableWorkspaces = await listUserWorkspaces();
      const workspace = await ensureActiveWorkspace(identity);
      if (availableWorkspaces.length === 0) {
        availableWorkspaces = [workspace];
      }

      const [overview, catalog] = await Promise.all([
        getWorkspaceBillingOverview({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
        }),
        getWorkspacePlanCatalog({
          workspaceId: workspace.workspaceId,
          currentPlan: workspace.plan,
        }),
      ]);

      setActiveWorkspace(workspace);
      setWorkspaces(availableWorkspaces);
      setBillingCatalog(catalog);
      setCurrentPlan(catalog.currentPlan || overview.currentPlan);
      setPlanName((catalog.currentPlan || overview.currentPlan) === 'pro'
        ? (demoMode ? 'Pro liberado (beta)' : 'Pro')
        : 'Free');
      setMonthlyUsageSummary(
        `${overview.currentMonthUsage.transactions} transacoes - ` +
        `${overview.currentMonthUsage.aiQueries} consultas IA`,
      );
    } catch (error) {
      logWarn('[Settings] Failed to load workspace billing overview', {
        error,
        fallback: 'settings-billing-overview-load-failed',
      });
      const message = 'Nao foi possivel carregar o plano do workspace. Tente novamente.';
      setBillingError(message);
      setBillingDiagnostic(buildSettingsDiagnostic(message));
    } finally {
      setBillingLoading(false);
    }
  };

  const handleWorkspaceChange = async (workspaceId: string) => {
    const nextWorkspace = workspaces.find((workspace) => workspace.workspaceId === workspaceId);
    if (!nextWorkspace || nextWorkspace.workspaceId === activeWorkspace?.workspaceId) {
      return;
    }

    setWorkspaceSwitching(true);
    setActiveWorkspaceId(nextWorkspace.workspaceId);
    setActiveWorkspace(nextWorkspace);

    try {
      await loadBillingOverview();
    } finally {
      setWorkspaceSwitching(false);
    }
  };

  const handleStartUpgrade = async () => {
    if (!activeWorkspace?.workspaceId) {
      setBillingActionError('Nao foi possivel identificar o workspace para iniciar o upgrade.');
      return;
    }

    setBillingActionBusy(true);
    setBillingActionError(null);

    let checkoutSessionUrl: string | null | undefined;
    try {
      const session = await createWorkspaceCheckoutSession({
        workspaceId: activeWorkspace.workspaceId,
        returnUrl: buildBillingReturnUrl({ tab: 'settings' }),
        source: 'settings',
      });
      checkoutSessionUrl = session.url;

      if (!checkoutSessionUrl) {
        throw new Error('Stripe checkout session returned no URL');
      }

      trackProductEvent('billing_checkout_redirected', {
        source: 'settings',
        plan: 'pro',
      });
      window.location.assign(checkoutSessionUrl);
    } catch (error) {
      if (checkoutSessionUrl !== undefined) {
        trackProductEvent('billing_checkout_failed', {
          source: 'settings',
          plan: 'pro',
        });
      }
      logWarn('[Settings] Failed to open Stripe checkout', {
        error,
        workspaceId: activeWorkspace.workspaceId,
        fallback: 'settings-upgrade-checkout-failed',
      });
      setBillingActionError('Nao foi possivel abrir o checkout do Stripe agora.');
    } finally {
      setBillingActionBusy(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!activeWorkspace?.workspaceId) {
      setBillingActionError('Nao foi possivel identificar o workspace para abrir o portal.');
      return;
    }

    setBillingActionBusy(true);
    setBillingActionError(null);

    let portalSessionUrl: string | undefined;
    try {
      const session = await createWorkspacePortalSession({
        workspaceId: activeWorkspace.workspaceId,
        returnUrl: buildBillingReturnUrl({ tab: 'settings' }),
        source: 'settings',
      });
      portalSessionUrl = session.url;

      trackProductEvent('billing_portal_redirected', {
        source: 'settings',
        plan: currentPlan,
      });
      window.location.assign(portalSessionUrl);
    } catch (error) {
      if (portalSessionUrl !== undefined) {
        trackProductEvent('billing_portal_failed', {
          source: 'settings',
          plan: currentPlan,
        });
      }
      logWarn('[Settings] Failed to open Stripe billing portal', {
        error,
        workspaceId: activeWorkspace.workspaceId,
        fallback: 'settings-billing-portal-failed',
      });
      setBillingActionError('Nao foi possivel abrir o portal de faturamento do Stripe agora.');
    } finally {
      setBillingActionBusy(false);
    }
  };

  const handleAiSupport = async (nextQuery?: string) => {
    const query = nextQuery ?? supportQuery;
    if (!query.trim()) return;
    setIsGeneratingSupport(true);
    setSupportResponse('');
    setSupportDiagnostic(null);

    const q = query.toLowerCase();
    let intent = 'monthly_summary';
    if (/(falta entrar|receber|recebivel|pendente|vencido|a receber)/.test(q)) intent = 'receivables_question';
    else if (/(gastar|posso gastar|limite|disponivel|sobrou)/.test(q)) intent = 'spending_advice';
    else if (/(risco|proximo|curto prazo|proximo|semana|dias)/.test(q)) intent = 'risk_question';
    else if (/(saldo|caixa|quanto tem|posicao)/.test(q)) intent = 'cash_position';
    else if (/(economiz|cortar|reduzir|poupar|economias)/.test(q)) intent = 'savings_question';

    const SUPPORT_FALLBACKS: Record<string, string> = {
      receivables_question: 'Trate recebiveis pendentes como fora do caixa ate confirmacao. Acompanhe vencimentos proximos e cobre os atrasados antes de assumir novos compromissos.',
      spending_advice: 'Para decidir se pode gastar, verifique o saldo confirmado em caixa, desconte compromissos dos proximos 7 dias e so considere o restante como margem disponivel.',
      risk_question: 'Monitore os proximos 7 dias: vencimentos de contas a pagar, recebimentos previstos e qualquer recebivel ja atrasado. Esses tres pontos definem o risco de curto prazo.',
      cash_position: 'Saldo disponivel e o total confirmado nas contas menos os compromissos ja assumidos. Valores pendentes ou previstos nao fazem parte do caixa ate entrar de fato.',
      savings_question: 'Comece cortando despesas recorrentes de baixo impacto operacional. Revise assinaturas, fornecedores secundarios e gastos variaveis que nao afetam a entrega do servico.',
      monthly_summary: 'Para um resumo do mes, compare entradas confirmadas com saidas registradas, calcule o saldo liquido e identifique os 3 maiores centros de custo. Essa leitura da o ponto de partida para decisoes operacionais.',
    };

    const SUPPORT_DIAGNOSTICS: Record<string, { message: string; suggestion: string }> = {
      receivables_question: {
        message: 'Suporte IA indisponivel para consolidar recebiveis agora.',
        suggestion: 'Revise a tela de contas a receber e confirme os vencimentos antes de assumir novos compromissos.',
      },
      spending_advice: {
        message: 'Suporte IA indisponivel para orientar gasto neste momento.',
        suggestion: 'Confira o caixa confirmado e os compromissos dos proximos 7 dias antes de decidir.',
      },
      risk_question: {
        message: 'Suporte IA indisponivel para calcular risco de curto prazo agora.',
        suggestion: 'Verifique vencimentos, recebiveis atrasados e saldo projetado na tela principal.',
      },
      cash_position: {
        message: 'Suporte IA indisponivel para consolidar a posicao de caixa agora.',
        suggestion: 'Use o saldo confirmado das contas e desconte os compromissos ja assumidos.',
      },
      savings_question: {
        message: 'Suporte IA indisponivel para sugerir economia neste momento.',
        suggestion: 'Revise assinaturas, fornecedores secundarios e gastos variaveis sem impacto operacional.',
      },
      monthly_summary: {
        message: 'Suporte IA indisponivel para consolidar o resumo do mes agora.',
        suggestion: 'Compare entradas confirmadas, saidas registradas e os 3 maiores centros de custo.',
      },
    };

    try {
      const response = await apiRequest<{ answer?: string; text?: string }>(
        API_ENDPOINTS.AI.CFO,
        {
          method: 'POST',
          body: JSON.stringify({
            question: query,
            context: '',
            intent,
          }),
        },
      );
      const answer = response.answer ?? response.text ?? '';
      if (answer.trim().length > 0) {
        setSupportResponse(answer);
        setSupportDiagnostic(null);
      } else {
        setSupportResponse(SUPPORT_FALLBACKS[intent]);
        setSupportDiagnostic(SUPPORT_DIAGNOSTICS[intent]);
      }
    } catch {
      logWarn('[Settings] AI support fallback triggered', {
        intent,
        fallback: 'settings-ai-support-fallback',
      });
      setSupportResponse(SUPPORT_FALLBACKS[intent]);
      setSupportDiagnostic(SUPPORT_DIAGNOSTICS[intent]);
    } finally {
      setIsGeneratingSupport(false);
    }
  };

  const handleLinkAccount = async (provider: AuthProvider) => {
    if (!auth.currentUser) return;
    setIsLinking(true);
    setLinkFeedback(null);
    try {
      await linkWithPopup(auth.currentUser, provider);
      setLinkFeedback({ type: 'success', msg: 'Conta vinculada com sucesso.' });
    } catch (err: unknown) {
      logWarn('[Settings] Failed to link social account', {
        error: err,
        fallback: 'settings-link-social-account-failed',
      });
      const error = err as { code?: string };
      if (error.code === 'auth/credential-already-in-use') {
        setLinkFeedback({
          type: 'error',
          msg: 'Esta credencial ja esta vinculada a outra conta.',
          diagnostic: buildLinkDiagnostic(error.code, 'Google ou Apple'),
        });
      } else {
        setLinkFeedback({
          type: 'error',
          msg: 'Nao foi possivel vincular este provedor.',
          diagnostic: buildLinkDiagnostic(error.code, 'Google ou Apple'),
        });
      }
    } finally {
      setIsLinking(false);
      setTimeout(() => setLinkFeedback(null), 3000);
    }
  };

  const canOpenWorkspaceAdmin =
    canManageWorkspaceMembers(activeWorkspaceRole || activeWorkspace?.role)
    || canManageWorkspaceBilling(activeWorkspaceRole || activeWorkspace?.role)
    || canViewWorkspaceAudit(activeWorkspaceRole || activeWorkspace?.role);

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Operacao do workspace</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Perfil, acesso e faturamento</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Sliders size={18} />
        </div>
      </div>

      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-5 dark:border-slate-700">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 shadow-inner dark:bg-slate-800 dark:text-slate-300">
            <User size={30} />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-lg font-semibold tracking-tight text-slate-800 dark:text-white">{userName || 'Usuario Flow'}</h3>
            <p className="text-sm font-medium text-slate-400 uppercase tracking-[0.16em]">{userEmail}</p>
            <button onClick={() => setShowNameModal(true)} className="flex items-center gap-1.5 mt-2 text-sm font-semibold text-slate-500 uppercase tracking-[0.16em] hover:text-slate-700 transition-colors">
              <Edit2 size={12} /> Editar nome
            </button>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-50 pt-5 dark:border-slate-700">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-[0.16em]">Resumo do workspace</h4>
            <span className={`text-sm font-semibold uppercase tracking-[0.16em] ${currentPlan === 'pro' ? 'text-emerald-500' : 'text-slate-500'}`}>
              {currentPlan.toUpperCase()} - {activeWorkspaceRole || activeWorkspace?.role || 'membro'}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em]">Workspace ativo</label>
            <select
              value={activeWorkspace?.workspaceId || ''}
              onChange={(event) => void handleWorkspaceChange(event.target.value)}
              disabled={billingLoading || workspaceSwitching || workspaces.length <= 1}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-100 outline-none disabled:opacity-60"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.workspaceId} value={workspace.workspaceId}>
                  {workspace.name} - {workspace.plan.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2">
            {billingLoading ? (
              <p className="text-sm font-medium text-slate-400 uppercase tracking-[0.16em]">Carregando workspace...</p>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-800 dark:text-white">Plano atual: {planName}</p>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-300 uppercase tracking-[0.16em]">Tenant: {activeTenantName || activeWorkspace?.tenantName || 'Tenant ativo'}</p>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-300 uppercase tracking-[0.16em]">Workspace: {activeWorkspaceName || activeWorkspace?.name || 'Workspace ativo'}</p>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-300 uppercase tracking-[0.16em]">Papel: {activeWorkspaceRole || activeWorkspace?.role || 'membro'}</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300 uppercase tracking-[0.16em]">Mes atual: {monthlyUsageSummary}</p>
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">Regra ativa do plano</p>
                  <ul className="space-y-1">
                    <li className="text-sm text-slate-600 dark:text-slate-300">• Consultor IA {currentPlan === 'pro' ? 'ilimitado' : `${FREE_LIMITS.consultorIaQueriesPerMonth} consultas por mes`}</li>
                    <li className="text-sm text-slate-600 dark:text-slate-300">• Workspaces {currentPlan === 'pro' ? 'multiplos' : `${FREE_LIMITS.workspaces}`}</li>
                    <li className="text-sm text-slate-600 dark:text-slate-300">• Exportacao de relatorios {currentPlan === 'pro' ? 'liberada' : 'bloqueada no Free'}</li>
                  </ul>
                </div>
                <div className="pt-3 flex flex-col gap-2">
                  {demoMode ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">Beta com Pro liberado</p>
                      <p className="text-sm font-medium leading-relaxed">
                        Este workspace demo já opera no Pro. O checkout e o portal Stripe ficam para a fase futura de billing.
                      </p>
                    </div>
                  ) : (
                    <>
                      {currentPlan === 'pro' ? (
                        <button
                          onClick={() => void handleOpenBillingPortal()}
                          disabled={billingActionBusy || !billingCatalog?.stripePortalEnabled}
                          className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                        >
                          {billingActionBusy ? 'Abrindo portal...' : 'Gerenciar assinatura'}
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleStartUpgrade()}
                          disabled={billingActionBusy || !billingCatalog?.stripeConfigured}
                          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:disabled:bg-slate-700"
                        >
                          {billingActionBusy ? 'Abrindo checkout...' : `Assinar Pro - R$ ${MONETIZATION_PRICING.proMonthlyBRL.toFixed(2).replace('.', ',')}/mes`}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => window.location.assign('/pricing')}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Ver pricing
                        <ChevronRight size={14} />
                      </button>
                      {!billingCatalog?.stripeConfigured && (
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                          Stripe ainda nao configurado neste ambiente. O wiring de upgrade esta pronto, mas depende dos price IDs e segredos do ambiente alvo.
                        </p>
                      )}
                      {currentPlan === 'pro' && !billingCatalog?.stripePortalEnabled && (
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                          O portal de assinatura libera depois que este workspace estiver vinculado a um customer Stripe valido.
                        </p>
                      )}
                    </>
                  )}
                  {billingActionError && (
                    <p className="text-sm font-medium text-rose-500">{billingActionError}</p>
                  )}
                </div>
              </>
            )}
            {billingError && <p className="text-sm font-medium text-rose-500">{billingError}</p>}
            {billingDiagnostic && (
              <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 p-3 space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">{billingDiagnostic.title}</p>
                <p className="text-sm font-medium text-rose-700 dark:text-rose-100">{billingDiagnostic.message}</p>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Próximo passo: {billingDiagnostic.suggestion}</p>
              </div>
            )}
          </div>

          {canOpenWorkspaceAdmin && (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-slate-500 dark:text-slate-300" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">Admin do workspace</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Gerencie plano, membros, auditoria e limites do workspace.</p>
                </div>
              </div>
              <button
                onClick={() => onOpenWorkspaceAdmin?.()}
                className="w-full p-4 rounded-2xl bg-slate-900 text-white text-sm font-semibold uppercase tracking-[0.16em] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
              >
                Abrir admin do workspace
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <Link2 size={15} className="text-slate-500 dark:text-slate-300" />
                <h4 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-[0.16em]">Acesso social</h4>
              </div>
            {linkFeedback && (
              linkFeedback.type === 'success' ? (
                <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 text-emerald-500">
                  <CheckCircle2 size={12} />
                  <span className="text-sm font-semibold uppercase tracking-[0.16em]">{linkFeedback.msg}</span>
                </div>
              ) : (
                <div role="status" className="rounded-2xl border border-rose-100 bg-rose-50/80 px-3 py-2.5 animate-in slide-in-from-right-2 dark:border-rose-500/20 dark:bg-rose-500/10">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={12} className="mt-0.5 text-rose-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">{linkFeedback.diagnostic?.title ?? 'Falha ao vincular provedor'}</p>
                      <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{linkFeedback.diagnostic?.message ?? linkFeedback.msg}</p>
                      <p className="mt-1 text-sm font-medium text-rose-500">{linkFeedback.diagnostic?.suggestion ?? 'Tente novamente em alguns instantes.'}</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => void handleLinkAccount(googleProvider)}
              disabled={isLinking}
              className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col items-center gap-1.5 border-2 border-transparent hover:border-slate-300 transition-all active:scale-95 group disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em]">Vincular Google</span>
            </button>
            <button
              onClick={() => void handleLinkAccount(appleProvider)}
              disabled={isLinking}
              className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col items-center gap-1.5 border-2 border-transparent hover:border-slate-300 transition-all active:scale-95 group disabled:opacity-50"
            >
              <svg className="w-4.5 h-4.5 fill-current text-slate-700 dark:text-white group-hover:scale-110 transition-transform" viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 21.8-88.5 21.8-11.4 0-51.1-20.8-82.9-20.1-41.9.3-81.2 26.1-102.3 65.1-41.1 75.9-10.3 188.7 30.2 247.3 20.1 28.5 44 54.8 75.1 53.9 29.9-1 41.3-19.1 77.6-19.1 36.3 0 46.7 19.1 78.2 18.5 31.9-.5 52.8-23.5 72.8-52.1 23-33.1 32.5-65.1 33-66.7-.6-.2-64.1-24.6-64.4-97.3zM281.3 83.1c31.4-38.1 25.1-73.3 23.5-83.1-27.1 1.1-59.3 18.6-77.9 40.2-16.1 18.5-30.5 52.2-25.7 82.9 30.8 2.4 59.4-11.2 80.1-30z"/></svg>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em]">Vincular Apple</span>
            </button>
          </div>
          <p className="text-xs text-center font-medium text-slate-400 uppercase tracking-[0.16em] px-2">Vincule um provedor para entrar mais rapido na proxima sessao.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Moon size={15} className="text-slate-500 dark:text-slate-300" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-[0.16em]">Tema</h4>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => handleThemeChange('light')} className={`flex-1 py-4 rounded-3xl flex flex-col items-center gap-1.5 border-2 transition-all ${theme === 'light' ? 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-800 dark:text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:border-slate-200'}`}>
              <Sun size={22} className={`transition-all duration-700 ${theme === 'light' && isAnimatingTheme ? 'rotate-[360deg] scale-110' : ''}`} />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Claro</span>
            </button>
            <button onClick={() => handleThemeChange('dark')} className={`flex-1 py-4 rounded-3xl flex flex-col items-center gap-1.5 border-2 transition-all ${theme === 'dark' ? 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-800 dark:text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:border-slate-200'}`}>
              <Moon size={22} className={`transition-all duration-700 ${theme === 'dark' && isAnimatingTheme ? '-rotate-12 scale-110' : ''}`} />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Escuro</span>
            </button>
          </div>
        </div>

        <button onClick={onLogout} className="w-full py-5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 rounded-3xl font-semibold text-sm uppercase tracking-[0.16em] flex items-center justify-center gap-3 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600">
          <LogOut size={18} /> Sair
        </button>
      </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 space-y-3">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-2 dark:border-slate-700">
            <Zap size={14} className="text-slate-500 dark:text-slate-300" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-[0.16em]">Integracoes</h4>
          </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Key size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Chave de integração</h5>
              <p className="text-sm text-slate-400 font-medium mt-0.5">Use para enviar eventos operacionais via webhook</p>
              {integrationKeyConfigured && integrationKeyPrefix && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    {integrationKeyPrefix}••••••••••••••••••••••••
                  </code>
                  {integrationKeyCreatedAt && (
                    <span className="text-xs text-slate-400">desde {new Date(integrationKeyCreatedAt).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {integrationKeyMetaError && (
            <div className="space-y-2">
              <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">{integrationKeyMetaError}</p>
              {integrationKeyMetaDiagnostic && (
                <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 dark:bg-amber-500/10 space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">{integrationKeyMetaDiagnostic.title}</p>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-100">{integrationKeyMetaDiagnostic.message}</p>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Proximo passo: {integrationKeyMetaDiagnostic.suggestion}</p>
                </div>
              )}
            </div>
          )}

          {integrationKeyGenerated && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2 dark:border-amber-700 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-[0.16em]">
                Guarde agora — esta chave nao sera exibida novamente
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-amber-800 dark:text-amber-300 break-all flex-1">{integrationKeyGenerated}</code>
                <button
                  onClick={handleCopyKey}
                  aria-label="Copiar chave de integracao"
                  className="shrink-0 p-1.5 rounded-lg bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-200 transition-colors"
                >
                  {integrationKeyCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}

          {integrationKeyError && (
            <div className="space-y-2">
              <p className="text-xs text-rose-500 font-medium">{integrationKeyError}</p>
              {integrationKeyDiagnostic && (
                <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 dark:bg-rose-500/10 space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">{integrationKeyDiagnostic.title}</p>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-100">{integrationKeyDiagnostic.message}</p>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Próximo passo: {integrationKeyDiagnostic.suggestion}</p>
                </div>
              )}
            </div>
          )}

          {clipboardDiagnostic && (
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 dark:bg-amber-500/10 space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">{clipboardDiagnostic.title}</p>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-100">{clipboardDiagnostic.message}</p>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Proximo passo: {clipboardDiagnostic.suggestion}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => void handleGenerateIntegrationKey()}
              disabled={integrationKeyLoading}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              {integrationKeyLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {integrationKeyConfigured ? 'Rotacionar chave' : 'Gerar chave'}
            </button>
            {integrationKeyConfigured && (
              <button
                onClick={() => void handleRevokeIntegrationKey()}
                disabled={integrationKeyLoading}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-900/20 dark:text-rose-400 disabled:opacity-50"
              >
                <Trash2 size={11} />
                Revogar chave
              </button>
            )}
          </div>

          <details className="group">
            <summary className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400 cursor-pointer hover:text-slate-700 transition-colors list-none flex items-center gap-1">
              <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
              Como usar — guia rapido
            </summary>
            <div className="mt-3 space-y-3">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-[0.16em]">1 — Gere a chave acima</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Clique em "Gerar chave". Copie e guarde em local seguro - so aparece uma vez.</p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-[0.16em]">2 — No n8n: nó HTTP Request</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Metodo: POST · URL: seu-backend/api/integrations/external/events</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Header: <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">X-Integration-Key: flw_sua_chave</code></p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-[0.16em]">3 — Categorias aceitas</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(['Pessoal', 'Trabalho / Consultório', 'Negócio', 'Investimento'] as const).map(cat => (
                    <span key={cat} className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{cat}</span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-[0.16em]">4 — Tipos de evento</p>
                <div className="space-y-1">
                  {[
                    { type: 'payment_received', label: 'Receita registrada' },
                    { type: 'expense_recorded', label: 'Despesa registrada' },
                    { type: 'alert_triggered', label: 'Alerta criado' },
                    { type: 'receivable_reminder_created', label: 'Lembrete de cobrança' },
                    { type: 'receivable_reminder_cleared', label: 'Cobrança quitada' },
                  ].map(({ type, label }) => (
                    <div key={type} className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded text-slate-600 dark:text-slate-300 shrink-0">{type}</code>
                      <span className="text-xs text-slate-400">-&gt; {label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-600 uppercase tracking-[0.16em]">Payload minimo (payment_received)</p>
                  <button
                    onClick={handleCopyPayload}
                    aria-label="Copiar payload de integracao"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors text-sm font-semibold"
                  >
                    {integrationPayloadCopied ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                    {integrationPayloadCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="text-xs font-mono overflow-x-auto text-slate-600 dark:text-slate-300 leading-relaxed">{`{
  "eventType": "payment_received",
  "workspaceId": "SEU_WORKSPACE_ID",
  "externalEventId": "ID_UNICO",
  "sourceSystem": "meu-sistema",
  "occurredAt": "2026-05-04T10:00:00Z",
  "payload": {
    "externalCustomerId": "cli-1",
    "externalReceivableId": "rec-1",
    "amount": 350.00,
    "currency": "BRL",
    "category": "Trabalho / Consultório",
    "description": "Consulta - Maria"
  }
}`}</pre>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 uppercase tracking-[0.16em]">Testar via curl</p>
                    {!integrationKeyRef.current && !integrationKeyGenerated && (
                      <p className="text-xs text-amber-500 mt-0.5">Gere a chave acima para copiar com valor real</p>
                    )}
                  </div>
                  <button
                    onClick={handleCopyCurl}
                    aria-label="Copiar curl de integracao"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors text-sm font-semibold"
                  >
                    {integrationCurlCopied ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                    {integrationCurlCopied ? 'Copiado!' : 'Copiar curl'}
                  </button>
                </div>
                <pre className="text-xs font-mono overflow-x-auto text-slate-500 dark:text-slate-400 leading-relaxed">{`curl -X POST https://SEU_BACKEND.vercel.app/api/integrations/external/events \
  -H "Content-Type: application/json" \
  -H "X-Integration-Key: flw_sua_chave"`}</pre>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 space-y-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-[0.16em] border-b border-slate-50 pb-2 dark:border-slate-700">Suporte operacional</h4>
        <div className="grid grid-cols-1 gap-2.5">
          <button
            onClick={() => setShowAiSupport(true)}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 flex items-center gap-3 group hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition-all text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 shadow-lg dark:bg-slate-800 dark:text-slate-300"><BrainCircuit size={18} /></div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-[0.12em]">Guia com IA</h5>
              <p className="text-xs text-slate-400 font-medium">Tire dúvidas sobre caixa, integrações ou fluxo do produto</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
          <a
            href="https://wa.me/5551995730813?text=Ola!%20Preciso%20de%20ajuda%20com%20o%20Flow%20Finance."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 flex items-center gap-3 group hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition-all text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 shadow-lg dark:bg-slate-800 dark:text-slate-300"><Phone size={18} /></div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Suporte humano</h5>
              <p className="text-xs text-slate-400 font-medium">Fale com a equipe pelo WhatsApp</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </a>

          <button
            onClick={() => setLegalModalType('privacy_terms')}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 flex items-center gap-3 group hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition-all text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-600 shadow-lg dark:bg-slate-700 dark:text-slate-300"><Scale size={18} /></div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Termos e privacidade</h5>
              <p className="text-xs text-slate-400 font-medium">Consulte as politicas de uso e protecao de dados</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        </div>
      </div>

      <div className="flex justify-center pt-4 pb-2">
        <button
          onClick={() => setLegalModalType('copyright')}
          className="group flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
        >
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <Copyright size={12} className="text-slate-500 dark:text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.16em] group-hover:text-slate-700 transition-colors">Flow Finance 2026</span>
          </div>
          <p className="text-xs font-medium text-slate-400">Todos os direitos reservados</p>
        </button>
      </div>

      {legalModalType && (
        <LegalModal
          type={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
      )}

      {showAiSupport && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 text-slate-600 rounded-xl shadow-md dark:bg-slate-800 dark:text-slate-300"><BrainCircuit size={16} /></div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Guia com IA</h3>
              </div>
              <button onClick={() => { setShowAiSupport(false); setSupportResponse(''); setSupportQuery(''); setSupportDiagnostic(null); }} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {supportDiagnostic && (
                <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em]">Diagnóstico do guia com IA</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed">{supportDiagnostic.message}</p>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] opacity-90">
                    Próximo passo: {supportDiagnostic.suggestion}
                  </p>
                </div>
              )}
              {!supportResponse && !isGeneratingSupport && (
                <div className="text-center py-10 space-y-4">
                  <p className="text-sm text-slate-400 font-semibold uppercase tracking-[0.16em]">O que voce precisa resolver?</p>
                  <div className="grid grid-cols-1 gap-2 px-4">
                    {['Ajuda com fluxo de caixa', 'Como devo usar meu saldo agora?', 'Como exportar meus dados?'].map((question) => (
                      <button key={question} onClick={() => { setSupportQuery(question); void handleAiSupport(question); }} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all text-left border border-transparent hover:border-slate-200">{question}</button>
                    ))}
                  </div>
                </div>
              )}
              {isGeneratingSupport && (
                <div className="py-20 flex flex-col items-center gap-4 text-center">
                  <Loader2 size={32} className="animate-spin text-slate-600" />
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-600 animate-pulse">Processando...</p>
                </div>
              )}
              {supportResponse && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{supportResponse}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-2">
              <input
                type="text"
                value={supportQuery}
                onChange={(event) => setSupportQuery(event.target.value)}
                onKeyPress={(event) => event.key === 'Enter' && void handleAiSupport(event.currentTarget.value)}
                placeholder="Digite sua pergunta sobre caixa, integrações ou planos..."
                className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-medium text-sm text-slate-700 dark:text-white"
              />
              <button
                type="button"
                aria-label="Enviar pergunta ao guia IA"
                onClick={() => void handleAiSupport(supportQuery)}
                className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-all dark:bg-slate-100 dark:text-slate-900"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showNameModal && (
        <NamePromptModal
          onSave={(newName) => { onUpdateProfile(newName); setShowNameModal(false); }}
        />
      )}
    </div>
  );
};

export default Settings;
