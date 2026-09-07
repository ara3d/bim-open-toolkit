import { objectKey, type Diagnostic, type ModelData, type ModelRef, type ObjectRef, type Result, type SceneDocument } from './contracts.js';

type Check = (value: unknown, path: string) => void;
const invalid = (path: string, expected: string): never => { throw new Error(`${path}: expected ${expected}`); };
const string: Check = (v, p) => { if (typeof v !== 'string') invalid(p, 'string'); };
const number: Check = (v, p) => { if (typeof v !== 'number' || !Number.isFinite(v)) invalid(p, 'finite number'); };
const unitInterval: Check = (v, p) => { number(v, p); if ((v as number) < 0 || (v as number) > 1) invalid(p, 'number in [0, 1]'); };
const positive: Check = (v, p) => { number(v, p); if ((v as number) <= 0) invalid(p, 'positive number'); };
const boolean: Check = (v, p) => { if (typeof v !== 'boolean') invalid(p, 'boolean'); };
const enumeration = (...values: unknown[]): Check => (v, p) => { if (!values.includes(v)) invalid(p, values.join(' | ')); };
const plainArray: Check = (v, p) => {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) invalid(p, 'plain array');
  const values = v as unknown[];
  if (Reflect.ownKeys(values).length !== values.length + 1) invalid(p, 'dense array without extra fields');
  for (let i = 0; i < values.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(values, String(i));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) invalid(`${p}[${i}]`, 'plain array element');
  }
};
const tuple = (length: number, check: Check = number): Check => (v, p) => {
  plainArray(v, p);
  if (!Array.isArray(v) || v.length !== length) invalid(p, `${length}-number tuple`);
  for (let i = 0; i < length; i++) check((v as unknown[])[i], `${p}[${i}]`);
};
const array = (check: Check): Check => (v, p) => {
  plainArray(v, p);
  const values = v as unknown[];
  for (let i = 0; i < values.length; i++) check(values[i], `${p}[${i}]`);
};
const object = (required: Record<string, Check>, optional: Record<string, Check> = {}): Check => (v, p) => {
  if (!v || typeof v !== 'object' || (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) invalid(p, 'plain object');
  const record = v as Record<string, unknown>;
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string' || (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key))) invalid(`${p}.${String(key)}`, 'known data field');
    const descriptor = Object.getOwnPropertyDescriptor(record, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable) invalid(`${p}.${String(key)}`, 'plain data field');
  }
  for (const [key, check] of Object.entries(required)) {
    if (!Object.hasOwn(record, key)) invalid(`${p}.${key}`, 'required field');
    check(record[key], `${p}.${key}`);
  }
  for (const [key, check] of Object.entries(optional)) if (Object.hasOwn(record, key)) check(record[key], `${p}.${key}`);
};
const ref = object({ modelId: string, objectId: string });
const modelRef = object({ id: string, revision: string }, { source: string });
const appearanceFields = { color: tuple(3, unitInterval), opacity: unitInterval, visible: boolean };
const style = object({}, appearanceFields);
const record = object({ ref, appearance: object(appearanceFields), transform: tuple(16) }, { name: string, sourceId: string });
const operations: Record<string, Check> = {
  add: object({ kind: enumeration('add'), object: record }),
  delete: object({ kind: enumeration('delete'), ref }),
  transform: object({ kind: enumeration('transform'), ref, transform: tuple(16) }),
  style: object({ kind: enumeration('style'), ref, style }),
};
const operation: Check = (v, p) => {
  if (!v || typeof v !== 'object') invalid(p, 'edit operation');
  const descriptor = Object.getOwnPropertyDescriptor(v, 'kind');
  const kind = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  if (typeof kind !== 'string' || !Object.hasOwn(operations, kind)) invalid(`${p}.kind`, 'add | delete | transform | style');
  operations[kind]!(v, p);
};
const camera = object({ position: tuple(3), target: tuple(3), up: tuple(3), projection: enumeration('perspective', 'orthographic'), zoom: positive });
const rule = object({ id: string, members: array(ref), style });
const scene = object({
  schemaVersion: enumeration(1), models: array(modelRef),
  sets: array(object({ id: string, name: string, members: array(ref) })),
  views: array(object({ id: string, camera, selection: array(ref), rules: array(rule) })),
  layers: array(object({ id: string, enabled: boolean, operations: array(operation) })),
});
const failure = (code: string, error: unknown): Result<never> => ({ ok: false, diagnostics: [{ code, message: error instanceof Error ? error.message : String(error) }] });

/** Validate and detach plain schema-v1 data. Unknown fields and runtime objects are rejected. */
export function validateSceneDocument(input: unknown): Result<SceneDocument> {
  try {
    scene(input, '$');
    const document = input as SceneDocument;
    for (const [name, entries] of [['models', document.models], ['sets', document.sets], ['views', document.views], ['layers', document.layers]] as const) {
      if (new Set(entries.map(entry => entry.id)).size !== entries.length) invalid(`$.${name}`, 'unique IDs');
    }
    return { ok: true, value: JSON.parse(JSON.stringify(document)) as SceneDocument, diagnostics: [] };
  } catch (error) { return failure('invalid-document', error); }
}

export function parseSceneDocument(json: string): Result<SceneDocument> {
  try { return validateSceneDocument(JSON.parse(json)); }
  catch (error) { return failure('invalid-json', error); }
}

/** Throws for invalid data so a malformed save cannot silently overwrite a valid save. */
export function serializeSceneDocument(document: SceneDocument): string {
  const result = validateSceneDocument(document);
  if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Invalid scene document');
  return JSON.stringify(result.value, null, 2);
}

export type ModelResolver = (reference: ModelRef, signal?: AbortSignal) => Promise<ModelData | undefined>;
export type RestoredScene = { readonly document: SceneDocument; readonly models: readonly ModelData[] };

/** Host-controlled resolution, concurrent across models, with deterministic diagnostics. */
export async function restoreSceneDocument(document: SceneDocument, resolver: ModelResolver, options: { readonly signal?: AbortSignal } = {}): Promise<Result<RestoredScene>> {
  const validated = validateSceneDocument(document);
  if (!validated.ok) return validated;
  const signal = options.signal;
  const cancelled = () => failure('cancelled', 'Scene restore was cancelled');
  if (signal?.aborted) return cancelled();
  let onAbort: (() => void) | undefined;
  const abort = new Promise<undefined>(resolve => {
    onAbort = () => resolve(undefined);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const requests = Promise.all(validated.value.models.map(async reference => {
      try { return { reference, model: await resolver(reference, signal) }; }
      catch (error) { return { reference, model: undefined, error }; }
    }));
    const resolved = await Promise.race([requests, abort]);
    if (!resolved || signal?.aborted) return cancelled();
    const models: ModelData[] = [];
    const diagnostics: Diagnostic[] = [];
    for (const entry of resolved) {
      const { reference, model } = entry;
      if (!model || model.ref.id !== reference.id) {
        diagnostics.push({ code: 'missing-model', message: `Model ${reference.id} could not be resolved${'error' in entry ? ': resolver failed' : ''}` });
      } else {
        models.push(model);
        if (model.ref.revision !== reference.revision) diagnostics.push({ code: 'revision-mismatch', message: `Model ${reference.id}: requested revision ${reference.revision}, received ${model.ref.revision}` });
      }
    }
    const available = new Set(models.flatMap(model => model.objects.map(object => objectKey(object.ref))));
    const refs: ObjectRef[] = [];
    for (const set of validated.value.sets) for (const member of set.members) refs.push(member);
    for (const view of validated.value.views) {
      for (const member of view.selection) refs.push(member);
      for (const rule of view.rules) for (const member of rule.members) refs.push(member);
    }
    for (const layer of validated.value.layers) for (const edit of layer.operations) {
      if (edit.kind === 'add') available.add(objectKey(edit.object.ref));
      else refs.push(edit.ref);
    }
    const reported = new Set<string>();
    for (const ref of refs) {
      const key = objectKey(ref);
      if (!available.has(key) && !reported.has(key)) {
        reported.add(key);
        diagnostics.push({ code: 'unresolved-object', message: `Object ${ref.objectId} in model ${ref.modelId} could not be resolved`, ref });
      }
    }
    return { ok: true, value: { document: validated.value, models }, diagnostics };
  } finally { if (onAbort) signal?.removeEventListener('abort', onAbort); }
}
