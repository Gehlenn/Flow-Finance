import { Transaction, Goal } from '../../../types';
import { Account } from '../../../models/Account';
import { generateFinancialInsights } from '../insightGenerator';
import { predictCashflow } from '../../finance/cashflowPredictor';
import { generateMonthlyReport } from '../../finance/reportEngine';
import { detectFinancialLeaks } from '../leakDetector';
import { runFinancialAutopilot } from '../financialAutopilot';
import { detectFinancialRisks } from '../riskAnalyzer';
import { detectSubscriptions } from '../subscriptionDetector';
import { detectSalary } from '../salaryDetector';
import { detectFixedExpenses } from '../fixedExpenseDetector';
import { AITask, AITaskType } from './taskTypes';

type AIWorkerPayload = {
  transactions?: Transaction[];
  accounts?: Account[];
  goals?: Goal[];
  [key: string]: unknown;
};

export async function executeAIWorkerTask(task: AITask): Promise<unknown> {
  const { type, userId } = task;
  const payload = task.payload as AIWorkerPayload;

  switch (type) {
    case AITaskType.INSIGHT_GENERATION:
      return generateFinancialInsights(payload.transactions || [], userId, payload.accounts || []);
    case AITaskType.CASHFLOW_SIMULATION:
      return predictCashflow(payload.accounts || [], payload.transactions || []);
    case AITaskType.FINANCIAL_REPORT:
      return generateMonthlyReport(payload.transactions || []);
    case AITaskType.LEAK_DETECTION:
      return detectFinancialLeaks(payload.transactions || []);
    case AITaskType.AUTOPILOT_ANALYSIS: {
      const prediction = predictCashflow(payload.accounts || [], payload.transactions || []);
      const insights = generateFinancialInsights(payload.transactions || [], userId, payload.accounts || []);
      return runFinancialAutopilot(payload.accounts || [], payload.transactions || [], prediction, insights);
    }
    case AITaskType.RISK_ANALYSIS: {
      const prediction = predictCashflow(payload.accounts || [], payload.transactions || []);
      return detectFinancialRisks(prediction);
    }
    case AITaskType.SUBSCRIPTION_DETECTION:
      return detectSubscriptions(payload.transactions || []);
    case AITaskType.SALARY_DETECTION:
      return detectSalary(payload.transactions || []);
    case AITaskType.FIXED_EXPENSE_DETECTION:
      return detectFixedExpenses(payload.transactions || []);
    default:
      throw new Error(`Unknown task type: ${type}`);
  }
}
