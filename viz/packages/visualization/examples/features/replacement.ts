import { meshBounds, transformBounds, unionBounds, type Bounds3, type MeshBuffers } from '@ara3d/viewer-core';
import { identityMatrix, objectKey } from '../../src/contracts.js';
import { boxReplacementMesh, ReplacementLayer } from '../../src/replacement.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const replacementDemo: FeatureDemo = {
  id: 'replacement', title: 'Replace one object',
  description: 'Replace a selected object with its world bounding box while retaining its identity and the surrounding model geometry.',
  source: 'examples/features/replacement.ts', tests: 'vitest run test/replacement.test.ts test/render.test.ts',
  mount(context) {
    const layer = new ReplacementLayer(context.viewer.objects, context.render, () => context.viewer.requestRender());
    const records = new Map(context.base.map(record => [objectKey(record.ref), record]));
    const boxes = new Map<string, Bounds3>();
    const localBounds = new Map<MeshBuffers, Bounds3 | null>();
    const group = context.viewer.scene.groups.find(item => item.instanceCount > 0);
    const initial = group && context.render.resolveInstance(group, 0)?.ref;
    const chosen = () => context.selection.snapshot()[0] ?? initial;
    const status = document.createElement('p');
    status.textContent = 'Pick an object, then replace it. With no selection, the first rendered object is used.';
    context.panel.append(status);
    const buttons = [
      context.button('Replace selected with box', () => {
        const ref = chosen();
        const original = ref && records.get(objectKey(ref));
        if (!original) { context.status('Select a loaded object first.'); return; }
        const key = objectKey(original.ref);
        let bounds = boxes.get(key);
        const start = performance.now();
        if (!bounds) {
          let combined: Bounds3 | null = null;
          for (const source of context.viewer.scene.groups) {
            const transforms = source.transforms;
            for (let i = 0; i < source.instanceCount; i++) {
              const binding = context.render.resolveInstance(source, i);
              if (!binding || objectKey(binding.ref) !== key) continue;
              if (!localBounds.has(source.mesh)) localBounds.set(source.mesh, meshBounds(source.mesh));
              const local = localBounds.get(source.mesh);
              if (local) combined = unionBounds(combined, transformBounds(local, transforms.subarray(i * 16, i * 16 + 16)));
            }
          }
          if (!combined) { context.status('Selected object has no rendered geometry.'); return; }
          bounds = combined; boxes.set(key, bounds);
        }
        const geometry = boxReplacementMesh(bounds);
        const generated = performance.now();
        layer.replace(original, geometry, identityMatrix);
        const submitted = performance.now();
        status.textContent = `${original.name ?? original.ref.objectId} · box generation/bounds ${(generated - start).toFixed(1)} ms · CPU replacement submission ${(submitted - generated).toFixed(1)} ms. GPU/display time unmeasured.`;
        context.status('Replacement retains the source object identity. Pick the box or undo to restore the original.');
      }),
      context.button('Undo selected replacement', () => {
        const ref = chosen();
        context.status(ref && layer.undo(ref) ? 'Original geometry restored.' : 'Selected object has no replacement.');
      }),
      context.button('Restore all originals', () => { layer.reset(); context.status('All replacement geometry released; original objects restored.'); }),
    ];
    return () => { layer.dispose(); for (const element of [...buttons, status]) element.remove(); };
  },
};
