import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAppTheme } from '../../src/app/useAppTheme';

describe('useAppTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('aplica e remove a classe dark no root document com base no tema', () => {
    const root = document.documentElement;
    root.classList.add('dark');

    const { rerender } = renderHook(({ theme }) => useAppTheme({
      theme,
      documentElement: root,
    }), {
      initialProps: { theme: 'light' as const },
    });

    expect(root.classList.contains('dark')).toBe(false);

    rerender({ theme: 'dark' });
    expect(root.classList.contains('dark')).toBe(true);

    rerender({ theme: 'light' });
    expect(root.classList.contains('dark')).toBe(false);
  });
});
