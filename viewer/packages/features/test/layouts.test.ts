import { describe, expect, it } from 'vitest';
import { emptyDocument, getSlice, putSlice, type Vec3 } from '@bim-open-toolkit/model';
import { transformOfRow, type InstanceTable } from '@bim-open-toolkit/render';
import {
  captureTranslations,
  categoryExplodeOffsets,
  defaultLayouts,
  gridOffsets,
  layoutOffsets,
  layoutTranslations,
  layoutsCommands,
  layoutsFeature,
  layoutsHook,
  layoutsSlice,
  placementsOf,
  storeyExplodeOffsets,
  writeLayout,
} from '../src/layouts.js';
import { building, buildingGeometry, buildingTable, keyOf } from './navigation-aids-fixture.js';
import { fakeSession } from './support/fake-session.js';

const model = building();

const session = () => fakeSession(layoutsCommands);

// The translation of one row as the group buffers hold it now.
const translationOfRow = (table: InstanceTable, row: number): readonly number[] =>
  [...transformOfRow(table, row)].slice(12, 15);

describe('placements', () => {
  it('reads each object where its own transform puts it', () => {
    const placements = placementsOf(model);
    expect(placements).toHaveLength(6);
    expect(placements[2]).toEqual({ key: keyOf('wall-0'), center: [2, 0, 1] });
  });
});

describe('explode', () => {
  it('lifts every storey above the ground one by an average storey height per storey', () => {
    const offsets = storeyExplodeOffsets(model, 1);
    expect(offsets.get(keyOf('wall-1'))).toEqual([0, 0, 3]);
    expect(offsets.get(keyOf('door-1'))).toEqual([0, 0, 3]);
    expect(offsets.get(keyOf('wall-0'))).toBeUndefined();
  });

  it('scales with strength, and moves nothing at zero', () => {
    expect(storeyExplodeOffsets(model, 0.5).get(keyOf('wall-1'))).toEqual([0, 0, 1.5]);
    expect(storeyExplodeOffsets(model, 0).size).toBe(0);
  });

  it('moves nothing when the model records no storeys', () => {
    const flat = { ...model, objects: model.objects.filter((item) => item.category !== 'Storey') };
    expect(storeyExplodeOffsets(flat, 1).size).toBe(0);
  });

  it('fans the categories outwards in the ground plane, in name order', () => {
    const offsets = categoryExplodeOffsets(model, 1);
    const door = offsets.get(keyOf('door-0')) ?? [0, 0, 0];
    const wall = offsets.get(keyOf('wall-0')) ?? [0, 0, 0];
    expect(door[0]).toBeCloseTo(2);
    expect(door[1]).toBeCloseTo(0);
    expect(wall[0]).toBeCloseTo(-1);
    expect(wall[1]).toBeCloseTo(-Math.sqrt(3));
    expect(door[2]).toBe(0);
  });

  it('gives every object of one category the same offset', () => {
    const offsets = categoryExplodeOffsets(model, 1);
    expect(offsets.get(keyOf('wall-0'))).toEqual(offsets.get(keyOf('wall-1')));
  });
});

describe('grid', () => {
  it('arranges every object when it is given no keys', () => {
    const offsets = gridOffsets(model, [], 4, 2);
    expect(offsets.size).toBe(6);
    expect(offsets.get(keyOf('storey-0'))).toEqual([0, -4, 0]);
    expect(offsets.get(keyOf('storey-1'))).toEqual([4, -4, 0]);
    expect(offsets.get(keyOf('wall-0'))).toEqual([-2, 0, 0]);
  });

  it('arranges only the objects it is named', () => {
    const offsets = gridOffsets(model, [keyOf('wall-0'), keyOf('door-0')], 4, 2);
    expect([...offsets.keys()]).toEqual([keyOf('wall-0'), keyOf('door-0')]);
  });

  it('keeps each object at its own height, so a grid is a plan arrangement', () => {
    const offsets = gridOffsets(model, [], 4, 2);
    expect(offsets.get(keyOf('storey-1'))?.[2]).toBe(0);
  });

  it('chooses a spacing and a column count when it is given neither', () => {
    const offsets = gridOffsets(model, [], 0, 0);
    expect(offsets.size).toBe(6);
    for (const offset of offsets.values()) expect(offset.every(Number.isFinite)).toBe(true);
  });
});

describe('the layouts slice', () => {
  it('round-trips a layout through a document', () => {
    const saved = { layout: { kind: 'grid', spacing: 2, columns: 3, keys: [keyOf('wall-0')] } } as const;
    const document = putSlice(emptyDocument(), layoutsSlice, saved);
    const read = getSlice(document, layoutsSlice);
    expect(read.ok && read.value).toEqual(saved);
  });

  it('reads its default out of a document that has no layout', () => {
    const read = getSlice(emptyDocument(), layoutsSlice);
    expect(read.ok && read.value).toEqual(defaultLayouts);
  });

  it('refuses a value written at a version it does not know', () => {
    const read = getSlice(
      { ...emptyDocument(), slices: { layouts: { version: 2, value: defaultLayouts } } },
      layoutsSlice,
    );
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/version']);
  });

  it('saves the layout parameters and never the positions they produced', () => {
    const live = session();
    live.dispatch('layouts.explode', { by: 'storey', strength: 2 });
    expect(live.read(layoutsSlice)).toEqual({ layout: { kind: 'explode', by: 'storey', strength: 2 } });
  });
});

describe('the layouts commands', () => {
  it('explodes by storey by default and resets to where the model placed things', () => {
    const live = session();
    expect(live.dispatch('layouts.explode', {}).ok).toBe(true);
    expect(live.read(layoutsSlice).layout).toEqual({ kind: 'explode', by: 'storey', strength: 1 });
    live.dispatch('layouts.reset', {});
    expect(live.read(layoutsSlice)).toEqual(defaultLayouts);
    expect(live.events).toEqual(['layouts.explode:layouts', 'layouts.reset:layouts']);
  });

  it('refuses a negative strength and a spacing of zero', () => {
    const live = session();
    expect(
      live.dispatch('layouts.explode', { strength: -1 }).diagnostics.map((item) => item.code),
    ).toEqual(['layouts/strength']);
    expect(
      live.dispatch('layouts.grid', { spacing: 0 }).diagnostics.map((item) => item.code),
    ).toEqual(['layouts/positive']);
  });

  it('takes the keys a grid is asked to arrange', () => {
    const live = session();
    live.dispatch('layouts.grid', { keys: [keyOf('wall-0')], columns: 1 });
    expect(live.read(layoutsSlice).layout).toEqual({
      kind: 'grid',
      spacing: 0,
      columns: 1,
      keys: [keyOf('wall-0')],
    });
  });
});

describe('the layouts hook', () => {
  const rows = () => {
    const geometry = buildingGeometry(model);
    return buildingTable(model, geometry);
  };

  it('moves the rows of the objects a layout moves, and only those', () => {
    const table = rows();
    const live = session();
    const moved: number[] = [];
    const installed = layoutsHook({ table, model, moved: (count) => moved.push(count) })(live);
    expect(translationOfRow(table, 0)).toEqual([2, 0, 1]);
    live.dispatch('layouts.explode', { by: 'storey', strength: 1 });
    expect(translationOfRow(table, 0)).toEqual([2, 0, 1]);
    expect(translationOfRow(table, 2)).toEqual([2, 0, 7]);
    expect(translationOfRow(table, 3)).toEqual([4, 0, 7]);
    expect(moved).toEqual([0, 2]);
    installed.dispose();
  });

  it('puts every row back exactly where the model placed it', () => {
    const table = rows();
    const live = session();
    const base = captureTranslations(table);
    const installed = layoutsHook({ table, model })(live);
    live.dispatch('layouts.explode', { by: 'category', strength: 3 });
    expect(translationOfRow(table, 0)).not.toEqual([2, 0, 1]);
    live.dispatch('layouts.reset', {});
    expect(captureTranslations(table)).toEqual(base);
    installed.dispose();
  });

  it('restores the base placement when it is disposed', () => {
    const table = rows();
    const live = session();
    const base = captureTranslations(table);
    const installed = layoutsHook({ table, model })(live);
    live.dispatch('layouts.explode', { by: 'storey', strength: 2 });
    expect(captureTranslations(table)).not.toEqual(base);
    installed.dispose();
    expect(captureTranslations(table)).toEqual(base);
  });

  it('builds a change table of one translation per row, base plus the offset', () => {
    const table = rows();
    const base = captureTranslations(table);
    const offsets = layoutOffsets(model, { kind: 'explode', by: 'storey', strength: 1 });
    const values = layoutTranslations(table, base, offsets);
    expect(values.length).toBe(table.rowCount * 3);
    expect([...values.subarray(0, 3)]).toEqual([2, 0, 1]);
    expect([...values.subarray(6, 9)]).toEqual([2, 0, 7]);
    expect(writeLayout(table, values)).toBe(2);
    expect(writeLayout(table, values)).toBe(0);
  });

  it('reuses a buffer it is given rather than allocating one per change', () => {
    const table = rows();
    const base = captureTranslations(table);
    const scratch = new Float32Array(base.length);
    const first = layoutTranslations(table, base, new Map<string, Vec3>(), scratch);
    const second = layoutTranslations(table, base, new Map<string, Vec3>(), scratch);
    expect(first).toBe(scratch);
    expect(second).toBe(scratch);
  });
});

describe('the feature', () => {
  it('owns the layouts slice and its three commands', () => {
    expect(layoutsFeature.id).toBe('layouts');
    expect(layoutsFeature.slice.id).toBe('layouts');
    expect(layoutsFeature.commands.map((item) => item.name)).toEqual([
      'layouts.explode',
      'layouts.grid',
      'layouts.reset',
    ]);
  });
});
