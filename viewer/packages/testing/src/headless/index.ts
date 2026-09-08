// A viewer-core scene built from model geometry in Node, and picking against it.

// The built scene: its groups, its mappings back to instance rows, and what it draws.
export {
  headlessScene,
  type HeadlessScene,
  type HeadlessSceneOptions,
} from './scene.js';

// Reading the built scene: which row an instance is, which object a row is, and its buffers.
export {
  boundsOfScene,
  colorInScene,
  meshBuffersOf,
  objectOfRow,
  rowOfInstance,
  transformInScene,
} from './scene.js';

// The three.js mirror and ray picking, without a GL context.
export { headlessMirror, rayThrough, type HeadlessHit, type HeadlessMirror } from './picking.js';
