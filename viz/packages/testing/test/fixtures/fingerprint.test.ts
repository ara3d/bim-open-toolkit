import { describe, expect, it } from 'vitest';
import {
  emptyInstances,
  i32Column,
  identityMatrix,
  instanceRecords,
  mesh,
  metresZUpLocal,
  objectRef,
  stringColumn,
  table,
  u32Column,
  type Geometry,
  type ModelData,
} from '@bim-open-toolkit/model';
import {
  digestHex,
  emptyDigest,
  hashBytes,
  hashInt,
  hashOptionalText,
  hashText,
} from '../../src/fixtures/fingerprint.js';
import {
  checkFingerprint,
  fixtureFingerprint,
  geometryDigest,
  modelDigest,
  tableDigest,
  type SceneFixture,
} from '../../src/fixtures/scene-fixture.js';

// A fixture built from constants, so its fingerprint depends on this file alone and can be pinned.
const model: ModelData = {
  ref: { id: 'pinned', revision: '1' },
  coordinates: metresZUpLocal,
  objects: [
    { ref: objectRef({ id: 'pinned', revision: '1' }, 'a'), name: 'A', transform: identityMatrix, representation: 0 },
    { ref: objectRef({ id: 'pinned', revision: '1' }, 'b'), transform: identityMatrix },
  ],
};

const geometry: Geometry = {
  meshes: [mesh(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), new Uint32Array([0, 1, 2]))],
  instances: instanceRecords([
    { meshIndex: 0, transform: identityMatrix, color: [1, 0, 0], opacity: 1, objectIndex: 0 },
    { meshIndex: -1, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 1 },
  ]),
};

const pinned: SceneFixture = {
  name: 'pinned',
  description: 'One triangle and one object without geometry.',
  model,
  geometry,
  tables: [['rows', table([['id', u32Column([1, 2])], ['name', stringColumn(['a', 'b'])]])]],
  triangleCount: 1,
};

describe('digest', () => {
  it('folds bytes and reports eight hexadecimal digits', () => {
    expect(digestHex(hashBytes(emptyDigest, new Uint8Array([1, 2, 3])))).toMatch(/^[0-9a-f]{8}$/);
  });

  it('separates an absent value from an empty one', () => {
    expect(hashOptionalText(emptyDigest, undefined)).not.toBe(hashOptionalText(emptyDigest, ''));
  });

  it('includes the byte length, so appending a zero differs', () => {
    expect(hashBytes(emptyDigest, new Uint8Array([1, 2]))).not.toBe(
      hashBytes(emptyDigest, new Uint8Array([1, 2, 0])),
    );
  });

  it('does not see element width on its own, which is why a table digest hashes column types', () => {
    const bytes = new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0]);
    const words = new Uint32Array(bytes.buffer.slice(0));
    expect(hashBytes(emptyDigest, bytes)).toBe(hashBytes(emptyDigest, words));
    expect(tableDigest(table([['n', u32Column([1, 2])]]))).not.toBe(
      tableDigest(table([['n', i32Column([1, 2])]])),
    );
  });

  it('depends on the order of the calls', () => {
    expect(hashText(hashInt(emptyDigest, 1), 'a')).not.toBe(hashInt(hashText(emptyDigest, 'a'), 1));
  });
});

describe('fixture fingerprint', () => {
  it('is stable for a fixture built from constants', () => {
    // Pinned deliberately. When this moves, either the hash or one of the model contracts it reads
    // changed; update it only after checking which.
    expect(fixtureFingerprint(pinned)).toBe('7912da9f');
  });

  it('names both values when the pin does not match', () => {
    expect(() => checkFingerprint(pinned, '00000000')).toThrow(/7912da9f, expected 00000000/);
  });

  it('moves when one instance colour changes', () => {
    const changed = new Float32Array(geometry.instances.color);
    changed[1] = 0.5;
    const other = { ...pinned, geometry: { ...geometry, instances: { ...geometry.instances, color: changed } } };
    expect(fixtureFingerprint(other)).not.toBe(fixtureFingerprint(pinned));
  });

  it('moves when a table cell changes', () => {
    const other = { ...pinned, tables: [['rows', table([['id', u32Column([1, 3])]])]] as const };
    expect(fixtureFingerprint(other)).not.toBe(fixtureFingerprint(pinned));
  });

  it('moves when an object is renamed', () => {
    const [first, second] = model.objects;
    if (first === undefined || second === undefined) throw new Error('the pinned model lost an object');
    const other = { ...pinned, model: { ...model, objects: [{ ...first, name: 'renamed' }, second] } };
    expect(fixtureFingerprint(other)).not.toBe(fixtureFingerprint(pinned));
  });
});

describe('part digests', () => {
  it('distinguishes models, geometries and tables of the same shape', () => {
    expect(modelDigest(model)).not.toBe(geometryDigest(geometry));
    expect(tableDigest(table([]))).not.toBe(geometryDigest({ meshes: [], instances: emptyInstances(0) }));
  });
});
