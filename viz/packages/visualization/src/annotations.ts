import { objectKey, type Diagnostic, type ObjectRef, type Result, type Vec3 } from './contracts.js';

export type Annotation = { readonly id: string; readonly text: string; readonly position: Vec3; readonly ref?: ObjectRef };
/** Separate from SceneDocument: positions stay in world space when objects move. */
export type AnnotationDocument = { readonly schemaVersion: 1; readonly annotations: readonly Annotation[] };
const fields = (value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Expected plain annotation data');
  const record = value as Record<string, unknown>;
  if (required.some(key => !Object.hasOwn(record, key))) throw new Error('Missing annotation field');
  for (const key of Reflect.ownKeys(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key)!;
    if (typeof key !== 'string' || ![...required, ...optional].includes(key) || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Unexpected annotation field');
  }
  return record;
};
const plainArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) throw new Error('Expected plain dense array');
  for (let i = 0; i < value.length; i++) if (!Object.getOwnPropertyDescriptor(value, String(i))?.enumerable || !('value' in Object.getOwnPropertyDescriptor(value, String(i))!)) throw new Error('Invalid array element');
  return value;
};
export function validateAnnotationDocument(input: unknown): Result<AnnotationDocument> {
  try {
    const document = fields(input, ['schemaVersion', 'annotations']);
    if (document.schemaVersion !== 1) throw new Error('Unsupported annotation schema version');
    const ids = new Set<string>();
    const annotations = plainArray(document.annotations).map(value => {
      const note = fields(value, ['id', 'text', 'position'], ['ref']);
      if (typeof note.id !== 'string' || !note.id || ids.has(note.id)) throw new Error('Annotation IDs must be nonempty and unique');
      if (typeof note.text !== 'string') throw new Error('Annotation text must be a string');
      const position = plainArray(note.position);
      if (position.length !== 3 || position.some(value => typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Annotation position must contain three finite numbers');
      if (Object.hasOwn(note, 'ref')) {
        const ref = fields(note.ref, ['modelId', 'objectId']);
        if (typeof ref.modelId !== 'string' || typeof ref.objectId !== 'string') throw new Error('Invalid annotation object reference');
      }
      ids.add(note.id);
      return { id: note.id, text: note.text, position: [...position] as unknown as Vec3, ...(note.ref ? { ref: { ...note.ref as ObjectRef } } : {}) };
    });
    return { ok: true, value: { schemaVersion: 1, annotations }, diagnostics: [] };
  } catch (error) { return { ok: false, diagnostics: [{ code: 'invalid-annotations', message: error instanceof Error ? error.message : String(error) }] }; }
}
export function parseAnnotationDocument(json: string): Result<AnnotationDocument> {
  try { return validateAnnotationDocument(JSON.parse(json)); }
  catch { return { ok: false, diagnostics: [{ code: 'invalid-json', message: 'Invalid annotation JSON' }] }; }
}
const validated = (document: AnnotationDocument): AnnotationDocument => {
  const result = validateAnnotationDocument(document);
  if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Invalid annotations');
  return result.value;
};
export const serializeAnnotationDocument = (document: AnnotationDocument): string => JSON.stringify(validated(document), null, 2);
export const addAnnotation = (document: AnnotationDocument, annotation: Annotation): AnnotationDocument => validated({ schemaVersion: 1, annotations: [...document.annotations, annotation] });
export function updateAnnotation(document: AnnotationDocument, annotation: Annotation): AnnotationDocument {
  if (!document.annotations.some(note => note.id === annotation.id)) throw new Error('Unknown annotation ID');
  return validated({ schemaVersion: 1, annotations: document.annotations.map(note => note.id === annotation.id ? annotation : note) });
}
export const removeAnnotation = (document: AnnotationDocument, id: string): AnnotationDocument => validated({ schemaVersion: 1, annotations: document.annotations.filter(note => note.id !== id) });
export function diagnoseAnnotationRefs(document: AnnotationDocument, available: Iterable<ObjectRef>): readonly Diagnostic[] {
  const keys = new Set(Array.from(available, objectKey));
  return document.annotations.flatMap(note => note.ref && !keys.has(objectKey(note.ref)) ? [{ code: 'unresolved-annotation-object', message: `Annotation ${note.id}: object unavailable; world anchor retained`, ref: note.ref }] : []);
}
