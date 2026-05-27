import { test, type Page } from '@playwright/test';

type E2EBootstrapOptions = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  token?: string;
};

type DemoBootstrapOptions = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  workspaceId?: string;
  workspaceName?: string;
  tenantId?: string;
  tenantName?: string;
  token?: string;
};

export function buildE2EAuthUrl(options: E2EBootstrapOptions = {}): string {
  const params = new URLSearchParams({
    e2eAuth: '1',
    bench: '1',
    userId: options.userId || 'e2e-user',
    userEmail: options.userEmail || 'e2e@flowfinance.test',
    userName: options.userName || 'E2E Flow',
    token: options.token || 'e2e-token',
  });

  return `/?${params.toString()}`;
}

export async function gotoAuthedApp(page: Page, options: E2EBootstrapOptions = {}): Promise<void> {
  await page.addInitScript((bootstrap) => {
    window.localStorage.setItem('flow_e2e_auth', '1');
    window.localStorage.setItem('flow_e2e_user_id', bootstrap.userId);
    window.localStorage.setItem('flow_e2e_user_email', bootstrap.userEmail);
    window.localStorage.setItem('flow_e2e_user_name', bootstrap.userName);
    window.localStorage.setItem('flow_e2e_auth_token', bootstrap.token);
    window.localStorage.setItem('active_workspace_id', 'ws-e2e-' + bootstrap.userId);
  }, {
    userId: options.userId || 'e2e-user',
    userEmail: options.userEmail || 'e2e@flowfinance.test',
    userName: options.userName || 'E2E Flow',
    token: options.token || 'e2e-token',
  });

  try {
    await page.goto(buildE2EAuthUrl(options), { waitUntil: 'domcontentloaded' });
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('ERR_CONNECTION_TIMED_OUT') || msg.includes('ERR_EMPTY_RESPONSE')) {
      test.skip(true, 'Dev server unavailable at localhost:4173 - skipping E2E test');
    } else {
      throw err;
    }
  }

  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

export async function gotoDemoApp(page: Page, options: DemoBootstrapOptions = {}): Promise<void> {
  await page.addInitScript((bootstrap) => {
    window.localStorage.setItem('flow_demo_data', '1');
    window.localStorage.setItem('flow_demo_user_id', bootstrap.userId);
    window.localStorage.setItem('flow_demo_user_email', bootstrap.userEmail);
    window.localStorage.setItem('flow_demo_user_name', bootstrap.userName);
    window.localStorage.setItem('flow_demo_workspace_id', bootstrap.workspaceId);
    window.localStorage.setItem('flow_demo_workspace_name', bootstrap.workspaceName);
    window.localStorage.setItem('flow_demo_tenant_id', bootstrap.tenantId);
    window.localStorage.setItem('flow_demo_tenant_name', bootstrap.tenantName);
    window.localStorage.setItem('flow_demo_auth_token', bootstrap.token);
  }, {
    userId: options.userId || 'demo-user',
    userEmail: options.userEmail || 'demo@flowfinance.local',
    userName: options.userName || 'Marina Demo',
    workspaceId: options.workspaceId || 'ws-demo-flow-finance',
    workspaceName: options.workspaceName || 'Atelie Aurora',
    tenantId: options.tenantId || 'tenant-demo-flow-finance',
    tenantName: options.tenantName || 'Flow Finance Demo',
    token: options.token || 'demo-token',
  });

  try {
    await page.goto('/?demoData=1', { waitUntil: 'domcontentloaded' });
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('ERR_CONNECTION_TIMED_OUT') || msg.includes('ERR_EMPTY_RESPONSE')) {
      test.skip(true, 'Dev server unavailable at localhost:4173 - skipping E2E test');
    } else {
      throw err;
    }
  }

  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}
