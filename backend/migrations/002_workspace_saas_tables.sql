CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  billing_email TEXT,
  billing_customer_id TEXT,
  subscription JSONB,
  entitlements JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_users (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  invited_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_user_preferences (
  user_id TEXT PRIMARY KEY,
  last_selected_workspace_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_monthly_usage (
  workspace_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  transactions INTEGER NOT NULL DEFAULT 0,
  ai_queries INTEGER NOT NULL DEFAULT 0,
  bank_connections INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, month_key)
);

CREATE TABLE IF NOT EXISTS workspace_usage_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  resource TEXT NOT NULL,
  amount INTEGER NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS workspace_billing_hooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  plan TEXT NOT NULL,
  event TEXT NOT NULL,
  resource TEXT,
  amount INTEGER NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_monthly_usage_workspace_id ON workspace_monthly_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_workspace_id ON workspace_usage_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_events_at ON workspace_usage_events(at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_billing_hooks_workspace_id ON workspace_billing_hooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_billing_hooks_at ON workspace_billing_hooks(at DESC);
