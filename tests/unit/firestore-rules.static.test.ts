import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

describe('firestore.rules multi-tenant coverage', () => {
  it('protects workspace SaaS collections', () => {
    expect(rules).toContain('match /saas_usage/{usageId}');
    expect(rules).toContain('match /billing_state/{stateId}');
    expect(rules).toContain('match /billing_hooks/{eventId}');
  });

  it('keeps workspace permission helpers in place', () => {
    expect(rules).toContain('function isTenantMember(tenantId)');
    expect(rules).toContain('function canManageWorkspace(workspaceId)');
    expect(rules).toContain('function canEditWorkspaceData(workspaceId)');
    expect(rules).toContain('function workspaceBelongsToTenant(workspaceId, tenantId)');
    expect(rules).toContain('function memberMatchesWorkspaceTenant(workspaceId)');
    expect(rules).toContain("workspaceRole(workspaceId) in ['owner', 'admin']");
    expect(rules).toContain("workspaceRole(workspaceId) in ['owner', 'admin', 'member']");
  });

  it('guards audit events by workspace scope', () => {
    expect(rules).toContain('match /audit_logs/{tenantId}/events/{eventId}');
    expect(rules).toContain('canManageWorkspace(resource.data.workspaceId)');
    expect(rules).toContain('workspaceBelongsToTenant(resource.data.workspaceId, tenantId)');
  });

  it('restricts tenant reads to tenant members', () => {
    expect(rules).toContain("match /tenants/{tenantId}");
    expect(rules).toContain('isTenantMember(tenantId)');
    expect(rules).toContain("match /tenant_members/{memberId}");
  });
});
