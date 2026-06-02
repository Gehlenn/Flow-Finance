import { Transaction, TransactionType } from '../../types';
import { makeId, formatCurrency } from '../../utils/helpers';
import { AIInsight } from './insightGenerator';
import { AIMemory } from './aiMemory';
import { getDaysUntilSalaryDay, parseAdaptiveDate } from './adaptiveAIEngineHelpers';

function makeInsight(
  userId: string,
  type: AIInsight['type'],
  message: string,
  severity: AIInsight['severity'],
): AIInsight {
  return {
    id: makeId(),
    user_id: userId,
    type,
    message,
    severity,
    created_at: new Date().toISOString(),
  };
}

export function generateAdaptiveInsights(
  transactions: Transaction[],
  memories: AIMemory[],
  userId: string,
): AIInsight[] {
  const insights: AIInsight[] = [];
  const get = (key: string) => memories.find((memory) => memory.key === key);

  const weekendMem = get('weekend_spending');
  if (weekendMem?.value === 'high' || weekendMem?.value === 'very_high') {
    const weekendTxs = transactions.filter((transaction) => {
      const day = parseAdaptiveDate(transaction.date)?.getDay();
      if (day === undefined) return false;
      return !transaction.generated && transaction.type === TransactionType.DESPESA && (day === 0 || day === 6);
    });
    const total = weekendTxs.reduce((sum, transaction) => sum + transaction.amount, 0);
    if (total > 0) {
      insights.push(makeInsight(
        userId,
        'warning',
        `Você costuma gastar mais nos fins de semana. Nos últimos registros, ${formatCurrency(total)} foram gastos em fins de semana.`,
        weekendMem.value === 'very_high' ? 'medium' : 'low',
      ));
    }
  }

  const deliveryMem = get('delivery_pattern');
  if (deliveryMem?.value === 'heavy' || deliveryMem?.value === 'moderate') {
    insights.push(makeInsight(
      userId,
      'warning',
      `Você tem um padrão ${deliveryMem.value === 'heavy' ? 'intenso' : 'regular'} de gastos com delivery. Preparar refeições em casa pode gerar economia significativa.`,
      deliveryMem.value === 'heavy' ? 'medium' : 'low',
    ));
  }

  const salaryMem = get('salary_day');
  if (salaryMem) {
    const salaryDay = Number.parseInt(salaryMem.value, 10);
    const daysUntil = getDaysUntilSalaryDay(salaryDay);
    if (daysUntil !== null && daysUntil <= 5) {
      insights.push(makeInsight(
        userId,
        'saving',
        `Com base no seu histórico, sua receita costuma entrar por volta do dia ${salaryDay}. Faltam aproximadamente ${daysUntil} dia(s).`,
        'low',
      ));
    }
  }

  const domCatMem = get('dominant_category');
  if (domCatMem) {
    const catTxs = transactions.filter((transaction) =>
      !transaction.generated && transaction.type === TransactionType.DESPESA && transaction.category === domCatMem.value
    );
    const catTotal = catTxs.reduce((sum, transaction) => sum + transaction.amount, 0);
    if (catTotal > 0) {
      insights.push(makeInsight(
        userId,
        'spending',
        `"${domCatMem.value}" é sua categoria dominante com ${formatCurrency(catTotal)} no histórico. Você tem preferência consistente por esta área.`,
        'low',
      ));
    }
  }

  const merchantMemories = memories.filter((memory) => memory.key.startsWith('merchant_') && memory.value === 'frequent');
  if (merchantMemories.length >= 3) {
    insights.push(makeInsight(
      userId,
      'spending',
      `Você tem ${merchantMemories.length} estabelecimento(s) favorito(s) recorrentes. Fidelidade a poucos lugares pode facilitar o controle de gastos.`,
      'low',
    ));
  }

  return insights;
}
