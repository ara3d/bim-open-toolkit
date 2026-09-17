import { describe, expect, it } from 'vitest';
import {
  atRevision, belongsTo, modelIdentity, modelKey, modelOf, objectKey, objectRef, parseModelKey,
  parseObjectKey, sameModel, sameModelId, sameObject, type ModelRef,
} from '../src/identity.js';

const model: ModelRef = { id: 'tower', revision: 'r1', source: 'https://example.test/tower.bos' };
const other: ModelRef = { id: 'tower', revision: 'r2' };

describe('identity', () => {
  it('drops the source from an identity', () => {
    expect(modelIdentity(model)).toEqual({ id: 'tower', revision: 'r1' });
  });

  it('names an object by model, revision and object id', () => {
    const ref = objectRef(model, 'door-3');
    expect(ref).toEqual({ modelId: 'tower', revision: 'r1', objectId: 'door-3' });
    expect(modelOf(ref)).toEqual({ id: 'tower', revision: 'r1' });
    expect(belongsTo(ref, model)).toBe(true);
    expect(belongsTo(ref, other)).toBe(false);
  });

  it('separates revisions of the same model', () => {
    expect(sameModel(model, other)).toBe(false);
    expect(sameModelId(model, other)).toBe(true);
    expect(objectKey(objectRef(model, 'a'))).not.toBe(objectKey(objectRef(other, 'a')));
  });

  it('gives two models the same local object ids without collision', () => {
    const first = objectKey(objectRef({ id: 'a', revision: 'r1' }, '7'));
    const second = objectKey(objectRef({ id: 'b', revision: 'r1' }, '7'));
    expect(first).not.toBe(second);
  });

  it('round-trips keys, including separators and percent signs inside the parts', () => {
    const ref = objectRef({ id: 'a|b', revision: 'r%7C1' }, 'x|y z');
    expect(parseObjectKey(objectKey(ref))).toEqual({ ok: true, value: ref, diagnostics: [] });
    expect(parseModelKey(modelKey(model))).toEqual({
      ok: true,
      value: { id: 'tower', revision: 'r1' },
      diagnostics: [],
    });
  });

  it('reports a key with the wrong number of parts or a broken encoding', () => {
    expect(parseObjectKey('a|b').ok).toBe(false);
    expect(parseModelKey('a|b|c').ok).toBe(false);
    expect(parseModelKey('a|%ZZ').ok).toBe(false);
  });

  it('compares object references by value', () => {
    expect(sameObject(objectRef(model, 'a'), objectRef(model, 'a'))).toBe(true);
    expect(sameObject(objectRef(model, 'a'), atRevision(objectRef(model, 'a'), 'r2'))).toBe(false);
  });
});
