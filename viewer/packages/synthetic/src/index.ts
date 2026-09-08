// Public API of @bim-open-toolkit/synthetic: deterministic generators for demonstration data.
// Geometry, object, table and fact types come from @bim-open-toolkit/model and are not re-exported.

// Seeded pseudo-random generator: pure functions over an explicit, immutable state value.
export { float, gaussian, int, next, pick, range, seed, shuffle, type Draw, type Rng } from './prng.js';

// Mesh primitives as plain data, centered on the origin and wound outward.
export { box, cylinder, extrude, plane, wedge } from './primitives.js';

// A model mesh known to carry per-vertex normals; every primitive here returns one.
export { type ShadedMesh } from './mesh-builder.js';

// A footprint corner as (x, z), until the model package publishes a two-dimensional vector.
export { type Vec2 } from './triangulate.js';
