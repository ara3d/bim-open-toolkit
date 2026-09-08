// Public API of @bim-open-toolkit/synthetic: deterministic generators for demonstration data.
// Geometry, object, table and fact types come from @bim-open-toolkit/model and are not re-exported.

// Seeded pseudo-random generator: pure functions over an explicit, immutable state value.
export { float, gaussian, int, next, pick, range, seed, shuffle, type Draw, type Rng } from './prng.js';

// Mesh primitives as plain data, centered on the origin and wound outward.
export { box, cylinder, extrude, plane, wedge } from './primitives.js';

// Calendar dates as `YYYY-MM-DD` text and integer day numbers, with no clock and no time zone.
export { addDays, dayOf, daysFromCivil, isoDate, type IsoDate } from './dates.js';

// A list of ids inside one string cell of a table column, and the way to read it back.
export { joinIds, splitIds } from './arrays.js';

// A model mesh known to carry per-vertex normals, and one mesh of a scene with its instance count.
export { type MeshGroup, type ShadedMesh } from './mesh-builder.js';

// A footprint corner as (x, z), until the model package publishes a two-dimensional vector.
export { type Vec2 } from './triangulate.js';

// Observations rendered as table columns, so a schedule can show what is not known.
export {
  conflictOf,
  evidenceOf,
  missingReasonOf,
  observationState,
  observationText,
  quantityColumns,
  quantityNumber,
  quantityUnit,
  textColumns,
  type NamedColumn,
  type ObservationState,
} from './schedule.js';

// A seeded building: storeys, rooms, walls, slabs, doors, windows, and schedules with real gaps.
export {
  defaultBuildingOptions,
  generateBuilding,
  type Building,
  type BuildingOptions,
  type DoorCoverage,
  type DoorWidthPolicy,
} from './building.js';

// A seeded stress scene: many instances across few meshes, inside a stated triangle budget.
export {
  defaultMaterialMix,
  defaultStressOptions,
  generateStressScene,
  materialClasses,
  type MaterialClass,
  type MaterialMix,
  type StressOptions,
  type StressScene,
} from './stress.js';
