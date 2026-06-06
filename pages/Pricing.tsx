import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { MONETIZATION_PRICING } from '../src/app/monetizationPlan';
import { trackProductEvent } from '../src/app/productAnalytics';
import { buildBillingReturnUrl, createWorkspaceCheckoutSession } from '../src/saas';
import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../src/services/workspaceSession';
import { logWarn } from '../src/utils/logger';

const PRO_FEATURE_LIST = [
  'Consultor IA ilimitado para revisao semanal de caixa',
  'Multiplos workspaces para operacoes ou unidades separadas',
  'Historico de caixa, previsto vs realizado e risco recorrente',
];

const FREE_FEATURE_LIST = [
  'Dashboard de caixa, previsto e realizado',
  'Lancamentos, recebiveis e vencimentos essenciais',
  '20 consultas do Consultor IA por mes',
];

const Pricing: React.FC = () => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      try {
        const workspace = await ensureActiveWorkspace(getCurrentWorkspaceIdentity());
        if (!cancelled) {
          setWorkspaceId(workspace.workspaceId);
        }
      } catch (loadError) {
        logWarn('[Pricing] Failed to resolve active workspace', {
          error: loadError,
          fallback: 'pricing-workspace-load-failed',
        });
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpgrade = async () => {
    if (!workspaceId) {
      setError('Nao foi possivel identificar o workspace para abrir o checkout.');
      return;
    }

    setIsLoading(true);
    setError(null);
    let checkoutSessionUrl: string | null | undefined;
    try {
      const session = await createWorkspaceCheckoutSession({
        workspaceId,
        returnUrl: buildBillingReturnUrl({ pricing: true }),
        source: 'pricing',
      });
      checkoutSessionUrl = session.url;

      if (!checkoutSessionUrl) {
        throw new Error('Stripe checkout session returned no URL');
      }

      trackProductEvent('billing_checkout_redirected', {
        source: 'pricing',
        plan: 'pro',
      });
      window.location.assign(checkoutSessionUrl);
    } catch (checkoutError) {
      if (checkoutSessionUrl !== undefined) {
        trackProductEvent('billing_checkout_failed', {
          source: 'pricing',
          plan: 'pro',
        });
      }
      logWarn('[Pricing] Failed to open Stripe checkout', {
        error: checkoutError,
        workspaceId,
        fallback: 'pricing-checkout-failed',
      });
      setError('Nao foi possivel abrir o checkout do Stripe agora.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Planos</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Flow Finance Pro</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-300">
            O Free valida o fluxo de caixa operacional. O Pro aprofunda revisao semanal, historico, risco e operacoes separadas sem tirar o core do MVP.
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Sparkles size={18} />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Free</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">R$ 0</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Caixa operacional</p>
          <ul className="mt-6 space-y-3">
            {FREE_FEATURE_LIST.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check size={16} className="text-slate-400" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Comecar gratis
          </button>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Pro</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                R$ {MONETIZATION_PRICING.proMonthlyBRL.toFixed(2).replace('.', ',')}/mes
              </h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Anual R$ {MONETIZATION_PRICING.proAnnualBRL.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Revisao e historico</p>
          <ul className="mt-6 space-y-3">
            {PRO_FEATURE_LIST.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check size={16} className="text-slate-500" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void handleUpgrade()}
            disabled={isLoading || !workspaceId}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Assinar Pro
            </button>
          {error && (
            <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>
          )}
        </article>
      </section>
    </div>
  );
};

export default Pricing;
