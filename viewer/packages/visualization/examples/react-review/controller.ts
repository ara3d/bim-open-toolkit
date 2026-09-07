import { composeAppearance } from '../../src/appearance.js';
import { objectKey, type ObjectRecord, type ObjectRef } from '../../src/contracts.js';
import type { DoorSchedule, DoorScheduleRow } from '../../src/building-model.js';
import type { SelectionStore } from '../../src/selection.js';

export type DoorSort = 'name' | 'width';
export function filterDoorRows(rows: readonly DoorScheduleRow[], query: string, sort: DoorSort): readonly DoorScheduleRow[] {
  const filtered = rows.filter(row => row.name.toLowerCase().includes(query.trim().toLowerCase()));
  return filtered.sort((a, b) => {
    if (sort === 'width') {
      const left = a.nominalWidth.state === 'known' ? a.nominalWidth.value : Infinity;
      const right = b.nominalWidth.state === 'known' ? b.nominalWidth.value : Infinity;
      if (left !== right) return left < right ? -1 : 1;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

/** Demo host bridge: camera events never enter React state or rebuild the model. */
export class ReviewController {
  private schedule: DoorSchedule | undefined;
  private coverage = true;
  private disposed = false;
  private readonly unsubscribe: () => void;
  constructor(private readonly selection: SelectionStore, private readonly base: readonly ObjectRecord[], private readonly update: (objects: readonly ObjectRecord[]) => void) {
    this.unsubscribe = selection.subscribe(() => this.refresh());
  }
  readonly getSnapshot = (): readonly ObjectRef[] => this.selection.snapshot();
  readonly subscribe = (listener: () => void): (() => void) => this.selection.subscribe(listener);
  select(ref: ObjectRef, toggle = false): void { if (toggle) this.selection.toggle([ref]); else this.selection.replace([ref]); }
  clear(): void { this.selection.replace([]); }
  setSchedule(schedule: DoorSchedule): void { this.schedule = schedule; this.refresh(); }
  setCoverage(enabled: boolean): void { this.coverage = enabled; this.refresh(); }
  refresh(): void {
    if (this.disposed) return;
    const rules = this.coverage ? (this.schedule?.rows ?? []).filter(row => row.ref).map(row => ({ id: row.id, members: [row.ref!], style: { color: row.nominalWidth.state === 'known' ? [0.1, 0.45, 0.85] as const : [0.95, 0.4, 0.05] as const } })) : [];
    this.update(composeAppearance(this.base, { rules, selection: this.selection.snapshot(), selectionColor: [0.1, 1, 0.35] }));
  }
  dispose(): void { if (!this.disposed) { this.disposed = true; this.unsubscribe(); } }
}
export const selectedDoorKeys = (refs: readonly ObjectRef[]): ReadonlySet<string> => new Set(refs.map(objectKey));
