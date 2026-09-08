import { describe, expect, it } from 'vitest';
import { groupBounds } from '@ara3d/viewer-core';
import { colorStride, emptyInstances, instanceRecords, meshTableFrom, transformStride } from '@bim-open-toolkit/model';
import {
  geometryMeshAt,
  geometryMeshCount,
  geometryMeshTriangles,
} from '../src/geometry-meshes.js';
import {
  buildInstanceTable,
  colorOfRow,
  groupCount,
  groupOf,
  keyOfRow,
  meshBuffers,
  objectCount,
  renderedTriangles,
  rowsOfKey,
  rowsOfObject,
  slotOf,
  transformOfRow,
  visibleRows,
} from '../src/instance-table.js';
import { resolveHit } from '../src/picking.js';
import { cube, fixtureKey, fixtureKeys, instanceAt, scene, standardKeys, standardScene, tableOnly } from './fixture.js';

const built = () => {
  const result = buildInstanceTable(standardScene(), standardKeys);
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.message).join('; '));
  return result;
};

describe('buildInstanceTable', () => {
  it('makes one group per mesh that has instances, in mesh order', () => {
    const table = built().value;
    expect(groupCount(table)).toBe(3);
    expect([...table.meshOfGroup]).toEqual([0, 1, 2]);
    expect(table.groups.map((group) => group.instanceCount)).toEqual([2, 2, 1]);
  });

  it('orders rows so every group owns a contiguous run', () => {
    const table = built().value;
    expect(table.rowCount).toBe(5);
    expect([...table.groupStart]).toEqual([0, 2, 4, 5]);
    expect([...table.groupOfRow]).toEqual([0, 0, 1, 1, 2]);
    expect([0, 1, 2, 3, 4].map((row) => slotOf(table, row))).toEqual([0, 1, 0, 1, 0]);
  });

  it('drops a mesh nobody instances', () => {
    const geometry = scene(3, [instanceAt(0, 0, 0), instanceAt(2, 1, 1)]);
    const result = buildInstanceTable(geometry, fixtureKeys(2));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.meshOfGroup]).toEqual([0, 2]);
  });

  it('reports geometry-free instance records instead of drawing them', () => {
    const result = built();
    expect(result.diagnostics.map((item) => item.code)).toContain('geometry-free-instances');
    expect(rowsOfKey(result.value, fixtureKey(4))).toHaveLength(0);
  });

  it('maps object keys to every row they draw', () => {
    const table = built().value;
    expect(objectCount(table)).toBe(5);
    expect([...rowsOfKey(table, fixtureKey(0))]).toEqual([0]);
    expect([...rowsOfKey(table, fixtureKey(1))]).toEqual([2, 3]);
    expect([...rowsOfKey(table, fixtureKey(2))]).toEqual([1]);
    expect([...rowsOfKey(table, fixtureKey(3))]).toEqual([4]);
    expect([...rowsOfObject(table, 4)]).toEqual([]);
  });

  it('maps rows back to their object key and group', () => {
    const table = built().value;
    expect(keyOfRow(table, 3)).toBe(fixtureKey(1));
    expect(keyOfRow(table, 99)).toBeUndefined();
    expect(groupOf(table, 4)).toBe(2);
    expect(groupOf(table, 99)).toBe(-1);
    expect(slotOf(table, 99)).toBe(-1);
  });

  it('copies colour, opacity and transform into the group buffers in row order', () => {
    const table = built().value;
    expect(colorOfRow(table, 0)).toEqual([1, 0, 0, 1]);
    expect(colorOfRow(table, 1)).toEqual([0, 0, 1, 1]);
    expect(colorOfRow(table, 2)).toEqual([0, 1, 0, 0.5]);
    expect([...table.opacity]).toEqual([1, 1, 0.5, 0.5, 1]);
    expect([...table.visible]).toEqual([1, 1, 1, 1, 1]);
    expect(transformOfRow(table, 1)[12]).toBe(2);
    expect(transformOfRow(table, 3)[12]).toBe(3);
  });

  it('starts with every row shown', () => {
    expect(visibleRows(built().value)).toBe(5);
  });

  it('honours a source that declares a row hidden, keeping the opacity it had', () => {
    const geometry = scene(1, [
      { ...instanceAt(0, 0, 0, [1, 0, 0], 0.4), visible: false },
      instanceAt(0, 1, 1),
    ]);
    const result = buildInstanceTable(geometry, fixtureKeys(2));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const table = result.value;
    expect([...table.visible]).toEqual([0, 1]);
    expect(table.opacity[0]).toBeCloseTo(0.4, 6);
    expect(colorOfRow(table, 0)[3]).toBe(0);
    expect(visibleRows(table)).toBe(1);
  });

  it('counts rendered triangles over instances, not over the mesh library', () => {
    const geometry = standardScene();
    const table = built().value;
    expect(renderedTriangles(table, geometry)).toBe(5 * 12);
  });

  it('warns when an instance names an object outside the key list', () => {
    const result = buildInstanceTable(scene(1, [instanceAt(0, 7, 0)]), fixtureKeys(2));
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((item) => item.code)).toContain('unknown-object-index');
  });

  it('warns when a key repeats and gives the rows to the first ordinal', () => {
    const geometry = scene(1, [instanceAt(0, 0, 0), instanceAt(0, 1, 1)]);
    const result = buildInstanceTable(geometry, [fixtureKey(0), fixtureKey(0)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics.map((item) => item.code)).toContain('repeated-object-key');
    expect([...rowsOfKey(result.value, fixtureKey(0))]).toEqual([0]);
  });

  it('refuses a geometry whose columns disagree with its instance count', () => {
    const records = instanceRecords([instanceAt(0, 0, 0), instanceAt(0, 1, 1)]);
    const short = { ...records, color: new Float32Array(colorStride) };
    const result = buildInstanceTable({ meshes: [cube(1)], instances: short }, fixtureKeys(2));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('bad-column-length');
  });

  it('builds an empty table from a geometry with no instances', () => {
    const result = buildInstanceTable(scene(1, []), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rowCount).toBe(0);
    expect(groupCount(result.value)).toBe(0);
    expect(colorOfRow(result.value, 0)).toEqual([]);
    expect(transformOfRow(result.value, 0)).toEqual([]);
  });
});

describe('meshBuffers', () => {
  it('shares the model mesh arrays rather than copying them', () => {
    const source = cube(2);
    const buffers = meshBuffers(source);
    expect(buffers.positions).toBe(source.positions);
    expect(buffers.indices).toBe(source.indices);
    expect(buffers.normals).toBeUndefined();
    expect(buffers.positions.length / 3).toBe(8);
    expect(source.indices.length).toBe(36);
  });
});

describe('a geometry that carries its meshes only as a table', () => {
  const fromRecords = built().value;
  const tabled = buildInstanceTable(tableOnly(standardScene()), standardKeys);

  it('builds, where reading `meshes` alone would have bound nothing', () => {
    expect(tabled.ok).toBe(true);
    if (!tabled.ok) return;
    expect(groupCount(tabled.value)).toBe(3);
    expect([...tabled.value.meshOfGroup]).toEqual([...fromRecords.meshOfGroup]);
    expect([...tabled.value.groupStart]).toEqual([...fromRecords.groupStart]);
    expect(tabled.value.rowCount).toBe(fromRecords.rowCount);
  });

  it('gives every group the same buffers, the same mesh and the same bounds', () => {
    if (!tabled.ok) return;
    for (let g = 0; g < groupCount(fromRecords); g++) {
      const expected = fromRecords.groups[g];
      const actual = tabled.value.groups[g];
      if (expected === undefined || actual === undefined) throw new Error(`group ${g} is missing`);
      expect([...actual.mesh.positions]).toEqual([...expected.mesh.positions]);
      expect([...(actual.mesh.indices ?? [])]).toEqual([...(expected.mesh.indices ?? [])]);
      expect(actual.mesh.normals).toBeUndefined();
      expect([...(tabled.value.colors[g] ?? [])]).toEqual([...(fromRecords.colors[g] ?? [])]);
      expect([...(tabled.value.transforms[g] ?? [])]).toEqual([...(fromRecords.transforms[g] ?? [])]);
      expect(groupBounds(actual)).toEqual(groupBounds(expected));
    }
  });

  it('counts the same rendered triangles', () => {
    if (!tabled.ok) return;
    expect(renderedTriangles(tabled.value, tableOnly(standardScene()))).toBe(
      renderedTriangles(fromRecords, standardScene()),
    );
  });

  it('resolves every hit to the same object', () => {
    if (!tabled.ok) return;
    for (let g = 0; g < groupCount(fromRecords); g++)
      for (let slot = 0; slot < 3; slot++) {
        const hit = { group: g, slot, point: [0, 0, 0] as const, distance: 1 };
        expect(resolveHit(tabled.value, hit)).toEqual(resolveHit(fromRecords, hit));
      }
  });

  it('prefers the table when the geometry carries both forms', () => {
    const source = standardScene();
    const both = { ...source, meshTable: meshTableFrom([cube(9)]) };
    expect(geometryMeshCount(both)).toBe(1);
    expect(geometryMeshAt(both, 0)?.bounds.max).toEqual([4.5, 4.5, 4.5]);
    expect(geometryMeshAt(both, 1)).toBeUndefined();
    expect(geometryMeshTriangles(both, 0)).toBe(12);
  });
});

describe('a geometry that carries neither form', () => {
  it('binds zero meshes rather than throwing', () => {
    const result = buildInstanceTable(scene(0, [instanceAt(0, 0, 0)]), fixtureKeys(1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(groupCount(result.value)).toBe(0);
    expect(result.value.rowCount).toBe(0);
    expect(result.diagnostics.map((item) => item.code)).toContain('geometry-free-instances');
  });

  it('binds zero meshes when the table it carries is empty', () => {
    const empty = { meshes: [], instances: emptyInstances(2), meshTable: meshTableFrom([]) };
    expect(geometryMeshCount(empty)).toBe(0);
    expect(geometryMeshAt(empty, 0)).toBeUndefined();
    expect(geometryMeshTriangles(empty, 0)).toBe(0);
    const result = buildInstanceTable(empty, fixtureKeys(2));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(groupCount(result.value)).toBe(0);
  });
});

describe('group buffers', () => {
  it('hold exactly the floats the strides promise', () => {
    const table = built().value;
    for (let g = 0; g < table.groups.length; g++) {
      const group = table.groups[g];
      const rows = (table.groupStart[g + 1] ?? 0) - (table.groupStart[g] ?? 0);
      expect(group?.colors.length).toBe(rows * colorStride);
      expect(group?.transforms.length).toBe(rows * transformStride);
    }
  });
});
