import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { addAnnotation, updateAnnotation, removeAnnotation, parseAnnotationDocument, serializeAnnotationDocument, validateAnnotationDocument, diagnoseAnnotationRefs, type AnnotationDocument } from '../src/annotations.js';
import { AnnotationOverlay } from '../src/overlay-renderer.js';

const fixture = (): AnnotationDocument => ({ schemaVersion: 1, annotations: [{ id: 'note', text: '<script>plain text</script>', position: [0, 0, 0], ref: { modelId: 'model', objectId: 'object' } }] });
describe('annotations', () => {
  it('round trips detached data and preserves world anchors with missing objects', () => {
    const input = fixture();
    const parsed = parseAnnotationDocument(serializeAnnotationDocument(input));
    expect(parsed).toEqual({ ok: true, value: input, diagnostics: [] });
    if (parsed.ok) expect(parsed.value.annotations[0]).not.toBe(input.annotations[0]);
    expect(diagnoseAnnotationRefs(input, [])).toMatchObject([{ code: 'unresolved-annotation-object' }]);
    expect(diagnoseAnnotationRefs(input, [input.annotations[0]!.ref!])).toEqual([]);
  });
  it('adds, edits and removes without mutating earlier documents', () => {
    const before = fixture();
    const added = addAnnotation(before, { id: 'new', text: 'second', position: [1, 2, 3] });
    const edited = updateAnnotation(added, { ...added.annotations[1]!, text: 'changed' });
    expect(before.annotations).toHaveLength(1);
    expect(added.annotations[1]!.text).toBe('second');
    expect(edited.annotations[1]!.text).toBe('changed');
    expect(removeAnnotation(edited, 'new')).toEqual(before);
    expect(() => addAnnotation(before, before.annotations[0]!)).toThrow();
    expect(() => updateAnnotation(before, { id: 'missing', text: '', position: [0, 0, 0] })).toThrow();
  });
  it.each([
    { schemaVersion: 2, annotations: [] }, { ...fixture(), mesh: {} },
    { schemaVersion: 1, annotations: [{ id: '', text: '', position: [0, 0, 0] }] },
    { schemaVersion: 1, annotations: [{ id: 'a', text: '', position: [0, NaN, 0] }] },
    { schemaVersion: 1, annotations: [{ id: 'a', text: '', position: Array(3) }] },
    { schemaVersion: 1, annotations: [{ id: 'a', text: '', position: [0, 0, 0], ref: { modelId: 1, objectId: '2' } }] },
  ])('rejects malformed or runtime data', input => { expect(validateAnnotationDocument(input).ok).toBe(false); });
  it('rejects invalid JSON and never invokes annotation getters', () => {
    expect(parseAnnotationDocument('{').ok).toBe(false);
    let called = false;
    expect(validateAnnotationDocument({ schemaVersion: 1, get annotations() { called = true; return []; } }).ok).toBe(false);
    expect(called).toBe(false);
  });
});

class FakeElement {
  style = {}; attributes = new Map<string, string>(); children: FakeElement[] = []; textContent = ''; parent?: FakeElement;
  ownerDocument = { createElementNS: (_namespace: string, _name: string): FakeElement => new FakeElement() };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  append(...children: FakeElement[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children: FakeElement[]) { this.children = []; this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}
it('owns projected labels, updates the camera position, and disposes without removing host nodes', () => {
  const container = new FakeElement(), hostChild = new FakeElement(); container.append(hostChild);
  const camera = new PerspectiveCamera(60, 1, 0.1, 100); camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  const overlay = new AnnotationOverlay(container as unknown as HTMLElement, camera);
  overlay.setAnnotations(fixture().annotations); overlay.update(100, 100);
  const root = container.children[1]!, label = root.children[0]!;
  expect(label.attributes.get('transform')).toBe('translate(50 50)');
  expect(label.children[2]!.textContent).toBe('<script>plain text</script>');
  camera.position.set(0, 0, -10); camera.lookAt(0, 0, -20); overlay.update(100, 100);
  expect(label.attributes.get('display')).toBe('none');
  overlay.setAnnotations([]); expect(root.children).toHaveLength(0);
  overlay.dispose(); overlay.dispose(); expect(container.children).toEqual([hostChild]);
  expect(() => overlay.setAnnotations([])).toThrow('disposed');
});
