import { emptyDocument, getSlice, putSlice, type AnyFeature } from '@bim-open-toolkit/model';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
import { describe, expect, it } from 'vitest';
import {
  addAnnotation,
  annotationCommands,
  annotationsFeature,
  annotationsSlice,
  editAnnotation,
  findAnnotation,
  nextAnnotationId,
  noAnnotations,
  parseAnnotations,
  readAnnotationsJson,
  removeAnnotation,
  writeAnnotationsJson,
  type Annotation,
  type AnnotationsState,
} from '../src/annotations.js';
import { fakeSession } from './support/fake-session.js';

const note = (id: string, text = 'Check this'): Annotation => ({ id, text, position: [1, 2, 3] });

const stateOf = (...notes: readonly Annotation[]): AnnotationsState => ({ annotations: notes });

describe('annotations slice', () => {
  it('round trips through a document', () => {
    const state = stateOf(note('a'), { ...note('b'), object: 'model|r1|door-3' });
    const document = putSlice(emptyDocument(), annotationsSlice, state);
    const read = getSlice(document, annotationsSlice);
    expect(read.ok && read.value).toEqual(state);
  });

  it('reads its default from a document that has no annotations', () => {
    const read = getSlice(emptyDocument(), annotationsSlice);
    expect(read.ok && read.value).toEqual(noAnnotations);
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/absent']);
  });

  it('refuses a version it does not know', () => {
    const older = { ...emptyDocument(), slices: { annotations: { version: 0, value: noAnnotations } } };
    expect(getSlice(older, annotationsSlice).ok).toBe(false);
  });
});

describe('annotations validated standalone', () => {
  it('accepts a document of notes with no session', () => {
    const written = writeAnnotationsJson(stateOf(note('a'), note('b')));
    expect(written.ok).toBe(true);
    const read = written.ok ? readAnnotationsJson(written.value) : written;
    expect(read.ok && read.value.annotations).toHaveLength(2);
  });

  it('refuses two notes with one id', () => {
    const result = parseAnnotations({ annotations: [note('a'), note('a')] });
    expect(result.diagnostics.map((item) => item.code)).toContain('annotations/duplicate-id');
  });

  it('refuses a position that is not three numbers', () => {
    expect(parseAnnotations({ annotations: [{ id: 'a', text: 'x', position: [1, 2] }] }).ok).toBe(false);
  });

  it('refuses an empty id', () => {
    expect(parseAnnotations({ annotations: [{ id: '', text: 'x', position: [0, 0, 0] }] }).ok).toBe(false);
  });

  it('reports text that is not JSON rather than throwing', () => {
    expect(readAnnotationsJson('{').diagnostics.map((item) => item.code)).toEqual(['annotations/json']);
  });
});

describe('annotation operations', () => {
  it('refuses to add an id that is taken', () => {
    expect(addAnnotation(stateOf(note('a')), note('a')).ok).toBe(false);
  });

  it('refuses to edit or remove a note that is not there', () => {
    expect(editAnnotation(noAnnotations, 'a', { text: 'x' }).ok).toBe(false);
    expect(removeAnnotation(noAnnotations, 'a').ok).toBe(false);
  });

  it('detaches a note from its object when the edit says null', () => {
    const attached = stateOf({ ...note('a'), object: 'model|r1|door-3' });
    const detached = editAnnotation(attached, 'a', { object: null });
    expect(detached.ok && findAnnotation(detached.value, 'a')?.object).toBeUndefined();
  });

  it('leaves the attachment alone when the edit does not mention it', () => {
    const attached = stateOf({ ...note('a'), object: 'model|r1|door-3' });
    const edited = editAnnotation(attached, 'a', { text: 'Changed' });
    expect(edited.ok && findAnnotation(edited.value, 'a')?.object).toBe('model|r1|door-3');
  });

  it('derives an id nothing holds', () => {
    expect(nextAnnotationId(stateOf(note('annotation-1')))).toBe('annotation-2');
    expect(nextAnnotationId(stateOf(note('annotation-2')))).toBe('annotation-3');
  });
});

describe('annotation commands through a session', () => {
  it('adds, edits and removes', () => {
    const session = fakeSession(annotationCommands);
    const added = session.dispatch('annotations.add', { text: 'Loose fixing', position: [0, 0, 1] });
    expect(added.ok).toBe(true);
    expect(session.read(annotationsSlice).annotations).toHaveLength(1);
    const id = session.read(annotationsSlice).annotations[0]?.id;
    expect(id).toBe('annotation-1');

    expect(session.dispatch('annotations.edit', { id, text: 'Fixed' }).ok).toBe(true);
    expect(findAnnotation(session.read(annotationsSlice), 'annotation-1')?.text).toBe('Fixed');

    expect(session.dispatch('annotations.remove', { id }).ok).toBe(true);
    expect(session.read(annotationsSlice).annotations).toHaveLength(0);
  });

  it('publishes the slice it changed', () => {
    const session = fakeSession(annotationCommands);
    session.dispatch('annotations.add', { id: 'a', text: 'x', position: [0, 0, 0] });
    expect(session.events).toEqual(['annotations.add:annotations']);
  });

  it('refuses input the schema does not accept, and changes nothing', () => {
    const session = fakeSession(annotationCommands);
    const result = session.dispatch('annotations.add', { text: 'x', position: 'here' });
    expect(result.ok).toBe(false);
    expect(session.read(annotationsSlice)).toEqual(noAnnotations);
  });

  it('refuses to edit a note nobody added', () => {
    const session = fakeSession(annotationCommands);
    expect(session.dispatch('annotations.edit', { id: 'missing', text: 'x' }).ok).toBe(false);
  });
});

describe('the feature', () => {
  it('owns its slice, its commands and no hook', () => {
    expect(annotationsFeature.id).toBe('annotations');
    expect(annotationsFeature.slice).toBe(annotationsSlice);
    expect(annotationsFeature.commands.map((item) => item.name)).toEqual([
      'annotations.add',
      'annotations.edit',
      'annotations.remove',
    ]);
    expect(annotationsFeature.install).toBeUndefined();
  });
});

// A real viewer session with the feature installed, or a thrown error saying why there is none.
const installed = (item: AnyFeature) => {
  const created = createSession();
  if (!created.ok) throw new Error(created.diagnostics.map((entry) => entry.message).join('; '));
  const host = featureHost(created.value);
  const done = host.install([item]);
  if (!done.ok) throw new Error(done.diagnostics.map((entry) => entry.message).join('; '));
  return { session: created.value, host };
};

describe('through the viewer session', () => {
  it('installs, adds a note, and takes its slice away again on disposal', () => {
    const { session: live, host } = installed(annotationsFeature);
    expect(live.dispatch('annotations.add', { text: 'Loose fixing', position: [0, 0, 1] }).ok).toBe(true);
    expect(live.read(annotationsSlice).annotations).toHaveLength(1);
    expect([...live.sliceRegistry().keys()]).toContain('annotations');
    host.dispose();
    expect([...live.sliceRegistry().keys()]).not.toContain('annotations');
    expect(live.diagnostics()).toEqual([]);
  });
});
