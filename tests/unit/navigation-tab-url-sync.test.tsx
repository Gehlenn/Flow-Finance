import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNavigationTabs } from '../../hooks/useNavigationTabs';

describe('useNavigationTabs url sync', () => {
  it('inicializa o tab a partir da query string da SPA', () => {
    window.history.replaceState({}, '', '/?tab=workspaceadmin&billing=return');

    const { result } = renderHook(() => useNavigationTabs());

    expect(result.current.activeTab).toBe('workspaceadmin');
  });

  it('sincroniza tabs validos na URL sem quebrar flags existentes', () => {
    window.history.replaceState({}, '', '/?billing=return');

    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('settings');
    });

    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?billing=return&tab=settings');
  });

  it('remove o tab da URL ao voltar para dashboard', () => {
    window.history.replaceState({}, '', '/?billing=return&tab=workspaceadmin');

    const { result } = renderHook(() => useNavigationTabs());

    act(() => {
      result.current.setActiveTab('dashboard');
    });

    expect(window.location.search).toBe('?billing=return');
  });
});
