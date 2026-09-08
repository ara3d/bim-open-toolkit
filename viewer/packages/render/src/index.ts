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
