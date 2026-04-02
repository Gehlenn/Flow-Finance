CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_id TEXT;

UPDATE workspaces
SET tenant_id = COALESCE(NULLIF(tenant_id, ''), workspace_id)
WHERE tenant_id IS NULL OR tenant_id = '';

UPDATE workspace_users
SET tenant_id = COALESCE(NULLIF(tenant_id, ''), workspace_id)
WHERE tenant_id IS NULL OR tenant_id = '';

INSERT INTO tenants (tenant_id, name, plan, created_at, updated_at)
SELECT DISTINCT
  w.tenant_id,
  w.name,
  w.plan,
  w.created_at,
  COALESCE(w.updated_at, w.created_at)
FROM workspaces w
WHERE w.tenant_id IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_tenant_id ON workspace_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_id ON audit_events(workspace_id);
