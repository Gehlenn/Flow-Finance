/**
 * usePredictions.ts
 * React hook for AI-powered cash flow predictions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CashFlowPrediction,
  ShortfallRisk,
  SeasonalPattern,
  PredictionAlert,
  ChartDataPoint,
} from '../../shared/types/prediction';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface UsePredictionsReturn {
  prediction: CashFlowPrediction | null;
  shortfallRisk: ShortfallRisk | null;
  seasonalPatterns: SeasonalPattern[];
  alerts: PredictionAlert[];
  loading: boolean;
  error: string | null;
  chartData: ChartDataPoint[];
  refreshPrediction: () => Promise<void>;
  fetchSeasonality: () => Promise<void>;
  dismissAlert: (alertId: string) => void;
}

export function usePredictions(days: number = 30): UsePredictionsReturn {
  const [prediction, setPrediction] = useState<CashFlowPrediction | null>(null);
  const [shortfallRisk, setShortfallRisk] = useState<ShortfallRisk | null>(null);
  const [seasonalPatterns, setSeasonalPatterns] = useState<SeasonalPattern[]>([]);
  const [alerts, setAlerts] = useState<PredictionAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Convert prediction data to chart format
   */
  const convertToChartData = useCallback((
    prediction: CashFlowPrediction,
    historicalData?: { date: Date; balance: number }[]
  ): ChartDataPoint[] => {
    const chartPoints: ChartDataPoint[] = [];
    
    // Add historical data if provided (last 30 days)
    if (historicalData) {
      const recentHistory = historicalData.slice(-30);
      for (const point of recentHistory) {
        chartPoints.push({
          date: point.date.toISOString().split('T')[0],
          balance: point.balance,
          predictedMin: point.balance,
          predictedMax: point.balance,
          isPrediction: false,
          income: 0,
          expenses: 0,
        });
      }
    }

    // Add prediction data
    for (const day of prediction.dailyPredictions) {
      chartPoints.push({
        date: day.date instanceof Date 
          ? day.date.toISOString().split('T')[0] 
          : new Date(day.date).toISOString().split('T')[0],
        balance: day.predictedBalance,
        predictedMin: day.confidenceInterval.min,
        predictedMax: day.confidenceInterval.max,
        isPrediction: true,
        income: day.expectedIncome,
        expenses: day.expectedExpenses,
      });
    }

    return chartPoints;
  }, []);

  /**
   * Fetch prediction from API
   */
  const fetchPrediction = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/predictions/cash-flow?days=${days}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch prediction');
      }

      // Convert date strings back to Date objects
      const predictionData: CashFlowPrediction = {
        ...result.data,
        dateRange: {
          start: new Date(result.data.dateRange.start),
          end: new Date(result.data.dateRange.end),
        },
        dailyPredictions: result.data.dailyPredictions.map((d: any) => ({
          ...d,
          date: new Date(d.date),
        })),
        generatedAt: new Date(result.data.generatedAt),
      };

      setPrediction(predictionData);
      
      // Convert to chart data
      const chartPoints = convertToChartData(predictionData);
      setChartData(chartPoints);

      // Check for shortfall risk
      await fetchShortfallRisk();

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      console.error('[usePredictions] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (controller.signal.aborted === false) {
        setLoading(false);
      }
    }
  }, [days, convertToChartData]);

  /**
   * Fetch shortfall risk
   */
  const fetchShortfallRisk = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/predictions/shortfall-risk`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          },
        }
      );

      if (!response.ok) {
        return; // Shortfall endpoint might return 404 if no risk
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const risk: ShortfallRisk = {
          ...result.data,
          predictedDate: new Date(result.data.predictedDate),
        };
        setShortfallRisk(risk);
        
        // Add alert if high severity
        if (risk.severity === 'high') {
          const alert: PredictionAlert = {
            id: `shortfall-${Date.now()}`,
            userId: '', // Will be set by backend
            type: 'SHORTFALL_WARNING',
            severity: 'high',
            message: `Projected shortfall in ${risk.daysUntil} days: $${risk.projectedDeficit.toFixed(2)}`,
            data: risk,
            createdAt: new Date(),
            read: false,
          };
          setAlerts(prev => [alert, ...prev]);
        }
      }
    } catch (err) {
      console.warn('[usePredictions] Shortfall fetch failed:', err);
    }
  }, []);

  /**
   * Refresh prediction (force recalculation)
   */
  const refreshPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/predictions/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          },
          body: JSON.stringify({ days }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh prediction');
      }

      // Update with fresh data
      const predictionData: CashFlowPrediction = {
        ...result.data,
        dateRange: {
          start: new Date(result.data.dateRange.start),
          end: new Date(result.data.dateRange.end),
        },
        dailyPredictions: result.data.dailyPredictions.map((d: any) => ({
          ...d,
          date: new Date(d.date),
        })),
        generatedAt: new Date(result.data.generatedAt),
      };

      setPrediction(predictionData);
      
      const chartPoints = convertToChartData(predictionData);
      setChartData(chartPoints);

      // Refresh shortfall risk
      await fetchShortfallRisk();

    } catch (err) {
      console.error('[usePredictions] Refresh error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [days, convertToChartData, fetchShortfallRisk]);

  /**
   * Fetch seasonal patterns
   */
  const fetchSeasonality = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/predictions/seasonality`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setSeasonalPatterns(result.data);
      }
    } catch (err) {
      console.warn('[usePredictions] Seasonality fetch failed:', err);
    }
  }, []);

  /**
   * Dismiss an alert
   */
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    prediction,
    shortfallRisk,
    seasonalPatterns,
    alerts,
    loading,
    error,
    chartData,
    refreshPrediction,
    fetchSeasonality,
    dismissAlert,
  };
}

export default usePredictions;
