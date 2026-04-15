import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppWithAnalytics from '../../AppWithAnalytics';

vi.mock('../../App', () => ({
  default: () => <div data-testid="app-root">App mounted</div>,
}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics">Analytics mounted</div>,
}));

describe('AppWithAnalytics', () => {
  it('renderiza o App e o Vercel Analytics juntos', () => {
    render(<AppWithAnalytics />);

    expect(screen.getByTestId('app-root').textContent).toContain('App mounted');
    expect(screen.getByTestId('vercel-analytics').textContent).toContain('Analytics mounted');
  });
});
