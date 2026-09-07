import { ndcFromClient } from '@ara3d/viewer-controls';
import { addAnnotation, updateAnnotation, removeAnnotation, parseAnnotationDocument, serializeAnnotationDocument, diagnoseAnnotationRefs, type AnnotationDocument } from '../../src/annotations.js';
import { AnnotationOverlay } from '../../src/overlay-renderer.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const annotationsDemo: FeatureDemo = {
  id: 'annotations', title: 'World anchored notes', description: 'Place text at a picked world point, edit or remove notes, and save them as separate annotation JSON. Labels remain visible over geometry.',
  source: 'examples/features/annotations.ts', tests: 'test/annotations.test.ts',
  mount(context) {
    let notes: AnnotationDocument = { schemaVersion: 1, annotations: [] };
    let armed = false, serial = 0, frame = 0;
    let pointer: { id: number; x: number; y: number } | undefined;
    const overlay = new AnnotationOverlay(context.canvas.parentElement!, context.viewer.camera);
    const text = document.createElement('input'); text.value = 'Review note'; text.setAttribute('aria-label', 'Note text');
    const list = document.createElement('select'); list.setAttribute('aria-label', 'Annotation to edit');
    const json = document.createElement('textarea'); json.rows = 6; json.setAttribute('aria-label', 'Annotation JSON');
    context.panel.append(text, list, json);
    const project = () => { if (frame) cancelAnimationFrame(frame); frame = 0; if (context.canvas.clientWidth && context.canvas.clientHeight) overlay.update(context.canvas.clientWidth, context.canvas.clientHeight); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(project); };
    const refresh = () => {
      const selected = list.value;
      list.replaceChildren();
      for (const note of notes.annotations) { const option = document.createElement('option'); option.value = note.id; option.textContent = `${note.id}: ${note.text}`; list.append(option); }
      if (notes.annotations.some(note => note.id === selected)) list.value = selected;
      overlay.setAnnotations(notes.annotations); project();
      context.status(`${notes.annotations.length} world anchored notes. Text overlays are not depth-occluded and anchors do not follow object edits.`);
    };
    list.onchange = () => { text.value = notes.annotations.find(note => note.id === list.value)?.text ?? ''; };
    context.button('Place note on next click', () => { armed = true; context.status('Click a model surface without dragging to place this note.'); });
    context.button('Update selected note', () => {
      const note = notes.annotations.find(note => note.id === list.value);
      if (note) { notes = updateAnnotation(notes, { ...note, text: text.value }); refresh(); }
    });
    context.button('Remove selected note', () => { notes = removeAnnotation(notes, list.value); refresh(); });
    context.button('Save note JSON', () => { json.value = serializeAnnotationDocument(notes); });
    context.button('Restore note JSON', () => {
      const parsed = parseAnnotationDocument(json.value);
      if (!parsed.ok) { context.status(parsed.diagnostics.map(item => item.message).join('; ')); return; }
      notes = parsed.value; refresh();
      const diagnostics = diagnoseAnnotationRefs(notes, context.base.map(object => object.ref));
      if (diagnostics.length) context.status(diagnostics.map(item => item.message).join('; '));
    });
    context.button('Reset notes demo', () => { context.reset(); });
    const down = (event: PointerEvent) => { pointer = event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : undefined; };
    const cancel = () => { pointer = undefined; };
    const move = (event: PointerEvent) => {
      if (pointer && (event.pointerId !== pointer.id || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4)) pointer = undefined;
      schedule();
    };
    const up = (event: PointerEvent) => {
      const start = pointer; pointer = undefined;
      if (!armed || !start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
      const ndc = ndcFromClient(context.canvas.getBoundingClientRect(), event.clientX, event.clientY);
      const hit = context.render.pick(context.viewer.objects, context.viewer.camera, ndc.x, ndc.y);
      if (!hit) { context.status('No surface hit. Click a visible object to place the note.'); return; }
      do { serial++; } while (notes.annotations.some(note => note.id === `note-${serial}`));
      notes = addAnnotation(notes, { id: `note-${serial}`, text: text.value, position: hit.point, ref: hit.ref }); armed = false; refresh();
    };
    context.canvas.addEventListener('pointerdown', down); context.canvas.addEventListener('pointerup', up); context.canvas.addEventListener('pointercancel', cancel);
    context.canvas.addEventListener('pointermove', move); context.canvas.addEventListener('wheel', schedule);
    const resize = new ResizeObserver(schedule); resize.observe(context.canvas);
    refresh();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); overlay.dispose(); list.onchange = null;
      context.canvas.removeEventListener('pointerdown', down); context.canvas.removeEventListener('pointerup', up); context.canvas.removeEventListener('pointercancel', cancel);
      context.canvas.removeEventListener('pointermove', move); context.canvas.removeEventListener('wheel', schedule);
    };
  },
};
