import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

const parserLabMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
  parseOFX: vi.fn(),
  parseCSV: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => parserLabMocks.logWarn(...args),
}));

vi.mock('../../src/finance/ofxParser', () => ({
  parseOFX: (...args: unknown[]) => parserLabMocks.parseOFX(...args),
}));

vi.mock('../../src/finance/csvParser', () => ({
  parseCSV: (...args: unknown[]) => parserLabMocks.parseCSV(...args),
}));

describe('AIControlPanel parser lab UI', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');
    vi.clearAllMocks();
    parserLabMocks.parseOFX.mockReturnValue([]);
    parserLabMocks.parseCSV.mockReturnValue([]);
  });

  it('clears stale parser output when the input changes', async () => {
    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /parser/i }));
    const textarea = await screen.findByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Data,Descricao,Valor\n01/03/2026,iFood,-89.90' } });
    fireEvent.click(screen.getByRole('button', { name: /executar parser/i }));

    await waitFor(() => {
      expect(screen.getByText(/transacoes parseadas/i)).toBeTruthy();
    });

    fireEvent.change(textarea, { target: { value: 'Data,Descricao,Valor\n01/03/2026,Uber,-12.00' } });

    expect(screen.queryByText(/transacoes parseadas/i)).toBeNull();
  });

  it('mostra diagnostico quando nao identifica transacoes', async () => {
    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /parser/i }));
    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: /executar parser/i }));

    expect(await screen.findByText(/Nenhuma transacao foi identificada/i)).toBeTruthy();
    expect(screen.getByText(/Cole um extrato valido/i)).toBeTruthy();
    expect(screen.getByText(/Proximo passo:/i)).toBeTruthy();
  });

  it('registra contexto quando o Parser Lab falha ao processar entrada', async () => {
    parserLabMocks.parseOFX.mockImplementationOnce(() => {
      throw new Error('ofx offline');
    });

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /parser/i }));
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'entrada invalida' } });
    fireEvent.click(screen.getByRole('button', { name: /executar parser/i }));

    expect(parserLabMocks.logWarn).toHaveBeenCalledWith(
      '[AIControlPanel] Parser Lab failed to process input',
      expect.objectContaining({
        fallback: 'ai-control-panel-parser-lab-failed',
        format: 'ofx',
      }),
    );
    expect(screen.getByText('ofx offline')).toBeTruthy();
  });
});
