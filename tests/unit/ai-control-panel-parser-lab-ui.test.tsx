import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

describe('AIControlPanel parser lab UI', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');
  });

  it('clears stale parser output when the input changes', async () => {
    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /parser/i }));
    const textarea = await screen.findByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Data,Descrição,Valor\n01/03/2026,iFood,-89.90' } });
    fireEvent.click(screen.getByRole('button', { name: /executar parser/i }));

    await waitFor(() => {
      expect(screen.getByText(/transações parseadas/i)).toBeTruthy();
    });

    fireEvent.change(textarea, { target: { value: 'Data,Descrição,Valor\n01/03/2026,Uber,-12.00' } });

    expect(screen.queryByText(/transações parseadas/i)).toBeNull();
  });
});
