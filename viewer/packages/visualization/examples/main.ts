import { observeResize } from './observe-resize.js';
import './style.css';
import { BoxGeometry, Vector3 } from 'three';
import { Viewer, InstancedGroup, sceneBounds } from '@ara3d/viewer-core';
import { OrbitControls, ndcFromClient } from '@ara3d/viewer-controls';
import { ModelRegistry, SelectionStore, objectKey, composeAppearance, composeEdits, createEditHistory, commitEditHistory, undoEditHistory, redoEditHistory, createNumericColorMap, serializeSceneDocument, parseSceneDocument, restoreSceneDocument, type ObjectRecord, type EditOperation, type ModelData, type SceneDocument, type Matrix4 } from '@bim-open-toolkit/visualization';
import { RenderBinding } from '@bim-open-toolkit/visualization/render';

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element: ${id}`);
  return value as T;
};
const canvas = element<HTMLCanvasElement>('canvas');
const status = (text: string) => { element('status').textContent = text; };
const viewer = new Viewer({ background: 0xdce3e9 });
try { viewer.attach(canvas); } catch (error) { status(`WebGL 2 unavailable: ${String(error)}`); throw error; }
const controls = new OrbitControls(viewer);
controls.attach({
  addEventListener: (type, listener) => canvas.addEventListener(type, listener as EventListener),
  removeEventListener: (type, listener) => canvas.removeEventListener(type, listener as EventListener),
  get clientHeight() { return canvas.clientHeight; },
  setPointerCapture: id => canvas.setPointerCapture(id),
  releasePointerCapture: id => canvas.releasePointerCapture(id),
});
const binding = new RenderBinding(viewer.scene, () => viewer.requestRender());
const registry = new ModelRegistry();
const selection = new SelectionStore();
let history = createEditHistory();
let base: readonly ObjectRecord[] = [];
let heat = false;
let transaction = 0;
const geometry = new BoxGeometry(0.7, 1, 0.7);
const mesh = { positions: new Float32Array(geometry.getAttribute('position').array), normals: new Float32Array(geometry.getAttribute('normal').array), indices: new Uint32Array(geometry.index!.array) };
geometry.dispose();
const heatMap = createNumericColorMap({ min: 0, max: 49, low: [0.05,0.3,0.6], high: [0.95,0.55,0.1], missingColor: [0.4,0.4,0.4] });
const rules = () => heat ? base.map(object => ({ id: objectKey(object.ref), members: [object.ref], style: { color: heatMap.color(Number(object.ref.objectId) % 50) } })) : [];
const update = () => {
  const edited = composeEdits(base, history.present);
  binding.applySnapshot(composeAppearance(edited.objects, { rules: rules(), selection: selection.snapshot(), selectionColor: [0.05,0.9,0.7] }));
  element('selection').textContent = `${selection.snapshot().length} selected · ${history.present.length} edit transactions`;
  element<HTMLButtonElement>('undo').disabled = history.past.length === 0;
  element<HTMLButtonElement>('redo').disabled = history.future.length === 0;
};
const table = () => {
  const query = element<HTMLInputElement>('filter').value.toLowerCase();
  const selected = new Set(selection.snapshot().map(objectKey));
  const fragment = document.createDocumentFragment();
  for (const object of base.filter(object => object.name?.toLowerCase().includes(query)).slice(0,100)) {
    const button = document.createElement('button');
    button.textContent = object.name ?? object.ref.objectId;
    button.setAttribute('aria-pressed', String(selected.has(objectKey(object.ref))));
    button.onclick = event => event.ctrlKey || event.metaKey ? selection.toggle([object.ref]) : selection.replace([object.ref]);
    const label = document.createElement('span'); label.textContent = object.ref.modelId; button.append(label);
    fragment.append(button);
  }
  element('table').replaceChildren(fragment);
};
const fit = () => {
  viewer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(devicePixelRatio, 2));
  const bounds = sceneBounds(viewer.scene);
  const vertical = viewer.camera.fov * Math.PI / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * viewer.camera.aspect);
  if (bounds) controls.model.frame(bounds, Math.min(vertical, horizontal));
  controls.update();
};
const loadFixture = (count: number) => {
  for (const model of registry.models()) { binding.removeModel(model.ref.id); registry.remove(model.ref.id); }
  history = createEditHistory(); heat = false; element<HTMLInputElement>('heat').checked = false;
  const width = Math.ceil(Math.sqrt(count / 2));
  for (let model = 0; model < 2; model++) {
    const id = `model-${model + 1}`;
    const group = new InstancedGroup(mesh, undefined, count / 2);
    const objects: ObjectRecord[] = [];
    for (let i = 0; i < count / 2; i++) {
      const transform: Matrix4 = [1,0,0,0,0,1,0,0,0,0,1,0, (i % width) + model * (width + 2), 0, Math.floor(i / width), 1];
      const object: ObjectRecord = { ref: { modelId: id, objectId: String(i) }, name: `Object ${String(i).padStart(3,'0')}`, sourceId: String(i), transform, appearance: { color: model ? [0.3,0.5,0.6] : [0.65,0.7,0.72], opacity: 1, visible: true } };
      objects.push(object);
      group.append(new Float32Array(transform), new Float32Array([...object.appearance.color,1]));
    }
    const data: ModelData = { ref: { id, revision: `fixture-${count}` }, coordinates: { units: 'metres', up: 'Y', registration: 'local' }, objects };
    registry.add(data);
    binding.addModel(id, objects.map((object, instanceIndex) => ({ ref: object.ref, group, instanceIndex, representationId: 'box' })));
  }
  base = registry.models().flatMap(model => model.objects);
  selection.replace([]); update(); table(); fit();
  status(`${count.toLocaleString()} synthetic objects · ${(count * 12).toLocaleString()} displayed triangles · table shows first 100 matches`);
};
const edit = (operation: (object: ObjectRecord) => EditOperation) => {
  const selected = new Set(selection.snapshot().map(objectKey));
  const objects = composeEdits(base, history.present).objects.filter(object => selected.has(objectKey(object.ref)));
  if (!objects.length) { status('Select one or more objects first.'); return; }
  do { transaction++; } while (history.present.some(layer => layer.id === `edit-${transaction}`));
  history = commitEditHistory(history, [...history.present, { id: `edit-${transaction}`, enabled: true, operations: objects.map(operation) }]); update();
};
element('color').onclick = () => edit(object => ({ kind: 'style', ref: object.ref, style: { color: [0.95,0.2,0.1] } }));
element('hide').onclick = () => edit(object => ({ kind: 'style', ref: object.ref, style: { visible: false } }));
element('move').onclick = () => edit(object => ({ kind: 'transform', ref: object.ref, transform: object.transform.map((n,i) => i === 13 ? n + 1 : n) as unknown as Matrix4 }));
element('undo').onclick = () => { history = undoEditHistory(history); update(); };
element('redo').onclick = () => { history = redoEditHistory(history); update(); };
element('all').onclick = () => selection.replace(base.map(object => object.ref));
element('clear').onclick = () => selection.replace([]);
element('fit').onclick = fit;
element('filter').oninput = table;
element('heat').onchange = () => { heat = element<HTMLInputElement>('heat').checked; update(); };
element('reset').onclick = () => loadFixture(100);
element('stress').onclick = () => loadFixture(10_000);
element('benchmark').onclick = () => {
  const samples: number[] = [];
  for (let i = 0; i < 25; i++) { const start = performance.now(); binding.update(base); if (i >= 5) samples.push(performance.now() - start); }
  samples.sort((a,b) => a-b);
  status(`CPU color/transform submission · ${base.length} objects · 5 warmups / 20 samples · p50 ${samples[9]!.toFixed(2)} ms · p95 ${samples[18]!.toFixed(2)} ms. Display latency unmeasured.`);
  update();
};
const vector = (v: Vector3): readonly [number,number,number] => [v.x,v.y,v.z];
element('save').onclick = () => {
  const document: SceneDocument = { schemaVersion: 1, models: registry.models().map(model => model.ref), sets: [], layers: history.present, views: [{ id: 'main', camera: { position: vector(viewer.camera.position), target: vector(controls.model.target), up: [0,1,0], projection: 'perspective', zoom: 1 }, selection: selection.snapshot(), rules: rules() }] };
  try { localStorage.setItem('bim-review-v1', serializeSceneDocument(document)); status('Review saved in this browser.'); } catch (error) { status(String(error)); }
};
element('restore').onclick = async () => {
  try {
    const parsed = parseSceneDocument(localStorage.getItem('bim-review-v1') ?? '');
    if (!parsed.ok) { status(parsed.diagnostics.map(d => d.message).join('; ')); return; }
    const restored = await restoreSceneDocument(parsed.value, async ref => registry.getModel(ref.id));
    if (!restored.ok || restored.diagnostics.length) { status(restored.diagnostics.map(d => d.message).join('; ')); return; }
    const view = parsed.value.views[0]; if (!view) return;
    history = createEditHistory(parsed.value.layers); heat = view.rules.length > 0; element<HTMLInputElement>('heat').checked = heat;
    controls.model.setPose(new Vector3(...view.camera.position), new Vector3(...view.camera.target)); controls.update();
    selection.replace(view.selection); update(); table(); status('Saved review restored.');
  } catch (error) { status(String(error)); }
};
let pointer: { x: number; y: number } | undefined;
canvas.addEventListener('pointerdown', event => { pointer = { x:event.clientX,y:event.clientY }; });
canvas.addEventListener('pointercancel', () => { pointer = undefined; });
canvas.addEventListener('pointerup', event => {
  if (!pointer || Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y) > 4) { pointer = undefined; return; }
  pointer = undefined;
  const ndc = ndcFromClient(canvas.getBoundingClientRect(),event.clientX,event.clientY);
  const hit = binding.pick(viewer.objects,viewer.camera,ndc.x,ndc.y);
  if (hit) { event.ctrlKey || event.metaKey ? selection.toggle([hit.ref]) : selection.replace([hit.ref]); status(registry.getObject(hit.ref)?.name ?? hit.ref.objectId); }
});
const unsubscribe = selection.subscribe(() => { update(); table(); });
const stopResize = observeResize(canvas, () => viewer.resize(canvas.clientWidth,canvas.clientHeight,Math.min(devicePixelRatio,2)));
window.addEventListener('pagehide', () => { stopResize(); unsubscribe(); selection.dispose(); registry.dispose(); controls.dispose(); binding.dispose(); viewer.dispose(); }, { once:true });
loadFixture(100);
