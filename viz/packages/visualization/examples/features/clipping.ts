import { sceneBounds } from '@ara3d/viewer-core';
import { applyClipping, createSectionPlanes } from '../../src/clipping.js';
import type { Vec3 } from '../../src/contracts.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const clippingDemo: FeatureDemo = {
  id: 'clipping', title: 'Planes and section boxes',
  description: 'Slice the building along a world axis or keep the interior of a section box. Source geometry stays intact.',
  source: 'examples/features/clipping.ts', tests: 'test/clipping.test.ts',
  mount(context) {
    const bounds = sceneBounds(context.viewer.scene);
    if (!bounds) { context.status('No geometry bounds available for sectioning.'); return () => {}; }
    let restore = () => {};
    const controls = document.createElement('div');
    const axisLabel = document.createElement('label'); axisLabel.textContent = 'Section axis ';
    const axis = document.createElement('select'); axis.setAttribute('aria-label', 'Section axis');
    for (const value of ['X', 'Y', 'Z']) { const option = document.createElement('option'); option.text = value; axis.add(option); }
    axis.value = 'Y'; axisLabel.append(axis);
    const positionLabel = document.createElement('label'); positionLabel.textContent = 'Section position ';
    const position = document.createElement('input'); position.type = 'range'; position.min = '0'; position.max = '100'; position.value = '50'; position.setAttribute('aria-label', 'Section position'); positionLabel.append(position);
    controls.append(axisLabel, positionLabel); context.panel.append(controls);
    const apply = (planes: ReturnType<typeof createSectionPlanes>) => {
      restore(); context.viewer.objects.sync();
      restore = applyClipping(context.viewer.objects.scene, planes);
      context.viewer.setLocalClipping(planes.length > 0);
      context.viewer.requestRender();
    };
    const section = () => {
      const dimension = ['X', 'Y', 'Z'].indexOf(axis.value);
      const coordinate = bounds.min[dimension]! + (bounds.max[dimension]! - bounds.min[dimension]!) * Number(position.value) / 100;
      const normal = [0, 0, 0]; normal[dimension] = 1;
      apply(createSectionPlanes({ kind: 'planes', planes: [{ normal: normal as unknown as Vec3, constant: -coordinate }] }));
      context.status(`Keeping ${axis.value} ≥ ${coordinate.toFixed(2)} in model coordinates.`);
    };
    axis.addEventListener('change', section); position.addEventListener('input', section);
    context.button('Apply axis section', section);
    context.button('Central section box', () => {
      const min = bounds.min.map((value, index) => value + (bounds.max[index]! - value) * 0.2) as unknown as Vec3;
      const max = bounds.max.map((value, index) => value - (value - bounds.min[index]!) * 0.2) as unknown as Vec3;
      apply(createSectionPlanes({ kind: 'box', min, max })); context.status('Keeping the central 60% section box.');
    });
    context.button('Clear clipping', () => { restore(); restore = () => {}; context.viewer.setLocalClipping(false); context.status('Clipping cleared.'); });
    context.status('Choose an axis section or a section box.');
    return () => { restore(); context.viewer.setLocalClipping(false); controls.remove(); };
  },
};
