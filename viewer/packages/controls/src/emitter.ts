export type Listener<T> = (value: T) => void;

/** Minimal typed event emitter. `on` returns an unsubscribe function. */
export class Emitter<T> {
  private listeners: Listener<T>[] = [];

  on(listener: Listener<T>): () => void {
    this.listeners.push(listener);
    return () => this.off(listener);
  }

  off(listener: Listener<T>): void {
    const i = this.listeners.indexOf(listener);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) listener(value);
  }

  get listenerCount(): number {
    return this.listeners.length;
  }
}
