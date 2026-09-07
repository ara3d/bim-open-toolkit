import { meshBounds, sceneBounds, transformBounds, unionBounds, type Bounds3 } from '@ara3d/viewer-core';
import { objectKey, type Vec3 } from '../../src/contracts.js';
import { explodeLayout, gridLayout } from '../../src/layouts.js';
import type { FeatureDemo } from '../gallery/contracts.js';

const center = (bounds: Bounds3): Vec3 => bounds.min.map((value, axis) => (value + bounds.max[axis]!) / 2) as unknown as Vec3;

export const layoutsDemo: FeatureDemo = {
  id: 'layouts', title: 'Exploded and grid layouts',
  description: 'Rearrange objects from their representation bounds, then restore original placement without rebuilding geometry.',
  source: 'examples/features/layouts.ts', tests: 'test/layouts.test.ts',
  mount(context) {
    const bounds = sceneBounds(context.viewer.scene);
    if (!bounds) { context.status('No geometry bounds available for layout.'); return () => {}; }
    const byObject = new Map<string, Bounds3>();
    for (const group of context.viewer.scene.groups) {
      const local = meshBounds(group.mesh); if (!local) continue;
      const transforms = group.transforms;
      for (let index = 0; index < group.instanceCount; index++) {
        const binding = context.render.resolveInstance(group, index); if (!binding) continue;
        const key = objectKey(binding.ref);
        byObject.set(key, unionBounds(byObject.get(key) ?? null, transformBounds(local, transforms.subarray(index * 16, index * 16 + 16)))!);
      }
    }
    const origin = center(bounds);
    const centers = new Map([...byObject].map(([key, value]) => [key, center(value)]));
    const centerOf = (object: typeof context.base[number]): Vec3 => centers.get(objectKey(object.ref)) ?? origin;
    const span = Math.max(...bounds.max.map((value, axis) => value - bounds.min[axis]!), 1);
    const label = document.createElement('label'); label.textContent = 'Explode amount ';
    const amount = document.createElement('input'); amount.type = 'range'; amount.min = '0'; amount.max = '2'; amount.step = '0.1'; amount.value = '0.5'; amount.setAttribute('aria-label', 'Explode amount'); label.append(amount); context.panel.append(label);
    context.button('Apply exploded layout', () => {
      context.update(explodeLayout(context.base, { origin, strength: Number(amount.value), centerOf })); context.fit();
      context.status(`Exploded by ${amount.value} × center separation; source placements retained.`);
    });
    context.button('Arrange grid', () => {
      const columns = Math.max(1, Math.ceil(Math.sqrt(context.base.length)));
      context.update(gridLayout(context.base, { origin, columns, spacing: span / Math.max(1, columns / 2), centerOf })); context.fit();
      context.status('Object centers arranged by source order on an XZ grid. Large objects may overlap.');
    });
    context.button('Restore source placement', () => { context.update(context.base); context.fit(); context.status('Original placements restored.'); });
    context.status('Layouts use world bounds for each object, including all its representations. Geometry-free objects use the model center.');
    return () => { label.remove(); };
  },
};
