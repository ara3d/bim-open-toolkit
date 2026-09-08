// Public API of @bim-open-toolkit/synthetic: deterministic generators for demonstration data.

// Seeded pseudo-random generator: pure functions over an explicit, immutable state value.
export { float, gaussian, int, next, pick, range, seed, shuffle, type Draw, type Rng } from './prng.js';

// Mesh primitives as plain data, centered on the origin and wound outward.
export { box, cylinder, extrude, plane, wedge } from './primitives.js';

// Sizes of a mesh.
export { triangleCount, vertexCount } from './mesh-builder.js';
