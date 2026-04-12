import { createHash } from 'crypto';
import { recordAuditEvent } from './admin/auditLog';
import { getWorkspaceAsync } from './admin/workspaceStore';
import { pullSyncItems, pushSyncItems } from './sync/cloudSyncStore';
import { AppError } from '../middleware/errorHandler';
import type { IntegrationReminderInput, IntegrationTransactionInput } from '../validation/businessIntegration.schema';

type IntegrationAction = 'created' | 'updated' | 'replayed';

type IntegrationIngestResponse = {
  ok: true;
  workspaceId: string;
  sourceSystem: string;
  externalRecordId: string;
  action: IntegrationAction;
  entity: 'transaction' | 'reminder';
  storedAs: 'transactions' | 'reminders';
};

function toIntegrationUserId(sourceSystem: string): string {
  return `integration:${sourceSystem}`;
}

function buildDeterministicId(kind: 'transaction' | 'reminder', sourceSystem: string, externalRecordId: string): string {
  const digest = createHash('sha256')
    .update(`${kind}:${sourceSystem}:${externalRecordId}`)
    .digest('hex')
    .slice(0, 24);

  return `int_${kind}_${digest}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeCategory(raw?: string): 'Pessoal' | 'Trabalho / Consultório' | 'Negócio' | 'Investimento' {
  if (!raw) return 'Negócio';
  const lower = raw.toLowerCase();
  if (lower.includes('invest')) return 'Investimento';
  if (lower.includes('pessoal') || lower.includes('personal')) return 'Pessoal';
  if (lower.includes('trabalho') || lower.includes('operac') || lower.includes('service')) return 'Trabalho / Consultório';
  return 'Negócio';
}

function normalizeReminderType(kind: 'financial' | 'operational'): 'Negócio' | 'Trabalho' {
  return kind === 'financial' ? 'Negócio' : 'Trabalho';
}

function normalizeReminderPriority(priority?: 'low' | 'medium' | 'high', overdue = false): 'baixa' | 'media' | 'alta' {
  if (overdue || priority === 'high') return 'alta';
  if (priority === 'medium') return 'media';
  return 'baixa';
}

function mapConfirmedTransactionType(input: IntegrationTransactionInput): 'Receita' | 'Despesa' {
  if (input.type === 'income' || input.type === 'receivable') return 'Receita';
  return 'Despesa';
}

function shouldMaterializeTransactionAsReminder(input: IntegrationTransactionInput): boolean {
  return (input.type === 'receivable' || input.type === 'payable') && input.status !== 'confirmed';
}

export async function ingestIntegrationTransaction(
  input: IntegrationTransactionInput,
): Promise<IntegrationIngestResponse> {
  const workspace = await getWorkspaceAsync(input.workspaceId);
  if (!workspace) {
    throw new AppError(404, 'Workspace not found for integration ingestion');
  }

  const integrationUserId = toIntegrationUserId(input.sourceSystem);
  const materializeAsReminder = shouldMaterializeTransactionAsReminder(input);
  const storedAs = materializeAsReminder ? 'reminders' : 'transactions';
  const entity = materializeAsReminder ? 'reminder' : 'transaction';
  const recordId = buildDeterministicId(entity, input.sourceSystem, input.externalRecordId);
  const currentState = await pullSyncItems(input.workspaceId);
  const existing = currentState.entities[storedAs].find((item) => item.id === recordId && !item.deleted);
  const updatedAt = new Date().toISOString();

  const payload = materializeAsReminder
    ? {
        id: recordId,
        title: input.description,
        date: input.dueAt || input.occurredAt,
        type: 'Negócio' as const,
        amount: input.amount,
        completed: false,
        priority: normalizeReminderPriority(undefined, input.status === 'overdue'),
        source: 'integration',
        integration_status: input.status,
        integration_type: input.type,
        source_system: input.sourceSystem,
        external_record_id: input.externalRecordId,
        integration_id: input.integrationId,
        external_customer_id: input.externalCustomerId,
        metadata: input.metadata,
        notes: input.notes,
        due_at: input.dueAt,
        reference_date: input.referenceDate,
      }
    : {
        id: recordId,
        user_id: integrationUserId,
        workspace_id: input.workspaceId,
        amount: input.amount,
        type: mapConfirmedTransactionType(input),
        category: normalizeCategory(input.category),
        description: input.description,
        date: input.occurredAt,
        source: 'import',
        confidence_score: 1,
        integration_status: input.status,
        integration_type: input.type,
        source_system: input.sourceSystem,
        external_record_id: input.externalRecordId,
        integration_id: input.integrationId,
        external_customer_id: input.externalCustomerId,
        counterparty_label: input.counterpartyLabel,
        metadata: input.metadata,
        notes: input.notes,
        due_at: input.dueAt,
        reference_date: input.referenceDate,
        subcategory: input.subcategory,
      };

  const action: IntegrationAction = !existing
    ? 'created'
    : stableStringify(existing.payload ?? null) === stableStringify(payload)
      ? 'replayed'
      : 'updated';

  if (action !== 'replayed') {
    await pushSyncItems(
      input.workspaceId,
      storedAs,
      [{ id: recordId, updatedAt, payload }],
      { userId: integrationUserId, workspaceId: input.workspaceId },
    );
  }

  recordAuditEvent({
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    userId: integrationUserId,
    action: 'integration.external_event_received',
    status: 'success',
    resource: workspace.workspaceId,
    resourceType: 'external_integration',
    resourceId: input.externalRecordId,
    metadata: {
      entity,
      storedAs,
      action,
      sourceSystem: input.sourceSystem,
      externalRecordId: input.externalRecordId,
    },
  });

  return {
    ok: true,
    workspaceId: input.workspaceId,
    sourceSystem: input.sourceSystem,
    externalRecordId: input.externalRecordId,
    action,
    entity,
    storedAs,
  };
}

export async function ingestIntegrationReminder(
  input: IntegrationReminderInput,
): Promise<IntegrationIngestResponse> {
  const workspace = await getWorkspaceAsync(input.workspaceId);
  if (!workspace) {
    throw new AppError(404, 'Workspace not found for integration ingestion');
  }

  const integrationUserId = toIntegrationUserId(input.sourceSystem);
  const recordId = buildDeterministicId('reminder', input.sourceSystem, input.externalRecordId);
  const currentState = await pullSyncItems(input.workspaceId);
  const existing = currentState.entities.reminders.find((item) => item.id === recordId && !item.deleted);
  const updatedAt = new Date().toISOString();

  const payload = {
    id: recordId,
    title: input.title,
    date: input.remindAt,
    type: normalizeReminderType(input.kind),
    amount: undefined,
    completed: input.status === 'completed' || input.status === 'canceled',
    priority: normalizeReminderPriority(input.priority),
    source: 'integration',
    integration_kind: input.kind,
    integration_status: input.status,
    source_system: input.sourceSystem,
    external_record_id: input.externalRecordId,
    related_transaction_external_id: input.relatedTransactionExternalId,
    integration_id: input.integrationId,
    external_customer_id: input.externalCustomerId,
    metadata: input.metadata,
    description: input.description,
  };

  const action: IntegrationAction = !existing
    ? 'created'
    : stableStringify(existing.payload ?? null) === stableStringify(payload)
      ? 'replayed'
      : 'updated';

  if (action !== 'replayed') {
    await pushSyncItems(
      input.workspaceId,
      'reminders',
      [{ id: recordId, updatedAt, payload }],
      { userId: integrationUserId, workspaceId: input.workspaceId },
    );
  }

  recordAuditEvent({
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    userId: integrationUserId,
    action: 'integration.external_event_received',
    status: 'success',
    resource: workspace.workspaceId,
    resourceType: 'external_integration',
    resourceId: input.externalRecordId,
    metadata: {
      entity: 'reminder',
      storedAs: 'reminders',
      action,
      sourceSystem: input.sourceSystem,
      externalRecordId: input.externalRecordId,
    },
  });

  return {
    ok: true,
    workspaceId: input.workspaceId,
    sourceSystem: input.sourceSystem,
    externalRecordId: input.externalRecordId,
    action,
    entity: 'reminder',
    storedAs: 'reminders',
  };
}

export type { IntegrationIngestResponse };
