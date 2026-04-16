/**
 * PredictionChart.tsx
 * AI-powered cash flow prediction visualization
 * Shows predicted vs actual with confidence bands
 */

import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip as MuiTooltip,
  useTheme,
  Skeleton,
  Alert,
  Button,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { usePredictions } from '../hooks/usePredictions';
import { ChartDataPoint, CashFlowPrediction } from '../../shared/types/prediction';

interface PredictionChartProps {
  days?: number;
  showConfidenceBands?: boolean;
  height?: number;
  title?: string;
}

/**
 * Custom tooltip for the chart
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as ChartDataPoint;
  const isPrediction = data.isPrediction;

  return (
    <Paper sx={{ p: 2, maxWidth: 280 }}>
      <Typography variant="subtitle2" gutterBottom>
        {new Date(data.date).toLocaleDateString('pt-BR', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </Typography>
      
      {isPrediction ? (
        <>
          <Typography variant="body2" color="primary">
            <strong>Previsão:</strong> R$ {data.balance.toFixed(2)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Intervalo: R$ {data.predictedMin.toFixed(2)} - R$ {data.predictedMax.toFixed(2)}
          </Typography>
          {data.income > 0 && (
            <Typography variant="body2" color="success.main">
              +R$ {data.income.toFixed(2)} (entrada)
            </Typography>
          )}
          {data.expenses > 0 && (
            <Typography variant="body2" color="error.main">
              -R$ {data.expenses.toFixed(2)} (saída)
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2">
          <strong>Saldo Real:</strong> R$ {data.balance.toFixed(2)}
        </Typography>
      )}
    </Paper>
  );
};

/**
 * Get trend icon based on prediction trend
 */
const TrendIcon: React.FC<{ trend: string }> = ({ trend }) => {
  switch (trend) {
    case 'up':
      return <TrendingUpIcon color="success" />;
    case 'down':
      return <TrendingDownIcon color="error" />;
    default:
      return <TrendingFlatIcon color="action" />;
  }
};

/**
 * Prediction Chart Component
 */
const PredictionChart: React.FC<PredictionChartProps> = ({
  days = 30,
  showConfidenceBands = true,
  height = 400,
  title = 'Previsão de Fluxo de Caixa',
}) => {
  const theme = useTheme();
  const {
    prediction,
    shortfallRisk,
    loading,
    error,
    chartData,
    refreshPrediction,
  } = usePredictions(days);

  const [refreshing, setRefreshing] = useState(false);

  /**
   * Handle refresh button click
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshPrediction();
    setRefreshing(false);
  };

  /**
   * Format currency for display
   */
  const formatCurrency = (value: number): string => {
    return `R$ ${value.toFixed(2)}`;
  };

  /**
   * Get summary statistics
   */
  const summaryStats = useMemo(() => {
    if (!prediction || chartData.length === 0) return null;

    const currentBalance = chartData[0]?.balance || 0;
    const finalBalance = prediction.dailyPredictions[prediction.dailyPredictions.length - 1]?.predictedBalance || 0;
    const change = finalBalance - currentBalance;
    const changePercent = currentBalance === 0 ? 0 : (change / Math.abs(currentBalance)) * 100;

    return {
      currentBalance,
      finalBalance,
      change,
      changePercent,
      confidence: prediction.confidence,
      trend: prediction.trend,
    };
  }, [prediction, chartData]);

  // Loading state
  if (loading && chartData.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={300} height={24} />
        </Box>
        <Skeleton variant="rectangular" height={height} />
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Tentar Novamente
            </Button>
          }
        >
          {error}
        </Alert>
      </Paper>
    );
  }

  // No data state
  if (!prediction || chartData.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Alert severity="info">
          Dados insuficientes para gerar previsão. Adicione mais transações para ver análises de fluxo de caixa.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          {summaryStats && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                icon={<TrendIcon trend={summaryStats.trend} />}
                label={`Tendência: ${
                  summaryStats.trend === 'up' ? 'Alta' : 
                  summaryStats.trend === 'down' ? 'Queda' : 'Estável'
                }`}
                size="small"
                color={summaryStats.trend === 'up' ? 'success' : summaryStats.trend === 'down' ? 'error' : 'default'}
              />
              <Chip
                label={`Confiança: ${(summaryStats.confidence * 100).toFixed(0)}%`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`${days} dias`}
                size="small"
                variant="outlined"
              />
            </Box>
          )}
        </Box>
        
        <MuiTooltip title="Atualizar previsão">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon className={refreshing ? 'spin' : ''} />
          </IconButton>
        </MuiTooltip>
      </Box>

      {/* Shortfall Warning */}
      {shortfallRisk && (
        <Alert 
          severity={shortfallRisk.severity === 'high' ? 'error' : shortfallRisk.severity === 'medium' ? 'warning' : 'info'}
          sx={{ mb: 3 }}
          icon={<WarningIcon />}
        >
          <Typography variant="subtitle2">
            Alerta de Déficit Previsto
          </Typography>
          <Typography variant="body2">
            Saldo negativo projetado em {shortfallRisk.daysUntil} dias 
            (R$ {shortfallRisk.projectedDeficit.toFixed(2)})
          </Typography>
          {shortfallRisk.suggestions.length > 0 && (
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              {shortfallRisk.suggestions.slice(0, 2).map((suggestion, idx) => (
                <Typography component="li" variant="body2" key={idx}>
                  {suggestion}
                </Typography>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {/* Summary Cards */}
      {summaryStats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Saldo Atual
            </Typography>
            <Typography variant="h6">
              {formatCurrency(summaryStats.currentBalance)}
            </Typography>
          </Paper>
          
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Projeção Final ({days}d)
            </Typography>
            <Typography variant="h6" color={summaryStats.finalBalance >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(summaryStats.finalBalance)}
            </Typography>
          </Paper>
          
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Variação
            </Typography>
            <Typography 
              variant="h6" 
              color={summaryStats.change >= 0 ? 'success.main' : 'error.main'}
            >
              {summaryStats.change >= 0 ? '+' : ''}
              {summaryStats.changePercent.toFixed(1)}%
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Chart */}
      <Box sx={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            
            <YAxis
              tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend />
            
            {/* Zero line */}
            <ReferenceLine y={0} stroke={theme.palette.text.secondary} strokeDasharray="2 2" />
            
            {/* Confidence bands (predictions only) */}
            {showConfidenceBands && (
              <>
                <Area
                  type="monotone"
                  dataKey="predictedMax"
                  stroke="none"
                  fill={theme.palette.primary.main}
                  fillOpacity={0.1}
                  name="Intervalo Superior"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="predictedMin"
                  stroke="none"
                  fill={theme.palette.background.paper}
                  fillOpacity={1}
                  name="Intervalo Inferior"
                  connectNulls
                />
              </>
            )}
            
            {/* Main balance line */}
            <Line
              type="monotone"
              dataKey="balance"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={false}
              name="Saldo Previsto"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>

      {/* Legend note */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        * A área sombreada representa o intervalo de confiança da previsão. 
        Dados históricos aparecem à esquerda, previsões à direita.
      </Typography>

      {/* Factors */}
      {prediction.factors.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Fatores da Previsão:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {prediction.factors.map((factor, idx) => (
              <Chip
                key={idx}
                label={factor.name}
                size="small"
                color={
                  factor.impact === 'positive' ? 'success' : 
                  factor.impact === 'negative' ? 'error' : 'default'
                }
                variant={factor.weight > 0.5 ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default PredictionChart;
