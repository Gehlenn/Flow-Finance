import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import {
  MONETIZATION_PRICING,
  formatAnnualPriceBRL,
  getPackagingEvidenceBoundary,
  getPlanFeatureMessages,
  getPlanPackaging,
} from '../src/app/monetizationPlan';
import { trackProductEvent } from '../src/app/productAnalytics';
import { buildBillingReturnUrl, createWorkspaceCheckoutSession } from '../src/saas';
import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../src/services/workspaceSession';
import { logWarn } from '../src/utils/logger';

const Pricing: React.FC = () => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const freePlan = getPlanPackaging('free');
  const proPlan = getPlanPackaging('pro');
  const freeFeatures = getPlanFeatureMessages('free');
  const proFeatures = getPlanFeatureMessages('pro');

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
      setError('Nao foi possivel abrir o checkout agora.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Planos</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Free e Pro para controle de caixa
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-300">
            Free cobre lancamento manual, dashboard e revisao inicial. Pro adiciona historico, relatorios, IA consultiva mais forte e revisao semanal.
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Sparkles size={18} />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{freePlan.label}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{freePlan.priceLabel}</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{freePlan.shortPositioning}</p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-300">{freePlan.decisionJob}</p>
          <ul className="mt-6 space-y-3">
            {freeFeatures.map((feature) => (
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
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{proPlan.label}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {proPlan.priceLabel}
              </h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Referencia anual {formatAnnualPriceBRL(MONETIZATION_PRICING.proAnnualBRL)}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{proPlan.shortPositioning}</p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-300">{proPlan.decisionJob}</p>
          <ul className="mt-6 space-y-3">
            {proFeatures.map((feature) => (
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
      <p className="text-xs font-medium leading-relaxed text-slate-400 dark:text-slate-500">
        {getPackagingEvidenceBoundary()}
      </p>
    </div>
  );
};

export default Pricing;
