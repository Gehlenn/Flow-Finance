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
    const usageRules = rules.split('match /saas_usage/{usageId}')[1]?.split('match /billing_state/{stateId}')[0];
    expect(usageRules).toContain('allow create, update, delete: if false');
    expect(usageRules).toContain('match /{authorityDocument=**}');
    expect(usageRules).toContain('allow read, write: if false');
  });

  it('keeps billing hook writes server-only', () => {
    expect(rules).toContain('match /billing_hooks/{eventId} {\n        allow read: if canManageWorkspace(workspaceId);\n        allow create, update, delete: if false;');
  });

  it('keeps billing state writes server-only', () => {
    expect(rules).toContain('match /billing_state/{stateId} {\n        allow read: if isWorkspaceMember(workspaceId);\n        allow create, update, delete: if false;');
  });

  it('keeps billing-authoritative workspace and tenant fields server-only', () => {
    expect(rules).toContain('match /tenants/{tenantId} {\n      allow create: if false;');
    expect(rules).toContain('match /workspaces/{workspaceId} {\n      allow create: if false;');
    expect(rules).toContain('allow update, delete: if false;');
  });

  it('keeps tenant, workspace, and membership mutations server-only', () => {
    expect(rules).toContain('match /tenants/{tenantId} {\n      allow create: if false;');
    expect(rules).toContain('allow update, delete: if false;');
    expect(rules).toContain('match /tenant_members/{memberId}');
    expect(rules).toContain('match /workspace_members/{memberId}');
    expect(rules).toContain('allow create, update, delete: if false;');
  });

  it('prevents clients from changing server-authoritative active workspace pointers', () => {
    expect(rules).toContain("!request.resource.data.keys().hasAny(['activeTenantId', 'activeWorkspaceId'])");
    expect(rules).toContain("!request.resource.data.diff(resource.data).affectedKeys().hasAny(['activeTenantId', 'activeWorkspaceId'])");
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
