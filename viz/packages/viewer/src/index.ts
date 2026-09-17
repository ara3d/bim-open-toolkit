// Public API of @bim-open-toolkit/viewer: the default composition.
//
//   const viewer = createViewer(canvas);
//   await viewer.open('/models/building.bfast');
//   viewer.run('view.fit', {});
//
// Everything below those three lines is what this package composes: a session over slices, a
// command bus, a feature host, the scene document, six renderer adapters, and one view per canvas.

// The three lines.
export {
  createViewer,
  type AddViewOptions,
  type OpenedModel,
  type Viewer,
  type ViewerOptions,
} from './create-viewer.js';

// The session a command sees: a slice store with change events, over a command bus.
export { createSession, directWrite, type SessionOptions, type ViewerSession } from './session.js';

// Commands that come and go with features, over M1's immutable registry.
export { commandBus, type CommandBus } from './command-bus.js';

// Features installed into a session: order, dependencies, and disposal that undoes the install.
export { featureHost, type FeatureHost } from './features.js';

// The default composition's own features. Pass your own list to `createViewer` to replace them.
export {
  appearanceFeature,
  appearanceSlice,
  defaultFeatures,
  modelsFeature,
  modelsSlice,
  viewFeature,
  viewSlice,
} from './core-features.js';

// Live capabilities a session carries beside its slices, because a renderer is not plain data.
export { service, type Service } from './services.js';
export { viewerAccess, type SceneAccess, type ViewerAccess, type ViewsAccess } from './access.js';

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

// One canvas: a camera, input, a frame loop, a size, and disposal.
export { createView, noSection, type View, type ViewOptions, type ViewSize } from './view.js';

// Several canvases over one session, with independent or linked cameras.
export { viewSet, type ViewSet } from './multi-view.js';

// What a view needs from a renderer, and the default one over viewer-core and three.
export { type RendererFactory, type ViewRenderer } from './renderer.js';
export {
  applyOrthographic,
  applyPerspective,
  blendableMaterial,
  captureTarget,
  clippingTarget,
  environmentTarget,
  gpuFrameTimer,
  matrixOf,
  ndcOf,
  overlayRenderer,
  raycastSource,
  rayThroughCamera,
  webglRenderer,
  type WebglOptions,
} from './adapters/index.js';

// Schemas for the model types a slice has to save. They are here because the default composition
// needed them first; they belong beside their types.
export {
  appearanceChangeSchema,
  appearanceExtrasSchema,
  cameraPoseSchema,
  colorSchema,
  coordinateContextSchema,
  lengthUnitSchema,
  projectionSchema,
  registrationSchema,
  styleRuleSchema,
  upAxisSchema,
  vec3Schema,
  viewStateSchema,
} from './schemas.js';
