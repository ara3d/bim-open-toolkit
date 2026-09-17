import { describe, expect, it } from 'vitest';
import {
  colorStride,
  identityMatrix,
  instanceRecords,
  mesh,
  meshTableFrom,
  noMesh,
  transformStride,
  type Geometry,
} from '@bim-open-toolkit/model';
import {
  boundsOfScene,
  colorInScene,
  headlessScene,
  meshBuffersOf,
  objectOfRow,
  rowOfInstance,
  transformInScene,
} from '../../src/headless/scene.js';
import { smallBuilding, stressScene } from '../../src/fixtures/catalog.js';

// A unit box at the origin, so bounds and hit distances are easy to state by hand.
const unitBox = mesh(
  new Float32Array([-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]),
  new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]),
);

// A translation of a box along x.
const atX = (x: number): readonly [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1];

// Two boxes and one object that draws nothing, so every mapping has a case to answer.
const twoBoxes: Geometry = {
  meshes: [unitBox],
  instances: instanceRecords([
    { meshIndex: 0, transform: atX(-5), color: [1, 0, 0], opacity: 1, objectIndex: 0 },
    { meshIndex: noMesh, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 1 },
    { meshIndex: 0, transform: atX(5), color: [0, 0, 1], opacity: 0.5, objectIndex: 2 },
  ]),
};

describe('building a scene from geometry', () => {
  const built = headlessScene(twoBoxes);

  it('makes one group per drawn mesh and adds it to the scene', () => {
    expect(built.groups.length).toBe(1);
    expect(built.scene.groupCount).toBe(1);
    expect(built.meshIndexOfGroup).toEqual(Int32Array.from([0]));
  });

  it('draws every instance that names a mesh, and none of the others', () => {
    expect(built.drawnCount).toBe(2);
    expect(built.groups[0]?.instanceCount).toBe(2);
    expect(Array.from(built.groupOfRow)).toEqual([0, -1, 0]);
    expect(Array.from(built.indexInGroup)).toEqual([0, -1, 1]);
  });

  it('maps an instance of a group back to its row and its object', () => {
    expect(rowOfInstance(built, 0, 0)).toBe(0);
    expect(rowOfInstance(built, 0, 1)).toBe(2);
    expect(rowOfInstance(built, 0, 2)).toBe(-1);
    expect(rowOfInstance(built, 1, 0)).toBe(-1);
    expect(objectOfRow(twoBoxes, rowOfInstance(built, 0, 1))).toBe(2);
    expect(objectOfRow(twoBoxes, 99)).toBe(-1);
  });

  it('copies the instance columns into the group buffers unchanged', () => {
    expect(Array.from(transformInScene(built, 2))).toEqual(Array.from(atX(5)));
    expect(Array.from(colorInScene(built, 0))).toEqual([1, 0, 0, 1]);
    expect(Array.from(colorInScene(built, 2))).toEqual([0, 0, 1, 0.5]);
  });

  it('refuses to read the buffers of a row that draws nothing', () => {
    expect(() => transformInScene(built, 1)).toThrow(/draws nothing/);
    expect(() => colorInScene(built, 1)).toThrow(/draws nothing/);
  });

  it('reports the box containing both instances', () => {
    expect(boundsOfScene(built)).toEqual({ min: [-6, -1, -1], max: [6, 1, 1] });
  });

  it('counts the triangles its instances draw', () => {
    expect(built.triangleCount).toBe(24);
  });

  it('builds nothing from an empty geometry', () => {
    const empty = headlessScene({ meshes: [], instances: instanceRecords([]) });
    expect(empty.groups).toEqual([]);
    expect(empty.drawnCount).toBe(0);
    expect(boundsOfScene(empty)).toBeNull();
  });

  it('ignores a row whose mesh index is not one of the meshes', () => {
    const stray: Geometry = {
      meshes: [unitBox],
      instances: instanceRecords([{ meshIndex: 7, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 0 }]),
    };
    expect(headlessScene(stray).drawnCount).toBe(0);
  });
});

describe('a geometry that carries its meshes only as a table', () => {
  // What the BFAST loader produces: `meshTable` holds every mesh and `meshes` is empty.
  const tabled: Geometry = {
    instances: twoBoxes.instances,
    meshes: [],
    meshTable: meshTableFrom(twoBoxes.meshes),
  };
  const built = headlessScene(twoBoxes);
  const fromTable = headlessScene(tabled);

  it('builds the same scene as the same meshes as records', () => {
    expect(fromTable.groups.length).toBe(built.groups.length);
    expect(fromTable.meshIndexOfGroup).toEqual(built.meshIndexOfGroup);
    expect(fromTable.drawnCount).toBe(built.drawnCount);
    expect(fromTable.triangleCount).toBe(built.triangleCount);
    expect(Array.from(fromTable.groupOfRow)).toEqual(Array.from(built.groupOfRow));
    expect(Array.from(fromTable.indexInGroup)).toEqual(Array.from(built.indexInGroup));
    expect(Array.from(fromTable.rowOfEntry)).toEqual(Array.from(built.rowOfEntry));
    expect(boundsOfScene(fromTable)).toEqual(boundsOfScene(built));
  });

  it('gives each group the same mesh buffers and the same instance columns', () => {
    const source = built.groups[0];
    const copy = fromTable.groups[0];
    if (source === undefined || copy === undefined) throw new Error('one of the scenes built no group');
    expect(Array.from(copy.mesh.positions)).toEqual(Array.from(source.mesh.positions));
    expect(Array.from(copy.mesh.indices ?? [])).toEqual(Array.from(source.mesh.indices ?? []));
    expect(Array.from(transformInScene(fromTable, 2))).toEqual(Array.from(transformInScene(built, 2)));
    expect(Array.from(colorInScene(fromTable, 0))).toEqual(Array.from(colorInScene(built, 0)));
  });

  it('draws nothing when the table it carries is empty, and does not throw', () => {
    const empty = headlessScene({ meshes: [], instances: twoBoxes.instances, meshTable: meshTableFrom([]) });
    expect(empty.groups).toEqual([]);
    expect(empty.drawnCount).toBe(0);
    expect(empty.triangleCount).toBe(0);
    expect(boundsOfScene(empty)).toBeNull();
  });
});

describe('mesh buffers', () => {
  it('sets normals only when the mesh has them', () => {
    expect(meshBuffersOf(unitBox).normals).toBeUndefined();
    expect('normals' in meshBuffersOf(unitBox)).toBe(false);
    const shaded = mesh(unitBox.positions, unitBox.indices, new Float32Array(unitBox.positions.length));
    expect(meshBuffersOf(shaded).normals).toBeInstanceOf(Float32Array);
  });
});

describe('building fixtures headlessly', () => {
  it('draws every instance of the small building that has geometry', () => {
    const fixture = smallBuilding();
    const built = headlessScene(fixture.geometry);
    expect(built.groups.length).toBeLessThanOrEqual(fixture.geometry.meshes.length);
    expect(built.triangleCount).toBe(fixture.triangleCount);
    const total = built.groups.reduce((sum, group) => sum + group.instanceCount, 0);
    expect(total).toBe(built.drawnCount);
  });

  it('builds the ten thousand instance stress scene, one group per mesh', () => {
    const fixture = stressScene();
    const built = headlessScene(fixture.geometry);
    expect(built.drawnCount).toBe(10_000);
    expect(built.groups.length).toBe(fixture.geometry.meshes.length);
    expect(built.triangleCount).toBe(fixture.triangleCount);
    const first = built.groups[0];
    if (first === undefined) throw new Error('the stress scene produced no groups');
    expect(first.transforms.length % transformStride).toBe(0);
    expect(first.colors.length % colorStride).toBe(0);
  });
});
