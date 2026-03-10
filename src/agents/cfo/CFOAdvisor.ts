import { calculateCashflowSummary } from '../../engines/finance/cashflowEngine';
import { buildMonthlyForecast } from '../../engines/finance/forecastEngine';
import { runAIOrchestrator } from '../../engines/ai/aiOrchestrator';
import { FinancialAutopilot } from '../../engines/autopilot/financialAutopilot';
import { createUserContext } from '../../context/UserContext';
import { Transaction } from '../../../types';
import { AICFOAgent } from './AICFOAgent';
import { CFOPlanner } from './CFOPlanner';
import { TransactionRepository } from '../../repositories';

export interface CFOAdvisorInput {
  userId: string;
  transactions?: Transaction[];
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
}

export interface CFOAdvisorResult {
  insights: string[];
  plan: ReturnType<CFOPlanner['generatePlan']>;
  autopilotAlerts: Array<{ type: string; message: string }>;
  forecast: ReturnType<typeof buildMonthlyForecast>;
}

export class CFOAdvisor {
  private readonly cfoAgent = new AICFOAgent();
  private readonly planner = new CFOPlanner();
  private readonly autopilot = new FinancialAutopilot();

  constructor(private readonly transactionRepository?: TransactionRepository) {}

  async advise(input: CFOAdvisorInput): Promise<CFOAdvisorResult> {
    const transactions = input.transactions ||
      (this.transactionRepository ? await this.transactionRepository.getByUser(input.userId) : []);

    const userContext = createUserContext({ userId: input.userId });

    const summary = calculateCashflowSummary(transactions);
    const forecast = buildMonthlyForecast(transactions, 6);

    await runAIOrchestrator({
      userContext,
      transactions,
      memory: {
        monthlyIncome: input.monthlyIncome,
        monthlyExpenses: input.monthlyExpenses,
      },
    });

    const insights = await this.cfoAgent.analyzeFinancialState({
      balance: input.balance,
      income: summary.income,
      expenses: summary.expenses,
    });

    const plan = this.planner.generatePlan({
      balance: input.balance,
      income: input.monthlyIncome,
      expenses: input.monthlyExpenses,
    });

    const autopilotAlerts = this.autopilot.analyze({
      monthlyExpenses: input.monthlyExpenses,
      monthlyIncome: input.monthlyIncome,
      currentBalance: input.balance,
    });

    return {
      insights,
      plan,
      autopilotAlerts,
      forecast,
    };
  }
}
