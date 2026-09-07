import { Vector3 } from 'three';
import { SceneStorage } from '../../src/storage.js';
import { composeAppearance, restoreSceneDocument, type SceneDocument, type Result, type Vec3 } from '../../src/index.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const storageDemo: FeatureDemo = {
  id: 'storage', title: 'Local saved views', description: 'Explicitly save, reload, list and delete camera/selection documents in this browser. Existing saves require the separate replace action.',
  source: 'examples/features/storage.ts', tests: 'test/storage.test.ts · test/persistence.test.ts',
  mount(context) {
    const controller = new AbortController();
    const alert = document.createElement('p'); alert.setAttribute('role', 'alert');
    const name = document.createElement('input'); name.value = 'review-1'; name.setAttribute('aria-label', 'Saved scene name');
    const list = document.createElement('select'); list.setAttribute('aria-label', 'Saved scenes');
    context.panel.append(alert, name, list);
    let store: SceneStorage;
    try { store = new SceneStorage(window.localStorage, 'bim-open-toolkit:gallery:saved-view'); }
    catch (error) { alert.textContent = `Browser storage unavailable: ${String(error)}`; return () => controller.abort(); }
    const show = <T,>(result: Result<T>): T | undefined => {
      if (!result.ok) { alert.textContent = result.diagnostics.map(item => `${item.code}: ${item.message}`).join('; '); return undefined; }
      alert.textContent = ''; return result.value;
    };
    const refreshList = () => {
      const ids = show(store.list()); if (!ids) return;
      list.replaceChildren();
      for (const id of ids) { const option = document.createElement('option'); option.value = id; option.textContent = id; list.append(option); }
    };
    list.onchange = () => { name.value = list.value; };
    const vector = (v: Vector3): Vec3 => [v.x, v.y, v.z];
    const snapshot = (): SceneDocument => ({ schemaVersion: 1, models: [context.model.ref], sets: [], layers: [], views: [{ id: 'main', selection: context.selection.snapshot(), rules: [], camera: {
      position: vector(context.viewer.camera.position), target: vector(context.controls.model.target), up: vector(context.viewer.camera.up), projection: 'perspective', zoom: context.viewer.camera.zoom,
    } }] });
    const save = (overwrite: boolean) => {
      if (!show(store.save(name.value, snapshot(), { overwrite }))) return;
      refreshList(); context.status(`Saved ${name.value} in this browser.`);
    };
    context.button('Save as new', () => save(false));
    context.button('Replace named save', () => save(true));
    context.button('Reload named save', async () => {
      const loaded = show(store.load(name.value)); if (!loaded) return;
      const view = loaded.views[0];
      if (!view || view.camera.projection !== 'perspective' || loaded.layers.length || view.rules.length) { alert.textContent = 'This viewer restores a perspective camera and selection only.'; return; }
      const restored = await restoreSceneDocument(loaded, async reference => reference.id === context.model.ref.id ? context.model : undefined, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!restored.ok || restored.diagnostics.length) { alert.textContent = restored.diagnostics.map(item => item.message).join('; '); return; }
      context.viewer.camera.up.set(...view.camera.up); context.viewer.camera.zoom = view.camera.zoom; context.viewer.camera.updateProjectionMatrix();
      context.controls.model.setPose(new Vector3(...view.camera.position), new Vector3(...view.camera.target)); context.controls.update();
      context.selection.replace(view.selection); context.status(`Restored ${name.value} against the loaded source revision.`);
    });
    context.button('Refresh saved list', refreshList);
    context.button('Delete named save', () => {
      const removed = show(store.remove(name.value)); if (removed === undefined) return;
      refreshList(); context.status(removed ? `Deleted ${name.value}.` : `No save named ${name.value} exists.`);
    });
    context.button('Reset current viewer', () => context.reset());
    const refresh = () => context.update(composeAppearance(context.base, { selection: context.selection.snapshot(), selectionColor: [0.1, 1, 0.35] }));
    const unsubscribe = context.selection.subscribe(refresh); refresh(); refreshList();
    context.status('Saves contain source references and plain view state. Resetting the viewer never deletes saved documents.');
    return () => { controller.abort(); unsubscribe(); list.onchange = null; };
  },
};
