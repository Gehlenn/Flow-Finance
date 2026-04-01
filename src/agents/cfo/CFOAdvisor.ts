import { calculateCashflowSummary } from '../../engines/finance/cashflowEngine';
import { buildMonthlyForecast } from '../../engines/finance/forecastEngine';
import { classifyFinancialProfile } from '../../engines/ai/financialProfileClassifier';
import { runAIOrchestrator } from '../../engines/ai/aiOrchestrator';
import { FinancialAutopilot } from '../../engines/autopilot/financialAutopilot';
import { createUserContext } from '../../context/UserContext';
import { Category, Transaction, TransactionType } from '../../../types';
import { Transaction as DomainTransaction } from '../../domain/entities';
import { AICFOAgent } from './AICFOAgent';
import { CFOPlanner } from './CFOPlanner';

type TransactionReader = {
  getByUser(userId: string): Promise<DomainTransaction[]>;
};

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

  constructor(private readonly transactionReader?: TransactionReader) {}

  private normalizeDomainTransactions(transactions: DomainTransaction[]): Transaction[] {
    return transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type === 'income' ? TransactionType.RECEITA : TransactionType.DESPESA,
      category: Object.values(Category).includes(tx.category as Category)
        ? (tx.category as Category)
        : Category.PESSOAL,
      description: tx.description,
      date: tx.date instanceof Date ? tx.date.toISOString() : new Date(tx.date).toISOString(),
      merchant: tx.merchant,
      generated: tx.isGenerated,
    }));
  }

  async advise(input: CFOAdvisorInput): Promise<CFOAdvisorResult> {
    const transactions = input.transactions ||
      (this.transactionReader
        ? this.normalizeDomainTransactions(await this.transactionReader.getByUser(input.userId))
        : []);

    const userContext = createUserContext({ userId: input.userId });

    const summary = calculateCashflowSummary(transactions);
    const forecast = buildMonthlyForecast(transactions, 6);
    const profile = classifyFinancialProfile(transactions);

    await runAIOrchestrator({
      userContext,
      transactions,
      memory: {
        monthlyIncome: input.monthlyIncome,
        monthlyExpenses: input.monthlyExpenses,
        profile,
      },
    });

    const insights = await this.cfoAgent.analyzeFinancialState({
      balance: input.balance,
      income: summary.income,
      expenses: summary.expenses,
      userId: input.userId,
      profile: profile.profile,
      transactions,
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
      userId: input.userId,
      transactions,
    });

    return {
      insights,
      plan,
      autopilotAlerts,
      forecast,
    };
  }
}
