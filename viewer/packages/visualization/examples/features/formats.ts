import { loadAssetModel, type AssetFormat } from '../../src/assets.js';
import type { InstanceBinding } from '../../src/render.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const formatsDemo: FeatureDemo = {
  id: 'formats', title: 'Geometry asset formats',
  description: 'Preview GLB, glTF, OBJ or STL, then restore the Snowdon baseline. Generated visual identities carry no BIM properties.',
  source: 'examples/features/formats.ts', tests: 'test/assets.test.ts',
  mount(context) {
    const controls = document.createElement('div');
    const label = document.createElement('label'); label.textContent = 'Asset and optional glTF resources ';
    const files = document.createElement('input'); files.type = 'file'; files.multiple = true; files.setAttribute('aria-label', 'Asset and resource files'); label.append(files);
    const formatLabel = document.createElement('label'); formatLabel.textContent = 'Format ';
    const format = document.createElement('select'); format.setAttribute('aria-label', 'Asset format');
    for (const name of ['glb', 'gltf', 'obj', 'stl']) { const option = document.createElement('option'); option.value = name; option.text = name.toUpperCase(); format.add(option); }
    formatLabel.append(format); controls.append(label, formatLabel); context.panel.append(controls);
    let controller: AbortController | undefined, activeId: string | undefined, disposed = false;
    const original = new Map<string, InstanceBinding[]>();
    const captureOriginal = () => {
      if (original.size) return;
      for (const group of context.viewer.scene.groups) for (let index = 0; index < group.instanceCount; index++) {
        const binding = context.render.resolveInstance(group, index); if (!binding) continue;
        const values = original.get(binding.ref.modelId) ?? []; values.push(binding); original.set(binding.ref.modelId, values);
      }
    };
    const restore = () => {
      if (!activeId) return;
      context.render.removeModel(activeId); activeId = undefined;
      for (const [id, bindings] of original) context.render.addModel(id, bindings);
      original.clear(); context.selection.replace([]);
    };
    context.button('Open selected asset', async () => {
      const selected = Array.from(files.files ?? []);
      const source = selected.find(file => file.name.toLowerCase().endsWith(`.${format.value}`));
      if (!source) { context.status('Choose an asset matching the selected format. Include its glTF buffers/images when needed.'); return; }
      controller?.abort(); controller = new AbortController(); const request = controller;
      const modelId = `asset-preview:${Date.now()}`;
      context.status(`Reading ${source.name}…`);
      const result = await loadAssetModel(source, format.value as AssetFormat, { id: modelId, revision: `${source.size}:${source.lastModified}` }, {
        signal: request.signal,
        resources: async uri => {
          const normalized = decodeURIComponent(uri).replace(/^\.\//, '');
          const resource = selected.find(file => file.name === normalized || file.webkitRelativePath === normalized);
          if (!resource) throw new Error(`Select the referenced resource file: ${uri}`);
          return resource;
        },
      });
      if (disposed || request.signal.aborted) return;
      if (!result.ok) { context.status(result.diagnostics.map(d => d.message).join(' ')); return; }
      captureOriginal();
      const added = context.render.addModel(modelId, result.value.bindings);
      if (!added.ok) { context.status(added.diagnostics.map(d => d.message).join(' ')); return; }
      if (activeId) context.render.removeModel(activeId);
      else for (const id of original.keys()) context.render.removeModel(id);
      activeId = modelId; context.selection.replace([]); context.fit();
      context.status(`${source.name}: ${result.value.model.objects.length} visual objects. ${result.diagnostics.map(d => d.message).join(' ')}`);
    });
    context.button('Cancel asset load', () => { controller?.abort(); context.status('Asset load cancelled.'); });
    context.button('Restore baseline model', () => { controller?.abort(); restore(); context.fit(); context.status('Baseline model restored.'); });
    return () => { disposed = true; controller?.abort(); restore(); controls.remove(); };
  },
};
