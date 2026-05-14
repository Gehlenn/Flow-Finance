// Mappers utilitários para conversão entre tipos de API, domínio e storage
// Padrão: camelCase, datas ISO string, enums TS

import { Transaction, TransactionType, Category, Reminder, ReminderType } from '../../types';
import { Account } from '../../models/Account';
// import { User, FinancialGoal, Subscription, BankConnection, SubscriptionPlan } from '../domain/entities'; // Descomente se for expandir mappers

function normalizeMapperDate(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return trimmed;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }

  const parsed = new Date(value as never);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}


/**
 * Converte objeto de API para Transaction do domínio.
 * @param api Objeto vindo da API
 */
export function toDomainTransaction(api: Partial<Record<string, any>>): Transaction {
  if (!api) throw new Error('Objeto de entrada inválido para toDomainTransaction');
  return {
    id: api.id,
    amount: api.amount,
    type: api.type as TransactionType,
    category: api.category as Category,
    description: api.description,
    date: normalizeMapperDate(api.date),
    account_id: api.account_id ?? api.accountId,
    merchant: api.merchant,
    payment_method: api.payment_method,
    source: api.source,
    confidence_score: api.confidence_score,
    receipt_image: api.receipt_image,
    recurring: api.recurring,
    recurrence_type: api.recurrence_type,
    recurrence_interval: api.recurrence_interval,
    generated: api.generated ?? api.isGenerated,
  };
}


/**
 * Converte Transaction do domínio para formato de API.
 * @param domain Transaction
 */
export function toApiTransaction(domain: Transaction): Record<string, any> {
  if (!domain) throw new Error('Objeto de entrada inválido para toApiTransaction');
  return {
    id: domain.id,
    amount: domain.amount,
    type: domain.type,
    category: domain.category,
    description: domain.description,
    date: domain.date,
    account_id: domain.account_id,
    merchant: domain.merchant,
    payment_method: domain.payment_method,
    source: domain.source,
    confidence_score: domain.confidence_score,
    receipt_image: domain.receipt_image,
    recurring: domain.recurring,
    recurrence_type: domain.recurrence_type,
    recurrence_interval: domain.recurrence_interval,
    generated: domain.generated,
  };
}


/**
 * Converte objeto de API para Account do domínio.
 * @param api Objeto vindo da API
 */
export function toDomainAccount(api: Partial<Record<string, any>>): Account {
  if (!api) throw new Error('Objeto de entrada inválido para toDomainAccount');
  return {
    id: api.id,
    user_id: api.user_id ?? api.userId,
    name: api.name,
    type: api.type,
    balance: api.balance,
    currency: api.currency,
    created_at: typeof api.created_at === 'string' ? api.created_at : normalizeMapperDate(api.createdAt),
  };
}


/**
 * Converte Account do domínio para formato de API.
 * @param domain Account
 */
export function toApiAccount(domain: Account): Record<string, any> {
  if (!domain) throw new Error('Objeto de entrada inválido para toApiAccount');
  return {
    id: domain.id,
    user_id: domain.user_id,
    name: domain.name,
    type: domain.type,
    balance: domain.balance,
    currency: domain.currency,
    created_at: domain.created_at,
  };
}


/**
 * Converte objeto de API para Reminder do domínio.
 * @param api Objeto vindo da API
 */
export function toDomainReminder(api: Partial<Record<string, any>>): Reminder {
  if (!api) throw new Error('Objeto de entrada inválido para toDomainReminder');
  return {
    id: api.id,
    title: api.title,
    date: normalizeMapperDate(api.date),
    type: api.type as ReminderType,
    amount: api.amount,
    completed: api.completed ?? false,
    priority: api.priority,
    isRecurring: api.isRecurring,
  };
}


/**
 * Converte Reminder do domínio para formato de API.
 * @param domain Reminder
 */
export function toApiReminder(domain: Reminder): Record<string, any> {
  if (!domain) throw new Error('Objeto de entrada inválido para toApiReminder');
  return {
    id: domain.id,
    title: domain.title,
    date: domain.date,
    type: domain.type,
    amount: domain.amount,
    completed: domain.completed,
    priority: domain.priority,
    isRecurring: domain.isRecurring,
  };
}

// Add more mappers as needed (User, Goal, etc.) when integrating with domain entities.
