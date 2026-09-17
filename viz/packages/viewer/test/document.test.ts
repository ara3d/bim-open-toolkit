import { describe, expect, it } from 'vitest';
import { integer, object, parse, stateSlice, string, type ModelRef, type SceneDocument } from '@bim-open-toolkit/model';
import { featureHost } from '../src/features.js';
import { createSession, type ViewerSession } from '../src/session.js';
import {
  documentFingerprint,
  fingerprintSliceId,
  loadScene,
  modelFingerprint,
  readScene,
  saveScene,
  writeScene,
} from '../src/document.js';
import { counterFeature, counterSlice, noteFeature, noteSlice } from './support/fixtures.js';

const tower: ModelRef = { id: 'tower', revision: 'r1' };
const other: ModelRef = { id: 'tower', revision: 'r2' };

const withFeatures = (): ViewerSession => {
  const made = createSession();
  if (!made.ok) throw new Error(made.diagnostics.map((one) => one.message).join('; '));
  const installed = featureHost(made.value).install([counterFeature, noteFeature([])]);
  if (!installed.ok) throw new Error(installed.diagnostics.map((one) => one.message).join('; '));
  return made.value;
};

const savedDocument = (session: ViewerSession, models: readonly ModelRef[] = [tower]): SceneDocument => {
  const saved = saveScene(session, models);
  if (!saved.ok) throw new Error('save failed');
  return saved.value;
};

describe('saveScene and loadScene', () => {
  it('saves one envelope per registered slice, plus the model fingerprint', () => {
    const session = withFeatures();
    session.write(counterSlice, { count: 4 });
    const document = savedDocument(session);
    expect(Object.keys(document.slices).sort()).toEqual(['test.counter', 'test.note', fingerprintSliceId]);
    expect(document.slices['test.counter']).toEqual({ version: 1, value: { count: 4 } });
    expect(document.models).toEqual([tower]);
    expect(documentFingerprint(document)).toBe(modelFingerprint([tower]));
  });

  it('does not save a value whose slice nobody registered', () => {
    const session = withFeatures();
    const stray = stateSlice('test.stray', 1, object({ n: integer() }), { n: 0 });
    session.write(stray, { n: 1 });
    expect(Object.keys(savedDocument(session).slices)).not.toContain('test.stray');
  });

  it('round-trips two features through JSON', () => {
    const session = withFeatures();
    session.write(counterSlice, { count: 9 });
    session.write(noteSlice, { text: 'kept' });
    const text = writeScene(savedDocument(session));

    const opened = withFeatures();
    const document = readScene(text);
    expect(document.ok).toBe(true);
    if (!document.ok) return;
    const loaded = loadScene(opened, document.value, { models: [tower] });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect([...loaded.value.restored].sort()).toEqual(['test.counter', 'test.note']);
    expect(opened.read(counterSlice)).toEqual({ count: 9 });
    expect(opened.read(noteSlice)).toEqual({ text: 'kept' });
  });

  it('refuses a document saved against a different model revision', () => {
    const session = withFeatures();
    const document = savedDocument(session, [tower]);
    const refused = loadScene(withFeatures(), document, { models: [other] });
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/model-mismatch');
  });

  it('restores against a different model when told to, and says so', () => {
    const session = withFeatures();
    session.write(counterSlice, { count: 2 });
    const opened = withFeatures();
    const loaded = loadScene(opened, savedDocument(session, [tower]), { models: [other], anyModel: true });
    expect(loaded.ok).toBe(true);
    expect(loaded.diagnostics.map((one) => one.code)).toContain('viewer/model-mismatch');
    expect(opened.read(counterSlice)).toEqual({ count: 2 });
  });

  it('warns rather than refusing when the document carries no fingerprint', () => {
    const session = withFeatures();
    const document = savedDocument(session);
    const withoutSlices = Object.fromEntries(
      Object.entries(document.slices).filter(([id]) => id !== fingerprintSliceId),
    );
    const loaded = loadScene(withFeatures(), { ...document, slices: withoutSlices }, { models: [tower] });
    expect(loaded.ok).toBe(true);
    expect(loaded.diagnostics.map((one) => one.code)).toContain('viewer/no-fingerprint');
  });

  it('leaves a registered slice the document says nothing about at the value it had', () => {
    const session = withFeatures();
    session.write(counterSlice, { count: 1 });
    const document = savedDocument(session);
    const trimmed = Object.fromEntries(Object.entries(document.slices).filter(([id]) => id !== 'test.note'));

    const opened = withFeatures();
    opened.write(noteSlice, { text: 'mine' });
    const loaded = loadScene(opened, { ...document, slices: trimmed }, { models: [tower] });
    expect(loaded.ok && [...loaded.value.absent]).toEqual(['test.note']);
    expect(opened.read(noteSlice)).toEqual({ text: 'mine' });
  });

  it('reports a slice nothing installed owns and keeps it in the document', () => {
    const session = withFeatures();
    const document = savedDocument(session);

    const bare = createSession();
    if (!bare.ok) return;
    featureHost(bare.value).install([counterFeature]);
    const loaded = loadScene(bare.value, document, { models: [tower] });
    expect(loaded.ok && [...loaded.value.orphans]).toEqual(['test.note']);
    expect(loaded.diagnostics.map((one) => one.code)).toContain('viewer/orphan-slice');
    expect(document.slices['test.note']).toBeDefined();
  });

  it('writes nothing when one slice cannot be read', () => {
    const session = withFeatures();
    session.write(counterSlice, { count: 6 });
    session.write(noteSlice, { text: 'kept' });
    const document = savedDocument(session);
    const broken: SceneDocument = {
      ...document,
      slices: { ...document.slices, 'test.note': { version: 1, value: { text: 7 } } },
    };
    const opened = withFeatures();
    const refused = loadScene(opened, broken, { models: [tower] });
    expect(refused.ok).toBe(false);
    expect(opened.read(counterSlice)).toEqual({ count: 0 });
  });

  it('migrates a slice written at an earlier version', () => {
    const versioned = stateSlice('test.versioned', 2, object({ text: string() }), { text: '' }, [
      {
        from: 1,
        up: (value) => {
          const read = parse(object({ label: string() }), value);
          return read.ok ? { text: read.value.label } : { text: '' };
        },
      },
    ]);
    const made = createSession({ slices: [versioned] });
    if (!made.ok) return;
    const document: SceneDocument = {
      formatVersion: 1,
      models: [],
      slices: { 'test.versioned': { version: 1, value: { label: 'old' } } },
    };
    const loaded = loadScene(made.value, document);
    expect(loaded.ok).toBe(true);
    expect(made.value.read(versioned)).toEqual({ text: 'old' });
  });

  it('refuses a slice with no migration from the version it was written at', () => {
    const versioned = stateSlice('test.versioned', 2, object({ text: string() }), { text: '' });
    const made = createSession({ slices: [versioned] });
    if (!made.ok) return;
    const document: SceneDocument = {
      formatVersion: 1,
      models: [],
      slices: { 'test.versioned': { version: 1, value: { text: 'old' } } },
    };
    const refused = loadScene(made.value, document);
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('slice/version');
  });

  it('restores every installed slice, which is the wave 2 acceptance case', () => {
    const session = withFeatures();
    session.dispatch('test.note', { text: 'from a command' });
    const document = savedDocument(session);

    const opened = createSession();
    if (!opened.ok) return;
    const host = featureHost(opened.value);
    host.install([counterFeature]);
    // The note feature is installed after the counter, exactly as a host would add a plug-in.
    host.install([noteFeature([])]);
    const loaded = loadScene(opened.value, document, { models: [tower] });
    expect(loaded.ok && [...loaded.value.restored].sort()).toEqual(['test.counter', 'test.note']);
    expect(loaded.ok && loaded.value.orphans).toEqual([]);
    expect(opened.value.read(noteSlice)).toEqual({ text: 'from a command' });
    expect(opened.value.read(counterSlice)).toEqual({ count: 1 });
  });

  it('reads a document that is not JSON as a diagnostic', () => {
    const refused = readScene('{ not json');
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/not-json');
  });

  it('reports a document whose format version is not the one this package reads', () => {
    const read = readScene(JSON.stringify({ formatVersion: 99, models: [], slices: {} }));
    expect(read.diagnostics.map((one) => one.code)).toContain('document/format');
  });

  it('fingerprints the same models the same however they were listed', () => {
    const a: ModelRef = { id: 'a', revision: '1' };
    const b: ModelRef = { id: 'b', revision: '1' };
    expect(modelFingerprint([a, b])).toBe(modelFingerprint([b, a]));
    expect(modelFingerprint([a])).not.toBe(modelFingerprint([a, b]));
  });

  it('saves a scene with no models at all', () => {
    const made = createSession();
    if (!made.ok) return;
    const saved = saveScene(made.value);
    expect(saved.ok && saved.value.models).toEqual([]);
  });
});
