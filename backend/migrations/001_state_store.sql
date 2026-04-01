CREATE TABLE IF NOT EXISTS app_state_store (
  state_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  user_id TEXT,
  email TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  resource TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_events_at ON audit_events(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
