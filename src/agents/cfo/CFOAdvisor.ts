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

function parseCfoAdvisorDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const parsed = new Date(year, month, day);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCfoDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCfoAdvisorDate(value: string | Date): string {
  if (value instanceof Date) {
    return formatCfoDateKey(value);
  }

  const parsed = parseCfoAdvisorDate(value);
  return parsed ? formatCfoDateKey(parsed) : new Date().toISOString();
}

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
      date: normalizeCfoAdvisorDate(tx.date),
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
