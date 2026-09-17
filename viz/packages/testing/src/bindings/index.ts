/**
 * Columnar instance binding: the study of what the alpha loader's normalized
 * binding step costs and what replaces it.
 *
 * `viewer/packages/testing/docs/normalized-bindings.md` records the numbers and
 * the recommendation. The package's own `src/index.ts` is supervisor-owned, so
 * these exports are reached by path until the shape moves into `render`.
 */
export {
  buildAlphaBindings,
  type AlphaBinding,
  type AlphaBindingResult,
  type AlphaObject,
} from './alpha-reference.js';
export {
  buildColumnarBinding,
  buildRepresentationTable,
  convertUpAxis,
  instanceEntityList,
  validateTransforms,
  withOpaqueMaterials,
  type BindingOptions,
  type LoadedBinding,
  type SourceUp,
} from './build.js';
export {
  buildObjectTable,
  noSourceId,
  objectAt,
  objectIdAt,
  objectNameAt,
  type NormalizedObject,
  type ObjectIdentity,
  type ObjectTable,
} from './object-table.js';
export {
  colorFloats,
  instanceAt,
  instanceColor,
  instanceObjectIndex,
  instanceTransform,
  representationIdAt,
  tableBytes,
  transformFloats,
  withColorOverrides,
  withTransformOverrides,
  type ColumnarBinding,
  type InstanceView,
  type RepresentationTable,
} from './representation-table.js';
export {
  bfastBindingSource,
  columnAt,
  denseColumn,
  stridedColumn,
  type BindingSource,
  type IntColumn,
} from './source.js';
export {
  buildingShape,
  syntheticRenderModel,
  type SyntheticModel,
  type SyntheticModelShape,
} from './synthetic-model.js';
