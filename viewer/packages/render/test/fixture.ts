// Small deterministic scenes for the render tests. Geometry is a unit box repeated; nothing here
// reads a model file and nothing needs a WebGL context.

import {
  identityMatrix,
  instanceRecords,
  mesh,
  meshTableFrom,
  modelIdentity,
  objectKey,
  objectRef,
  translation,
  type Color,
  type Geometry,
  type InstanceRecord,
  type Mesh,
  type ModelRef,
  type ObjectKey,
} from '@bim-open-toolkit/model';

// The model every fixture object belongs to.
export const fixtureModel: ModelRef = modelIdentity({ id: 'fixture', revision: '1' });

// Object key of the nth fixture object.
export const fixtureKey = (index: number): ObjectKey =>
  objectKey(objectRef(fixtureModel, `object-${index}`));

// Keys for `count` fixture objects, in ordinal order.
export const fixtureKeys = (count: number): readonly ObjectKey[] =>
  Array.from({ length: count }, (_unused, i) => fixtureKey(i));

// An axis-aligned unit cube of `size`, two triangles per face.
export const cube = (size: number): Mesh => {
  const h = size / 2;
  const corners: readonly (readonly [number, number, number])[] = [
    [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
    [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
  ];
  const positions = new Float32Array(corners.flatMap((corner) => [...corner]));
  const faces = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  return mesh(positions, Uint32Array.from(faces));
};

// One instance record, placed on the x axis so every instance has a distinct position.
export const instanceAt = (
  meshIndex: number,
  objectIndex: number,
  x: number,
  color: Color = [1, 1, 1],
  opacity = 1,
): InstanceRecord => ({
  meshIndex,
  transform: x === 0 ? identityMatrix : translation([x, 0, 0]),
  color,
  opacity,
  objectIndex,
});

// A scene of `meshCount` distinct meshes, `objectCount` objects and the supplied instance rows.
export const scene = (meshCount: number, rows: readonly InstanceRecord[]): Geometry => ({
  meshes: Array.from({ length: meshCount }, (_unused, i) => cube(1 + i)),
  instances: instanceRecords(rows),
});

// The scene every table test starts from: three meshes, four objects, five drawn instances and one
// object whose single instance record has no geometry at all.
//
// | row | mesh | object |
// |-----|------|--------|
// |  0  |  0   |   0    |
// |  1  |  0   |   2    |
// |  2  |  1   |   1    |
// |  3  |  1   |   1    |
// |  4  |  2   |   3    |
export const standardScene = (): Geometry =>
  scene(3, [
    instanceAt(0, 0, 0, [1, 0, 0]),
    instanceAt(1, 1, 1, [0, 1, 0], 0.5),
    instanceAt(0, 2, 2, [0, 0, 1]),
    instanceAt(1, 1, 3, [0, 1, 0], 0.5),
    instanceAt(2, 3, 4, [1, 1, 0]),
    instanceAt(-1, 4, 5),
  ]);

// The five objects the standard scene names, the last of which draws nothing.
export const standardKeys = fixtureKeys(5);

// The same geometry with its meshes only as columns, which is what a BFAST model gives a binding:
// `meshTable` holds every mesh and `meshes` is empty.
export const tableOnly = (geometry: Geometry): Geometry => ({
  instances: geometry.instances,
  meshes: [],
  meshTable: meshTableFrom(geometry.meshes),
});
