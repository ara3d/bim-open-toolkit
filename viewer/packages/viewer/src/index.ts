// Public API of @bim-open-toolkit/viewer: the default composition.
//
//   const viewer = createViewer(canvas);
//   await viewer.open('/models/building.bfast');
//   viewer.run('view.fit', {});
//
// Everything below those three lines is what this package composes: a session over slices, a
// command bus, a feature host, the scene document, the renderer adapters, one view per canvas.

// The session a command sees: a slice store with change events, over a command bus.
export { createSession, directWrite, type SessionOptions, type ViewerSession } from './session.js';

// Commands that come and go with features, over M1's immutable registry.
export { commandBus, type CommandBus } from './command-bus.js';

// Features installed into a session: order, dependencies, and disposal that undoes the install.
export { featureHost, type FeatureHost } from './features.js';

// Live capabilities a session carries beside its slices, because a renderer is not plain data.
export { service, type Service } from './services.js';

// The scene document: the composition of the installed slices, saved, restored and migrated.
export {
  documentFingerprint,
  fingerprintSliceId,
  loadScene,
  modelFingerprint,
  readScene,
  saveScene,
  writeScene,
  type LoadOptions,
  type SceneLoad,
} from './document.js';
