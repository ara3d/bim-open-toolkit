import { objectKey, type NamedSet, type ObjectRef } from './contracts.js';

/** Stable order, structural equality, and immutable snapshots. */
export function uniqueRefs(refs: Iterable<ObjectRef>): readonly ObjectRef[] {
  const values = new Map<string, ObjectRef>();
  for (const ref of refs) {
    const key = objectKey(ref);
    if (!values.has(key)) values.set(key, Object.freeze({ ...ref }));
  }
  return Object.freeze([...values.values()]);
}

export function unionRefs(left: readonly ObjectRef[], right: readonly ObjectRef[]): readonly ObjectRef[] {
  return uniqueRefs([...left, ...right]);
}

export function intersectRefs(left: readonly ObjectRef[], right: readonly ObjectRef[]): readonly ObjectRef[] {
  const keys = new Set(right.map(objectKey));
  return uniqueRefs(left.filter(ref => keys.has(objectKey(ref))));
}

export function subtractRefs(left: readonly ObjectRef[], right: readonly ObjectRef[]): readonly ObjectRef[] {
  const keys = new Set(right.map(objectKey));
  return uniqueRefs(left.filter(ref => !keys.has(objectKey(ref))));
}

export function createNamedSet(id: string, name: string, members: Iterable<ObjectRef>): NamedSet {
  return Object.freeze({ id, name, members: uniqueRefs(members) });
}

export type SelectionListener = (selection: readonly ObjectRef[]) => void;

/** Selection has no renderer or registry dependency; hosts may retain unresolved refs. */
export class SelectionStore {
  private members: readonly ObjectRef[];
  private readonly listeners = new Set<SelectionListener>();
  private disposed = false;

  constructor(initial: Iterable<ObjectRef> = []) { this.members = uniqueRefs(initial); }
  snapshot(): readonly ObjectRef[] { return this.members; }
  subscribe(listener: SelectionListener): () => void {
    this.assertActive();
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  replace(refs: readonly ObjectRef[]): boolean {
    this.assertActive();
    const next = uniqueRefs(refs);
    const previousKeys = new Set(this.members.map(objectKey));
    if (next.length === this.members.length && next.every(ref => previousKeys.has(objectKey(ref)))) return false;
    this.members = next;
    for (const listener of [...this.listeners]) listener(next);
    return true;
  }
  add(refs: readonly ObjectRef[]): boolean { return this.replace(unionRefs(this.members, refs)); }
  remove(refs: readonly ObjectRef[]): boolean { return this.replace(subtractRefs(this.members, refs)); }
  toggle(refs: readonly ObjectRef[]): boolean {
    const unique = uniqueRefs(refs);
    return this.replace(unionRefs(subtractRefs(this.members, unique), subtractRefs(unique, this.members)));
  }
  dispose(): void { this.listeners.clear(); this.members = Object.freeze([]); this.disposed = true; }
  private assertActive(): void { if (this.disposed) throw new Error('Selection store is disposed'); }
}
