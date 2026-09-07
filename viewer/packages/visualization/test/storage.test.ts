import { describe, expect, it } from 'vitest';
import { SceneStorage, type StorageLike } from '../src/storage.js';
import type { SceneDocument } from '../src/contracts.js';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const document: SceneDocument = { schemaVersion: 1, models: [], sets: [], views: [], layers: [] };
describe('SceneStorage', () => {
  it('round trips encoded names and lists/deletes only its versioned namespace', () => {
    const memory = new MemoryStorage(), store = new SceneStorage(memory, 'test');
    memory.setItem('other:v1:x', 'untouched'); memory.setItem('test:v2:x', 'future');
    expect(store.save('A / % α', document).ok).toBe(true);
    expect(store.load('A / % α')).toEqual({ ok: true, value: document, diagnostics: [] });
    expect(store.list()).toEqual({ ok: true, value: ['A / % α'], diagnostics: [] });
    expect(store.remove('A / % α')).toEqual({ ok: true, value: true, diagnostics: [] });
    expect(store.remove('A / % α')).toEqual({ ok: true, value: false, diagnostics: [] });
    expect(memory.values.size).toBe(2);
  });
  it('requires explicit overwrite and validates before replacing a save', () => {
    const memory = new MemoryStorage(), store = new SceneStorage(memory);
    store.save('saved', document);
    const changed = { ...document, models: [{ id: 'new', revision: '1' }] };
    expect(store.save('saved', changed)).toMatchObject({ ok: false, diagnostics: [{ code: 'already-exists' }] });
    expect(store.load('saved')).toMatchObject({ ok: true, value: document });
    expect(store.save('saved', { ...document, schemaVersion: 2 } as unknown as SceneDocument, { overwrite: true }).ok).toBe(false);
    expect(store.load('saved')).toMatchObject({ ok: true, value: document });
    expect(store.save('saved', changed, { overwrite: true }).ok).toBe(true);
    expect(store.load('saved')).toMatchObject({ ok: true, value: changed });
  });
  it('reports missing/corrupt documents and malformed IDs/keys without removing data', () => {
    const memory = new MemoryStorage(), store = new SceneStorage(memory, 'test');
    expect(store.load('missing')).toMatchObject({ ok: false, diagnostics: [{ code: 'missing-document' }] });
    memory.setItem('test:v1:broken', '{');
    expect(store.load('broken')).toMatchObject({ ok: false, diagnostics: [{ code: 'corrupt-document' }] });
    expect(memory.getItem('test:v1:broken')).toBe('{');
    expect(store.load(' ')).toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-id' }] });
    expect(store.save(' ', document)).toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-id' }] });
    memory.setItem('test:v1:%invalid', '');
    expect(store.list()).toMatchObject({ ok: false, diagnostics: [{ code: 'corrupt-storage-key' }] });
  });
  it('reports quota errors and preserves the last successful save', () => {
    const memory = new MemoryStorage(), store = new SceneStorage(memory, 'test');
    store.save('saved', document);
    memory.setItem = () => { const error = new Error('Storage full'); error.name = 'QuotaExceededError'; throw error; };
    expect(store.save('saved', document, { overwrite: true })).toMatchObject({ ok: false, diagnostics: [{ code: 'storage-quota' }] });
    expect(store.load('saved')).toMatchObject({ ok: true, value: document });
  });
  it('reports denied access and errors from enumeration/removal', () => {
    const memory = new MemoryStorage(), store = new SceneStorage(memory);
    store.save('saved', document);
    memory.removeItem = () => { throw new Error('Remove failed'); };
    expect(store.remove('saved')).toMatchObject({ ok: false, diagnostics: [{ code: 'storage-failed' }] });
    memory.key = () => { throw new Error('List failed'); };
    expect(store.list()).toMatchObject({ ok: false, diagnostics: [{ code: 'storage-failed' }] });
    memory.getItem = () => { const error = new Error('Access denied'); error.name = 'SecurityError'; throw error; };
    expect(store.load('saved')).toMatchObject({ ok: false, diagnostics: [{ code: 'storage-unavailable' }] });
  });
});
