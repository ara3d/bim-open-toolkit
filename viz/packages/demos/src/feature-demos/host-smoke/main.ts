// The host's own smoke page: open the building with its roof and ceilings, fit, pick on click, and
// report counts, frame timing and the GPU timer's state. Every feature demo page is this plus
// features.

import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import { failure, diagnostic, success } from '@bim-open-toolkit/model';
import { addButton, addStatus } from '../_shared/controls.js';
import { mountFeatureDemo } from '../_shared/page.js';

void mountFeatureDemo((host, page) => {
  const building = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });
  const opened = host.open('building', building.model, building.geometry);
  if (!opened.ok) return failure(opened.diagnostics);
  const model = opened.value;
  const statistics = host.binding.statistics();

  let picked = '';
  let frames = 0;
  let lastIntervalMs = 0;
  const readout = addStatus(page.controls, 'readout', 'Click an object to see its name and category.');
  addButton(page.controls, 'fit', 'Fit', () => {
    host.fit(undefined, true);
  });

  const pressed = { x: 0, y: 0, id: -1 };
  page.canvas.addEventListener('pointerdown', (event) => {
    pressed.x = event.clientX;
    pressed.y = event.clientY;
    pressed.id = event.isPrimary && event.button === 0 ? event.pointerId : -1;
  });
  page.canvas.addEventListener('pointerup', (event) => {
    if (pressed.id !== event.pointerId || Math.hypot(pressed.x - event.clientX, pressed.y - event.clientY) > 4) return;
    const hit = host.pick(event.clientX, event.clientY);
    picked = hit?.key ?? '';
    const record = hit === undefined ? undefined : model.model.objects[hit.object];
    readout.textContent =
      record === undefined ? 'Nothing under the pointer.' : `${record.name ?? record.ref.objectId} · ${record.category ?? 'no category'}`;
  });

  const report = () => ({
    objects: statistics.sourceObjects,
    instances: statistics.renderedInstances,
    triangles: statistics.renderedTriangles,
    frames,
    lastIntervalMs,
    gpu: host.gpu.availability.state === 'available' ? 'available' : host.gpu.availability.reason,
    picked,
  });
  const frameListener = host.onFrame((frame) => {
    frames++;
    lastIntervalMs = frame.intervalMs;
    if (frames % 15 === 0) {
      const current = report();
      page.status.textContent =
        `${current.objects} objects · ${current.instances} instances · ${current.triangles} triangles · ` +
        `frame ${current.lastIntervalMs.toFixed(1)} ms · GPU timing ${current.gpu}`;
    }
  });

  if (statistics.renderedInstances === 0)
    return failure([diagnostic('smoke/empty', 'The building bound no instances')]);
  return success({
    report,
    act: (name) => {
      if (name !== 'fit') return false;
      host.fit();
      return true;
    },
    dispose: () => {
      frameListener.dispose();
    },
  });
});
