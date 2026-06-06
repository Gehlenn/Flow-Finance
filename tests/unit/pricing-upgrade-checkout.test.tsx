import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkoutMocks = vi.hoisted(() => ({
  createWorkspaceCheckoutSession: vi.fn(),
  ensureActiveWorkspace: vi.fn(),
  getCurrentWorkspaceIdentity: vi.fn(),
  trackProductEvent: vi.fn(),
  locationAssign: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../../src/saas', async () => {
  const actual = await vi.importActual<typeof import('../../src/saas')>('../../src/saas');
  return {
    ...actual,
    createWorkspaceCheckoutSession: checkoutMocks.createWorkspaceCheckoutSession,
  };
});

vi.mock('../../src/services/workspaceSession', () => ({
  ensureActiveWorkspace: checkoutMocks.ensureActiveWorkspace,
  getCurrentWorkspaceIdentity: checkoutMocks.getCurrentWorkspaceIdentity,
}));

vi.mock('../../src/app/productAnalytics', () => ({
  trackProductEvent: checkoutMocks.trackProductEvent,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: checkoutMocks.logWarn,
}));

import Pricing from '../../pages/Pricing';
import UpgradePromptCard from '../../components/UpgradePromptCard';

describe('checkout entrypoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutMocks.ensureActiveWorkspace.mockResolvedValue({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Workspace 1',
      role: 'owner',
      plan: 'free',
    });
    checkoutMocks.getCurrentWorkspaceIdentity.mockReturnValue({
      userId: 'user-1',
      name: 'Flow User',
      email: 'user@test.dev',
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        href: 'http://localhost:3000/pricing',
        assign: checkoutMocks.locationAssign,
      },
    });
  });

  it('starts pricing checkout with source metadata and tracks only redirect on the page', async () => {
    checkoutMocks.createWorkspaceCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://billing.example/checkout',
    });

    render(<Pricing />);

    const button = await screen.findByRole('button', { name: /Assinar Pro/i });
    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(checkoutMocks.createWorkspaceCheckoutSession).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        returnUrl: 'http://localhost:3000/pricing?billing=return',
        source: 'pricing',
      });
      expect(checkoutMocks.trackProductEvent).toHaveBeenCalledTimes(1);
      expect(checkoutMocks.trackProductEvent).toHaveBeenCalledWith('billing_checkout_redirected', {
        source: 'pricing',
        plan: 'pro',
      });
      expect(checkoutMocks.locationAssign).toHaveBeenCalledWith('https://billing.example/checkout');
    });
  });

  it('tracks pricing checkout failure only when Stripe responds without a redirect URL', async () => {
    checkoutMocks.createWorkspaceCheckoutSession.mockResolvedValue({
      id: 'cs_test_2',
      url: null,
    });

    render(<Pricing />);

    const button = await screen.findByRole('button', { name: /Assinar Pro/i });
    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(checkoutMocks.trackProductEvent).toHaveBeenCalledWith('billing_checkout_failed', {
        source: 'pricing',
        plan: 'pro',
      });
      expect(screen.getByText(/Nao foi possivel abrir o checkout do Stripe agora/i)).toBeTruthy();
    });
  });

  it('passes upgrade prompt source metadata to the central billing client', async () => {
    checkoutMocks.createWorkspaceCheckoutSession.mockResolvedValue({
      id: 'cs_test_3',
      url: 'https://billing.example/upgrade',
    });

    render(
      <UpgradePromptCard
        title="Mais analise"
        description="Libere o Pro."
        bullets={['Analise historica']}
        workspaceId="ws-card"
        showUpgradeAction
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Assinar Pro/i }));

    await waitFor(() => {
      expect(checkoutMocks.createWorkspaceCheckoutSession).toHaveBeenCalledWith({
        workspaceId: 'ws-card',
        returnUrl: 'http://localhost:3000/?billing=return',
        source: 'upgrade_prompt',
      });
      expect(checkoutMocks.trackProductEvent).toHaveBeenCalledWith('billing_checkout_redirected', {
        source: 'upgrade_prompt',
        plan: 'pro',
      });
      expect(checkoutMocks.locationAssign).toHaveBeenCalledWith('https://billing.example/upgrade');
    });
  });
});
