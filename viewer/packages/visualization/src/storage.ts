import { parseSceneDocument, serializeSceneDocument } from './persistence.js';
import type { Result, SceneDocument } from './contracts.js';

/** Minimal synchronous key/value store, compatible with browser Storage and in-memory hosts. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const fail = (code: string, message: string): Result<never> => ({ ok: false, diagnostics: [{ code, message }] });
const storageFailure = (error: unknown): Result<never> => {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  const code = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ? 'storage-quota' : name === 'SecurityError' ? 'storage-unavailable' : 'storage-failed';
  return fail(code, error instanceof Error ? error.message : String(error));
};

/** Explicit saves only. A custom namespace must be exclusively owned by this adapter. */
export class SceneStorage {
  private readonly prefix: string;
  constructor(private readonly storage: StorageLike, namespace = 'bim-open-toolkit:scene') {
    if (!namespace.trim()) throw new Error('Storage namespace must be nonempty');
    this.prefix = `${namespace}:v1:`;
  }
  private key(id: string): string {
    if (!id.trim()) throw new Error('Scene ID must be nonempty');
    return this.prefix + encodeURIComponent(id);
  }
  save(id: string, document: SceneDocument, options: { readonly overwrite?: boolean } = {}): Result<true> {
    let key: string, json: string;
    try { key = this.key(id); } catch { return fail('invalid-id', 'Scene ID must be nonempty and encodable'); }
    try { json = serializeSceneDocument(document); }
    catch (error) { return fail('invalid-document', error instanceof Error ? error.message : String(error)); }
    try {
      if (!options.overwrite && this.storage.getItem(key) !== null) return fail('already-exists', `Scene ${id} already exists; replacement must be explicit`);
      this.storage.setItem(key, json);
      return { ok: true, value: true, diagnostics: [] };
    } catch (error) { return storageFailure(error); }
  }
  load(id: string): Result<SceneDocument> {
    let key: string;
    try { key = this.key(id); } catch { return fail('invalid-id', 'Scene ID must be nonempty and encodable'); }
    try {
      const json = this.storage.getItem(key);
      if (json === null) return fail('missing-document', `Scene ${id} was not found`);
      const parsed = parseSceneDocument(json);
      return parsed.ok ? parsed : fail('corrupt-document', parsed.diagnostics.map(item => item.message).join('; '));
    } catch (error) { return storageFailure(error); }
  }
  list(): Result<readonly string[]> {
    try {
      const ids: string[] = [];
      for (let index = 0; index < this.storage.length; index++) {
        const key = this.storage.key(index);
        if (!key?.startsWith(this.prefix)) continue;
        const encoded = key.slice(this.prefix.length);
        let id: string;
        try { id = decodeURIComponent(encoded); } catch { return fail('corrupt-storage-key', 'A saved scene key cannot be decoded'); }
        if (!id.trim() || encodeURIComponent(id) !== encoded) return fail('corrupt-storage-key', 'A saved scene key is malformed');
        ids.push(id);
      }
      return { ok: true, value: [...new Set(ids)].sort(), diagnostics: [] };
    } catch (error) { return storageFailure(error); }
  }
  remove(id: string): Result<boolean> {
    let key: string;
    try { key = this.key(id); } catch { return fail('invalid-id', 'Scene ID must be nonempty and encodable'); }
    try {
      if (this.storage.getItem(key) === null) return { ok: true, value: false, diagnostics: [] };
      this.storage.removeItem(key);
      return { ok: true, value: true, diagnostics: [] };
    } catch (error) { return storageFailure(error); }
  }
}
