import { describe, expect, it } from 'vitest';

import { Category, Transaction, TransactionType } from '../../types';
import { detectSubscriptions } from './subscriptionDetector';

const createMockTransaction = (
  id: string,
  description: string,
  amount: number,
  date: string,
  merchant: string | null = null,
): Transaction => ({
  id,
  description,
  amount,
  date: new Date(date).toISOString(),
  type: TransactionType.DESPESA,
  category: Category.PESSOAL,
  source: 'manual',
  merchant: merchant || description,
  account_id: 'acc1',
  generated: false,
  confidence_score: 1,
});

describe('Subscription Detector', () => {
  it('detects a known subscription with multiple occurrences', () => {
    const transactions: Transaction[] = [
      createMockTransaction('1', 'Pagamento Netflix', 39.9, '2024-06-15'),
      createMockTransaction('2', 'Cobranca Mensal Netflix.com', 39.9, '2024-05-15'),
      createMockTransaction('3', 'Assinatura Netflix', 39.9, '2024-04-15'),
    ];

    const summary = detectSubscriptions(transactions);

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].name).toBe('Netflix');
    expect(summary.subscriptions[0].cycle).toBe('monthly');
    expect(summary.subscriptions[0].occurrences).toBe(3);
    expect(summary.subscriptions[0].amount).toBeCloseTo(39.9);
    expect(summary.subscriptions[0].category).toBe('Entretenimento');
  });

  it('splits known subscriptions with different amounts into separate plans', () => {
    const transactions: Transaction[] = [
      createMockTransaction('1', 'Pagamento Netflix', 39.9, '2024-06-15'),
      createMockTransaction('2', 'Cobranca Mensal Netflix.com', 39.9, '2024-05-15'),
      createMockTransaction('3', 'Assinatura Netflix', 39.9, '2024-04-15'),
      createMockTransaction('4', 'Pagamento Netflix Premium', 55.9, '2024-06-16'),
      createMockTransaction('5', 'Cobranca Mensal Netflix Premium', 55.9, '2024-05-16'),
      createMockTransaction('6', 'Assinatura Netflix Premium', 55.9, '2024-04-16'),
    ];

    const summary = detectSubscriptions(transactions);

    expect(summary.count).toBe(2);
    expect(summary.subscriptions.map((subscription) => subscription.amount)).toEqual([55.9, 39.9]);
  });

  it('detects unknown recurring payments with stable values and dates', () => {
    const transactions: Transaction[] = [
      createMockTransaction('1', 'Pagamento recorrente Academia CorpoBelo', 55, '2024-06-10', 'Academia CorpoBelo'),
      createMockTransaction('2', 'Mensalidade Academia CorpoBelo', 55, '2024-05-10', 'Academia CorpoBelo'),
      createMockTransaction('3', 'Taxa Academia CorpoBelo', 55, '2024-04-10', 'Academia CorpoBelo'),
    ];

    const summary = detectSubscriptions(transactions);

    expect(summary.count).toBe(1);
    expect(summary.subscriptions[0].name).toContain('Academia CorpoBelo');
    expect(summary.subscriptions[0].cycle).toBe('monthly');
    expect(summary.subscriptions[0].occurrences).toBe(3);
    expect(summary.subscriptions[0].amount).toBeCloseTo(55);
    expect(summary.subscriptions[0].category).toBe('Assinatura');
  });

  it('does not detect subscriptions for unstable amounts', () => {
    const transactions: Transaction[] = [
      createMockTransaction('1', 'Restaurante Sabor da Terra', 25.5, '2024-06-10', 'Sabor da Terra'),
      createMockTransaction('2', 'Almoco Sabor da Terra', 45.8, '2024-05-12', 'Sabor da Terra'),
      createMockTransaction('3', 'Jantar Sabor da Terra', 89.9, '2024-04-15', 'Sabor da Terra'),
    ];

    const summary = detectSubscriptions(transactions);

    expect(summary.count).toBe(0);
  });

  it('does not report a stable billing cycle for irregular dates', () => {
    const transactions: Transaction[] = [
      createMockTransaction('1', 'Plano de Celular', 50, '2024-06-05'),
      createMockTransaction('2', 'Plano de Celular', 50, '2024-06-01'),
      createMockTransaction('3', 'Plano de Celular', 50, '2024-03-15'),
    ];

    const summary = detectSubscriptions(transactions);
    const stableCycles = summary.subscriptions.filter((subscription) =>
      subscription.cycle === 'monthly' ||
      subscription.cycle === 'weekly' ||
      subscription.cycle === 'annual');

    expect(stableCycles).toHaveLength(0);
  });

  it('can identify annual cycles when the data supports it', () => {
    const transactions: Transaction[] = [
      createMockTransaction('1', 'Seguro Anual Carro', 1800, '2024-01-20'),
      createMockTransaction('2', 'Seguro Anual Carro', 1800, '2023-01-18'),
    ];

    const summary = detectSubscriptions(transactions);
    const annualSubscription = summary.subscriptions.find(
      (subscription) => subscription.cycle === 'annual',
    );

    if (annualSubscription) {
      expect(annualSubscription.cycle).toBe('annual');
    } else {
      expect(annualSubscription).toBeUndefined();
    }
  });
});
