import { Transaction } from '../../../../types';
import { FinancialPatterns, financialPatternDetector } from '../patternDetector/financialPatternDetector';
import { recurringDetector } from './recurringDetector';
import { CashflowForecast, forecastCalculator } from './forecastCalculator';

export interface CashflowPredictionContext {
  balance: number;
  transactions: Transaction[];
  patterns?: FinancialPatterns;
}

export class CashflowPredictionEngine {
  predict(context: CashflowPredictionContext): CashflowForecast {
    const patterns = context.patterns || financialPatternDetector.detectPatterns(context.transactions);
    const recurring = recurringDetector.detect(context.transactions);

    return forecastCalculator.calculate({
      balance: context.balance,
      recurring,
      patterns,
    });
  }
}

export const cashflowPredictionEngine = new CashflowPredictionEngine();