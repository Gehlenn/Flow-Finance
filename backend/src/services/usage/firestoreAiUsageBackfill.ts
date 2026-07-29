import type { Firestore } from 'firebase-admin/firestore';
import { PLAN_USAGE_LIMITS, isPlanId, type PlanId } from '../../../shared/saasCatalog';

export type LegacyUsageSnapshot = {
  transactions: number;
  aiQueries: number;
  bankConnections: number;
};

export type BackfillAction = 'create_snapshot_and_event' | 'create_snapshot' | 'already_backfilled' | 'skipped_missing_workspace' | 'conflict';

export type BackfillResult = {
  action: BackfillAction;
  wrote: boolean;
};

type DocumentSnapshotLike = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

type DocumentReferenceLike = {
  collection(name: string): CollectionReferenceLike;
};

type CollectionReferenceLike = {
  doc(id?: string): DocumentReferenceLike;
};

type TransactionLike = {
  get(reference: DocumentReferenceLike): Promise<DocumentSnapshotLike>;
  set(reference: DocumentReferenceLike, value: Record<string, unknown>, options?: { merge?: boolean }): void;
};

type FirestoreLike = {
  collection(name: string): CollectionReferenceLike;
  runTransaction<T>(updateFunction: (transaction: TransactionLike) => Promise<T>): Promise<T>;
};

const WORKSPACES_COLLECTION = 'workspaces';
const SAAS_USAGE_COLLECTION = 'saas_usage';
const EVENTS_COLLECTION = 'events';
const BACKFILL_EVENT_PREFIX = 'legacy_backfill_ai_queries_';
const BACKFILL_IDEMPOTENCY_PREFIX = 'legacy-backfill-aiQueries-';
const BACKFILL_USER_ID = 'system:legacy-backfill';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function assertLegacyUsageSnapshot(usage: LegacyUsageSnapshot): void {
  if (
    !isNonNegativeSafeInteger(usage.transactions) ||
    !isNonNegativeSafeInteger(usage.aiQueries) ||
    !isNonNegativeSafeInteger(usage.bankConnections)
  ) {
    throw new Error('Legacy usage counters must be non-negative safe integers');
  }
}

function assertWorkspaceId(workspaceId: string): void {
  if (!workspaceId.trim() || workspaceId.includes('/')) {
    throw new Error('workspaceId must be a non-empty Firestore document id');
  }
}

function assertMonthKey(monthKey: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new Error('monthKey must be a UTC month in YYYY-MM format');
  }
}

export function utcMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function resolveLegacyUsageForMonth(
  usageByMonth: Record<string, LegacyUsageSnapshot>,
  monthKey: string,
): LegacyUsageSnapshot {
  return usageByMonth[monthKey] ?? {
    transactions: 0,
    aiQueries: 0,
    bankConnections: 0,
  };
}

export type PreparedLegacyAiUsageBackfillSource = {
  inputs: Array<{ workspaceId: string; legacyUsage: LegacyUsageSnapshot }>;
  workspaceCount: number;
  invalidLegacyCounters: number;
  orphanUsageWorkspaceCount: number;
  fingerprint: string;
};

export function prepareLegacyAiUsageBackfillSource(
  workspaceIds: string[],
  usageByWorkspace: Record<string, Record<string, LegacyUsageSnapshot>>,
  monthKey: string,
): PreparedLegacyAiUsageBackfillSource {
  assertMonthKey(monthKey);
  const uniqueWorkspaceIds = [...new Set(workspaceIds)].sort();
  const workspaceIdSet = new Set(uniqueWorkspaceIds);
  const usageWorkspaceIds = Object.keys(usageByWorkspace).sort();
  const orphanUsageWorkspaceCount = usageWorkspaceIds.filter((workspaceId) => !workspaceIdSet.has(workspaceId)).length;
  const inputs: PreparedLegacyAiUsageBackfillSource['inputs'] = [];
  let invalidLegacyCounters = 0;

  for (const workspaceId of uniqueWorkspaceIds) {
    const legacyUsage = resolveLegacyUsageForMonth(usageByWorkspace[workspaceId] ?? {}, monthKey);
    if (
      !isNonNegativeSafeInteger(legacyUsage.transactions) ||
      !isNonNegativeSafeInteger(legacyUsage.aiQueries) ||
      !isNonNegativeSafeInteger(legacyUsage.bankConnections)
    ) {
      invalidLegacyCounters += 1;
      continue;
    }
    inputs.push({ workspaceId, legacyUsage });
  }

  // The value is compared in memory only and never logged. Sorting makes a
  // second durable read comparable without treating database row order as data.
  const fingerprint = JSON.stringify({
    workspaceIds: uniqueWorkspaceIds,
    usage: usageWorkspaceIds.map((workspaceId) => [
      workspaceId,
      usageByWorkspace[workspaceId]?.[monthKey] ?? null,
    ]),
  });

  return {
    inputs,
    workspaceCount: uniqueWorkspaceIds.length,
    invalidLegacyCounters,
    orphanUsageWorkspaceCount,
    fingerprint,
  };
}

export function firestoreAiUsageBackfillEventId(monthKey: string): string {
  assertMonthKey(monthKey);
  return `${BACKFILL_EVENT_PREFIX}${monthKey}`;
}

function monthStartIso(monthKey: string): string {
  return `${monthKey}-01T00:00:00.000Z`;
}

function backfillIdempotencyKey(monthKey: string): string {
  assertMonthKey(monthKey);
  return `${BACKFILL_IDEMPOTENCY_PREFIX}${monthKey}`;
}

function workspaceAiQueriesEntitlement(snapshot: DocumentSnapshotLike): { plan: PlanId; limit: number } {
  const raw = snapshot.data();
  if (!isRecord(raw)) return { plan: 'free', limit: PLAN_USAGE_LIMITS.free.aiQueries };

  const plan = isPlanId(raw.plan) ? raw.plan : 'free';
  const entitlements = isRecord(raw.entitlements) ? raw.entitlements : null;
  const limits = entitlements && isRecord(entitlements.limits) ? entitlements.limits : null;
  const configuredLimit = limits?.aiQueriesPerMonth;
  return {
    plan,
    limit: isNonNegativeSafeInteger(configuredLimit) ? configuredLimit : PLAN_USAGE_LIMITS[plan].aiQueries,
  };
}

function usageDocumentIsValid(snapshot: DocumentSnapshotLike, monthKey: string): boolean {
  if (!snapshot.exists) return true;
  const data = snapshot.data();
  return Boolean(
    isRecord(data) &&
    data.monthKey === monthKey &&
    isNonNegativeSafeInteger(data.transactions) &&
    isNonNegativeSafeInteger(data.aiQueries) &&
    isNonNegativeSafeInteger(data.bankConnections),
  );
}

function matchesBackfillEvent(
  snapshot: DocumentSnapshotLike,
  workspaceId: string,
  monthKey: string,
  amount: number,
): boolean {
  const data = snapshot.data();
  return Boolean(
    snapshot.exists &&
    isRecord(data) &&
    data.workspaceId === workspaceId &&
    data.userId === BACKFILL_USER_ID &&
    data.monthKey === monthKey &&
    data.resource === 'aiQueries' &&
    data.amount === amount &&
    data.idempotencyKey === backfillIdempotencyKey(monthKey) &&
    data.outcome === 'accepted' &&
    data.idempotent === true &&
    data.current === amount &&
    typeof data.createdAt === 'string' &&
    isRecord(data.metadata) &&
    data.metadata.source === 'legacy_backfill',
  );
}

function backfillEvent(
  workspaceSnapshot: DocumentSnapshotLike,
  workspaceId: string,
  monthKey: string,
  amount: number,
  createdAt: string,
): Record<string, unknown> {
  const { plan, limit } = workspaceAiQueriesEntitlement(workspaceSnapshot);
  return {
    workspaceId,
    userId: BACKFILL_USER_ID,
    monthKey,
    resource: 'aiQueries',
    amount,
    idempotencyKey: backfillIdempotencyKey(monthKey),
    outcome: 'accepted',
    idempotent: true,
    current: amount,
    limit,
    remaining: Math.max(0, limit - amount),
    plan,
    createdAt,
    metadata: { source: 'legacy_backfill' },
  };
}

function initialUsageDocument(monthKey: string, aiQueries: number, updatedAt: string): Record<string, unknown> {
  return {
    transactions: 0,
    aiQueries,
    bankConnections: 0,
    monthKey,
    updatedAt,
  };
}

async function determineBackfillAction(
  workspaceSnapshot: DocumentSnapshotLike,
  usageSnapshot: DocumentSnapshotLike,
  eventSnapshot: DocumentSnapshotLike,
  workspaceId: string,
  monthKey: string,
  legacyUsage: LegacyUsageSnapshot,
): Promise<BackfillAction> {
  if (!workspaceSnapshot.exists) return 'skipped_missing_workspace';
  if (!usageDocumentIsValid(usageSnapshot, monthKey)) return 'conflict';

  if (usageSnapshot.exists && usageSnapshot.data()?.aiQueries !== legacyUsage.aiQueries) {
    return 'conflict';
  }

  if (eventSnapshot.exists && !matchesBackfillEvent(eventSnapshot, workspaceId, monthKey, legacyUsage.aiQueries)) {
    return 'conflict';
  }

  // An event without its matching counter is evidence of an incomplete or manual
  // write. Do not recreate the counter from an ambiguous event.
  if (!usageSnapshot.exists && eventSnapshot.exists) return 'conflict';

  // A positive counter without this tool's deterministic event cannot be
  // distinguished from a partial/manual migration. Never repair it in place.
  if (usageSnapshot.exists && legacyUsage.aiQueries > 0 && !eventSnapshot.exists) return 'conflict';

  const needsSnapshot = !usageSnapshot.exists;
  const needsEvent = legacyUsage.aiQueries > 0 && !eventSnapshot.exists;

  if (needsSnapshot && needsEvent) return 'create_snapshot_and_event';
  if (needsSnapshot) return 'create_snapshot';
  return 'already_backfilled';
}

function references(db: FirestoreLike, workspaceId: string, monthKey: string) {
  const workspace = db.collection(WORKSPACES_COLLECTION).doc(workspaceId);
  const usage = workspace.collection(SAAS_USAGE_COLLECTION).doc(monthKey);
  const event = usage.collection(EVENTS_COLLECTION).doc(firestoreAiUsageBackfillEventId(monthKey));
  return { workspace, usage, event };
}

export async function inspectFirestoreAiUsageBackfill(
  db: Firestore,
  input: { workspaceId: string; monthKey: string; legacyUsage: LegacyUsageSnapshot },
): Promise<BackfillResult> {
  assertWorkspaceId(input.workspaceId);
  assertMonthKey(input.monthKey);
  assertLegacyUsageSnapshot(input.legacyUsage);

  const { workspace, usage, event } = references(db as unknown as FirestoreLike, input.workspaceId, input.monthKey);
  const [workspaceSnapshot, usageSnapshot, eventSnapshot] = await Promise.all([
    (workspace as unknown as { get(): Promise<DocumentSnapshotLike> }).get(),
    (usage as unknown as { get(): Promise<DocumentSnapshotLike> }).get(),
    (event as unknown as { get(): Promise<DocumentSnapshotLike> }).get(),
  ]);
  const action = await determineBackfillAction(
    workspaceSnapshot,
    usageSnapshot,
    eventSnapshot,
    input.workspaceId,
    input.monthKey,
    input.legacyUsage,
  );
  return { action, wrote: false };
}

export async function applyFirestoreAiUsageBackfill(
  db: Firestore,
  input: { workspaceId: string; monthKey: string; legacyUsage: LegacyUsageSnapshot; now?: Date },
): Promise<BackfillResult> {
  assertWorkspaceId(input.workspaceId);
  assertMonthKey(input.monthKey);
  assertLegacyUsageSnapshot(input.legacyUsage);
  const writtenAt = (input.now ?? new Date()).toISOString();

  return (db as unknown as FirestoreLike).runTransaction(async (transaction) => {
    const { workspace, usage, event } = references(db as unknown as FirestoreLike, input.workspaceId, input.monthKey);
    const [workspaceSnapshot, usageSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(workspace),
      transaction.get(usage),
      transaction.get(event),
    ]);
    const action = await determineBackfillAction(
      workspaceSnapshot,
      usageSnapshot,
      eventSnapshot,
      input.workspaceId,
      input.monthKey,
      input.legacyUsage,
    );

    if (action === 'create_snapshot' || action === 'create_snapshot_and_event') {
      transaction.set(usage, initialUsageDocument(input.monthKey, input.legacyUsage.aiQueries, writtenAt));
    }
    if (action === 'create_snapshot_and_event') {
      transaction.set(event, backfillEvent(
        workspaceSnapshot,
        input.workspaceId,
        input.monthKey,
        input.legacyUsage.aiQueries,
        monthStartIso(input.monthKey),
      ));
    }

    return {
      action,
      wrote: action === 'create_snapshot' || action === 'create_snapshot_and_event',
    };
  });
}
