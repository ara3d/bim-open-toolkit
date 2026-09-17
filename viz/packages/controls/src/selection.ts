import { InstancedGroup } from '@ara3d/viewer-core';
import { Emitter } from './emitter.js';

/** One selected instance; null selection means "nothing selected". */
export interface SelectedInstance {
  readonly group: InstancedGroup;
  readonly instanceIndex: number;
}

const same = (a: SelectedInstance | null, b: SelectedInstance | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.group === b.group && a.instanceIndex === b.instanceIndex);

/**
 * Holds the current selection and emits `changed` when it actually changes.
 * Owns no scene content — highlighting is up to the consumer (e.g. via
 * InstancedGroup.setColor).
 */
export class Selection {
  readonly changed = new Emitter<SelectedInstance | null>();

  private _current: SelectedInstance | null = null;

  get current(): SelectedInstance | null { return this._current; }
  get isEmpty(): boolean { return this._current === null; }

  select(selection: SelectedInstance | null): void {
    if (same(this._current, selection)) return;
    this._current = selection;
    this.changed.emit(selection);
  }

  clear(): void {
    this.select(null);
  }
}
