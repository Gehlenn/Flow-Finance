import { expect, test, type Page } from '@playwright/test';

const FIXED_NOW_ISO = '2026-05-26T12:00:00.000Z';
const FIXED_NOW_MS = Date.parse(FIXED_NOW_ISO);
const SCREENSHOT_THRESHOLD = 0.2;
const SCREENSHOT_MAX_DIFF_PIXEL_RATIO = 0.002;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const SURFACES = [
  { tab: 'dashboard', readySelector: 'text=Leitura rapida do caixa' },
  { tab: 'flow', readySelector: 'h2:has-text("Receitas")' },
  { tab: 'analytics', readySelector: 'text=Historico de receita' },
  { tab: 'cfo', readySelector: 'text=Consultor de caixa' },
  { tab: 'assistant', readySelector: 'text=Plano de acao' },
  { tab: 'goals', readySelector: 'text=Metas de caixa' },
  { tab: 'insights', readySelector: 'text=Sinais do caixa' },
] as const;

type Surface = (typeof SURFACES)[number];

test.use({
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  colorScheme: 'light',
  deviceScaleFactor: 1,
  serviceWorkers: 'block',
});

test.skip(
  ({ browserName, isMobile }) => process.platform !== 'win32' || browserName !== 'chromium' || isMobile,
  'The committed pixel baseline currently supports Chromium on Windows only.',
);

function buildDemoUrl(tab: Surface['tab']): string {
  const params = new URLSearchParams({
    demoData: '1',
    demoPlan: 'pro',
    demoUserId: 'visual-regression-user',
    demoUserEmail: 'visual@flow.dev',
    demoUserName: 'Visual Regression',
    demoWorkspaceId: 'ws-visual-regression',
    demoWorkspaceName: 'Atelie Aurora',
    demoTenantId: 'tenant-visual-regression',
    demoTenantName: 'Flow Finance Demo',
    demoToken: 'visual-regression-token',
    tab,
  });

  return `/?${params.toString()}`;
}

async function fulfillDemoApi(route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method().toUpperCase();
  const now = new Date(FIXED_NOW_MS).toISOString();

  const json = async (body: unknown) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: `${JSON.stringify(body)}\n`,
  });

  if (url.pathname === '/api/integrations/keys' && method === 'GET') {
    return json({
      configured: false,
      keyPrefix: null,
      createdAt: null,
    });
  }

  if (url.pathname === '/api/integrations/keys' && method === 'DELETE') {
    return json({ ok: true });
  }

  if (url.pathname === '/api/integrations/keys/generate' && method === 'POST') {
    return json({
      key: 'flw_demo_key_123456',
      keyPrefix: 'flw_',
      createdAt: now,
      warning: 'demo response',
    });
  }

  if (url.pathname === '/api/saas/usage' && method === 'GET') {
    return json({ usage: {} });
  }

  if (url.pathname === '/api/saas/plans' && method === 'GET') {
    return json({
      scope: 'workspace',
      workspaceId: 'ws-visual-regression',
      currentPlan: 'pro',
      mockBillingEnabled: false,
      stripeConfigured: false,
      stripePortalEnabled: false,
      hasBillingCustomer: false,
      billingProvider: 'none',
      manualPlanChangeAllowed: false,
      plans: [],
    });
  }

  if (url.pathname === '/api/saas/billing-hooks' && method === 'POST') {
    return json({ ok: true });
  }

  if (url.pathname === '/api/saas/stripe/checkout-session' && method === 'POST') {
    return json({ id: 'demo_checkout_session', url: null });
  }

  if (url.pathname === '/api/saas/stripe/portal-session' && method === 'POST') {
    return json({ url: '' });
  }

  if (url.pathname === '/api/ai/cfo' && method === 'POST') {
    return json({
      answer: 'Demo response: a leitura de caixa esta pronta para screenshots locais.',
    });
  }

  if (url.pathname === '/api/workspace' && method === 'GET') {
    return json({
      workspaces: [
        {
          workspaceId: 'ws-visual-regression',
          name: 'Atelie Aurora',
          tenantId: 'tenant-visual-regression',
          tenantName: 'Flow Finance Demo',
          plan: 'pro',
          role: 'owner',
          isDefault: true,
        },
      ],
    });
  }

  return json({});
}

async function installVisualBootstrap(page: Page) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url());

    if (
      requestUrl.host === 'localhost:3001'
      || requestUrl.host === '127.0.0.1:3001'
      || requestUrl.pathname.startsWith('/api/')
    ) {
      await fulfillDemoApi(route);
      return;
    }

    await route.continue();
  });

  await page.addInitScript((fixedNow) => {
    const RealDate = Date;

    class MockDate extends RealDate {
      constructor(...args: ConstructorParameters<DateConstructor>) {
        if (args.length === 0) {
          super(fixedNow);
          return;
        }

        super(...args);
      }

      static now() {
        return fixedNow;
      }

      static parse(value: string) {
        return RealDate.parse(value);
      }

      static UTC(...args: Parameters<DateConstructor['UTC']>) {
        return RealDate.UTC(...args);
      }
    }

    Object.setPrototypeOf(MockDate, RealDate);
    // @ts-expect-error runtime override inside browser context
    window.Date = MockDate;

    window.localStorage.setItem('flow_demo_data', '1');
    window.localStorage.setItem('flow_demo_plan', 'pro');
    window.localStorage.setItem('flow_demo_user_id', 'visual-regression-user');
    window.localStorage.setItem('flow_demo_user_email', 'visual@flow.dev');
    window.localStorage.setItem('flow_demo_user_name', 'Visual Regression');
    window.localStorage.setItem('flow_demo_workspace_id', 'ws-visual-regression');
    window.localStorage.setItem('flow_demo_workspace_name', 'Atelie Aurora');
    window.localStorage.setItem('flow_demo_tenant_id', 'tenant-visual-regression');
    window.localStorage.setItem('flow_demo_tenant_name', 'Flow Finance Demo');
    window.localStorage.setItem('flow_demo_auth_token', 'visual-regression-token');
  }, FIXED_NOW_MS);
}

async function stabilizePage(page: Page, readySelector: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    if ('fonts' in document) {
      await document.fonts.ready;
    }
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.waitForTimeout(700);
}

async function openSurface(page: Page, surface: Surface) {
  await installVisualBootstrap(page);
  await page.goto(buildDemoUrl(surface.tab), { waitUntil: 'domcontentloaded' });
  await stabilizePage(page, surface.readySelector);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    });

    for (const surface of SURFACES) {
      test(`${surface.tab} matches committed baseline`, async ({ page }) => {
        await openSurface(page, surface);

        await expect(page).toHaveScreenshot(`${surface.tab}-${viewport.name}.png`, {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          scale: 'css',
          threshold: SCREENSHOT_THRESHOLD,
          maxDiffPixelRatio: SCREENSHOT_MAX_DIFF_PIXEL_RATIO,
        });
      });
    }
  });
}
