import { useEffect } from 'react';

export type AppTheme = 'light' | 'dark';

type ThemeRootElement = Pick<HTMLElement, 'classList'>;

export interface UseAppThemeArgs {
  theme: AppTheme;
  documentElement?: ThemeRootElement | null;
}

export function useAppTheme({ theme, documentElement }: UseAppThemeArgs): void {
  const rootElement = documentElement ?? (typeof document !== 'undefined' ? document.documentElement : null);

  useEffect(() => {
    if (!rootElement) {
      return;
    }

    if (theme === 'dark') {
      rootElement.classList.add('dark');
      return;
    }

    rootElement.classList.remove('dark');
  }, [rootElement, theme]);
}
