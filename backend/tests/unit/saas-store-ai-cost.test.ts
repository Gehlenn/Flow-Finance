import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  loadJsonState: vi.fn().mockResolvedValue(null),
  loadWorkspaceSaasState: vi.fn().mockResolvedValue(null),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
}));

import {
  enrichWorkspaceUsageEventsWithAICost,
  getWorkspaceAICostSummaryFromEvents,
  getWorkspaceUsageEvents,
  recordWorkspaceUsage,
  resetSaasStoreForTests,
} from '../../src/utils/saasStore';

describe('saasStore AI cost metering', () => {
  beforeEach(() => {
    process.env.DISABLE_LEGACY_STATE_BLOBS = 'true';
    resetSaasStoreForTests();
  });

  it('derives per-workspace AI cost from usage-event token metadata', async () => {
    await recordWorkspaceUsage('workspace-ai', {
      resource: 'aiQueries',
      amount: 1,
      userId: 'user-ai',
      at: '2026-06-01T10:00:00.000Z',
      metadata: {
        aiUsage: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          tokensUsed: 2_000_000,
        },
      },
    });

    await recordWorkspaceUsage('workspace-ai', {
      resource: 'transactions',
      amount: 1,
      userId: 'user-ai',
      at: '2026-06-01T11:00:00.000Z',
    });

    const events = getWorkspaceUsageEvents('workspace-ai');
    const summary = getWorkspaceAICostSummaryFromEvents('workspace-ai', events);
    const enrichedEvents = enrichWorkspaceUsageEventsWithAICost('workspace-ai', events);
    const aiEvent = enrichedEvents.find((event) => event.resource === 'aiQueries');

    expect(summary.workspaceId).toBe('workspace-ai');
    expect(summary.sampleCount).toBe(1);
    expect(summary.totalTokens).toBe(2_000_000);
    expect(summary.estimatedCostUsd).toBe(0.00075);
    expect(summary.evidence).toBe('estimated_from_tokens');
    expect(summary.basis).toBe('estimated_from_tokens');
    expect(summary.disclaimer).toContain('not a real provider invoice');
    expect(aiEvent?.aiCost).toBeDefined();
    expect(aiEvent?.aiCost).toMatchObject({
      basis: 'estimated_from_tokens',
      pricingEvidence: 'provider_usage_tokens',
      estimatedCostUsd: 0.00075,
      totalTokens: 2_000_000,
    });
  });

  it('ignores usage events without AI metadata', async () => {
    await recordWorkspaceUsage('workspace-non-ai', {
      resource: 'transactions',
      amount: 3,
      userId: 'user-non-ai',
      at: '2026-06-02T10:00:00.000Z',
    });

    const events = getWorkspaceUsageEvents('workspace-non-ai');
    const summary = getWorkspaceAICostSummaryFromEvents('workspace-non-ai', events);
    const enrichedEvents = enrichWorkspaceUsageEventsWithAICost('workspace-non-ai', events);

    expect(summary.sampleCount).toBe(0);
    expect(summary.estimatedCostUsd).toBe(0);
    expect(enrichedEvents[0].aiCost).toBeUndefined();
  });
});
