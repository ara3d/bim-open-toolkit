import { emptyDocument, getSlice, putSlice } from '@bim-open-toolkit/model';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
import { describe, expect, it } from 'vitest';
import { annotationCommands, annotationsFeature, annotationsSlice } from '../src/annotations.js';
import {
  applyDocument,
  defaultStorageNamespace,
  documentOf,
  emptyScene,
  memoryStorageAdapter,
  noStorage,
  readDocument,
  sceneSource,
  storageCommands,
  storageFeature,
  storageFeatureWith,
  storagePrefix,
  storageSlice,
  webStorageAdapter,
  type SceneSource,
  type StorageAdapter,
  type WebStorageLike,
} from '../src/storage.js';
import { fakeSession } from './support/fake-session.js';

// A store shaped like a browser's, so the web adapter is exercised without a DOM.
const fakeWebStorage = (): WebStorageLike & { readonly entries: Map<string, string> } => {
  const entries = new Map<string, string>();
  return {
    entries,
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
};

const scene = sceneSource([annotationsSlice], [{ id: 'tower', revision: 'a' }]);

const adapters: readonly (readonly [string, () => StorageAdapter])[] = [
  ['memory', () => memoryStorageAdapter()],
  ['web', () => webStorageAdapter(fakeWebStorage())],
];

for (const [name, make] of adapters)
  describe(`the ${name} adapter`, () => {
    it('puts, gets, lists and deletes', () => {
      const adapter = make();
      expect(adapter.put('one', 'a', false).ok).toBe(true);
      expect(adapter.put('two', 'b', false).ok).toBe(true);
      const read = adapter.get('one');
      expect(read.ok && read.value).toBe('a');
      const listed = adapter.list();
      expect(listed.ok && listed.value).toEqual(['one', 'two']);
      expect(adapter.delete('one').ok).toBe(true);
      const after = adapter.list();
      expect(after.ok && after.value).toEqual(['two']);
    });

    it('never overwrites without being told to', () => {
      const adapter = make();
      adapter.put('one', 'a', false);
      expect(adapter.put('one', 'b', false).diagnostics.map((item) => item.code)).toEqual(['storage/exists']);
      expect(adapter.put('one', 'b', true).ok).toBe(true);
      const read = adapter.get('one');
      expect(read.ok && read.value).toBe('b');
    });

    it('reports a key nothing was saved under', () => {
      const adapter = make();
      expect(adapter.get('nothing').diagnostics.map((item) => item.code)).toEqual(['storage/missing']);
      expect(adapter.delete('nothing').diagnostics.map((item) => item.code)).toEqual(['storage/missing']);
    });

    it('refuses an empty key', () => {
      const adapter = make();
      expect(adapter.put('  ', 'a', false).diagnostics.map((item) => item.code)).toEqual(['storage/empty-key']);
    });
  });

describe('the versioned namespace', () => {
  it('puts the version in every key', () => {
    expect(storagePrefix('scenes')).toBe('scenes:v1:');
    expect(storagePrefix('scenes', 2)).toBe('scenes:v2:');
  });

  it('keeps two versions of one namespace apart', () => {
    const store = fakeWebStorage();
    const now = webStorageAdapter(store, 'scenes', 1);
    const next = webStorageAdapter(store, 'scenes', 2);
    now.put('one', 'old', false);
    expect(next.get('one').ok).toBe(false);
    expect(next.put('one', 'new', false).ok).toBe(true);
    const read = now.get('one');
    expect(read.ok && read.value).toBe('old');
    expect(store.entries.size).toBe(2);
  });

  it('encodes a key so a name cannot forge a namespace', () => {
    const store = fakeWebStorage();
    const adapter = webStorageAdapter(store, 'scenes');
    adapter.put('a:v1:b', 'x', false);
    expect([...store.entries.keys()]).toEqual(['scenes:v1:a%3Av1%3Ab']);
    const listed = adapter.list();
    expect(listed.ok && listed.value).toEqual(['a:v1:b']);
  });

  it('reports a stored key it cannot read back', () => {
    const store = fakeWebStorage();
    store.entries.set(`${storagePrefix(defaultStorageNamespace)}%zz`, 'x');
    expect(webStorageAdapter(store).list().diagnostics.map((item) => item.code)).toEqual(['storage/corrupt-key']);
  });
});

describe('the scene document', () => {
  it('carries the models and one value per slice, but not the storage bookkeeping', () => {
    const session = fakeSession(annotationCommands);
    session.dispatch('annotations.add', { id: 'a', text: 'x', position: [0, 0, 0] });
    const document = documentOf(session, sceneSource([annotationsSlice, storageSlice], [{ id: 'tower', revision: 'a' }]));
    expect(Object.keys(document.slices)).toEqual(['annotations']);
    expect(document.models).toEqual([{ id: 'tower', revision: 'a' }]);
  });

  it('loads every slice it can and leaves the broken one alone', () => {
    const session = fakeSession(annotationCommands);
    const broken = { ...emptyDocument(), slices: { annotations: { version: 1, value: { annotations: 'no' } } } };
    const applied = applyDocument(session, sceneSource([annotationsSlice]), broken);
    expect(applied.ok && applied.value).toEqual([]);
    expect(applied.diagnostics.every((item) => item.severity === 'warning')).toBe(true);
  });

  it('notes slice ids no feature owns rather than dropping them', () => {
    const session = fakeSession([]);
    const document = putSlice(putSlice(emptyDocument(), annotationsSlice, { annotations: [] }), storageSlice, noStorage);
    const applied = applyDocument(session, sceneSource([annotationsSlice]), document);
    expect(applied.diagnostics.map((item) => item.code)).toContain('storage/orphan-slices');
  });

  it('reports text that is not JSON rather than throwing', () => {
    expect(readDocument('{').diagnostics.map((item) => item.code)).toEqual(['storage/json']);
  });
});

describe('storage commands through a session', () => {
  const opened = () => fakeSession([...annotationCommands, ...storageCommands(memoryStorageAdapter(), scene)]);

  it('saves and loads the scene, restoring what was in it', () => {
    const one = opened();
    one.dispatch('annotations.add', { id: 'a', text: 'Loose fixing', position: [1, 1, 1] });
    expect(one.dispatch('storage.save', { key: 'level-2' }).ok).toBe(true);
    expect(one.read(storageSlice).lastSaved).toBe('level-2');
    expect(one.read(storageSlice).keys).toEqual(['level-2']);

    one.dispatch('annotations.remove', { id: 'a' });
    expect(one.read(annotationsSlice).annotations).toHaveLength(0);

    const loaded = one.dispatch('storage.load', { key: 'level-2' });
    expect(loaded.ok && loaded.value).toEqual(['annotations']);
    expect(one.read(annotationsSlice).annotations[0]?.text).toBe('Loose fixing');
    expect(one.read(storageSlice).lastLoaded).toBe('level-2');
  });

  it('refuses to save over a scene unless it is told to', () => {
    const one = opened();
    one.dispatch('storage.save', { key: 'level-2' });
    expect(one.dispatch('storage.save', { key: 'level-2' }).diagnostics.map((item) => item.code)).toEqual([
      'storage/exists',
    ]);
    expect(one.dispatch('storage.save', { key: 'level-2', overwrite: true }).ok).toBe(true);
  });

  it('lists and deletes what the store holds', () => {
    const one = opened();
    one.dispatch('storage.save', { key: 'b' });
    one.dispatch('storage.save', { key: 'a' });
    const listed = one.dispatch('storage.list', {});
    expect(listed.ok && listed.value).toEqual(['a', 'b']);
    expect(one.read(storageSlice).keys).toEqual(['a', 'b']);

    expect(one.dispatch('storage.delete', { key: 'a' }).ok).toBe(true);
    expect(one.read(storageSlice).keys).toEqual(['b']);
    expect(one.dispatch('storage.delete', { key: 'a' }).ok).toBe(false);
  });

  it('refuses to load a key nothing was saved under', () => {
    const one = opened();
    expect(one.dispatch('storage.load', { key: 'nothing' }).diagnostics.map((item) => item.code)).toEqual([
      'storage/missing',
    ]);
  });
});

describe('the storage slice', () => {
  it('round trips through a document', () => {
    const state = { namespace: 'scenes', keys: ['a', 'b'], lastSaved: 'b' };
    const document = putSlice(emptyDocument(), storageSlice, state);
    const read = getSlice(document, storageSlice);
    expect(read.ok && read.value).toEqual(state);
  });
});

describe('the feature', () => {
  it('names its commands and defaults to a store of its own', () => {
    expect(storageFeature.id).toBe('storage');
    expect(storageFeature.commands.map((item) => item.name)).toEqual([
      'storage.save',
      'storage.load',
      'storage.list',
      'storage.delete',
    ]);
    expect(emptyScene.slices()).toEqual([]);
  });
});

describe('through the viewer session', () => {
  it('saves and reloads every slice the session has registered', () => {
    const created = createSession();
    if (!created.ok) throw new Error('no session');
    const live = created.value;
    const whole: SceneSource = { slices: () => [...live.sliceRegistry().values()], models: () => [] };
    const host = featureHost(live);
    const done = host.install([annotationsFeature, storageFeatureWith(memoryStorageAdapter(), whole)]);
    expect(done.ok).toBe(true);

    live.dispatch('annotations.add', { id: 'a', text: 'Loose fixing', position: [1, 1, 1] });
    expect(live.dispatch('storage.save', { key: 'level-2' }).ok).toBe(true);
    live.dispatch('annotations.remove', { id: 'a' });
    const loaded = live.dispatch('storage.load', { key: 'level-2' });
    expect(loaded.ok && loaded.value).toEqual(['annotations']);
    expect(live.read(annotationsSlice).annotations[0]?.text).toBe('Loose fixing');
    host.dispose();
    expect(live.diagnostics()).toEqual([]);
  });
});
