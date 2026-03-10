import { FinancialPatterns } from '../patternDetector/financialPatternDetector';
import { DetectedRecurringTransaction } from './recurringDetector';

export interface CashflowForecast {
  currentBalance: number;
  in7Days: number;
  in30Days: number;
  in90Days: number;
}

interface ForecastCalculatorInput {
  balance: number;
  recurring: DetectedRecurringTransaction[];
  patterns?: FinancialPatterns;
}

function expectedOccurrences(recurring: DetectedRecurringTransaction, horizonDays: number): number {
  const cadence = Math.max(1, recurring.cadenceDays || 30);
  return Math.max(0, Math.floor(horizonDays / cadence));
}

function weeklySpikeAdjustment(patterns: FinancialPatterns | undefined, horizonDays: number): number {
  if (!patterns || patterns.weeklySpikes.length === 0) {
    return 0;
  }

  const totalSpikeSpend = patterns.weeklySpikes.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0
  );
  const averageWeeklySpike = totalSpikeSpend / patterns.weeklySpikes.length;
  return averageWeeklySpike * (horizonDays / 7);
}

export const forecastCalculator = {
  calculate({ balance, recurring, patterns }: ForecastCalculatorInput): CashflowForecast {
    const forecast: CashflowForecast = {
      currentBalance: balance,
      in7Days: balance,
      in30Days: balance,
      in90Days: balance,
    };

    for (const recurringTransaction of recurring) {
      forecast.in7Days -= recurringTransaction.amount * expectedOccurrences(recurringTransaction, 7);
      forecast.in30Days -= recurringTransaction.amount * expectedOccurrences(recurringTransaction, 30);
      forecast.in90Days -= recurringTransaction.amount * expectedOccurrences(recurringTransaction, 90);
    }

    forecast.in7Days -= weeklySpikeAdjustment(patterns, 7);
    forecast.in30Days -= weeklySpikeAdjustment(patterns, 30);
    forecast.in90Days -= weeklySpikeAdjustment(patterns, 90);

    return forecast;
  },
};