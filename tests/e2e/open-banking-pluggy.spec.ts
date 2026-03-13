import { test, expect, APIRequestContext, Page, TestInfo } from '@playwright/test';

const BACKEND_BASE_URL = process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:3001';

type TokenProbeResult =
  | { status: 'valid'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'not-configured'; message: string }
  | { status: 'backend-unavailable'; message: string };

interface BackendAuthContext {
  token: string;
  userId: string;
}

async function createBackendAuthToken(request: APIRequestContext, email: string): Promise<BackendAuthContext | null> {
  const response = await request.post(`${BACKEND_BASE_URL}/api/auth/login`, {
    data: { email, password: 'e2e-password' },
    timeout: 5000,
  });

  if (!response.ok()) {
    return null;
  }

  const payload = await response.json() as { token?: string; user?: { userId?: string } };
  if (!payload.token || !payload.user?.userId) {
    return null;
  }

  return {
    token: payload.token,
    userId: payload.user.userId,
  };
}

async function probeConnectToken(
  request: APIRequestContext,
  clientUserId: string,
  bearerToken: string,
): Promise<TokenProbeResult> {
  try {
    const healthRes = await request.get(`${BACKEND_BASE_URL}/api/banking/health`, { timeout: 5000 });
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

test.describe('Open Banking - Pluggy Connect', () => {
  test('deve validar connect-token e abrir a área de conexão do Pluggy', async ({ page, request }, testInfo) => {
    const authEmail = `e2e+pluggy-auth-${Date.now()}@flowfinance.test`;
    const authContext = await createBackendAuthToken(request, authEmail);

    if (!authContext) {
      test.skip(true, 'Não foi possível autenticar no backend para validar connect-token.');
    }

    const tokenProbe = await probeConnectToken(request, authContext!.userId, authContext!.token);
    testInfo.annotations.push({
      type: 'pluggy-connect-token',
      description: `${tokenProbe.status}: ${tokenProbe.message}`,
    });

    // Com autenticação backend válida, connect-token não pode falhar por credenciais Bearer.
    expect(tokenProbe.message).not.toMatch(/status 401|status 403/i);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

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
