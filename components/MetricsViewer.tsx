/**
 * METRICS VIEWER
 *
 * Componente de observabilidade para o AI Control Panel.
 * Exibe resumo de métricas de IA em tempo real (dev mode only).
 */

import React, { useEffect, useState } from 'react';
import { Activity, Zap, AlertTriangle, Database, BarChart2, RefreshCw } from 'lucide-react';
import { getAIMetricsSummary, clearAIMetrics, type AIMetricsSummary } from '../src/observability/aiMetrics';

const REFRESH_INTERVAL_MS = 3000;

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon, color }) => (
  <div className="bg-slate-800/50 rounded p-3 flex items-center gap-3">
    <div className={`${color} shrink-0`}>{icon}</div>
    <div>
      <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`font-mono text-[13px] font-bold ${color}`}>{value}</p>
    </div>
  </div>
);

const MetricsViewer: React.FC = () => {
  const [summary, setSummary] = useState<AIMetricsSummary>(getAIMetricsSummary());

  useEffect(() => {
    const id = setInterval(() => setSummary(getAIMetricsSummary()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const hitRatePct = (summary.cache_hit_rate * 100).toFixed(1);

  const handleClear = () => {
    clearAIMetrics();
    setSummary(getAIMetricsSummary());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BarChart2 size={11} className="text-violet-400" />
          <span className="font-mono text-[9px] text-slate-300 uppercase tracking-widest">AI Metrics</span>
          <span className="font-mono text-[7px] text-slate-600">auto-refresh 3s</span>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          title="Limpar métricas"
        >
          <RefreshCw size={8} className="text-slate-400" />
          <span className="font-mono text-[7px] text-slate-400">clear</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="AI Calls"
            value={summary.ai_calls}
            icon={<Activity size={12} />}
            color="text-emerald-400"
          />
          <MetricCard
            label="AI Errors"
            value={summary.ai_errors}
            icon={<AlertTriangle size={12} />}
            color={summary.ai_errors > 0 ? 'text-rose-400' : 'text-slate-500'}
          />
          <MetricCard
            label="Avg Latency"
            value={`${summary.avg_latency_ms}ms`}
            icon={<Zap size={12} />}
            color="text-amber-400"
          />
          <MetricCard
            label="Cache Hit Rate"
            value={`${hitRatePct}%`}
            icon={<Database size={12} />}
            color={summary.cache_hit_rate >= 0.8 ? 'text-emerald-400' : 'text-amber-400'}
          />
        </div>

        <div className="mt-3 bg-slate-800/50 rounded p-3">
          <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider mb-1">Events Processed</p>
          <p className="font-mono text-[13px] font-bold text-sky-400">{summary.events_processed}</p>
        </div>

        <p className="font-mono text-[7px] text-slate-600 text-right mt-3">
          snapshot: {new Date(summary.recorded_at).toLocaleTimeString('pt-BR')}
        </p>
      </div>
    </div>
  );
};

export default MetricsViewer;
