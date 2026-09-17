import { describe, expect, it, vi } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import {
  defaultAppearance,
  f32Column,
  noStyling,
  resolveStyles,
  styleComposition,
  styleRule,
  table as makeTable,
  u32Column,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import { colorOfRow } from '../src/instance-table.js';
import { SceneBinding, type ModelRaycastHit } from '../src/scene-binding.js';
import { updateColumns } from '../src/updates.js';
import { fixtureKey, standardKeys, standardScene } from './fixture.js';

const bind = () => {
  const scene = new ViewerScene();
  let renders = 0;
  const binding = new SceneBinding(scene, () => {
    renders++;
  });
  return { scene, binding, renders: () => renders };
};

const added = () => {
  const held = bind();
  const result = held.binding.addModel('m1', standardScene(), standardKeys);
  if (!result.ok) throw new Error('fixture did not bind');
  return { ...held, table: result.value };
};

describe('addModel and removeModel', () => {
  it('puts the model groups in the scene and takes them out again', () => {
    const { scene, binding } = added();
    expect(scene.groupCount).toBe(3);
    expect(binding.models).toHaveLength(1);
    expect(binding.removeModel('m1')).toBe(true);
    expect(scene.groupCount).toBe(0);
    expect(binding.models).toHaveLength(0);
    expect(binding.removeModel('m1')).toBe(false);
  });

  it('refuses a repeated model id rather than replacing what is there', () => {
    const { binding } = added();
    const again = binding.addModel('m1', standardScene(), standardKeys);
    expect(again.ok).toBe(false);
    expect(again.diagnostics[0]?.code).toBe('repeated-model');
    expect(binding.models).toHaveLength(1);
  });

  it('holds two models side by side', () => {
    const { scene, binding } = added();
    expect(binding.addModel('m2', standardScene(), standardKeys).ok).toBe(true);
    expect(scene.groupCount).toBe(6);
    expect(binding.statistics().renderedInstances).toBe(10);
    binding.removeModel('m1');
    expect(scene.groupCount).toBe(3);
  });

  it('asks for one render per operation, not one per object', () => {
    const held = added();
    expect(held.renders()).toBe(1);
    held.binding.removeModel('m1');
    expect(held.renders()).toBe(2);
  });

  it('carries the table diagnostics through', () => {
    const { binding } = bind();
    const result = binding.addModel('m1', standardScene(), standardKeys);
    expect(result.diagnostics.map((item) => item.code)).toContain('geometry-free-instances');
  });

  it('refuses to add anything once disposed', () => {
    const { scene, binding } = added();
    binding.dispose();
    expect(binding.disposed).toBe(true);
    expect(scene.groupCount).toBe(0);
    expect(binding.addModel('m2', standardScene(), standardKeys).ok).toBe(false);
    binding.dispose();
    expect(binding.disposed).toBe(true);
  });
});

describe('groupIndex', () => {
  it('reuses geometric bounds across appearance changes and invalidates moved groups', () => {
    const { binding, table } = added();
    const group = table.groups[0]!;
    const reads = vi.spyOn(group, 'transforms', 'get');
    const before = binding.bounds();
    expect(reads).toHaveBeenCalled();
    reads.mockClear();
    group.setColor(0, 1, 0, 0, .2);
    expect(binding.bounds()).toEqual(before);
    expect(binding.modelBounds('m1')).toEqual(before);
    expect(reads).not.toHaveBeenCalled();
    const moved = group.transforms.slice(0, 16);
    moved[12] = 1000;
    group.setTransform(0, moved);
    reads.mockClear();
    expect(binding.bounds().max[0]).toBeGreaterThan(before.max[0]);
    expect(reads).toHaveBeenCalled();
    binding.removeModel('m1');
    expect(binding.bounds()).toEqual(new SceneBinding(new ViewerScene()).bounds());
  });

  it('says which model and ordinal each group is', () => {
    const { binding, table } = added();
    const index = binding.groupIndex();
    expect(index.size).toBe(3);
    const first = table.groups[0];
    if (first === undefined) throw new Error('bad fixture');
    expect(index.get(first)).toEqual({ modelId: 'm1', group: 0 });
  });

  it('forgets a model that was removed', () => {
    const { binding } = added();
    binding.removeModel('m1');
    expect(binding.groupIndex().size).toBe(0);
  });
});

describe('applyChanges', () => {
  it('applies a change table and publishes once per touched group', () => {
    const { binding, table } = added();
    const before = table.groups.map((group) => group.colorsVersion);
    const changes = makeTable([
      [updateColumns.object, u32Column([1])],
      [updateColumns.red, f32Column([0])],
      [updateColumns.green, f32Column([0])],
      [updateColumns.blue, f32Column([1])],
    ]);
    const report = binding.applyChanges('m1', changes);
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.rowsWritten).toBe(2);
    expect(colorOfRow(table, 2).slice(0, 3)).toEqual([0, 0, 1]);
    expect(table.groups[1]?.colorsVersion).toBe((before[1] ?? 0) + 1);
    expect(table.groups[0]?.colorsVersion).toBe(before[0]);
  });

  it('clears the dirty ranges after publishing, so the next publish says nothing moved', () => {
    const { binding } = added();
    const changes = makeTable([
      [updateColumns.object, u32Column([1])],
      [updateColumns.alpha, f32Column([0.3])],
    ]);
    expect(binding.applyChanges('m1', changes).ok).toBe(true);
    expect(binding.publish()).toEqual({ colorGroups: 0, transformGroups: 0 });
  });

  it('refuses a model that is not in the scene', () => {
    const { binding } = added();
    const result = binding.applyChanges('other', makeTable([[updateColumns.object, u32Column([0])]]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('unknown-model');
  });
});

describe('applyStyles', () => {
  const resolvedFor = (keys: readonly ObjectKey[]) => resolveStyles(noStyling, keys);

  it('writes a resolved appearance into every row of each object', () => {
    const { binding, table } = added();
    const composition = styleComposition(
      new Map([[fixtureKey(1), { ...defaultAppearance, color: [1, 0, 1] }]]),
      [],
      [],
    );
    const report = binding.applyStyles('m1', resolveStyles(composition, standardKeys));
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.rowsAddressed).toBe(5);
    expect(colorOfRow(table, 2).slice(0, 3)).toEqual([1, 0, 1]);
    expect(colorOfRow(table, 3).slice(0, 3)).toEqual([1, 0, 1]);
  });

  it('hides what a rule hides and shows it again when the rule goes', () => {
    const { binding, table } = added();
    const hide = styleRule('r1', 'Hide doors', [fixtureKey(1)], { visible: false });
    const hidden = resolveStyles(styleComposition(new Map(), [], [hide]), standardKeys);
    expect(binding.applyStyles('m1', hidden).ok).toBe(true);
    expect(colorOfRow(table, 2)[3]).toBe(0);
    expect(table.visible[2]).toBe(0);
    expect(binding.applyStyles('m1', resolvedFor(standardKeys)).ok).toBe(true);
    expect(table.visible[2]).toBe(1);
    expect(colorOfRow(table, 2)[3]).toBe(1);
  });

  it('addresses every row of the model, so an object a rule stopped naming goes back to the fallback', () => {
    const { binding, table } = added();
    const rule = styleRule('r1', 'Colour doors', [fixtureKey(1)], { color: [0, 1, 1] });
    expect(binding.applyStyles('m1', resolveStyles(styleComposition(new Map(), [], [rule]), standardKeys)).ok).toBe(true);
    expect(colorOfRow(table, 2).slice(0, 3)).toEqual([0, 1, 1]);
    const report = binding.applyStyles('m1', resolvedFor(standardKeys));
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.rowsAddressed).toBe(table.rowCount);
    for (let channel = 0; channel < 3; channel++)
      expect(colorOfRow(table, 2)[channel]).toBeCloseTo(defaultAppearance.color[channel] ?? 0, 6);
  });

  it('writes nothing when the resolution has not moved', () => {
    const { binding } = added();
    binding.applyStyles('m1', resolvedFor(standardKeys));
    const report = binding.applyStyles('m1', resolvedFor(standardKeys));
    expect(report.ok && report.value.rowsWritten).toBe(0);
  });

  it('reports a named object the model does not hold', () => {
    const { binding } = added();
    const rule = styleRule('r1', 'Colour a stranger', ['not-a-key'], { color: [0, 1, 1] });
    const resolved = resolveStyles(styleComposition(new Map(), [], [rule]), ['not-a-key']);
    const report = binding.applyStyles('m1', resolved);
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.objectsMissing).toBe(1);
    expect(report.diagnostics[0]?.code).toBe('unknown-object');
  });

  it('does not count a key that resolved to the fallback, and says so in the report', () => {
    const { binding } = added();
    const report = binding.applyStyles('m1', resolvedFor(['not-a-key']));
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.objectsMissing).toBe(0);
  });

  it('refuses a model that is not in the scene', () => {
    const { binding } = added();
    expect(binding.applyStyles('other', resolvedFor(standardKeys)).ok).toBe(false);
  });
});

describe('rowsOf', () => {
  it('finds an object in every model that draws it', () => {
    const { binding } = added();
    expect(binding.addModel('m2', standardScene(), standardKeys).ok).toBe(true);
    const found = binding.rowsOf(fixtureKey(1));
    expect(found.map((item) => item.modelId)).toEqual(['m1', 'm2']);
    expect([...(found[0]?.rows ?? [])]).toEqual([2, 3]);
    expect(binding.rowsOf(fixtureKey(4))).toHaveLength(0);
  });
});

describe('bounds', () => {
  it('covers the instanced geometry of every model', () => {
    const { binding } = added();
    const bounds = binding.bounds();
    expect(bounds.min[0]).toBeLessThan(0);
    expect(bounds.max[0]).toBeGreaterThan(4);
    expect(binding.modelBounds('m1')).toEqual(bounds);
    expect(binding.modelBounds('missing').min[0]).toBe(Number.POSITIVE_INFINITY);
  });

  it('is empty once every model has gone', () => {
    const { binding } = added();
    binding.removeModel('m1');
    expect(binding.bounds().min[0]).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('statistics', () => {
  it('counts what is in the scene', () => {
    const { binding } = added();
    expect(binding.statistics()).toEqual({
      sourceObjects: 5,
      groups: 3,
      renderedInstances: 5,
      visibleInstances: 5,
      renderedTriangles: 60,
    });
  });
});

describe('pick', () => {
  const ray = { origin: [0, 0, 0] as const, direction: [0, 0, 1] as const };
  const hit = (modelId: string, group: number, slot: number, distance: number): ModelRaycastHit => ({
    modelId,
    group,
    slot,
    distance,
    point: [0, 0, distance],
  });

  it('resolves a renderer hit to an object key', () => {
    const { binding } = added();
    const found = binding.pick(ray, () => [hit('m1', 1, 1, 4)]);
    expect(found?.key).toBe(fixtureKey(1));
    expect(found?.row).toBe(3);
  });

  it('takes the nearest across two models', () => {
    const { binding } = added();
    expect(binding.addModel('m2', standardScene(), standardKeys).ok).toBe(true);
    const found = binding.pick(ray, () => [hit('m1', 2, 0, 9), hit('m2', 0, 0, 2)]);
    expect(found?.distance).toBe(2);
  });

  it('ignores a hit naming a model that is not in the scene', () => {
    const { binding } = added();
    expect(binding.pick(ray, () => [hit('gone', 0, 0, 1)])).toBeUndefined();
  });

  it('lets an extra source win when it is in front', () => {
    const { binding } = added();
    const found = binding.pick(
      ray,
      () => [hit('m1', 0, 0, 5)],
      [
        {
          id: 'replacement',
          hits: () => [
            { key: fixtureKey(3), object: -1, row: -1, point: [0, 0, 1], distance: 1, source: 'unused' },
          ],
        },
      ],
    );
    expect(found?.source).toBe('replacement');
  });
});
