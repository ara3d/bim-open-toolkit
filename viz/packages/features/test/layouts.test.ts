import { describe, expect, it } from 'vitest';
import { emptyDocument, getSlice, putSlice, type Vec3 } from '@bim-open-toolkit/model';
import type { Placement } from '../src/layouts.js';
import { transformOfRow, type InstanceTable } from '@bim-open-toolkit/render';
import {
  captureTranslations,
  categoryExplodeOffsets,
  defaultLayouts,
  distinctPlacements,
  gridOffsets,
  layoutOffsets,
  layoutPlacements,
  layoutTranslations,
  layoutsCommands,
  layoutsFeature,
  layoutsHook,
  layoutsSlice,
  placementElevations,
  placementsOf,
  rowPlacements,
  storeyExplodeOffsets,
  writeLayout,
} from '../src/layouts.js';
import {
  building,
  buildingGeometry,
  buildingTable,
  keyOf,
  rowPlacedBuilding,
} from './navigation-aids-fixture.js';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
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

// The fixture as a format that places its instances rather than its object records: the same rows
// in the same places, every record at the identity.
const onRows = () => {
  const placed = rowPlacedBuilding();
  return { model: placed, table: buildingTable(placed, buildingGeometry(model)) };
};

describe('placements taken off the rows', () => {
  it('counts how many distinct points a set of placements puts objects at', () => {
    expect(distinctPlacements(placementsOf(model))).toBe(6);
    expect(distinctPlacements(placementsOf(rowPlacedBuilding()))).toBe(1);
  });

  it('places each object at the centre of the rows it draws, and places no undrawn object', () => {
    const found = rowPlacements(onRows().table);
    expect(found.map((item) => item.key)).toEqual([
      keyOf('wall-0'),
      keyOf('door-0'),
      keyOf('wall-1'),
      keyOf('door-1'),
    ]);
    expect(found[0]).toEqual({ key: keyOf('wall-0'), center: [2, 0, 1] });
    expect(found[3]).toEqual({ key: keyOf('door-1'), center: [4, 0, 4] });
  });

  it('keeps the records when they tell two objects apart', () => {
    const { table } = onRows();
    const chosen = layoutPlacements(model, table);
    expect(chosen.ok && chosen.value).toEqual(placementsOf(model));
    expect(chosen.diagnostics).toEqual([]);
  });

  it('asks the rows when the records put every object at one point, and says so', () => {
    const { model: placed, table } = onRows();
    const chosen = layoutPlacements(placed, table);
    expect(chosen.ok && chosen.value).toEqual(rowPlacements(table));
    expect(chosen.diagnostics.map((item) => [item.code, item.severity])).toEqual([
      ['layouts/placements-from-rows', 'info'],
    ]);
  });

  it('fails when neither the records nor the rows separate anything', () => {
    const placed = rowPlacedBuilding();
    // Rows built from the identity records, so every row sits at the origin too.
    const chosen = layoutPlacements(placed, buildingTable(placed, buildingGeometry(placed)));
    expect(chosen.ok).toBe(false);
    expect(chosen.diagnostics.map((item) => item.code)).toEqual(['layouts/no-placements']);
  });

  it('reads a height per object off the placements, in the frame the model reports', () => {
    const elevations = placementElevations(placementsOf(model), 'z');
    expect(elevations.get(keyOf('wall-1'))).toBe(4);
    expect(placementElevations(placementsOf(model), 'y').get(keyOf('wall-1'))).toBe(0);
  });
});

describe('a layout over placements taken off the rows', () => {
  it('separates the storeys the rows sit on, which the records alone cannot', () => {
    const { model: placed, table } = onRows();
    expect(storeyExplodeOffsets(placed, 1).size).toBe(0);
    const found = rowPlacements(table);
    // The storey objects draw nothing, so the rows say nothing about how high they are, and a
    // storey explode over them stays impossible. This fixture is the real model's own shape.
    expect(storeyExplodeOffsets(placed, 1, found).size).toBe(0);
  });

  it('fans the categories over the footprint the placements cover, not over one unit', () => {
    const placed = rowPlacedBuilding();
    const wide: readonly Placement[] = [
      { key: keyOf('wall-0'), center: [-50, 0, 0] },
      { key: keyOf('door-0'), center: [50, 0, 0] },
    ];
    const reach = (offsets: ReadonlyMap<string, Vec3>): number =>
      Math.max(...[...offsets.values()].map((offset) => Math.hypot(offset[0], offset[1])));
    // Records at one point leave a zero-size footprint, and the fan falls back to a single unit.
    expect(reach(categoryExplodeOffsets(placed, 1))).toBeCloseTo(1);
    expect(reach(categoryExplodeOffsets(placed, 1, wide))).toBeCloseTo(50);
    expect(categoryExplodeOffsets(placed, 1, wide).size).toBe(placed.objects.length);
  });

  it('arranges only the objects the rows place, over the footprint they cover', () => {
    const { model: placed, table } = onRows();
    const found = gridOffsets(placed, [], 0, 2, rowPlacements(table));
    expect([...found.keys()]).toEqual([
      keyOf('wall-0'),
      keyOf('door-0'),
      keyOf('wall-1'),
      keyOf('door-1'),
    ]);
    expect(gridOffsets(placed, [], 0, 2).size).toBe(6);
  });

  it('moves the rows through the hook when the host is given the placements', () => {
    const { model: placed, table } = onRows();
    const live = session();
    const installed = layoutsHook({ table, model: placed, placements: rowPlacements(table) })(live);
    live.dispatch('layouts.explode', { by: 'category', strength: 1 });
    expect(translationOfRow(table, 0)).not.toEqual([2, 0, 1]);
    installed.dispose();
    expect(translationOfRow(table, 0)).toEqual([2, 0, 1]);
  });

  it('leaves a model whose records place its objects exactly as it was', () => {
    const table = buildingTable(model, buildingGeometry(model));
    const chosen = layoutPlacements(model, table);
    const layout = { kind: 'explode', by: 'storey', strength: 0.35 } as const;
    expect(layoutOffsets(model, layout, chosen.ok ? chosen.value : undefined)).toEqual(
      layoutOffsets(model, layout),
    );
    const arrangement = { kind: 'grid', spacing: 0, columns: 0, keys: [] } as const;
    expect(layoutOffsets(model, arrangement, chosen.ok ? chosen.value : undefined)).toEqual(
      layoutOffsets(model, arrangement),
    );
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

  it('moves nothing when every storey the model records is at the same height', () => {
    const stacked = {
      ...model,
      objects: model.objects.map((item) =>
        item.category === 'Storey' ? { ...item, transform: model.objects[0]?.transform ?? item.transform } : item,
      ),
    };
    expect(storeyExplodeOffsets(stacked, 1).size).toBe(0);
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

// A real viewer session with the feature installed, or a thrown error saying why there is none.
const installed = () => {
  const created = createSession();
  if (!created.ok) throw new Error(created.diagnostics.map((item) => item.message).join('; '));
  const host = featureHost(created.value);
  const done = host.install([layoutsFeature]);
  if (!done.ok) throw new Error(done.diagnostics.map((item) => item.message).join('; '));
  return { session: created.value, host };
};

describe('through the viewer session', () => {
  it('installs, explodes, and moves the rows its hook is given', () => {
    const { session: live, host } = installed();
    const table = buildingTable(model, buildingGeometry(model));
    const hook = layoutsHook({ table, model })(live);
    expect(live.dispatch('layouts.explode', { by: 'storey', strength: 1 }).ok).toBe(true);
    expect(live.read(layoutsSlice).layout).toEqual({ kind: 'explode', by: 'storey', strength: 1 });
    expect(translationOfRow(table, 2)).toEqual([2, 0, 7]);
    hook.dispose();
    host.dispose();
  });
});
