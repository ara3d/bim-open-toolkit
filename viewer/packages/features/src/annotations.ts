// Annotations: text notes at a world point, optionally attached to an object.
//
// A note keeps a world position even when it names an object, so an object that is deleted, hidden
// or replaced leaves the note where the author put it rather than moving it or dropping it. The
// attachment is a key, not a pointer, so the slice stays plain data a document can hold.
//
// The whole slice validates standalone through `annotationsSchema`: a file of notes can be checked
// without a session, a renderer or a model, which is what makes an exchange format testable.

import {
  array,
  command,
  diagnostic,
  failure,
  feature,
  nullable,
  number,
  object,
  optional,
  parse,
  refine,
  stateSlice,
  string,
  success,
  tuple,
  type Command,
  type Feature,
  type Migration,
  type ObjectKey,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
  type Vec3,
} from '@bim-open-toolkit/model';

// A world point, as three finite numbers.
const vec3Schema: Schema<Vec3> = tuple(number(), number(), number());

// One note: text at a world point, and the object it was made about when there was one.
export type Annotation = {
  readonly id: string;
  readonly text: string;
  readonly position: Vec3;
  readonly object?: ObjectKey | undefined;
  readonly createdAt?: string | undefined;
};

// Every note, in the order they were added.
export type AnnotationsState = {
  readonly annotations: readonly Annotation[];
};

// The shape of one note.
export const annotationSchema: Schema<Annotation> = object({
  id: refine(string(), (value) => value !== '', 'annotations/empty-id', 'An annotation id cannot be empty.'),
  text: string(),
  position: vec3Schema,
  object: optional(string()),
  createdAt: optional(string()),
});

// True when no two notes share an id.
const idsAreUnique = (state: { readonly annotations: readonly Annotation[] }): boolean =>
  new Set(state.annotations.map((item) => item.id)).size === state.annotations.length;

// The shape of the whole slice, refusing two notes with the same id.
export const annotationsSchema: Schema<AnnotationsState> = refine(
  object({ annotations: array(annotationSchema) }),
  idsAreUnique,
  'annotations/duplicate-id',
  'Two annotations cannot share an id.',
);

// No notes.
export const noAnnotations: AnnotationsState = { annotations: [] };

// Version 1 has no earlier versions to read; a later version adds its step here.
export const annotationMigrations: readonly Migration[] = [];

// The slice the annotations feature owns.
export const annotationsSlice: StateSlice<AnnotationsState> = stateSlice(
  'annotations',
  1,
  annotationsSchema,
  noAnnotations,
  annotationMigrations,
);

// Reads notes out of plain data, checking every one of them.
export const parseAnnotations = (value: unknown): Result<AnnotationsState> => parse(annotationsSchema, value);

// Reads notes out of JSON text. Text that is not JSON is reported, never thrown.
export const readAnnotationsJson = (json: string): Result<AnnotationsState> => {
  try {
    return parseAnnotations(JSON.parse(json));
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'no reason given';
    return failure([diagnostic('annotations/json', `The annotation text is not JSON: ${reason}.`)]);
  }
};

// The notes as JSON text, checked before it is written so nothing invalid is ever saved.
export const writeAnnotationsJson = (state: AnnotationsState): Result<string> => {
  const checked = parseAnnotations(state);
  return checked.ok ? success(JSON.stringify(checked.value, null, 2)) : failure(checked.diagnostics);
};

// The note with that id, or undefined.
export const findAnnotation = (state: AnnotationsState, id: string): Annotation | undefined =>
  state.annotations.find((item) => item.id === id);

// An id no note holds, derived from how many there are, so the same sequence of adds gives the same
// ids every time. Nothing here is random.
export const nextAnnotationId = (state: AnnotationsState): string => {
  const taken = new Set(state.annotations.map((item) => item.id));
  let at = state.annotations.length + 1;
  while (taken.has(`annotation-${at}`)) at += 1;
  return `annotation-${at}`;
};

// The state with the note appended, refusing an id that is already taken.
export const addAnnotation = (state: AnnotationsState, note: Annotation): Result<AnnotationsState> =>
  findAnnotation(state, note.id) === undefined
    ? success({ annotations: [...state.annotations, note] })
    : failure([diagnostic('annotations/duplicate-id', `There is already an annotation named "${note.id}".`)]);

// What an edit may change. An absent property is left alone; `object` set to null detaches the note.
export type AnnotationEdit = {
  readonly text?: string | undefined;
  readonly position?: Vec3 | undefined;
  readonly object?: ObjectKey | null | undefined;
};

// The note with the edit applied.
const edited = (note: Annotation, change: AnnotationEdit): Annotation => {
  const attached = change.object === undefined ? note.object : (change.object ?? undefined);
  return {
    ...note,
    text: change.text ?? note.text,
    position: change.position ?? note.position,
    object: attached,
  };
};

// The state with one note changed, refusing an id nothing holds.
export const editAnnotation = (
  state: AnnotationsState,
  id: string,
  change: AnnotationEdit,
): Result<AnnotationsState> =>
  findAnnotation(state, id) === undefined
    ? failure([diagnostic('annotations/unknown', `There is no annotation named "${id}".`)])
    : success({
        annotations: state.annotations.map((item) => (item.id === id ? edited(item, change) : item)),
      });

// The state without that note, refusing an id nothing holds.
export const removeAnnotation = (state: AnnotationsState, id: string): Result<AnnotationsState> =>
  findAnnotation(state, id) === undefined
    ? failure([diagnostic('annotations/unknown', `There is no annotation named "${id}".`)])
    : success({ annotations: state.annotations.filter((item) => item.id !== id) });

// Adds a note. Leaving the id out takes the next unused one.
const addCommand: Command = command({
  name: 'annotations.add',
  title: 'Add annotation',
  description: 'Adds a text note at a world point, optionally attached to an object.',
  input: object({
    id: optional(string()),
    text: string(),
    position: vec3Schema,
    object: optional(string()),
    createdAt: optional(string()),
  }),
  run: (session: Session, input) => {
    const state = session.read(annotationsSlice);
    const note: Annotation = {
      id: input.id ?? nextAnnotationId(state),
      text: input.text,
      position: input.position,
      object: input.object,
      createdAt: input.createdAt,
    };
    const next = addAnnotation(state, note);
    if (!next.ok) return failure(next.diagnostics);
    session.write(annotationsSlice, next.value);
    return success(note, next.diagnostics);
  },
});

// Changes a note's text, position or attachment. `object: null` detaches it.
const editCommand: Command = command({
  name: 'annotations.edit',
  title: 'Edit annotation',
  description: "Changes a note's text, position or attached object.",
  input: object({
    id: string(),
    text: optional(string()),
    position: optional(vec3Schema),
    object: optional(nullable(string())),
  }),
  run: (session: Session, input) => {
    const next = editAnnotation(session.read(annotationsSlice), input.id, {
      text: input.text,
      position: input.position,
      object: input.object,
    });
    if (!next.ok) return failure(next.diagnostics);
    session.write(annotationsSlice, next.value);
    return success(findAnnotation(next.value, input.id), next.diagnostics);
  },
});

// Removes a note.
const removeCommand: Command = command({
  name: 'annotations.remove',
  title: 'Remove annotation',
  description: 'Removes a note by id.',
  input: object({ id: string() }),
  run: (session: Session, input) => {
    const next = removeAnnotation(session.read(annotationsSlice), input.id);
    if (!next.ok) return failure(next.diagnostics);
    session.write(annotationsSlice, next.value);
    return success(input.id, next.diagnostics);
  },
});

// The commands the annotations feature registers, in the order a registry lists them.
export const annotationCommands: readonly Command[] = [addCommand, editCommand, removeCommand];

// Text notes attached to objects or world points, saved with the scene.
export const annotationsFeature: Feature<AnnotationsState> = feature(
  'annotations',
  annotationsSlice,
  annotationCommands,
);
