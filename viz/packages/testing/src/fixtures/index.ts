// Named, deterministic scenes and the fingerprint that proves one did not change.

// A hash in progress, folded over bytes, text and numbers, and reported as eight hexadecimal digits.
export {
  digestHex,
  emptyDigest,
  hashByte,
  hashBytes,
  hashInt,
  hashNumber,
  hashNumbers,
  hashOptionalNumber,
  hashOptionalText,
  hashText,
  type Digest,
} from './fingerprint.js';

// One scene to test against: objects, geometry, tables, and how many triangles it draws.
export { drawnTriangles, tableOf, type NamedTable, type SceneFixture } from './scene-fixture.js';

// Content hashes of the parts of a fixture, for a caller comparing one part rather than all of it.
export { geometryDigest, modelDigest, tableDigest } from './scene-fixture.js';

// The fingerprint of a whole fixture, and the check that fails with both values when it moves.
export { checkFingerprint, fixtureDigest, fixtureFingerprint } from './scene-fixture.js';

// The named fixtures: a small building, a building past ten thousand objects, and a stress scene.
export {
  sceneFixture,
  sceneFixtureNames,
  sceneFixtures,
  smallBuilding,
  stressScene,
  tenThousandObjects,
  type SceneFixtureName,
} from './catalog.js';

// Fixtures from options of your own, and the options the named ones use.
export {
  buildingFixture,
  smallBuildingOptions,
  stressFixture,
  stressSceneOptions,
  tenThousandObjectOptions,
} from './catalog.js';
