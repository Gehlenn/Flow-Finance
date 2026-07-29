import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('../../src/config/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: vi.fn().mockReturnValue(false),
  saveJsonState: vi.fn().mockResolvedValue(undefined),
  saveWorkspaceSaasState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/admin/workspaceStore', () => ({
  getWorkspace: vi.fn(),
  getWorkspaceEntitlements: vi.fn(),
}));
import {
  PLAN_FEATURES,
  PLAN_IDS,
  PLAN_LIMITS,
  PLAN_USAGE_LIMITS,
  getPlanEntitlements,
  type PlanId,
} from '../../shared/saasCatalog';
import { getPlanFeatures, getPlanLimit, getPlanLimits } from '../../shared/policyEngine';
import { buildEntitlements } from '../../src/services/admin/workspaceStoreHelpers';
import type { WorkspacePlan } from '../../src/types';
import { PLAN_LIMITS as storePlanLimits } from '../../src/utils/saasStore';

describe('SaaS catalog parity', () => {
  it('uses one backend plan type across billing and SaaS modules', () => {
    expectTypeOf<WorkspacePlan>().toEqualTypeOf<PlanId>();
  });

  it.each(PLAN_IDS)('keeps %s limits aligned across policy and storage', (plan) => {
    const limits = PLAN_LIMITS[plan];

    expect(getPlanLimits(plan)).toEqual(limits);
    expect(storePlanLimits[plan]).toEqual(PLAN_USAGE_LIMITS[plan]);
    expect(getPlanLimit(plan, 'transactions')).toBe(limits.transactionsPerMonth);
    expect(getPlanLimit(plan, 'aiQueries')).toBe(limits.aiQueriesPerMonth);
    expect(getPlanLimit(plan, 'bankConnections')).toBe(limits.bankConnections);
  });

  it.each(PLAN_IDS)('returns the established feature set for %s', (plan) => {
    expect(getPlanEntitlements(plan).features).toEqual(PLAN_FEATURES[plan]);
    expect(getPlanFeatures(plan)).toEqual(PLAN_FEATURES[plan]);
    expect(buildEntitlements(plan)).toEqual(getPlanEntitlements(plan));
  });

  it('keeps the policy feature lookup fallback for legacy invalid plans', () => {
    expect(getPlanFeatures('legacy')).toEqual([]);
  });
});
