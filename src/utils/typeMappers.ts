// Mappers utilitários para conversão entre tipos de API, domínio e storage
// Padrão: camelCase, datas ISO string, enums TS

import { Transaction, TransactionType, Category, Reminder, ReminderType } from '../../types';
import { Account } from '../../models/Account';
// import { User, FinancialGoal, Subscription, BankConnection, SubscriptionPlan } from '../domain/entities'; // Descomente se for expandir mappers

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value ?? fallback) || fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && allowed.includes(value as T)) {
    return value as T;
  }

  return fallback;
}

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
export function toDomainTransaction(api: Partial<Record<string, unknown>>): Transaction {
  if (!api) throw new Error('Objeto de entrada inválido para toDomainTransaction');
  return {
    id: readString(api.id),
    amount: readNumber(api.amount),
    type: readOneOf(api.type, Object.values(TransactionType) as TransactionType[], TransactionType.DESPESA),
    category: readOneOf(api.category, Object.values(Category) as Category[], Category.PESSOAL),
    description: readString(api.description),
    date: normalizeMapperDate(api.date),
    account_id: readString(api.account_id ?? api.accountId),
    merchant: readString(api.merchant),
    payment_method: readOneOf(api.payment_method, ['cash', 'credit_card', 'debit_card', 'pix', 'transfer'] as const, 'cash'),
    source: readOneOf(api.source, ['manual', 'ai_text', 'ai_image', 'import'] as const, 'manual'),
    confidence_score: readNumber(api.confidence_score),
    receipt_image: readString(api.receipt_image),
    recurring: readBoolean(api.recurring),
    recurrence_type: readOneOf(api.recurrence_type, ['daily', 'weekly', 'monthly'] as const, 'monthly'),
    recurrence_interval: readNumber(api.recurrence_interval),
    generated: readBoolean(api.generated ?? api.isGenerated),
  };
}


/**
 * Converte Transaction do domínio para formato de API.
 * @param domain Transaction
 */
export function toApiTransaction(domain: Transaction): Record<string, unknown> {
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
export function toDomainAccount(api: Partial<Record<string, unknown>>): Account {
  if (!api) throw new Error('Objeto de entrada inválido para toDomainAccount');
  return {
    id: readString(api.id),
    user_id: readString(api.user_id ?? api.userId),
    name: readString(api.name),
    type: readOneOf(api.type, ['bank', 'cash', 'credit_card', 'investment'] as const, 'cash'),
    balance: readNumber(api.balance),
    currency: readString(api.currency, 'BRL'),
    created_at: typeof api.created_at === 'string' ? api.created_at : normalizeMapperDate(api.createdAt),
  };
}


/**
 * Converte Account do domínio para formato de API.
 * @param domain Account
 */
export function toApiAccount(domain: Account): Record<string, unknown> {
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
export function toDomainReminder(api: Partial<Record<string, unknown>>): Reminder {
  if (!api) throw new Error('Objeto de entrada inválido para toDomainReminder');
  return {
    id: readString(api.id),
    title: readString(api.title),
    date: normalizeMapperDate(api.date),
    type: readOneOf(api.type, Object.values(ReminderType) as ReminderType[], ReminderType.PESSOAL),
    amount: readNumber(api.amount),
    completed: readBoolean(api.completed),
    priority: readOneOf(api.priority, ['baixa', 'media', 'alta'] as const, 'media'),
    isRecurring: readBoolean(api.isRecurring),
  };
}


/**
 * Converte Reminder do domínio para formato de API.
 * @param domain Reminder
 */
export function toApiReminder(domain: Reminder): Record<string, unknown> {
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
