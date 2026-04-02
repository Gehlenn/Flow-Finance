import { describe, expect, it } from 'vitest';

import { diffMigrations } from '../../backend/src/utils/postgresMigrationPlan';

describe('postgres migration plan', () => {
  it('detects pending migrations in lexical order', () => {
    const result = diffMigrations(
      ['001_state_store.sql', '002_workspace_saas_tables.sql', '003_multi_tenant_audit.sql'],
      ['001_state_store.sql'],
    );

    expect(result.pending).toEqual([
      '002_workspace_saas_tables.sql',
      '003_multi_tenant_audit.sql',
    ]);
    expect(result.unexpected).toEqual([]);
  });

  it('flags unexpected applied migrations', () => {
    const result = diffMigrations(
      ['001_state_store.sql'],
      ['001_state_store.sql', '999_custom_patch.sql'],
    );

    expect(result.pending).toEqual([]);
    expect(result.unexpected).toEqual(['999_custom_patch.sql']);
  });
});
