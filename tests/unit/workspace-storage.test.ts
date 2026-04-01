import { describe, expect, it } from 'vitest';
import {
  getWorkspaceScopedStorageKey,
  getWorkspaceStorageScope,
} from '../../src/utils/workspaceStorage';

describe('workspaceStorage', () => {
  it('uses the workspace id when available', () => {
    expect(getWorkspaceStorageScope('ws_123')).toBe('ws_123');
    expect(getWorkspaceScopedStorageKey('flow_report', 'ws_123')).toBe('flow_report:ws_123');
  });

  it('falls back to a global scope when no workspace is selected', () => {
    expect(getWorkspaceStorageScope()).toBe('global');
    expect(getWorkspaceStorageScope('   ')).toBe('global');
    expect(getWorkspaceScopedStorageKey('flow_report', null)).toBe('flow_report:global');
  });
});
