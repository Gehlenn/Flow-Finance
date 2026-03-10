import React from 'react';
import { usePerformanceMonitoring, formatBytes, formatTime, calculatePerformanceScore } from '../hooks/usePerformanceMonitoring';
import { Activity, Zap, Monitor, Wifi, HardDrive, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

const PerformanceMonitor: React.FC = () => {
  const metrics = usePerformanceMonitoring();
  const performanceScore = calculatePerformanceScore(metrics);

  const MetricCard: React.FC<{
    title: string;
    value: string;
    icon: React.ReactNode;
    status?: 'good' | 'warning' | 'error' | 'neutral';
    description?: string;
  }> = ({ title, value, icon, status = 'neutral', description }) => {
    const statusColors = {
      good: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
      warning: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
      error: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10',
      neutral: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10'
    };

    return (
      <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${statusColors[status]}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{title}</h4>
            {description && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{description}</p>
            )}
          </div>
        </div>
        <p className="text-lg font-black text-slate-900 dark:text-white">{value}</p>
      </div>
    );
  };

  const getStatusForMetric = (value: number | null, thresholds: { good: number; warning: number }): 'good' | 'warning' | 'error' | 'neutral' => {
    if (!value) return 'neutral';
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.warning) return 'warning';
    return 'error';
  };

  return (
    <div className="space-y-6">
      {/* Performance Score Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg"
            style={{ backgroundColor: performanceScore.color }}
          >
            {performanceScore.score}
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Performance Score</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{performanceScore.grade}</p>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${performanceScore.score}%`,
              backgroundColor: performanceScore.color
            }}
          />
        </div>
      </div>

      {/* Core Web Vitals */}
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Zap size={20} />
          Core Web Vitals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Largest Contentful Paint"
            value={formatTime(metrics.lcp)}
            icon={<Monitor size={16} />}
            status={getStatusForMetric(metrics.lcp, { good: 2500, warning: 4000 })}
            description="Tempo para carregar o maior elemento visível"
          />
          <MetricCard
            title="First Input Delay"
            value={formatTime(metrics.fid)}
            icon={<Activity size={16} />}
            status={getStatusForMetric(metrics.fid, { good: 100, warning: 300 })}
            description="Resposta à primeira interação do usuário"
          />
          <MetricCard
            title="Cumulative Layout Shift"
            value={metrics.cls ? metrics.cls.toFixed(3) : 'N/A'}
            icon={<TrendingUp size={16} />}
            status={getStatusForMetric(metrics.cls, { good: 0.1, warning: 0.25 })}
            description="Mudanças inesperadas no layout"
          />
        </div>
      </div>

      {/* Additional Metrics */}
      <div>
        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Clock size={20} />
          Métricas Adicionais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="First Contentful Paint"
            value={formatTime(metrics.fcp)}
            icon={<Monitor size={16} />}
            description="Primeiro conteúdo pintado"
          />
          <MetricCard
            title="Time to First Byte"
            value={formatTime(metrics.ttfb)}
            icon={<Clock size={16} />}
            description="Tempo para primeiro byte"
          />
          <MetricCard
            title="DOM Content Loaded"
            value={formatTime(metrics.domContentLoaded)}
            icon={<Activity size={16} />}
            description="DOM pronto para interação"
          />
          <MetricCard
            title="Load Complete"
            value={formatTime(metrics.loadComplete)}
            icon={<TrendingUp size={16} />}
            description="Página totalmente carregada"
          />
        </div>
      </div>

      {/* Memory Usage */}
      {metrics.memoryUsage.used && (
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <HardDrive size={20} />
            Uso de Memória
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Memória Utilizada"
              value={formatBytes(metrics.memoryUsage.used)}
              icon={<HardDrive size={16} />}
              description="JavaScript heap atual"
            />
            <MetricCard
              title="Memória Total"
              value={formatBytes(metrics.memoryUsage.total)}
              icon={<HardDrive size={16} />}
              description="Heap total alocado"
            />
            <MetricCard
              title="Limite de Memória"
              value={formatBytes(metrics.memoryUsage.limit)}
              icon={<AlertTriangle size={16} />}
              description="Limite do navegador"
            />
          </div>
        </div>
      )}

      {/* Network Information */}
      {(metrics.connectionType || metrics.effectiveType) && (
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Wifi size={20} />
            Informações de Rede
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Tipo de Conexão"
              value={metrics.connectionType || 'N/A'}
              icon={<Wifi size={16} />}
              description="Tipo de rede detectado"
            />
            <MetricCard
              title="Conexão Efetiva"
              value={metrics.effectiveType || 'N/A'}
              icon={<Wifi size={16} />}
              description="Velocidade estimada"
            />
            <MetricCard
              title="Velocidade"
              value={metrics.downlink ? `${metrics.downlink} Mbps` : 'N/A'}
              icon={<TrendingUp size={16} />}
              description="Largura de banda estimada"
            />
          </div>
        </div>
      )}

      {/* Performance Tips */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-[2rem] p-6 border border-indigo-100 dark:border-indigo-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Activity size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white">Dicas de Performance</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>Otimização automática:</strong> O app usa lazy loading e code splitting para carregamento mais rápido
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">✓</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>Monitoramento contínuo:</strong> Métricas são coletadas automaticamente para melhorar a experiência
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">ℹ</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>Dica:</strong> Feche outras abas para melhorar o desempenho se notar lentidão
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;