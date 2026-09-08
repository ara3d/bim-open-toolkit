// Storage: saving and loading the scene document, behind an adapter.
//
// Everything a store has to do is four operations over string keys and string values, so a browser's
// `localStorage`, a file, a server or a map in a test all satisfy the same interface and nothing
// above this line knows which one it has. The adapter is injected rather than reached for, because
// a viewer that assumes `localStorage` cannot be tested in Node and cannot be embedded anywhere
// that has no window.
//
// Two rules are worth stating because losing work is the failure that matters. A namespace carries
// a version, so a later format lives beside the current one instead of on top of it; and a put over
// an existing key is refused unless the caller says to replace it, so nothing is overwritten by
// accident.

import {
  array,
  boolean,
  command,
  diagnostic,
  emptyDocument,
  failure,
  feature,
  getSlice,
  note,
  object,
  optional,
  orphanSliceIds,
  parseDocument,
  putSlice,
  sliceRegistry,
  stateSlice,
  string,
  success,
  warning,
  type Command,
  type Diagnostic,
  type Feature,
  type Migration,
  type ModelRef,
  type Result,
  type SceneDocument,
  type Schema,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';

// A store of strings by key, inside one versioned namespace.
//
// Every operation returns a `Result` rather than throwing, because a quota that is full, a browser
// that blocks site data and a key that was never written are all ordinary answers a caller has to
// handle, not exceptions.
export type StorageAdapter = {
  readonly namespace: string;
  readonly get: (key: string) => Result<string>;
  readonly put: (key: string, value: string, overwrite: boolean) => Result<string>;
  readonly list: () => Result<readonly string[]>;
  readonly delete: (key: string) => Result<string>;
};

// The namespace scenes are saved under when nobody says otherwise.
export const defaultStorageNamespace = 'bim-open-toolkit:scene';

// The format version a namespace stores. A later format takes the next number and leaves what is
// already saved where it is.
export const storageVersion = 1;

// What every key of a namespace begins with.
export const storagePrefix = (namespace: string, version: number = storageVersion): string =>
  `${namespace}:v${version}:`;

// A key that can be stored and read back exactly, or a diagnostic saying why it cannot.
export const checkStorageKey = (key: string): Result<string> =>
  key.trim() === ''
    ? failure([diagnostic('storage/empty-key', 'A storage key cannot be empty.')])
    : success(key);

// The in-memory store, which is also the store a test uses. It is not a stub: it is the whole
// interface, so anything that passes against it is exercising the real ordering and refusals.
export const memoryStorageAdapter = (
  namespace: string = defaultStorageNamespace,
  version: number = storageVersion,
): StorageAdapter => {
  const entries = new Map<string, string>();
  const prefix = storagePrefix(namespace, version);
  return {
    namespace,
    get: (key) => {
      const checked = checkStorageKey(key);
      if (!checked.ok) return checked;
      const found = entries.get(prefix + key);
      return found === undefined
        ? failure([diagnostic('storage/missing', `Nothing is saved under "${key}".`)])
        : success(found);
    },
    put: (key, value, overwrite) => {
      const checked = checkStorageKey(key);
      if (!checked.ok) return checked;
      if (!overwrite && entries.has(prefix + key))
        return failure([diagnostic('storage/exists', `"${key}" is already saved; replacing it has to be explicit.`)]);
      entries.set(prefix + key, value);
      return success(key);
    },
    list: () => success([...entries.keys()].map((key) => key.slice(prefix.length)).sort()),
    delete: (key) => {
      const checked = checkStorageKey(key);
      if (!checked.ok) return checked;
      return entries.delete(prefix + key)
        ? success(key)
        : failure([diagnostic('storage/missing', `Nothing is saved under "${key}".`)]);
    },
  };
};

// The part of a browser's `Storage` this package uses. Stating it rather than naming `Storage`
// keeps the module out of the DOM, so the same adapter runs against a fake in Node.
export type WebStorageLike = {
  readonly length: number;
  readonly key: (index: number) => string | null;
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
};

// What went wrong with a web store, told apart by name so a full quota reads differently from a
// browser that refuses site data altogether.
const webFailure = (cause: unknown): Diagnostic => {
  const name = cause instanceof Error ? cause.name : '';
  const message = cause instanceof Error ? cause.message : 'no reason given';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return diagnostic('storage/quota', `There is no room left in the store: ${message}.`);
  if (name === 'SecurityError') return diagnostic('storage/unavailable', `The store cannot be used here: ${message}.`);
  return diagnostic('storage/failed', `The store refused the operation: ${message}.`);
};

// The key a stored name encodes, or undefined when it is not one this adapter wrote.
const decodeStorageKey = (encoded: string): string | undefined => {
  try {
    const decoded = decodeURIComponent(encoded);
    return encodeURIComponent(decoded) === encoded ? decoded : undefined;
  } catch {
    return undefined;
  }
};

// The same interface over a browser's `localStorage` or `sessionStorage`, or anything shaped like
// one. Keys are percent-encoded so a scene name with a colon in it cannot forge a namespace.
export const webStorageAdapter = (
  storage: WebStorageLike,
  namespace: string = defaultStorageNamespace,
  version: number = storageVersion,
): StorageAdapter => {
  const prefix = storagePrefix(namespace, version);
  const stored = (key: string): string => prefix + encodeURIComponent(key);
  return {
    namespace,
    get: (key) => {
      const checked = checkStorageKey(key);
      if (!checked.ok) return checked;
      try {
        const found = storage.getItem(stored(key));
        return found === null
          ? failure([diagnostic('storage/missing', `Nothing is saved under "${key}".`)])
          : success(found);
      } catch (cause) {
        return failure([webFailure(cause)]);
      }
    },
    put: (key, value, overwrite) => {
      const checked = checkStorageKey(key);
      if (!checked.ok) return checked;
      try {
        if (!overwrite && storage.getItem(stored(key)) !== null)
          return failure([diagnostic('storage/exists', `"${key}" is already saved; replacing it has to be explicit.`)]);
        storage.setItem(stored(key), value);
        return success(key);
      } catch (cause) {
        return failure([webFailure(cause)]);
      }
    },
    list: () => {
      try {
        const keys: string[] = [];
        for (let at = 0; at < storage.length; at += 1) {
          const key = storage.key(at);
          if (key === null || !key.startsWith(prefix)) continue;
          const encoded = key.slice(prefix.length);
          const decoded = decodeStorageKey(encoded);
          if (decoded === undefined)
            return failure([diagnostic('storage/corrupt-key', `The saved key "${encoded}" cannot be read.`)]);
          keys.push(decoded);
        }
        return success(keys.sort());
      } catch (cause) {
        return failure([webFailure(cause)]);
      }
    },
    delete: (key) => {
      const checked = checkStorageKey(key);
      if (!checked.ok) return checked;
      try {
        if (storage.getItem(stored(key)) === null)
          return failure([diagnostic('storage/missing', `Nothing is saved under "${key}".`)]);
        storage.removeItem(stored(key));
        return success(key);
      } catch (cause) {
        return failure([webFailure(cause)]);
      }
    },
  };
};

// What a scene is made of: the slices a session has installed and the models it holds. The viewer
// supplies both; this feature never enumerates a session on its own, because a session that could
// be enumerated would let one feature read another's state.
export type SceneSource = {
  readonly slices: () => readonly StateSlice<unknown>[];
  readonly models: () => readonly ModelRef[];
};

// A scene of exactly these slices and models.
export const sceneSource = (
  slices: readonly StateSlice<unknown>[],
  models: readonly ModelRef[] = [],
): SceneSource => ({ slices: () => slices, models: () => models });

// A scene with nothing in it, for a host that has not said what it holds.
export const emptyScene: SceneSource = sceneSource([]);

// What has been saved and what was last touched. The keys are a cache of the store's own listing,
// refreshed by `storage.list`, so a UI can show them without a read on every frame.
export type StorageState = {
  readonly namespace: string;
  readonly keys: readonly string[];
  readonly lastSaved?: string | undefined;
  readonly lastLoaded?: string | undefined;
};

// The whole slice.
export const storageSchema: Schema<StorageState> = object({
  namespace: string(),
  keys: array(string()),
  lastSaved: optional(string()),
  lastLoaded: optional(string()),
});

// Nothing saved yet.
export const noStorage: StorageState = { namespace: defaultStorageNamespace, keys: [] };

// Version 1 has no earlier versions to read; a later version adds its step here.
export const storageMigrations: readonly Migration[] = [];

// The slice the storage feature owns.
export const storageSlice: StateSlice<StorageState> = stateSlice(
  'storage',
  1,
  storageSchema,
  noStorage,
  storageMigrations,
);

// The slices a save covers: everything the scene holds except this feature's own bookkeeping.
// Saving the list of saved scenes into a saved scene would restore a stale listing on load.
const savedSlices = (scene: SceneSource): readonly StateSlice<unknown>[] =>
  scene.slices().filter((slice) => slice.id !== storageSlice.id);

// The scene document as it stands: the models, and one stored value per slice.
export const documentOf = (session: Session, scene: SceneSource): SceneDocument =>
  savedSlices(scene).reduce(
    (document, slice) => putSlice(document, slice, session.read(slice)),
    emptyDocument(scene.models()),
  );

// Writes a document into the session, a slice at a time.
//
// A slice that will not read leaves every other slice loaded and reports its own complaint as a
// warning: refusing the whole document would throw away the parts that are perfectly good, which is
// the opposite of what somebody opening an old scene wants. Slice ids nobody owns are kept in the
// document and noted, never dropped.
export const applyDocument = (
  session: Session,
  scene: SceneSource,
  document: SceneDocument,
): Result<readonly string[]> => {
  const slices = savedSlices(scene);
  const applied: string[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const slice of slices) {
    const value = getSlice(document, slice);
    if (value.ok) {
      session.write(slice, value.value);
      applied.push(slice.id);
      continue;
    }
    for (const item of value.diagnostics)
      diagnostics.push(warning(item.code, `The "${slice.id}" slice was left alone: ${item.message}`, item.path));
  }
  const orphans = orphanSliceIds(document, sliceRegistry(slices));
  if (orphans.length > 0)
    diagnostics.push(note('storage/orphan-slices', `The document also holds ${orphans.join(', ')}, which no feature owns.`));
  return success(applied, diagnostics);
};

// Saves the scene under a key. An existing key is refused unless `overwrite` says to replace it.
const saveCommand = (adapter: StorageAdapter, scene: SceneSource): Command =>
  command({
    name: 'storage.save',
    title: 'Save scene',
    description: 'Writes the scene document to the store under a key.',
    input: object({ key: string(), overwrite: optional(boolean()) }),
    run: (session: Session, input) => {
      const document = documentOf(session, scene);
      const written = adapter.put(input.key, JSON.stringify(document), input.overwrite ?? false);
      if (!written.ok) return failure(written.diagnostics);
      const state = session.read(storageSlice);
      session.write(storageSlice, {
        ...state,
        namespace: adapter.namespace,
        keys: state.keys.includes(input.key) ? state.keys : [...state.keys, input.key].sort(),
        lastSaved: input.key,
      });
      return success(input.key, written.diagnostics);
    },
  });

// Loads the scene saved under a key into the session.
const loadCommand = (adapter: StorageAdapter, scene: SceneSource): Command =>
  command({
    name: 'storage.load',
    title: 'Load scene',
    description: 'Reads the scene document saved under a key and writes it into the session.',
    input: object({ key: string() }),
    run: (session: Session, input) => {
      const text = adapter.get(input.key);
      if (!text.ok) return failure(text.diagnostics);
      const parsed = readDocument(text.value);
      if (!parsed.ok) return failure(parsed.diagnostics);
      const applied = applyDocument(session, scene, parsed.value);
      if (!applied.ok) return failure(applied.diagnostics);
      const state = session.read(storageSlice);
      session.write(storageSlice, { ...state, namespace: adapter.namespace, lastLoaded: input.key });
      return success(applied.value, [...parsed.diagnostics, ...applied.diagnostics]);
    },
  });

// Reads a document out of JSON text. Text that is not JSON is reported, never thrown.
export const readDocument = (json: string): Result<SceneDocument> => {
  try {
    return parseDocument(JSON.parse(json));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'no reason given';
    return failure([diagnostic('storage/json', `The saved scene is not JSON: ${reason}.`)]);
  }
};

// Lists what the store holds, and remembers it in the slice.
const listCommand = (adapter: StorageAdapter): Command =>
  command({
    name: 'storage.list',
    title: 'List saved scenes',
    description: 'Reads the keys the store holds in this namespace.',
    input: object({}),
    run: (session: Session) => {
      const keys = adapter.list();
      if (!keys.ok) return failure(keys.diagnostics);
      const state = session.read(storageSlice);
      session.write(storageSlice, { ...state, namespace: adapter.namespace, keys: keys.value });
      return success(keys.value, keys.diagnostics);
    },
  });

// Deletes what is saved under a key.
const deleteCommand = (adapter: StorageAdapter): Command =>
  command({
    name: 'storage.delete',
    title: 'Delete saved scene',
    description: 'Removes what is saved under a key.',
    input: object({ key: string() }),
    run: (session: Session, input) => {
      const removed = adapter.delete(input.key);
      if (!removed.ok) return failure(removed.diagnostics);
      const state = session.read(storageSlice);
      session.write(storageSlice, {
        ...state,
        namespace: adapter.namespace,
        keys: state.keys.filter((key) => key !== input.key),
      });
      return success(input.key, removed.diagnostics);
    },
  });

// The commands the storage feature registers, in the order a registry lists them.
export const storageCommands = (adapter: StorageAdapter, scene: SceneSource): readonly Command[] => [
  saveCommand(adapter, scene),
  loadCommand(adapter, scene),
  listCommand(adapter),
  deleteCommand(adapter),
];

// Scene storage over a given store and a given scene.
export const storageFeatureWith = (adapter: StorageAdapter, scene: SceneSource): Feature<StorageState> =>
  feature('storage', storageSlice, storageCommands(adapter, scene));

// Scene storage over a fresh in-memory store holding nothing but this feature's own slice.
// A host replaces it with `storageFeatureWith` once it knows its store and its slices.
export const storageFeature: Feature<StorageState> = storageFeatureWith(memoryStorageAdapter(), emptyScene);
