// Public API of @bim-open-toolkit/render.
//
// Everything that does not need a WebGL context is a pure function or a typed-array data
// structure, tested in Node. Everything that does need one is reached through a small interface a
// test can substitute: `RaycastSource`, `EnvironmentTarget`, `OverlayRenderer`, `CaptureTarget`
// and `GpuFrameTimer`.

// Rows of rendered instances bound to viewer-core groups through index columns, with no
// per-instance JavaScript object.
export {
  alphaChannel,
  buildInstanceTable,
  colorOfRow,
  defaultTableOptions,
  groupCount,
  groupOf,
  keyOfRow,
  meshBuffers,
  objectCount,
  renderedTriangles,
  rowsOfKey,
  rowsOfObject,
  slotOf,
  transformOfRow,
  translationOffset,
  translationStride,
  visibleRows,
  type InstanceTable,
  type InstanceTableOptions,
} from './instance-table.js';

// Bulk column writes straight into the group buffers, with change detection, dirty slot ranges and
// one publish per touched group.
export {
  DirtyRanges,
  applyUpdates,
  defaultUpdateOptions,
  dirtySets,
  everyRow,
  publishDirty,
  selectionSize,
  transformColumnNames,
  updateColumns,
  writeColors,
  writeOpacity,
  writeTransforms,
  writeTranslations,
  writeVisibility,
  type DirtySets,
  type PublishReport,
  type RowSelection,
  type UpdateOptions,
  type UpdateReport,
} from './updates.js';

// Clipping planes and boxes as plain data, with the one-method seam a renderer implements.
export {
  applyClipping,
  boundsClipped,
  boxPlanes,
  clipPlane,
  isClipped,
  noClipping,
  planeThrough,
  planesOf,
  signedDistance,
  type ClipPlane,
  type ClipRegion,
  type ClippingTarget,
} from './clipping.js';

// Picking: object identity and a world hit point, with hidden and clipped surfaces rejected.
export {
  defaultPickOptions,
  groupOrdinals,
  instanceSource,
  intersectMesh,
  intersectTriangle,
  isPickable,
  nearestHit,
  pick,
  pickInstances,
  pointOnRay,
  projectPoint,
  rayThroughNdc,
  resolveHit,
  rowOfSlot,
  type ObjectHit,
  type ObjectHitSource,
  type PickOptions,
  type Ray,
  type RaycastHit,
  type RaycastSource,
} from './picking.js';

// A representation registry and replacement: an object's geometry swapped while identity stays.
export {
  boxMesh,
  boxRepresentation,
  changedReplacements,
  drawnReplacements,
  isReplaced,
  meshBounds,
  noReplacements,
  replaceObject,
  replacedKeys,
  replacementBounds,
  replacementHits,
  replacementOf,
  replacementSource,
  replacementSourceId,
  representation,
  representationRegistry,
  restoreAll,
  restoreObject,
  type DrawnRepresentation,
  type Replacement,
  type ReplacementState,
  type Representation,
  type RepresentationRegistry,
  type RepresentationTarget,
} from './representations.js';

// Overlay primitives with click actions, as data, plus the projection and hit test a renderer needs.
export {
  checkOverlays,
  clickAction,
  defaultOverlayStyle,
  noOverlays,
  objectAnchor,
  overlayAt,
  overlayItem,
  overlayKinds,
  overlayLayer,
  projectOverlays,
  projectToScreen,
  putItem,
  putLayer,
  removeItem,
  removeLayer,
  repeatedItemIds,
  resolveAnchor,
  setLayerVisible,
  visibleItems,
  worldAnchor,
  type AnchorPositions,
  type OverlayAction,
  type OverlayAnchor,
  type OverlayItem,
  type OverlayKind,
  type OverlayLayer,
  type OverlayRenderer,
  type OverlayState,
  type OverlayStyle,
  type ProjectedOverlay,
  type ScreenPoint,
} from './overlays.js';

// Background, light rig, scale-aware grid, ground plane and axes, as settings and line segments.
export {
  applyEnvironment,
  axisLengthFor,
  axisLines,
  checkEnvironment,
  defaultEnvironment,
  environmentDrawing,
  gridLines,
  gridSpacingFor,
  groundHeight,
  type EnvironmentDrawing,
  type EnvironmentSettings,
  type EnvironmentTarget,
  type GridSettings,
  type LightRig,
  type LineSegment,
} from './environment.js';

// Capture behind an adapter: draw, encode, and put the view back the size it was.
export {
  captureImage,
  captureSize,
  pngFormat,
  thumbnailSize,
  type CaptureFormat,
  type CaptureImage,
  type CaptureOptions,
  type CaptureTarget,
} from './capture.js';

// Frame timing, GPU timing when it exists, and scene statistics, as data a HUD reads.
export {
  DurationLog,
  FrameTimer,
  frameBudgetMs,
  framesPerSecond,
  gpuUnavailable,
  hudData,
  noDurations,
  noGpuTimer,
  percentileOf,
  readGpuTimer,
  sceneStatistics,
  type CameraKind,
  type DurationStats,
  type GpuAvailability,
  type GpuFrameTimer,
  type GpuReading,
  type HudData,
  type SceneStatistics,
} from './timing.js';

// The composition: models bound to a viewer-core scene, and the operations that cross modules.
export {
  SceneBinding,
  instanceColorStride,
  type BoundModel,
  type GroupLocation,
  type ModelRaycastHit,
} from './scene-binding.js';
