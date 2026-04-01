import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';
import {
  clearActiveWorkspace,
  ensureActiveWorkspace,
  setActiveWorkspaceId,
  WORKSPACE_CHANGED_EVENT,
} from '../../src/services/workspaceSession';

describe('workspaceSession', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearActiveWorkspace();
  });

  it('reuses the stored workspace when it is still available', async () => {
    localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, 'ws_2');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        workspaces: [
          { workspaceId: 'ws_1', name: 'Workspace 1', plan: 'free' },
          { workspaceId: 'ws_2', name: 'Workspace 2', plan: 'pro' },
        ],
      }),
    } as Response);

    const workspace = await ensureActiveWorkspace();

    expect(workspace.workspaceId).toBe('ws_2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates a personal workspace when the user has none', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workspaces: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workspaceId: 'ws_new', name: 'Workspace Pessoal', plan: 'free' }),
      } as Response);

    const workspace = await ensureActiveWorkspace();

    expect(workspace.workspaceId).toBe('ws_new');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_new');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('persists active workspace changes and emits a browser event', () => {
    const listener = vi.fn();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);

    setActiveWorkspaceId('ws_selected');

    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_selected');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(WORKSPACE_CHANGED_EVENT, listener as EventListener);
  });
});
