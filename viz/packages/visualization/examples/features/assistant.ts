import { meshBounds, transformBounds, unionBounds, type Bounds3 } from '@ara3d/viewer-core';
import { composeAppearance } from '../../src/appearance.js';
import { objectKey, type Appearance } from '../../src/contracts.js';
import { createReviewTools } from '../../src/review-tools.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const assistantDemo: FeatureDemo = {
  id: 'assistant', title: 'Bounded assistant commands',
  description: 'Run visible, validated review-tool requests locally. Model queries and explicit selection, fit and reversible style commands are ready for a host MCP adapter.',
  source: 'examples/features/assistant.ts', tests: 'test/review-tools.test.ts',
  mount(context) {
    const styles = new Map<string, Partial<Appearance>>();
    const refresh = () => context.update(composeAppearance(context.base.map(object => ({ ...object, appearance: { ...object.appearance, ...styles.get(objectKey(object.ref)) } })), { selection: context.selection.snapshot(), selectionColor: [1, 0.7, 0.15] }));
    const tools = createReviewTools({
      snapshot: () => ({ models: [context.model], selection: context.selection.snapshot() }),
      select: refs => { context.selection.replace(refs); },
      setStyle: (refs, style) => {
        for (const ref of refs) { const key = objectKey(ref); if (style) styles.set(key, { ...styles.get(key), ...style }); else styles.delete(key); }
        refresh();
      },
      fit: refs => {
        if (refs === null) { context.fit(); return; }
        const keys = new Set(refs.map(objectKey)); let bounds: Bounds3 | null = null;
        for (const group of context.viewer.scene.groups) {
          const local = meshBounds(group.mesh); if (!local) continue;
          const transforms = group.transforms;
          for (let index = 0; index < group.instanceCount; index++) {
            const binding = context.render.resolveInstance(group, index);
            if (binding && keys.has(objectKey(binding.ref))) bounds = unionBounds(bounds, transformBounds(local, transforms.subarray(index * 16, index * 16 + 16)));
          }
        }
        if (!bounds) throw new Error('Selected references have no geometry to fit');
        const vertical = context.viewer.camera.fov * Math.PI / 180, horizontal = 2 * Math.atan(Math.tan(vertical / 2) * context.viewer.camera.aspect);
        context.controls.model.frame(bounds, Math.min(vertical, horizontal)); context.controls.update();
      },
    }, { allowWrites: true });
    const unsubscribe = context.selection.subscribe(refresh);
    const controls = document.createElement('div'), label = document.createElement('label'); label.textContent = 'Review tool ';
    const tool = document.createElement('select'); tool.setAttribute('aria-label', 'Review tool');
    for (const item of tools.list()) { const option = document.createElement('option'); option.value = item.name; option.text = `${item.name}${item.annotations.readOnlyHint ? ' (read)' : ' (changes scene)'}`; tool.add(option); }
    label.append(tool);
    const input = document.createElement('textarea'); input.rows = 9; input.maxLength = 8192; input.setAttribute('aria-label', 'Tool arguments JSON'); input.style.width = '100%';
    const output = document.createElement('pre'); output.setAttribute('aria-live', 'polite'); output.style.whiteSpace = 'pre-wrap'; output.style.maxHeight = '240px'; output.style.overflow = 'auto';
    const requestLabel = document.createElement('p'); requestLabel.textContent = 'Local requests only. Writes are enabled for this demo; no external MCP transport is running. Selection highlighting takes precedence over style color.';
    controls.append(requestLabel, label, input, output); context.panel.append(controls);
    const example = () => {
      const refs = (context.selection.snapshot().length ? context.selection.snapshot() : context.base.slice(0, 6).map(object => object.ref)).slice(0, 100).map(ref => ({ ...ref, revision: context.model.ref.revision }));
      const args = tool.value === 'list_objects' ? { modelId: context.model.ref.id, revision: context.model.ref.revision, limit: 10 }
        : tool.value === 'list_models' || tool.value === 'scene_state' ? {}
        : tool.value === 'set_style' ? { refs, color: [0.2, 0.7, 1] } : { refs };
      input.value = JSON.stringify(args, null, 2);
    };
    tool.addEventListener('change', example); example();
    context.button('Run visible request', async () => {
      try { const response = await tools.call(tool.value, JSON.parse(input.value)); output.textContent = JSON.stringify(response, null, 2); context.status(response.isError ? 'Tool request rejected; see result.' : 'Tool request completed.'); }
      catch { output.textContent = 'Enter valid JSON arguments.'; }
    });
    context.button('Refresh request example', example);
    return () => { unsubscribe(); controls.remove(); };
  },
};
