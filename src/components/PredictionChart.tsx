/**
 * PredictionChart.tsx
 *
 * Visualização de previsão de fluxo de caixa (IA) usando Recharts.
 *
 * Importante:
 * - Este componente NÃO depende de MUI (@mui/*). A base do projeto é React + Tailwind + Recharts.
 * - Mantemos o layout simples e auditável para evitar dependências pesadas.
 */

import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { usePredictions } from '../hooks/usePredictions';
import type { ChartDataPoint } from '../../shared/types/prediction';

interface PredictionChartProps {
  days?: number;
  showConfidenceBands?: boolean;
  height?: number;
  title?: string;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as ChartDataPoint;
  const isPrediction = Boolean(data.isPrediction);

  return (
    <div className="max-w-[320px] rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
      <div className="text-xs font-semibold text-slate-700">
        {new Date(data.date).toLocaleDateString('pt-BR', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>

      <div className="mt-2 space-y-1 text-sm">
        {isPrediction ? (
          <>
            <div className="font-medium text-slate-900">
              Previsao: {formatCurrency(data.balance)}
            </div>
            <div className="text-slate-600">
              Intervalo: {formatCurrency(data.predictedMin)} -{' '}
              {formatCurrency(data.predictedMax)}
            </div>
            {data.income > 0 ? (
              <div className="text-emerald-700">
                +{formatCurrency(data.income)} (entrada)
              </div>
            ) : null}
            {data.expenses > 0 ? (
              <div className="text-rose-700">
                -{formatCurrency(data.expenses)} (saida)
              </div>
            ) : null}
          </>
        ) : (
          <div className="font-medium text-slate-900">
            Saldo real: {formatCurrency(data.balance)}
          </div>
        )}
      </div>
    </div>
  );
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-emerald-700" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-rose-700" />;
  return <Minus className="h-4 w-4 text-slate-600" />;
}

const PredictionChart: React.FC<PredictionChartProps> = ({
  days = 30,
  showConfidenceBands = true,
  height = 400,
  title = 'Previsao de Fluxo de Caixa',
}) => {
  const {
    prediction,
    shortfallRisk,
    loading,
    error,
    chartData,
    refreshPrediction,
  } = usePredictions(days);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPrediction();
    } finally {
      setRefreshing(false);
    }
  };

  const summaryStats = useMemo(() => {
    if (!prediction || chartData.length === 0) return null;

    const currentBalance = chartData[0]?.balance ?? 0;
    const last = prediction.dailyPredictions[prediction.dailyPredictions.length - 1];
    const finalBalance = last?.predictedBalance ?? 0;
    const change = finalBalance - currentBalance;
    const changePercent =
      currentBalance === 0 ? 0 : (change / Math.abs(currentBalance)) * 100;

    return {
      currentBalance,
      finalBalance,
      change,
      changePercent,
      confidence: prediction.confidence,
      trend: prediction.trend,
    };
  }, [prediction, chartData]);

  if (loading && chartData.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-6 w-64 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 animate-pulse rounded bg-slate-100" style={{ height }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div>
            <div className="font-semibold">Falha ao carregar previsoes</div>
            <div className="mt-1 text-sm text-rose-800">
              {String(error)}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">
            Janela: {days} dias. Dados historicos a esquerda, previsoes a direita.
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Atualizar previsao"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {summaryStats ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Saldo atual
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(summaryStats.currentBalance)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Saldo previsto (fim)
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(summaryStats.finalBalance)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Tendencia
              </div>
              <TrendIcon trend={summaryStats.trend} />
            </div>
            <div className="mt-1 text-sm text-slate-700">
              Variacao: {formatCurrency(summaryStats.change)} (
              {summaryStats.changePercent.toFixed(1)}%)
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Confianca: {(summaryStats.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      ) : null}

      {shortfallRisk ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <div className="font-semibold">Risco de falta de caixa</div>
              <div className="mt-1 text-sm text-amber-800">
                Severidade: {shortfallRisk.severity}. Em {shortfallRisk.daysUntil} dia(s): deficit previsto{' '}
                {formatCurrency(shortfallRisk.projectedDeficit)}.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              }
              minTickGap={16}
            />
            <YAxis tickFormatter={(v) => `R$ ${Number(v).toFixed(0)}`} width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />

            {showConfidenceBands ? (
              <Area
                type="monotone"
                dataKey="predictedMax"
                stroke="transparent"
                fill="#93c5fd"
                fillOpacity={0.25}
                name="Intervalo (max)"
                connectNulls
              />
            ) : null}

            {showConfidenceBands ? (
              <Area
                type="monotone"
                dataKey="predictedMin"
                stroke="transparent"
                fill="#ffffff"
                fillOpacity={1}
                name="Intervalo (min)"
                connectNulls
              />
            ) : null}

            <Line
              type="monotone"
              dataKey="actual"
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
              name="Saldo real"
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="balance"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              name="Saldo previsto"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-xs text-slate-600">
        * A area sombreada representa o intervalo de confianca da previsao.
      </div>

      {prediction?.factors?.length ? (
        <div className="mt-4">
          <div className="text-sm font-semibold text-slate-900">
            Fatores da previsao
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {prediction.factors.map((factor, idx) => {
              const color =
                factor.impact === 'positive'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : factor.impact === 'negative'
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-900';

              const weight =
                factor.weight > 0.5 ? 'font-semibold' : 'font-medium';

              return (
                <span
                  key={idx}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${color} ${weight}`}
                  title={`Peso: ${factor.weight}`}
                >
                  {factor.name}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PredictionChart;
