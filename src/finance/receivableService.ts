import type { Receivable, Reminder, Transaction } from '../../types';
import { TransactionType } from '../../types';
import { addMoney, compareMoney, sumTransactions } from '../security/moneyMath';
import type { CashflowTimeframe } from '../engines/finance/analyticsEngine';

export type ReceivableAggregate = {
  confirmed: number;
  pending: number;
  overdue: number;
  projected: number;
};

type ReceivableMirrorContext = {
  userId?: string | null;
  tenantId?: string | null;
  workspaceId?: string | null;
  createId?: () => string;
  now?: () => string;
};

type ReceivableAggregateOptions = {
  confirmedRange?: { start?: Date; end?: Date };
  pendingRange?: { start?: Date; end?: Date };
  overdueRange?: { start?: Date; end?: Date };
};

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(referenceDate: Date): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
}

function endOfDay(referenceDate: Date): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);
}

function getNow(now?: () => string): string {
  return now ? now() : new Date().toISOString();
}

function createId(createId?: () => string): string {
  if (createId) {
    return createId();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tmp_${crypto.randomUUID()}`;
  }

  return `tmp_${Math.random().toString(36).slice(2, 11)}`;
}

function hasFinancialImpact(reminder: Reminder): boolean {
  return Boolean(reminder.amount && compareMoney(reminder.amount, 0) > 0);
}

function isCancelledReminder(reminder: Reminder): boolean {
  const reminderRecord = reminder as Reminder & { status?: string | null };
  const normalized = String(reminderRecord.status || '').trim().toLowerCase();
  return normalized === 'cancelled' || normalized === 'canceled' || normalized === 'cancelado';
}

function matchesRange(dateIso: string | null | undefined, range?: { start?: Date; end?: Date }): boolean {
  if (!range) {
    return true;
  }

  const parsed = parseDate(dateIso || undefined);
  if (!parsed) {
    return false;
  }

  if (range.start && parsed.getTime() < range.start.getTime()) {
    return false;
  }

  if (range.end && parsed.getTime() > range.end.getTime()) {
    return false;
  }

  return true;
}

export function isReceivableRealized(receivable: Receivable): boolean {
  return receivable.status === 'realized' || compareMoney(receivable.realized_amount || 0, 0) > 0;
}

export function isReceivableCancelled(receivable: Receivable): boolean {
  return receivable.status === 'cancelled';
}

export function isReceivableOverdue(receivable: Receivable, referenceDate: Date = new Date()): boolean {
  if (isReceivableCancelled(receivable) || isReceivableRealized(receivable)) {
    return false;
  }

  const dueDate = parseDate(receivable.due_date);
  if (!dueDate) {
    return false;
  }

  return dueDate.getTime() < startOfDay(referenceDate).getTime();
}

export function isReceivablePending(receivable: Receivable, referenceDate: Date = new Date()): boolean {
  if (isReceivableCancelled(receivable) || isReceivableRealized(receivable)) {
    return false;
  }

  const dueDate = parseDate(receivable.due_date);
  if (!dueDate) {
    return false;
  }

  return dueDate.getTime() >= startOfDay(referenceDate).getTime();
}

export function createReceivableFromReminder(
  reminder: Reminder,
  context: ReceivableMirrorContext = {},
  existingReceivable?: Receivable | null,
): Receivable | null {
  if (!hasFinancialImpact(reminder)) {
    return null;
  }

  const now = getNow(context.now);
  const normalizedAmount = reminder.amount || 0;
  const status = isCancelledReminder(reminder)
    ? 'cancelled'
    : reminder.completed
      ? 'realized'
      : 'open';

  return {
    id: existingReceivable?.id || createId(context.createId),
    user_id: context.userId || existingReceivable?.user_id || undefined,
    tenant_id: context.tenantId || existingReceivable?.tenant_id || undefined,
    workspace_id: context.workspaceId || existingReceivable?.workspace_id || undefined,
    description: reminder.title.trim() || existingReceivable?.description || 'Recebivel Flow',
    expected_amount: normalizedAmount,
    realized_amount: reminder.completed ? normalizedAmount : 0,
    due_date: reminder.date,
    realized_at: reminder.completed ? now : null,
    status,
    source: existingReceivable?.source === 'reminder_migration' ? 'reminder_migration' : 'manual',
    source_ref: reminder.id,
    customer_label: existingReceivable?.customer_label,
    created_at: existingReceivable?.created_at || now,
    updated_at: now,
  };
}

export function upsertReminderReceivable(
  receivables: Receivable[],
  reminder: Reminder,
  context: ReceivableMirrorContext = {},
): Receivable[] {
  const existingIndex = receivables.findIndex((receivable) => receivable.source_ref === reminder.id);
  const existingReceivable = existingIndex >= 0 ? receivables[existingIndex] : null;
  const mirrored = createReceivableFromReminder(reminder, context, existingReceivable);

  if (!mirrored) {
    if (existingIndex < 0) {
      return receivables;
    }
    return receivables.filter((receivable) => receivable.source_ref !== reminder.id);
  }

  if (existingIndex < 0) {
    return [mirrored, ...receivables];
  }

  return receivables.map((receivable, index) => (index === existingIndex ? mirrored : receivable));
}

export function removeReminderReceivable(receivables: Receivable[], reminderId: string): Receivable[] {
  return receivables.filter((receivable) => receivable.source_ref !== reminderId);
}

export function createSyntheticReceivableFromTransaction(
  transaction: Transaction,
  context: ReceivableMirrorContext = {},
): Receivable | null {
  if (transaction.type !== TransactionType.RECEITA || !transaction.generated || compareMoney(transaction.amount, 0) <= 0) {
    return null;
  }

  const now = getNow(context.now);

  return {
    id: `synthetic_tx_${transaction.id}`,
    user_id: transaction.user_id || context.userId || undefined,
    tenant_id: transaction.tenant_id || context.tenantId || undefined,
    workspace_id: transaction.workspace_id || context.workspaceId || undefined,
    description: transaction.description?.trim() || 'Recebivel gerado por transacao',
    expected_amount: transaction.amount,
    realized_amount: 0,
    due_date: transaction.date,
    realized_at: null,
    status: 'open',
    source: 'transaction_link',
    source_ref: transaction.id,
    created_at: now,
    updated_at: now,
  };
}

export function mergeReceivableSources(input: {
  receivables?: Receivable[];
  reminders?: Reminder[];
  transactions?: Transaction[];
  context?: ReceivableMirrorContext;
}): Receivable[] {
  const merged = new Map<string, Receivable>();

  for (const receivable of input.receivables || []) {
    merged.set(receivable.id, receivable);
  }

  const hasSourceRef = (sourceRef?: string) => {
    if (!sourceRef) {
      return false;
    }

    for (const receivable of merged.values()) {
      if (receivable.source_ref === sourceRef) {
        return true;
      }
    }

    return false;
  };

  for (const reminder of input.reminders || []) {
    if (!hasFinancialImpact(reminder) || hasSourceRef(reminder.id)) {
      continue;
    }

    const mirrored = createReceivableFromReminder(reminder, input.context);
    if (mirrored) {
      merged.set(mirrored.id, mirrored);
    }
  }

  for (const transaction of input.transactions || []) {
    if (hasSourceRef(transaction.id)) {
      continue;
    }

    const synthetic = createSyntheticReceivableFromTransaction(transaction, input.context);
    if (synthetic) {
      merged.set(synthetic.id, synthetic);
    }
  }

  return Array.from(merged.values()).sort((left, right) => String(left.due_date).localeCompare(String(right.due_date), 'pt-BR'));
}

export function aggregateReceivables(
  receivables: Receivable[],
  referenceDate: Date = new Date(),
  options: ReceivableAggregateOptions = {},
): ReceivableAggregate {
  let confirmed = 0;
  let pending = 0;
  let overdue = 0;

  for (const receivable of receivables) {
    if (isReceivableCancelled(receivable)) {
      continue;
    }

    if (isReceivableRealized(receivable)) {
      if (matchesRange(receivable.realized_at, options.confirmedRange)) {
        confirmed = addMoney(confirmed, receivable.realized_amount || receivable.expected_amount || 0);
      }
      continue;
    }

    if (isReceivableOverdue(receivable, referenceDate)) {
      if (matchesRange(receivable.due_date, options.overdueRange)) {
        overdue = addMoney(overdue, receivable.expected_amount || 0);
      }
      continue;
    }

    if (matchesRange(receivable.due_date, options.pendingRange)) {
      pending = addMoney(pending, receivable.expected_amount || 0);
    }
  }

  return {
    confirmed,
    pending,
    overdue,
    projected: addMoney(pending, overdue),
  };
}

export function buildDashboardReceivableAggregate(
  receivables: Receivable[],
  referenceDate: Date = new Date(),
): ReceivableAggregate {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = endOfDay(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0));

  return aggregateReceivables(receivables, referenceDate, {
    confirmedRange: { start: monthStart, end: monthEnd },
    pendingRange: { start: monthStart, end: monthEnd },
  });
}

function buildTimeframeRange(
  timeframe: CashflowTimeframe,
  referenceDate: Date = new Date(),
  dateStart?: string,
  dateEnd?: string,
): { start?: Date; end?: Date } {
  const end = endOfDay(referenceDate);

  if (timeframe === '7d') {
    return { start: startOfDay(new Date(referenceDate.getTime() - (7 * 24 * 60 * 60 * 1000))), end };
  }

  if (timeframe === '30d') {
    return { start: startOfDay(new Date(referenceDate.getTime() - (30 * 24 * 60 * 60 * 1000))), end };
  }

  if (timeframe === '12m') {
    return { start: new Date(referenceDate.getFullYear(), 0, 1), end };
  }

  if (timeframe === 'custom') {
    return {
      start: parseDate(dateStart || undefined) || undefined,
      end: parseDate(dateEnd || undefined) ? endOfDay(parseDate(dateEnd || undefined)!) : end,
    };
  }

  return {};
}

export function filterReceivablesByTimeframe(
  receivables: Receivable[],
  timeframe: CashflowTimeframe,
  dateStart?: string,
  dateEnd?: string,
  referenceDate: Date = new Date(),
): Receivable[] {
  const range = buildTimeframeRange(timeframe, referenceDate, dateStart, dateEnd);

  return receivables.filter((receivable) => {
    if (isReceivableCancelled(receivable)) {
      return false;
    }

    if (isReceivableRealized(receivable)) {
      return matchesRange(receivable.realized_at, range);
    }

    return matchesRange(receivable.due_date, range);
  });
}

export function buildReceivableStateSummary(
  receivables: Receivable[],
  referenceDate: Date = new Date(),
): ReceivableAggregate {
  return aggregateReceivables(receivables, referenceDate);
}

export function sumReceivableAmounts(receivables: Receivable[]): number {
  return sumTransactions(receivables.map((receivable) => receivable.expected_amount || 0));
}
