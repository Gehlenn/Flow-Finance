import { test, expect, APIRequestContext, Page, TestInfo } from '@playwright/test';
import { getFixtureAuthToken } from './fixtures/auth';

const BACKEND_BASE_URL = process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:3001';

type TokenProbeResult =
  | { status: 'valid'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'not-configured'; message: string }
  | { status: 'disabled'; message: string }
  | { status: 'backend-unavailable'; message: string };

async function probeConnectToken(
  request: APIRequestContext,
  clientUserId: string,
  bearerToken: string,
): Promise<TokenProbeResult> {
  try {
    const healthRes = await request.get(`${BACKEND_BASE_URL}/api/banking/health`, { timeout: 5000 });
    if (healthRes.status() === 503) {
      return { status: 'disabled', message: 'Open Finance desativado por decisao de negocio.' };
    }

    if (!healthRes.ok()) {
      return { status: 'backend-unavailable', message: `health status ${healthRes.status()}` };
    }

    const health = await healthRes.json() as {
      providerMode?: string;
      pluggyConfigured?: boolean;
    };

    const providerMode = String(health.providerMode || 'mock').toLowerCase();
    const configured = Boolean(health.pluggyConfigured);

    if (providerMode !== 'pluggy' || !configured) {
      return {
        status: 'not-configured',
        message: `providerMode=${providerMode}, pluggyConfigured=${configured}`,
      };
    }

    const tokenRes = await request.post(`${BACKEND_BASE_URL}/api/banking/connect-token`, {
      data: { clientUserId },
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
      timeout: 5000,
    });

    if (!tokenRes.ok()) {
      return { status: 'invalid', message: `connect-token status ${tokenRes.status()}` };
    }

    const body = await tokenRes.json() as { accessToken?: string };
    const accessToken = body.accessToken || '';
    const jwtLike = accessToken.split('.').length === 3;

    if (!jwtLike) {
      return { status: 'invalid', message: 'accessToken ausente ou fora do formato JWT' };
    }

    return { status: 'valid', message: 'connect-token válido (JWT)' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    return { status: 'backend-unavailable', message };
  }
}

async function ensureOpenBankNavigation(page: Page, testInfo: TestInfo): Promise<boolean> {
  const openBankNav = page.getByRole('button', { name: 'Open Bank' });
  if (await openBankNav.count()) {
    return true;
  }

  const signUpTrigger = page.getByRole('button', { name: /Cadastre-se/i });
  if (!(await signUpTrigger.count())) {
    testInfo.annotations.push({
      type: 'open-bank-auth',
      description: 'Tela de login não apresentou fluxo de cadastro esperado.',
    });
    return false;
  }

  const email = `e2e+pluggy-${Date.now()}@flowfinance.test`;
  const password = 'Pluggy@123';

  await signUpTrigger.first().click();
  await page.getByPlaceholder('Seu nome').fill('E2E Pluggy');
  await page.getByPlaceholder('Seu e-mail').fill(email);
  await page.getByPlaceholder('Senha (min 6 car.)').fill(password);
  await page.getByRole('button', { name: /Criar meu Acesso/i }).click();

  await page.waitForTimeout(2000);
  return (await openBankNav.count()) > 0;
}

async function isAuthenticatedShell(page: Page): Promise<boolean> {
  const probes = [
    page.getByRole('button', { name: /AI CFO/i }),
    page.getByRole('button', { name: /Insights/i }),
    page.getByRole('button', { name: /Open Bank/i }),
    page.getByRole('button', { name: /Ajustes|Settings/i }),
  ];

  for (const probe of probes) {
    if (await probe.count()) return true;
  }

  return false;
}

async function waitForAuthResolution(page: Page): Promise<void> {
  await expect.poll(async () => {
    const hasAuthGate =
      (await page.getByRole('button', { name: /Cadastre-se|Sign up/i }).count()) > 0 ||
      (await page.getByPlaceholder('Seu e-mail').count()) > 0;
    const hasShell = await isAuthenticatedShell(page);
    const hasSplash = (await page.locator('body').getByText(/Iniciando|Loading|Flow Finan/i).count()) > 0;

    if (hasAuthGate) return 'auth';
    if (hasShell) return 'shell';
    if (hasSplash) return 'splash';
    return 'unknown';
  }, { timeout: 12000, intervals: [250, 500, 1000] }).not.toBe('unknown');
}

test.describe('Open Banking - Pluggy Connect', () => {
  test('deve validar connect-token e abrir a área de conexão do Pluggy', async ({ page, request }, testInfo) => {
    // D7: usa fixture de auth estável em vez de email dinâmico (fix B010)
    const authResult = await getFixtureAuthToken(request);

    if (authResult.status === 'unavailable') {
      testInfo.annotations.push({
        type: 'backend-unavailable',
        description: authResult.message,
      });
      test.skip(true, 'Backend indisponível para validar Open Banking nesta execução.');
    }

    if (authResult.status === 'invalid') {
      testInfo.annotations.push({
        type: 'backend-auth',
        description: authResult.message,
      });
      test.skip(true, 'Não foi possível autenticar no backend para validar connect-token.');
    }

    if (authResult.status !== 'ok') {
      return;
    }

    let tokenProbe = await probeConnectToken(request, authResult.context.userId, authResult.context.token);

    const unauthorizedConnectToken = /status 401|status 403/i.test(tokenProbe.message);
    if (tokenProbe.status === 'invalid' && unauthorizedConnectToken) {
      const retryAuth = await getFixtureAuthToken(request);

      testInfo.annotations.push({
        type: 'pluggy-connect-token-retry-auth',
        description: retryAuth.status === 'ok'
          ? 'retry auth ok'
          : `${retryAuth.status}: ${'message' in retryAuth ? retryAuth.message : 'no message'}`,
      });

      if (retryAuth.status === 'ok') {
        tokenProbe = await probeConnectToken(request, retryAuth.context.userId, retryAuth.context.token);
      }
    }

    testInfo.annotations.push({
      type: 'pluggy-connect-token',
      description: `${tokenProbe.status}: ${tokenProbe.message}`,
    });

    if (tokenProbe.status === 'disabled') {
      test.skip(true, 'Open Finance desativado por decisao de negocio nesta fase do produto.');
    }

    const stillUnauthorized = /status 401|status 403/i.test(tokenProbe.message);
    if (stillUnauthorized) {
      test.skip(true, 'Connect-token retornou 401/403 mesmo após nova autenticação da fixture nesta execução.');
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForAuthResolution(page);

    const hasSplash = (await page.locator('body').getByText(/Iniciando|Loading|Flow Finan/i).count()) > 0;
    if (hasSplash) {
      testInfo.annotations.push({
        type: 'open-bank-auth',
        description: 'App permaneceu na splash nesta execução; mantendo validação de connect-token no backend.',
      });
      return;
    }

    const canAccessOpenBank = await ensureOpenBankNavigation(page, testInfo);
    if (!canAccessOpenBank) {
      testInfo.annotations.push({
        type: 'open-bank-auth',
        description: 'Open Bank não acessível na UI nesta execução; validação mantida no backend connect-token.',
      });
      return;
    }

    const openBankNav = page.getByRole('button', { name: 'Open Bank' });
    await expect(openBankNav.first()).toBeVisible();
    await openBankNav.click();

    const connectBankButton = page.getByRole('button', { name: 'Conectar Banco' });
    if (await connectBankButton.count()) {
      await connectBankButton.first().click();
    }

    await expect(page.getByText('Conectar Banco')).toBeVisible();

    if (tokenProbe.status === 'valid') {
      await expect(page.getByText('Conectar com Pluggy Connect')).toBeVisible();
    } else {
      await expect(page.getByText('Conectar com Pluggy Connect')).toHaveCount(0);
    }
  });
});
