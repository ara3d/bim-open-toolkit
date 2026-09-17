import { describe, expect, it } from 'vitest';
import { formatPath, type Result } from '../src/result.js';
import { integer, object, parse, string, type Schema } from '../src/schema.js';
import {
  currentFormatVersion, emptyDocument, getSlice, hasSlice, migrations, orphanSliceIds, parseDocument,
  putSlice, removeSlice, sliceRegistry, stateSlice, storedSliceIds, type SceneDocument,
} from '../src/slices.js';

type Counter = { readonly count: number };
type Named = { readonly count: number; readonly name: string };

const counterSchema: Schema<Counter> = object({ count: integer() });
const namedSchema: Schema<Named> = object({ count: integer(), name: string() });

const counter = stateSlice('counter', 1, counterSchema, { count: 0 });

// Version 2 of the same slice gained a name, so a version 1 value gets one.
const addName = (value: unknown): unknown => {
  const read = parse(counterSchema, value);
  return read.ok ? { count: read.value.count, name: 'migrated' } : value;
};

const named = stateSlice('counter', 2, namedSchema, { count: 0, name: 'unnamed' }, [{ from: 1, up: addName }]);

const codes = <T>(result: Result<T>): readonly string[] => result.diagnostics.map((item) => item.code);
const paths = <T>(result: Result<T>): readonly string[] => result.diagnostics.map((item) => formatPath(item.path));

describe('scene document', () => {
  it('starts empty at the current format version', () => {
    const document = emptyDocument([{ id: 'm', revision: 'r1' }]);
    expect(document.formatVersion).toBe(currentFormatVersion);
    expect(storedSliceIds(document)).toEqual([]);
    expect(document.models).toEqual([{ id: 'm', revision: 'r1' }]);
  });

  it('stores, reports and removes a slice value without changing the input', () => {
    const document = emptyDocument();
    const stored = putSlice(document, counter, { count: 3 });
    expect(hasSlice(stored, 'counter')).toBe(true);
    expect(hasSlice(document, 'counter')).toBe(false);
    expect(storedSliceIds(stored)).toEqual(['counter']);
    expect(hasSlice(removeSlice(stored, 'counter'), 'counter')).toBe(false);
  });

  it('round-trips a slice value through the document', () => {
    const stored = putSlice(emptyDocument(), counter, { count: 3 });
    expect(getSlice(stored, counter)).toEqual({ ok: true, value: { count: 3 }, diagnostics: [] });
  });

  it('gives the default and a note when a document predates the slice', () => {
    const read = getSlice(emptyDocument(), counter);
    expect(read.ok && read.value).toEqual({ count: 0 });
    expect(codes(read)).toEqual(['slice/absent']);
    expect(read.diagnostics[0]?.severity).toBe('info');
  });

  it('addresses a broken slice value under the slice id', () => {
    const broken: SceneDocument = { ...emptyDocument(), slices: { counter: { version: 1, value: { count: 'x' } } } };
    const read = getSlice(broken, counter);
    expect(read.ok).toBe(false);
    expect(paths(read)).toEqual(['counter.count']);
  });

  it('keeps the ids no installed slice owns', () => {
    const stored = putSlice(putSlice(emptyDocument(), counter, { count: 1 }), {
      ...counter,
      id: 'clipping',
    }, { count: 2 });
    expect(orphanSliceIds(stored, sliceRegistry([counter]))).toEqual(['clipping']);
    expect(storedSliceIds(stored)).toEqual(['counter', 'clipping']);
  });
});

describe('slice migration', () => {
  it('reads a value written at an earlier version through its steps', () => {
    const old = putSlice(emptyDocument(), counter, { count: 5 });
    expect(getSlice(old, named)).toEqual({
      ok: true,
      value: { count: 5, name: 'migrated' },
      diagnostics: [],
    });
  });

  it('refuses a version it has no step for, rather than guessing', () => {
    const gapped = stateSlice('counter', 3, namedSchema, { count: 0, name: 'unnamed' }, [
      { from: 2, up: (value) => value },
    ]);
    const old = putSlice(emptyDocument(), counter, { count: 5 });
    expect(codes(getSlice(old, gapped))).toEqual(['slice/migration']);
  });

  it('refuses a value written by a newer version of the feature', () => {
    const future: SceneDocument = { ...emptyDocument(), slices: { counter: { version: 9, value: {} } } };
    expect(codes(getSlice(future, named))).toEqual(['slice/future']);
  });

  it('refuses an older version when the slice declares no migration at all', () => {
    const old: SceneDocument = { ...emptyDocument(), slices: { counter: { version: 0, value: {} } } };
    expect(codes(getSlice(old, counter))).toEqual(['slice/version']);
  });

  it('checks the migrated value against the current schema', () => {
    const wrong = migrations(namedSchema, 2, [{ from: 1, up: () => ({ count: 'no' }) }]);
    expect(codes(wrong({ count: 1 }, 1))).toEqual(['schema/type', 'schema/missing']);
  });
});

describe('reading a document from plain data', () => {
  it('accepts a document it wrote', () => {
    const stored = putSlice(emptyDocument([{ id: 'm', revision: 'r1' }]), counter, { count: 2 });
    const round = parseDocument(JSON.parse(JSON.stringify(stored)));
    expect(round.ok && round.value).toEqual(stored);
    expect(round.ok && getSlice(round.value, counter)).toEqual({ ok: true, value: { count: 2 }, diagnostics: [] });
  });

  it('reports the shape it did not find', () => {
    expect(codes(parseDocument({ formatVersion: 1, models: 'none', slices: {} }))).toEqual(['schema/type']);
    expect(paths(parseDocument({ formatVersion: 1, models: [{ id: 'm' }], slices: {} }))).toEqual(['models[0].revision']);
  });

  it('reports a format version it does not read', () => {
    expect(codes(parseDocument({ formatVersion: 2, models: [], slices: {} }))).toEqual(['document/format']);
  });
});
