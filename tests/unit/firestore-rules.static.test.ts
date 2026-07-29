import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const firebaseJsonPath = path.resolve(process.cwd(), 'firebase.json');
const vitestFirestoreConfigPath = path.resolve(process.cwd(), 'vitest.firestore.config.ts');

const rules = readFileSync(rulesPath, 'utf8');
const firebaseJson = JSON.parse(readFileSync(firebaseJsonPath, 'utf8')) as {
  firestore?: { rules?: string };
  emulators?: {
    firestore?: { port?: number };
    ui?: { enabled?: boolean };
    singleProjectMode?: boolean;
  };
};
const vitestFirestoreConfig = readFileSync(vitestFirestoreConfigPath, 'utf8');

describe('firestore.rules multi-tenant coverage', () => {
  it('protects workspace SaaS collections', () => {
    expect(rules).toContain('match /saas_usage/{usageId}');
    expect(rules).toContain('match /billing_state/{stateId}');
    expect(rules).toContain('match /billing_hooks/{eventId}');
  });

  it('keeps billing hook writes server-only', () => {
    expect(rules).toContain('match /billing_hooks/{eventId} {\n        allow read: if canManageWorkspace(workspaceId);\n        allow create, update, delete: if false;');
  });

  it('keeps billing state writes server-only', () => {
    expect(rules).toContain('match /billing_state/{stateId} {\n        allow read: if isWorkspaceMember(workspaceId);\n        allow create, update, delete: if false;');
  });

  it('protects billing-authoritative workspace and tenant fields from client updates', () => {
    expect(rules).toContain('function keepsWorkspaceBillingAuthorityImmutable()');
    expect(rules).toContain("'billingCustomerId'");
    expect(rules).toContain("'subscription'");
    expect(rules).toContain('&& keepsWorkspaceBillingAuthorityImmutable();');
    expect(rules).toContain('function keepsTenantAuthorityImmutable()');
    expect(rules).toContain("'ownerUserId'");
    expect(rules).toContain('&& keepsTenantAuthorityImmutable();');
  });

  it('requires client-created tenants and workspaces to start on the free plan', () => {
    expect(rules).toContain("request.resource.data.plan == 'free'");
    expect(rules).toContain('hasNoBillingAuthorityFields(request.resource.data);');
    expect(rules).toContain('request.resource.data.id == workspaceId');
  });

  it('covers future workspace-scoped collections', () => {
    expect(rules).toContain('match /insights/{insightId}');
    expect(rules).toContain('match /imports/{importId}');
    expect(rules).toContain('match /subscriptions/{subscriptionId}');
  });

  it('keeps workspace permission helpers in place', () => {
    expect(rules).toContain('function isTenantMember(tenantId)');
    expect(rules).toContain('function isTenantOwner(tenantId)');
    expect(rules).toContain('function canManageWorkspace(workspaceId)');
    expect(rules).toContain('function canEditWorkspaceData(workspaceId)');
    expect(rules).toContain('function workspaceBelongsToTenant(workspaceId, tenantId)');
    expect(rules).toContain('function memberMatchesWorkspaceTenant(workspaceId)');
    expect(rules).toContain('function requestMatchesWorkspaceContext(workspaceId)');
    expect(rules).toContain('function resourceMatchesWorkspaceContext(workspaceId)');
  });

  it('guards audit events by workspace scope', () => {
    expect(rules).toContain('match /audit_logs/{tenantId}/events/{eventId}');
    expect(rules).toContain('canManageWorkspace(resource.data.workspaceId)');
    expect(rules).toContain('workspaceBelongsToTenant(resource.data.workspaceId, tenantId)');
  });

  it('restricts tenant reads to tenant members', () => {
    expect(rules).toContain('match /tenants/{tenantId}');
    expect(rules).toContain('resource.data.id == tenantId');
    expect(rules).toContain('isTenantMember(tenantId)');
    expect(rules).toContain('isTenantOwner(tenantId)');
    expect(rules).toContain('match /tenant_members/{memberId}');
  });

  it('pins the emulator config to the local Firestore rules file', () => {
    expect(firebaseJson.firestore?.rules).toBe('firestore.rules');
    expect(firebaseJson.emulators?.firestore?.port).toBe(8080);
    expect(firebaseJson.emulators?.ui?.enabled).toBe(false);
    expect(firebaseJson.emulators?.singleProjectMode).toBe(true);
  });

  it('keeps the dedicated Firestore Vitest config scoped to firestore tests', () => {
    expect(vitestFirestoreConfig).toContain("include: ['tests/firestore/**/*.test.ts']");
    expect(vitestFirestoreConfig).toContain("exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/tests/integration/**']");
    expect(vitestFirestoreConfig).toContain("environment: 'node'");
    expect(vitestFirestoreConfig).toContain("pool: 'forks'");
    expect(vitestFirestoreConfig).toContain('passWithNoTests: false');
  });
});
