-- Optional migration for future PostgreSQL persistence in Open Finance.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS bank_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_logo TEXT,
  bank_color TEXT,
  provider TEXT NOT NULL,
  connection_status TEXT NOT NULL,
  external_account_id TEXT,
  account_type TEXT,
  balance DOUBLE PRECISION,
  last_sync TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id
  ON bank_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_bank_connections_external_account_id
  ON bank_connections(external_account_id);
