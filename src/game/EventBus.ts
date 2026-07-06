export type Unsubscribe = () => void;

export class EventBus<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, Set<(payload: TEvents[keyof TEvents]) => void>>();

  subscribe<TKey extends keyof TEvents>(
    eventName: TKey,
    listener: (payload: TEvents[TKey]) => void,
  ): Unsubscribe {
    const listenersForEvent = this.listeners.get(eventName) ?? new Set();
    listenersForEvent.add(listener as (payload: TEvents[keyof TEvents]) => void);
    this.listeners.set(eventName, listenersForEvent);

    return () => {
      listenersForEvent.delete(listener as (payload: TEvents[keyof TEvents]) => void);
      if (listenersForEvent.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  emit<TKey extends keyof TEvents>(eventName: TKey, payload: TEvents[TKey]): void {
    const listenersForEvent = this.listeners.get(eventName);
    if (!listenersForEvent) {
      return;
    }

    for (const listener of listenersForEvent) {
      listener(payload);
    }
  }
}
