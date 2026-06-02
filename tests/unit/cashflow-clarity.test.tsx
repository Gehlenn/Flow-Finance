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
    expect(screen.getByText(/Sa.*das/i)).toBeTruthy();
  }, 20_000);

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
    fireEvent.click(screen.getByRole('tab', { name: /Estratégia/i }));
    expect(screen.getByText(/Pr.*ximo passo financeiro/i)).toBeTruthy();
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

    expect(screen.getByText('Receita realizada')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Estratégia/i }));
    expect(screen.getByText(/Pr.*ximo passo financeiro/i)).toBeTruthy();
  }, 20_000);

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

    fireEvent.click(screen.getByRole('tab', { name: /Estratégia/i }));
    await waitFor(() => {
      expect(screen.getByText(/Resumo estratégico salvo/i)).toBeTruthy();
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

    fireEvent.click(screen.getByRole('tab', { name: /Estratégia/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gerar diagn/i })).toBeTruthy();
    });

    expect(localStorage.getItem(reportKey)).toBeNull();
  }, 20_000);

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

    fireEvent.click(screen.getByRole('tab', { name: /Estratégia/i }));
    fireEvent.click(screen.getByRole('button', { name: /Gerar diagn/i }));

    await waitFor(() => {
      expect(cashFlowMocks.logWarn).toHaveBeenCalledWith(
        '[CashFlow] Failed to generate strategic report',
        expect.objectContaining({
          fallback: 'cashflow-generate-strategic-report-failed',
        }),
      );
    });
  }, 20_000);

  it('nao trata diagnostico local da demo como falha de IA', async () => {
    vi.spyOn(GeminiService.prototype, 'generateStrategicReport').mockResolvedValueOnce({
      executiveSummary: 'Diagnostico local pronto para demonstracao.',
      actionPlan: ['Confirmar recebiveis pendentes antes de assumir novos gastos.'],
      diagnostic: {
        kind: 'demo-local',
        message: 'Diagnostico local gerado sem depender do backend de IA.',
        suggestion: 'Use esta leitura para demonstracao.',
      },
    });

    render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Estrat/i }));
    fireEvent.click(screen.getByRole('button', { name: /Gerar diagn/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Diagnostico local pronto/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/IA sem resposta completa/i)).toBeNull();
  }, 20_000);

  it('mostra estados vazios uteis quando nao ha movimentos no recorte', () => {
    render(
      <CashFlow
        activeWorkspaceId={workspaceId}
        activeWorkspaceName="Clinica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    expect(screen.getByText(/Sem movimento neste recorte/i)).toBeTruthy();
    expect(screen.getByText(/Sem despesas para segmentar/i)).toBeTruthy();
    expect(screen.getByText(/Sem ranking ainda/i)).toBeTruthy();
  });

  it('alterna entre subsecoes de receitas com controle local na propria tela', () => {
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
        ]}
        receivables={[
          {
            id: 'recv-1',
            user_id: 'user-1',
            tenant_id: 'tenant-1',
            workspace_id: workspaceId,
            description: 'Recebivel pendente',
            expected_amount: 180,
            realized_amount: 0,
            due_date: '2026-04-25',
            realized_at: null,
            status: 'open',
            source: 'manual',
            created_at: '2026-04-10T00:00:00.000Z',
            updated_at: '2026-04-10T00:00:00.000Z',
          },
          {
            id: 'recv-2',
            user_id: 'user-1',
            tenant_id: 'tenant-1',
            workspace_id: workspaceId,
            description: 'Recebivel vencido',
            expected_amount: 90,
            realized_amount: 0,
            due_date: '2026-04-01',
            realized_at: null,
            status: 'open',
            source: 'manual',
            created_at: '2026-04-10T00:00:00.000Z',
            updated_at: '2026-04-10T00:00:00.000Z',
          },
        ]}
        hideValues={false}
        theme="light"
      />,
    );

    expect(screen.getByRole('tab', { name: /Realizado/i }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: /Previsto/i }));
    expect(screen.getAllByText(/Previsão de receita/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pr.*ximos receb/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /Pendências/i }));
    expect(screen.getByText(/Pendências em aberto/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Vencidos/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Estratégia/i }));
    expect(screen.getByRole('button', { name: /Gerar diagn/i })).toBeTruthy();
  });
});








