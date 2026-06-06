type BillingReturnTab = 'dashboard' | 'settings' | 'workspaceadmin';

type BillingReturnUrlOptions = {
  tab?: BillingReturnTab;
  pricing?: boolean;
};

export function buildBillingReturnUrl(options: BillingReturnUrlOptions = {}): string {
  if (typeof window === 'undefined') {
    return options.pricing
      ? 'http://localhost:3000/pricing?billing=return'
      : 'http://localhost:3000/?billing=return';
  }

  const url = new URL(window.location.origin);
  url.pathname = options.pricing ? '/pricing' : '/';
  url.searchParams.set('billing', 'return');

  if (options.tab && options.tab !== 'dashboard' && !options.pricing) {
    url.searchParams.set('tab', options.tab);
  }

  return url.toString();
}
