const processedEventStore = new Map<string, string>();

function makeKey(workspaceId: string, externalEventId: string): string {
  return `${workspaceId}::${externalEventId}`;
}

export function hasProcessedExternalEvent(workspaceId: string, externalEventId: string): boolean {
  return processedEventStore.has(makeKey(workspaceId, externalEventId));
}

export function markExternalEventProcessed(workspaceId: string, externalEventId: string): void {
  processedEventStore.set(makeKey(workspaceId, externalEventId), new Date().toISOString());
}

export function resetExternalIdempotencyStoreForTests(): void {
  processedEventStore.clear();
}
