import { describe, expect, it } from 'vitest';

import {
  estimateAICost,
  summarizeWorkspaceAICost,
} from '../../src/services/ai/aiCostMonitor';

describe('aiCostMonitor', () => {
  it('estimates per-response cost from provider token split', () => {
    const estimate = estimateAICost({
      workspaceId: 'workspace-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      tokensUsed: 2_000_000,
    });

    expect(estimate.workspaceId).toBe('workspace-1');
    expect(estimate.totalTokens).toBe(2_000_000);
    expect(estimate.estimatedCostUsd).toBe(0.00075);
    expect(estimate.evidence).toBe('provider_usage_tokens');
  });

  it('summarizes estimated cost without mixing workspaces', () => {
    const summary = summarizeWorkspaceAICost([
      {
        workspaceId: 'workspace-1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 1_000_000,
        outputTokens: 0,
      },
      {
        workspaceId: 'workspace-2',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      },
      {
        workspaceId: 'workspace-1',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inputTokens: 0,
        outputTokens: 1_000_000,
      },
    ], 'workspace-1');

    expect(summary.workspaceId).toBe('workspace-1');
    expect(summary.requestCount).toBe(2);
    expect(summary.estimatedCostUsd).toBe(0.00315);
    expect(summary.byProvider.openai.requestCount).toBe(1);
    expect(summary.byProvider.gemini.requestCount).toBe(1);
  });

  it('does not invent pricing for providers without a known table', () => {
    const estimate = estimateAICost({
      workspaceId: 'workspace-3',
      provider: 'claude',
      model: 'claude-test',
      inputTokens: 1000,
      outputTokens: 1000,
    });

    expect(estimate.estimatedCostUsd).toBe(0);
    expect(estimate.evidence).toBe('pricing_unknown');
  });
});
