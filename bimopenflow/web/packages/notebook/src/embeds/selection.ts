// One selection shared by every embed on a page: a row picked in a table, a
// bar in a chart, and an element in 3D select the same element ids.

/** Who published a selection, so a renderer can ignore its own echo. */
export type SelectionOrigin = string;

export type SelectionListener = (ids: readonly string[], origin: SelectionOrigin) => void;

export interface SelectionBus {
  current(): readonly string[];
  publish(ids: readonly string[], origin: SelectionOrigin): void;
  /** Returns the function that unsubscribes. */
  subscribe(listener: SelectionListener): () => void;
}

export function createSelectionBus(): SelectionBus {
  let ids: readonly string[] = [];
  const listeners = new Set<SelectionListener>();
  return {
    current: () => ids,
    publish(next, origin) {
      ids = [...next];
      for (const listener of [...listeners]) listener(ids, origin);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
