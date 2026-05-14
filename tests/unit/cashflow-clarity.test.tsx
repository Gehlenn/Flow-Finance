import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CashFlow from '../../components/CashFlow';
import { GeminiService } from '../../services/geminiService';
import { getWorkspaceScopedStorageKey } from '../../src/utils/workspaceStorage';
import { Category, TransactionType } from '../../types';

const cashFlowMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: cashFlowMocks.logWarn,
}));

describe('CashFlow clarity', () => {
  const workspaceId = 'workspace-1';

  const getReportKey = () => getWorkspaceScopedStorageKey(
    `flow_report_${new Date().toISOString().split('T')[0]}`,
    workspaceId,
  );

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('separa realizado, entradas e saidas com linguagem operacional', () => {
    render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[
          {
            id: '1',
            amount: 500,
            type: TransactionType.RECEITA,
            category: Category.CONSULTORIO,
            description: 'Receita confirmada',
            date: '2026-04-10T10:00:00.000Z',
          },
          {
            id: '2',
            amount: 120,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Despesa confirmada',
            date: '2026-04-10T12:00:00.000Z',
          },
        ]}
        hideValues
        theme="light"
      />,
    );

    expect(screen.getByText('Receita realizada')).toBeTruthy();
    expect(screen.getByText('Entradas')).toBeTruthy();
    expect(screen.getByText(/Saidas/i)).toBeTruthy();
    expect(screen.getByText(/Próximo passo financeiro/i)).toBeTruthy();
  });

  it('ignora relatorio estrategico armazenado invalido sem quebrar a tela', () => {
    localStorage.setItem(getReportKey(), '{"summary":123');

    render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    expect(screen.getByText('Receita realizada')).toBeTruthy();
    expect(screen.getByText(/Próximo passo financeiro/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Abrir diagn/i })).toBeNull();
    expect(cashFlowMocks.logWarn).toHaveBeenCalledWith(
      '[CashFlow] Failed to parse stored strategic report',
      expect.objectContaining({
        fallback: 'cashflow-parse-stored-report-failed',
      }),
    );
  });

  it('mostra diagnostico salvo quando o relatorio estrategico existe', async () => {
    localStorage.setItem(
      getReportKey(),
      JSON.stringify({
        executiveSummary: 'Sessao expirada ou invalida.',
        actionPlan: ['Verificar permissoes', 'Gerar novo diagnostico'],
        diagnostic: {
          kind: 'ai_unavailable',
          statusCode: 403,
          message: 'Sem permissao para usar a IA neste workspace.',
          suggestion: 'Verifique a permissao do workspace ou o papel do usuario.',
        },
      }),
    );

    render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Abrir diagn/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Abrir diagn/i }));

    expect(await screen.findByText(/Diagnostico Executivo/i)).toBeTruthy();
    expect(screen.getByText(/Sessao expirada ou invalida/i)).toBeTruthy();
    expect(screen.getByText(/Sem permissao para usar a IA neste workspace/i)).toBeTruthy();
    expect(screen.getByText(/Verifique a permissao do workspace ou o papel do usuario/i)).toBeTruthy();
  });

  it('invalida o relatorio estrategico quando o recorte de caixa muda', async () => {
    const reportKey = getReportKey();

    localStorage.setItem(
      reportKey,
      JSON.stringify({
        executiveSummary: 'Resumo atual',
        actionPlan: ['forte'],
        diagnostic: {
          kind: 'ai_unavailable',
          statusCode: null,
          message: 'fallback',
          suggestion: 'verificar novamente',
        },
      }),
    );

    const { rerender } = render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[
          {
            id: '1',
            amount: 500,
            type: TransactionType.RECEITA,
            category: Category.CONSULTORIO,
            description: 'Receita confirmada',
            date: '2026-04-10T10:00:00.000Z',
          },
        ]}
        hideValues={false}
        theme="light"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Abrir diagn/i })).toBeTruthy();
    });

    expect(localStorage.getItem(reportKey)).not.toBeNull();

    rerender(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[
          {
            id: '1',
            amount: 500,
            type: TransactionType.RECEITA,
            category: Category.CONSULTORIO,
            description: 'Receita confirmada',
            date: '2026-04-10T10:00:00.000Z',
          },
          {
            id: '2',
            amount: 120,
            type: TransactionType.DESPESA,
            category: Category.PESSOAL,
            description: 'Despesa nova',
            date: '2026-04-11T10:00:00.000Z',
          },
        ]}
        hideValues={false}
        theme="light"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gerar diagn/i })).toBeTruthy();
    });

    expect(localStorage.getItem(reportKey)).toBeNull();
  });

  it('mostra fallback visivel quando a geracao do relatorio estrategico falha', async () => {
    vi.spyOn(GeminiService.prototype, 'generateStrategicReport').mockRejectedValueOnce(new Error('strategic failed'));

    render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Abrir diagn/i }));
    fireEvent.click(screen.getByRole('button', { name: /Gerar diagn/i }));

    await waitFor(() => {
      expect(cashFlowMocks.logWarn).toHaveBeenCalledWith(
        '[CashFlow] Failed to generate strategic report',
        expect.objectContaining({
          fallback: 'cashflow-generate-strategic-report-failed',
        }),
      );
    });
  });
});
