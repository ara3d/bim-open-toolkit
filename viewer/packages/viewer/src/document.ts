// The scene document: saving and restoring a session.
//
// M1 already says what a document is - a format version, the models it was saved against, and one
// versioned envelope per slice - and already migrates a slice from the version it was written at.
// What is left is the composition: walk the registered slices, and refuse a document that was
// saved against a different model.
//
// Two rules shape this file.
//
// **A document is the composition of the registered slices, and nothing else.** Persistence never
// learns a feature's name. A slice a session holds a value for but nobody registered is not saved,
// because a document that carried it could not be restored by anyone.
//
// **Restoring is all or nothing.** Every slice is read and migrated before anything is written, so
// a document with one unreadable slice leaves the session exactly as it was rather than half
// restored. A missing migration is a refusal; the model package already decided that, and this
// keeps it true of the whole scene.

import {
  diagnostic,
  emptyDocument,
  failure,
  getSlice,
  hasSlice,
  modelKey,
  note,
  object,
  parseDocument,
  putSlice,
  stateSlice,
  storedSliceIds,
  string,
  success,
  warning,
  type Diagnostic,
  type ModelRef,
  type Result,
  type SceneDocument,
} from '@bim-open-toolkit/model';
import type { ViewerSession } from './session.js';

// The slice id the document's own model fingerprint is stored under. It belongs to no feature, and
// `loadScene` never restores it into a session.
export const fingerprintSliceId = 'viewer.models';

const fingerprintSlice = stateSlice(fingerprintSliceId, 1, object({ fingerprint: string() }), {
  fingerprint: '',
});

// FNV-1a over a string, as eight lowercase hex digits. A change detector, not a security hash.
const digest = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

// A digest of the models a scene is about: their ids and revisions, in a fixed order, so the same
// models fingerprint the same however they were opened. The revision is in the key, so a document
// saved against one revision does not match another.
export const modelFingerprint = (models: readonly ModelRef[]): string =>
  digest([...models.map(modelKey)].sort().join('\n'));

// What a document says it was saved against, or undefined for one that carries no fingerprint.
export const documentFingerprint = (document: SceneDocument): string | undefined => {
  if (!hasSlice(document, fingerprintSliceId)) return undefined;
  const read = getSlice(document, fingerprintSlice);
  return read.ok && read.value.fingerprint !== '' ? read.value.fingerprint : undefined;
};

// Everything a session holds that a document can carry: one envelope per registered slice, plus the
// models and their fingerprint.
export const saveScene = (session: ViewerSession, models: readonly ModelRef[] = []): Result<SceneDocument> => {
  let document = emptyDocument(models);
  for (const slice of session.sliceRegistry().values()) document = putSlice(document, slice, session.read(slice));
  document = putSlice(document, fingerprintSlice, { fingerprint: modelFingerprint(models) });
  return success(document);
};

// What restoring did.
export type SceneLoad = {
  // Slices written from the document.
  readonly restored: readonly string[];
  // Registered slices the document says nothing about. They keep the value they had.
  readonly absent: readonly string[];
  // Ids the document carries that no registered slice owns: a feature that is not installed. They
  // are reported, never dropped, so a host can install what is missing and load again.
  readonly orphans: readonly string[];
  // The models the document was saved against.
  readonly models: readonly ModelRef[];
};

// How to restore.
export type LoadOptions = {
  // The models open now. When given, a document saved against different ones is refused.
  readonly models?: readonly ModelRef[] | undefined;
  // Restore anyway when the models do not match. Off by default: a saved appearance addressed to
  // object keys of another model would paint nothing and say nothing.
  readonly anyModel?: boolean | undefined;
};

// Restores a document into a session. Nothing is written unless every slice can be read.
export const loadScene = (
  session: ViewerSession,
  document: SceneDocument,
  options: LoadOptions = {},
): Result<SceneLoad> => {
  const diagnostics: Diagnostic[] = [];
  const saved = documentFingerprint(document);

  if (options.models !== undefined) {
    const open = modelFingerprint(options.models);
    if (saved === undefined)
      diagnostics.push(
        warning('viewer/no-fingerprint', 'The document does not say which models it was saved against.', ['models']),
      );
    else if (saved !== open) {
      const refusal = diagnostic(
        'viewer/model-mismatch',
        `The document was saved against models ${saved}, and ${open} are open.`,
        ['models'],
      );
      if (!(options.anyModel ?? false)) return failure([refusal]);
      diagnostics.push({ ...refusal, severity: 'warning' });
    }
  }

  const registry = session.sliceRegistry();
  const restored: { readonly id: string; readonly value: unknown }[] = [];
  const absent: string[] = [];
  const failures: Diagnostic[] = [];

  for (const slice of registry.values()) {
    if (!hasSlice(document, slice.id)) {
      absent.push(slice.id);
      diagnostics.push(note('viewer/slice-absent', `The document has no "${slice.id}" slice.`, [slice.id]));
      continue;
    }
    const read = getSlice(document, slice);
    if (!read.ok) {
      failures.push(...read.diagnostics);
      continue;
    }
    diagnostics.push(...read.diagnostics);
    restored.push({ id: slice.id, value: read.value });
  }
  if (failures.length > 0) return failure(failures);

  for (const { id, value } of restored) {
    const slice = registry.get(id);
    if (slice !== undefined) session.write(slice, value);
  }

  const orphans = storedSliceIds(document).filter((id) => id !== fingerprintSliceId && !registry.has(id));
  for (const id of orphans)
    diagnostics.push(
      warning('viewer/orphan-slice', `Nothing installed owns the "${id}" slice; its value is left in the document.`, [
        id,
      ]),
    );

  return success({ restored: restored.map((one) => one.id), absent, orphans, models: document.models }, diagnostics);
};

// A document out of JSON text. A file that is not JSON at all is a diagnostic, never a throw.
export const readScene = (text: string): Result<SceneDocument> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return failure([
      diagnostic('viewer/not-json', `The scene is not JSON: ${cause instanceof Error ? cause.message : String(cause)}`),
    ]);
  }
  return parseDocument(parsed);
};

// A document as JSON text, indented so a saved scene can be read and diffed.
export const writeScene = (document: SceneDocument): string => JSON.stringify(document, undefined, 2);
