import { Vector3 } from 'three';
import { composeAppearance, parseSceneDocument, restoreSceneDocument, serializeSceneDocument, type ModelData, type SceneDocument, type Vec3 } from '../../src/index.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const persistenceDemo: FeatureDemo = {
  id: 'persistence', title: 'Save and restore a view',
  description: 'Save camera pose and selection as validated schema-v1 JSON, then restore against this viewer’s already loaded model.',
  source: 'examples/features/persistence.ts', tests: 'test/persistence.test.ts',
  mount(context) {
    const controller = new AbortController();
    const models: ModelData[] = [context.model];
    const json = document.createElement('textarea');
    json.rows = 12; json.setAttribute('aria-label', 'Saved view JSON'); json.placeholder = 'Save a view to inspect its JSON';
    context.panel.append(json);
    const vector = (value: { x: number; y: number; z: number }): Vec3 => [value.x, value.y, value.z];
    const refresh = () => { context.update(composeAppearance(context.base, { selection: context.selection.snapshot(), selectionColor: [0.05, 0.95, 0.5] })); };
    context.button('Select first rendered object', () => {
      for (const group of context.viewer.scene.groups) {
        const binding = context.render.resolveInstance(group, 0);
        if (binding) { context.selection.replace([binding.ref]); return; }
      }
      context.status('No rendered object is available to select.');
    });
    context.button('Save pose and selection', () => {
      const saved: SceneDocument = { schemaVersion: 1, models: models.map(model => model.ref), sets: [], layers: [], views: [{
        id: 'saved-view', selection: context.selection.snapshot(), rules: [],
        camera: { position: vector(context.viewer.camera.position), target: vector(context.controls.model.target), up: vector(context.viewer.camera.up), projection: 'perspective', zoom: context.viewer.camera.zoom },
      }] };
      json.value = serializeSceneDocument(saved);
      context.status('Saved to the JSON field. Change the camera or selection, then restore. This example resolves only the current loaded model.');
    });
    context.button('Restore JSON', async () => {
      const parsed = parseSceneDocument(json.value);
      if (!parsed.ok) { context.status(parsed.diagnostics.map(item => item.message).join('; ')); return; }
      const view = parsed.value.views[0];
      if (!view || view.camera.projection !== 'perspective' || parsed.value.layers.length || view.rules.length) { context.status('This mini demo restores a perspective pose and selection only; edit layers and style rules belong to the other demos.'); return; }
      const restored = await restoreSceneDocument(parsed.value, async reference => models.find(model => model.ref.id === reference.id), { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!restored.ok || restored.diagnostics.length) { context.status(restored.diagnostics.map(item => item.message).join('; ')); return; }
      context.viewer.camera.up.set(...view.camera.up);
      context.viewer.camera.zoom = view.camera.zoom; context.viewer.camera.updateProjectionMatrix();
      context.controls.model.setPose(new Vector3(...view.camera.position), new Vector3(...view.camera.target)); context.controls.update();
      context.selection.replace(view.selection); refresh();
      context.status(`Restored camera and ${view.selection.length} selected objects against the current loaded model.`);
    });
    context.button('Reset current view', () => {
      context.viewer.camera.zoom = 1; context.viewer.camera.updateProjectionMatrix();
      context.selection.replace([]); context.fit(); refresh();
      context.status('Current view reset. Saved JSON remains available to restore.');
    });
    const unsubscribe = context.selection.subscribe(refresh);
    refresh(); context.status('Save a view, move the camera, then restore. No geometry or source credentials are included.');
    return () => { controller.abort(); unsubscribe(); json.remove(); };
  },
};
