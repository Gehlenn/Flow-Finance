import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashFlow from '../../components/CashFlow';
import { Category, TransactionType } from '../../types';
import { GeminiService } from '../../services/geminiService';

describe('CashFlow clarity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('separa realizado, entradas e saídas com linguagem operacional', () => {
    render(
      <CashFlow
        activeWorkspaceName="Clínica Flow"
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
        hideValues={true}
        theme="light"
      />,
    );

    expect(screen.getByText('Caixa realizado')).toBeTruthy();
    expect(screen.getByText('Entradas')).toBeTruthy();
    expect(screen.getByText('Saídas')).toBeTruthy();
    expect(screen.getByText(/Fluxo consultivo/)).toBeTruthy();
  });

  it('ignora relatório estratégico armazenado inválido sem quebrar a tela', () => {
    const reportKey = `flow_report_${new Date().toISOString().split('T')[0]}:global`;
    localStorage.setItem(reportKey, '{"summary":123');

    render(
      <CashFlow
        activeWorkspaceName="Clínica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    expect(screen.getByText('Caixa realizado')).toBeTruthy();
    expect(screen.getByText(/Fluxo consultivo/)).toBeTruthy();
  });

  it('ignora relatório estratégico com shape legado invalido sem quebrar a tela', () => {
    const reportKey = `flow_report_${new Date().toISOString().split('T')[0]}:global`;
    localStorage.setItem(reportKey, JSON.stringify({
      summary: 'Resumo antigo',
      executiveSummary: 'Resumo antigo',
      strengths: [],
      weaknesses: [],
      risks: [],
      opportunities: [],
      actions: [],
      actionPlan: 'nao-e-array',
      diagnostic: { kind: 'ai_unavailable', message: 'x', suggestion: 'y' },
    }));

    render(
      <CashFlow
        activeWorkspaceName="Clínica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    expect(screen.getByText('Caixa realizado')).toBeTruthy();
    expect(screen.getByText(/Fluxo consultivo/)).toBeTruthy();
  });

  it('mostra fallback diagnostico quando a IA estrategica falha ao gerar o relatorio', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(GeminiService.prototype, 'generateStrategicReport').mockRejectedValueOnce(new Error('backend offline'));

    render(
      <CashFlow
        activeWorkspaceName="Clínica Flow"
        transactions={[]}
        hideValues={false}
        theme="light"
      />,
    );

    screen.getByRole('button', { name: /Gerar diagnóstico/i }).click();

    expect(await screen.findByText(/IA sem resposta completa/i)).toBeTruthy();
    expect(screen.getAllByText(/A IA estratégica está indisponível no momento/i).length).toBeGreaterThanOrEqual(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('invalida o relatorio estrategico quando o recorte de caixa muda', async () => {
    const reportKey = `flow_report_${new Date().toISOString().split('T')[0]}:global`;
    vi.spyOn(GeminiService.prototype, 'generateStrategicReport').mockResolvedValueOnce({
      summary: 'Resumo atual',
      executiveSummary: 'Resumo atual',
      strengths: ['forte'],
      weaknesses: [],
      risks: [],
      opportunities: [],
      actions: [],
      actionPlan: [],
      diagnostic: {
        kind: 'ai_unavailable',
        statusCode: null,
        message: 'fallback',
        suggestion: 'verificar novamente',
      },
    } as any);

    const { rerender } = render(
      <CashFlow
        activeWorkspaceName="Clínica Flow"
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

    fireEvent.click(screen.getByRole('button', { name: /gerar diagnóstico/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /abrir diagnóstico/i })).toBeTruthy();
    });
    expect(localStorage.getItem(reportKey)).not.toBeNull();

    rerender(
      <CashFlow
        activeWorkspaceName="Clínica Flow"
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
      expect(screen.getByRole('button', { name: /gerar diagnóstico/i })).toBeTruthy();
    });
    expect(localStorage.getItem(reportKey)).toBeNull();
  });
});
