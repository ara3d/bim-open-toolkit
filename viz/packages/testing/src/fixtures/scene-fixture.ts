// One named scene a test or a benchmark runs against, and the fingerprint that says it is still
// the scene the expected numbers were written against.
//
// Every fixture is the same shape whatever generator made it: the objects, the geometry that draws
// them, and the tables the workflows read. That is what lets a benchmark, a headless scene test and
// a browser spec all take "a fixture" rather than each knowing about a particular generator.

import {
  triangleCount,
  type Geometry,
  type Mesh,
  type ModelData,
  type ObjectRecord,
  type Table,
} from '@bim-open-toolkit/model';
import {
  digestHex,
  emptyDigest,
  hashBytes,
  hashInt,
  hashNumbers,
  hashOptionalNumber,
  hashOptionalText,
  hashText,
  type Digest,
} from './fingerprint.js';

// A named table published alongside a fixture, in a stable order.
export type NamedTable = readonly [string, Table];

// A scene to test against: what it is, what it draws, and what can be read off it.
export type SceneFixture = {
  readonly name: string;
  // One line saying what the fixture is for, so a report can name its workload honestly.
  readonly description: string;
  readonly model: ModelData;
  readonly geometry: Geometry;
  readonly tables: readonly NamedTable[];
  // Triangles the scene draws, counting every instance, which is the number the load and frame
  // budgets in the product brief are stated against.
  readonly triangleCount: number;
};

// The named table of a fixture, or undefined when it publishes no such table.
export const tableOf = (fixture: SceneFixture, name: string): Table | undefined =>
  fixture.tables.find(([tableName]) => tableName === name)?.[1];

// How many triangles the instances of a geometry draw in total.
export const drawnTriangles = (geometry: Geometry): number => {
  let total = 0;
  for (let row = 0; row < geometry.instances.count; row += 1) {
    const index = geometry.instances.meshIndex[row] ?? -1;
    const mesh = index < 0 ? undefined : geometry.meshes[index];
    if (mesh !== undefined) total += triangleCount(mesh);
  }
  return total;
};

// The frame a model reports in.
const hashCoordinates = (digest: Digest, model: ModelData): Digest => {
  const { units, up, registration } = model.coordinates;
  const named = hashText(hashText(hashText(digest, units), up), registration.kind);
  if (registration.kind === 'project') return hashText(named, registration.projectId);
  if (registration.kind === 'geographic') {
    const { latitude, longitude, altitude, trueNorthDegrees } = registration.anchor;
    return hashNumbers(named, [latitude, longitude, altitude, trueNorthDegrees]);
  }
  return named;
};

// One object record: its identity, its place in the tree, where it sits and how it looks.
const hashObject = (digest: Digest, record: ObjectRecord): Digest => {
  const identity = hashText(hashText(hashText(digest, record.ref.modelId), record.ref.revision), record.ref.objectId);
  const named = hashOptionalText(
    hashOptionalText(hashOptionalText(hashOptionalText(identity, record.name), record.category), record.sourceId),
    record.parentId,
  );
  const placed = hashNumbers(named, [...record.transform]);
  const appearance = record.appearance;
  const styled =
    appearance === undefined
      ? hashInt(placed, 0)
      : hashNumbers(hashInt(placed, 1), [...appearance.color, appearance.opacity, appearance.visible ? 1 : 0]);
  return hashOptionalNumber(styled, record.representation);
};

// The objects of a model, in table order, with the model's identity and frame.
export const modelDigest = (model: ModelData, digest: Digest = emptyDigest): Digest => {
  const identified = hashOptionalText(
    hashText(hashText(digest, model.ref.id), model.ref.revision),
    model.ref.source,
  );
  return model.objects.reduce(hashObject, hashInt(hashCoordinates(identified, model), model.objects.length));
};

// One mesh: its buffers and the box it declares.
const hashMesh = (digest: Digest, source: Mesh): Digest => {
  const buffers = hashBytes(hashBytes(digest, source.positions), source.indices);
  const shaded = source.normals === undefined ? hashInt(buffers, 0) : hashBytes(hashInt(buffers, 1), source.normals);
  return hashNumbers(shaded, [...source.bounds.min, ...source.bounds.max]);
};

// The meshes and the instance columns of a geometry.
export const geometryDigest = (geometry: Geometry, digest: Digest = emptyDigest): Digest => {
  const meshes = geometry.meshes.reduce(hashMesh, hashInt(digest, geometry.meshes.length));
  const { count, meshIndex, transform, color, objectIndex } = geometry.instances;
  return hashBytes(hashBytes(hashBytes(hashBytes(hashInt(meshes, count), meshIndex), transform), color), objectIndex);
};

// One table: its column names in order, each column's type, and its values.
export const tableDigest = (source: Table, digest: Digest = emptyDigest): Digest => {
  let result = hashInt(hashInt(digest, source.rowCount), source.columns.size);
  for (const [name, column] of source.columns) {
    result = hashText(hashText(result, name), column.type);
    result =
      column.type === 'string'
        ? column.values.reduce(hashText, hashInt(result, column.values.length))
        : hashBytes(result, column.values);
  }
  return result;
};

// A whole fixture: its name, its model, its geometry and every table it publishes.
export const fixtureDigest = (fixture: SceneFixture): Digest => {
  const scene = geometryDigest(fixture.geometry, modelDigest(fixture.model, hashText(emptyDigest, fixture.name)));
  return fixture.tables.reduce(
    (digest, [name, values]) => tableDigest(values, hashText(digest, name)),
    hashInt(scene, fixture.tables.length),
  );
};

// The eight hexadecimal digits a test pins to prove the fixture did not change.
export const fixtureFingerprint = (fixture: SceneFixture): string => digestHex(fixtureDigest(fixture));

// Rejects a fixture whose fingerprint moved, naming both values so the caller can update the pin
// deliberately rather than by rerunning until it passes.
export function checkFingerprint(fixture: SceneFixture, expected: string): void {
  const actual = fixtureFingerprint(fixture);
  if (actual !== expected) {
    throw new Error(`fixture "${fixture.name}" fingerprint is ${actual}, expected ${expected}`);
  }
}
