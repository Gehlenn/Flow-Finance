import type { DocumentSnapshot, Firestore, Transaction } from 'firebase-admin/firestore';
import {
  PLAN_USAGE_LIMITS,
  isPlanId,
  isResourceKind,
  type PlanId,
  type ResourceKind,
  type UsageSnapshot,
} from '../../../shared/saasCatalog';
import { getFirestoreOrNull } from '../../utils/firestoreAdmin';

const WORKSPACES_COLLECTION = 'workspaces';
const SAAS_USAGE_COLLECTION = 'saas_usage';
const RECEIPTS_COLLECTION = 'receipts';
const EVENTS_COLLECTION = 'events';

export function isFirestoreAiUsageAuthorityEnabled(): boolean {
  return process.env.FIRESTORE_AI_USAGE_AUTHORITY_ENABLED === 'true';
}

export type WorkspaceUsageReservation = {
  workspaceId: string;
  userId: string;
  resource: ResourceKind;
  amount: number;
  idempotencyKey: string;
};

export type WorkspaceUsageReservationOutcome = {
  outcome: 'accepted' | 'limit_exceeded';
  idempotent: boolean;
  current: number;
  limit: number;
  remaining: number;
  monthKey: string;
  plan: PlanId;
};

export type AuthoritativeWorkspaceUsage = {
  workspaceId: string;
  monthKey: string;
  plan: PlanId;
  usage: UsageSnapshot;
};

export class WorkspaceUsageAuthorityUnavailableError extends Error {
  readonly code = 'workspace_usage_authority_unavailable';
  readonly cause?: unknown;

  constructor(cause?: unknown) {
    super('Workspace usage authority is unavailable because Firestore is not configured or reachable');
    this.name = 'WorkspaceUsageAuthorityUnavailableError';
    this.cause = cause;
  }
}

export class WorkspaceUsageIdempotencyConflictError extends Error {
  readonly code = 'workspace_usage_idempotency_conflict';

  constructor(idempotencyKey: string) {
    super(`Idempotency key ${idempotencyKey} was already used with a different usage reservation`);
    this.name = 'WorkspaceUsageIdempotencyConflictError';
  }
}

export class WorkspaceUsageInputError extends Error {
  readonly code = 'workspace_usage_invalid_input';

  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceUsageInputError';
  }
}

// Compatibility names used by the quota boundary. They alias the same error
// constructors so instanceof checks remain reliable across the service layer.
export {
  WorkspaceUsageAuthorityUnavailableError as UsageAuthorityUnavailableError,
  WorkspaceUsageIdempotencyConflictError as UsageIdempotencyConflictError,
};

type WorkspaceUsageDocument = UsageSnapshot & {
  monthKey: string;
  updatedAt: string;
};

type UsageReceiptDocument = WorkspaceUsageReservationOutcome & {
  workspaceId: string;
  userId: string;
  resource: ResourceKind;
  amount: number;
  idempotencyKey: string;
  createdAt: string;
};

type WorkspaceDocument = {
  plan: PlanId;
  entitlements: Record<ResourceKind, number>;
};

function utcMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function emptyUsage(): UsageSnapshot {
  return { transactions: 0, aiQueries: 0, bankConnections: 0 };
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function readUsageSnapshot(snapshot: DocumentSnapshot): UsageSnapshot {
  if (!snapshot.exists) {
    return emptyUsage();
  }

  const value = snapshot.data();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WorkspaceUsageInputError('Workspace usage document is malformed');
  }

  const record = value as Record<string, unknown>;
  const transactions = readNonNegativeInteger(record.transactions);
  const aiQueries = readNonNegativeInteger(record.aiQueries);
  const bankConnections = readNonNegativeInteger(record.bankConnections);

  if (transactions === undefined || aiQueries === undefined || bankConnections === undefined) {
    throw new WorkspaceUsageInputError('Workspace usage counters must be non-negative safe integers');
  }

  return {
    transactions,
    aiQueries,
    bankConnections,
  };
}

function readWorkspaceDocument(snapshot: DocumentSnapshot): WorkspaceDocument | null {
  if (!snapshot.exists) {
    return null;
  }

  const raw = snapshot.data();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { plan: 'free', entitlements: PLAN_USAGE_LIMITS.free };
  }

  const record = raw as Record<string, unknown>;
  const plan = isPlanId(record.plan) ? record.plan : 'free';
  const rawEntitlements = record.entitlements;
  const entitlementRecord = typeof rawEntitlements === 'object' && rawEntitlements !== null && !Array.isArray(rawEntitlements)
    ? rawEntitlements as Record<string, unknown>
    : null;
  const rawLimits = entitlementRecord?.limits;
  const limitRecord = typeof rawLimits === 'object' && rawLimits !== null && !Array.isArray(rawLimits)
    ? rawLimits as Record<string, unknown>
    : null;
  const configured = {
    transactions: readNonNegativeInteger(limitRecord?.transactionsPerMonth),
    aiQueries: readNonNegativeInteger(limitRecord?.aiQueriesPerMonth),
    bankConnections: readNonNegativeInteger(limitRecord?.bankConnections),
  };

  return {
    plan,
    entitlements: {
      transactions: configured.transactions ?? PLAN_USAGE_LIMITS[plan].transactions,
      aiQueries: configured.aiQueries ?? PLAN_USAGE_LIMITS[plan].aiQueries,
      bankConnections: configured.bankConnections ?? PLAN_USAGE_LIMITS[plan].bankConnections,
    },
  };
}

function readReceiptDocument(snapshot: DocumentSnapshot): UsageReceiptDocument | null {
  if (!snapshot.exists) {
    return null;
  }

  const raw = snapshot.data();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (
    typeof record.workspaceId !== 'string' ||
    typeof record.userId !== 'string' ||
    !isResourceKind(record.resource) ||
    !Number.isSafeInteger(record.amount) ||
    typeof record.idempotencyKey !== 'string' ||
    (record.outcome !== 'accepted' && record.outcome !== 'limit_exceeded') ||
    !Number.isSafeInteger(record.current) ||
    !Number.isSafeInteger(record.limit) ||
    !Number.isSafeInteger(record.remaining) ||
    typeof record.monthKey !== 'string' ||
    !isPlanId(record.plan) ||
    typeof record.createdAt !== 'string'
  ) {
    return null;
  }

  return record as UsageReceiptDocument;
}

function toOutcome(receipt: UsageReceiptDocument, idempotent: boolean): WorkspaceUsageReservationOutcome {
  return {
    outcome: receipt.outcome,
    idempotent,
    current: receipt.current,
    limit: receipt.limit,
    remaining: receipt.remaining,
    monthKey: receipt.monthKey,
    plan: receipt.plan,
  };
}

function validateReservation(input: WorkspaceUsageReservation): void {
  if (!input.workspaceId.trim()) {
    throw new WorkspaceUsageInputError('workspaceId is required');
  }
  if (!input.userId.trim()) {
    throw new WorkspaceUsageInputError('userId is required');
  }
  if (!isResourceKind(input.resource)) {
    throw new WorkspaceUsageInputError('resource must be an allowed metered resource');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new WorkspaceUsageInputError('amount must be a positive safe integer');
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 240 || input.idempotencyKey.includes('/')) {
    throw new WorkspaceUsageInputError('idempotencyKey must be a non-empty Firestore document id');
  }
}

function isSameReservation(receipt: UsageReceiptDocument, input: WorkspaceUsageReservation): boolean {
  return receipt.workspaceId === input.workspaceId &&
    receipt.userId === input.userId &&
    receipt.resource === input.resource &&
    receipt.amount === input.amount &&
    receipt.idempotencyKey === input.idempotencyKey;
}

function workspaceUsageRef(db: Firestore, workspaceId: string, monthKey: string) {
  return db.collection(WORKSPACES_COLLECTION).doc(workspaceId).collection(SAAS_USAGE_COLLECTION).doc(monthKey);
}

export async function reserveWorkspaceUsage(input: WorkspaceUsageReservation): Promise<WorkspaceUsageReservationOutcome> {
  validateReservation(input);

  const db = await getFirestoreOrNull('WorkspaceUsageAuthority');
  if (!db) {
    throw new WorkspaceUsageAuthorityUnavailableError();
  }

  const monthKey = utcMonthKey();
  const workspaceRef = db.collection(WORKSPACES_COLLECTION).doc(input.workspaceId);
  const usageRef = workspaceUsageRef(db, input.workspaceId, monthKey);
  const receiptRef = usageRef.collection(RECEIPTS_COLLECTION).doc(input.idempotencyKey);

  try {
    return await db.runTransaction(async (transaction: Transaction) => {
      const [workspaceSnapshot, usageSnapshot, receiptSnapshot] = await Promise.all([
        transaction.get(workspaceRef),
        transaction.get(usageRef),
        transaction.get(receiptRef),
      ]);
      const existingReceipt = readReceiptDocument(receiptSnapshot);
      if (existingReceipt) {
        if (!isSameReservation(existingReceipt, input)) {
          throw new WorkspaceUsageIdempotencyConflictError(input.idempotencyKey);
        }
        return toOutcome(existingReceipt, true);
      }
      if (receiptSnapshot.exists) {
        throw new WorkspaceUsageIdempotencyConflictError(input.idempotencyKey);
      }

      const workspace = readWorkspaceDocument(workspaceSnapshot);
      if (!workspace) {
        throw new WorkspaceUsageInputError(`Workspace ${input.workspaceId} was not found`);
      }

      const usage = readUsageSnapshot(usageSnapshot);
      const current = usage[input.resource];
      const limit = workspace.entitlements[input.resource];
      const accepted = current + input.amount <= limit;
      const nextUsage = accepted
        ? { ...usage, [input.resource]: current + input.amount }
        : usage;
      const outcome: WorkspaceUsageReservationOutcome = {
        outcome: accepted ? 'accepted' : 'limit_exceeded',
        idempotent: false,
        current: accepted ? current + input.amount : current,
        limit,
        remaining: Math.max(0, limit - (accepted ? current + input.amount : current)),
        monthKey,
        plan: workspace.plan,
      };
      const createdAt = new Date().toISOString();
      const receipt: UsageReceiptDocument = {
        ...input,
        ...outcome,
        createdAt,
      };

      if (accepted) {
        const usageDocument: WorkspaceUsageDocument = {
          ...nextUsage,
          monthKey,
          updatedAt: createdAt,
        };
        transaction.set(usageRef, usageDocument, { merge: true });
      }
      transaction.set(receiptRef, receipt);
      transaction.set(usageRef.collection(EVENTS_COLLECTION).doc(), {
        workspaceId: input.workspaceId,
        userId: input.userId,
        resource: input.resource,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        ...outcome,
        createdAt,
      });

      return outcome;
    });
  } catch (error) {
    if (error instanceof WorkspaceUsageIdempotencyConflictError) {
      throw error;
    }
    throw new WorkspaceUsageAuthorityUnavailableError(error);
  }
}

export async function getAuthoritativeWorkspaceUsage(workspaceId: string): Promise<AuthoritativeWorkspaceUsage | null> {
  if (!workspaceId.trim()) {
    throw new WorkspaceUsageInputError('workspaceId is required');
  }

  const db = await getFirestoreOrNull('WorkspaceUsageAuthority');
  if (!db) {
    return null;
  }

  const monthKey = utcMonthKey();
  const workspaceRef = db.collection(WORKSPACES_COLLECTION).doc(workspaceId);
  const usageRef = workspaceUsageRef(db, workspaceId, monthKey);
  const [workspaceSnapshot, usageSnapshot] = await Promise.all([workspaceRef.get(), usageRef.get()]);
  const workspace = readWorkspaceDocument(workspaceSnapshot);
  if (!workspace) {
    throw new WorkspaceUsageInputError(`Workspace ${workspaceId} was not found`);
  }

  return {
    workspaceId,
    monthKey,
    plan: workspace.plan,
    usage: readUsageSnapshot(usageSnapshot),
  };
}
