// The page the browser smoke opens: the three-line path, on a real canvas, with a real renderer.
//
// It is deliberately the documented path and nothing else. What the test reads back is what a
// beginner would get: a model on the screen, a rule applied, a frame drawn, and the counts.

import { styleRule, objectKey } from '@bim-open-toolkit/model';
import { createViewer } from '../../src/create-viewer.js';
import { twoObjectModel } from '../support/model-fixture.js';

declare global {
  interface Window {
    // What the page reports back, once the first frame is drawn.
    viewerSmoke?: {
      readonly objects: number;
      readonly instances: number;
      readonly triangles: number;
      readonly framesDrawn: number;
      readonly redChannel: number;
      readonly views: readonly string[];
      readonly commands: number;
      readonly restoredSlices: readonly string[];
    };
    viewerReady?: boolean;
    viewerError?: string;
  }
}

const canvas = document.getElementById('viewport');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('the page has no canvas with id "viewport"');

try {
  // The three lines.
  const viewer = createViewer(canvas);
  const shown = viewer.show(twoObjectModel());
  viewer.run('view.fit', {});

  if (!shown.ok) throw new Error(shown.diagnostics.map((one) => one.message).join('; '));

  const doorKey = objectKey({ modelId: 'fixture', revision: 'r1', objectId: 'b' });
  viewer.apply(styleRule('red', 'The door', [doorKey], { color: [1, 0, 0] }));

  // A scene saved and restored, which is the wave 2 acceptance case, in the browser.
  const saved = viewer.save();
  const restored = saved.ok ? viewer.load(saved.value) : undefined;

  let framesDrawn = 0;
  viewer.views.get('main')?.renderNow();
  framesDrawn++;

  const table = viewer.binding.tableOf('fixture');
  const statistics = viewer.statistics();
  window.viewerSmoke = {
    objects: statistics.sourceObjects,
    instances: statistics.renderedInstances,
    triangles: statistics.renderedTriangles,
    framesDrawn,
    redChannel: table?.colors[0]?.[4] ?? -1,
    views: viewer.views.ids(),
    commands: viewer.describe().length,
    restoredSlices: restored !== undefined && restored.ok ? [...restored.value.restored].sort() : [],
  };
  window.viewerReady = true;
  window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
} catch (cause) {
  window.viewerError = cause instanceof Error ? cause.message : String(cause);
  console.error(window.viewerError);
}
