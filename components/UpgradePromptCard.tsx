import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { buildBillingReturnUrl, createWorkspaceCheckoutSession } from '../src/saas';
import { ensureActiveWorkspace, getCurrentWorkspaceIdentity } from '../src/services/workspaceSession';
import { MONETIZATION_PRICING } from '../src/app/monetizationPlan';
import { trackProductEvent } from '../src/app/productAnalytics';
import { logWarn } from '../src/utils/logger';

interface UpgradePromptCardProps {
  title: string;
  description: string;
  bullets: string[];
  compact?: boolean;
  workspaceId?: string | null;
  showUpgradeAction?: boolean;
  ctaLabel?: string;
}

const UpgradePromptCard: React.FC<UpgradePromptCardProps> = ({
  title,
  description,
  bullets,
  compact = false,
  workspaceId = null,
  showUpgradeAction = false,
  ctaLabel = 'Assinar Pro',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthlyPriceLabel = useMemo(
    () => `R$ ${MONETIZATION_PRICING.proMonthlyBRL.toFixed(2).replace('.', ',')}/mes`,
    [],
  );

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    let checkoutSessionUrl: string | null | undefined;
    try {
      const resolvedWorkspaceId = workspaceId
        || (await ensureActiveWorkspace(getCurrentWorkspaceIdentity())).workspaceId;
      const session = await createWorkspaceCheckoutSession({
        workspaceId: resolvedWorkspaceId,
        returnUrl: buildBillingReturnUrl(),
        source: 'upgrade_prompt',
      });
      checkoutSessionUrl = session.url;

      if (!checkoutSessionUrl) {
        throw new Error('Stripe checkout session returned no URL');
      }

      trackProductEvent('billing_checkout_redirected', {
        source: 'upgrade_prompt',
        plan: 'pro',
      });
      window.location.assign(checkoutSessionUrl);
    } catch (checkoutError) {
      if (checkoutSessionUrl !== undefined) {
        trackProductEvent('billing_checkout_failed', {
          source: 'upgrade_prompt',
          plan: 'pro',
        });
      }
      logWarn('[UpgradePromptCard] Failed to open Stripe checkout', {
        error: checkoutError,
        workspaceId,
        fallback: 'upgrade-card-checkout-failed',
      });
      setError('Nao foi possivel abrir o checkout do Stripe agora.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-slate-800 p-2 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
          {compact ? <Sparkles size={14} /> : <TrendingUp size={16} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Plano Pro</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            • {bullet}
          </li>
        ))}
      </ul>

      {showUpgradeAction && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Checkout Stripe</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{monthlyPriceLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleUpgrade()}
              disabled={isLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {ctaLabel}
            </button>
          </div>
          {error && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default UpgradePromptCard;
