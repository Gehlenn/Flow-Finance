export type EventPayload = Record<string, unknown>;
export type EventHandler<T = EventPayload> = (payload: T) => void;

class EventBus {
  private readonly listeners = new Map<string, EventHandler[]>();

  emit<T = EventPayload>(event: string, payload: T): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((handler) => handler(payload as EventPayload));
  }

  on<T = EventPayload>(event: string, handler: EventHandler<T>): () => void {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler as EventHandler);
    this.listeners.set(event, handlers);

    return () => {
      const current = this.listeners.get(event) || [];
      this.listeners.set(
        event,
        current.filter((h) => h !== handler)
      );
    };
  }
}

export const eventBus = new EventBus();
