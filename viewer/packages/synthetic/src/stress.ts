// A seeded stress scene: many instances across few meshes, inside a stated triangle budget, with a
// material mix a renderer actually has to cope with.
//
// The point of this generator is measurement, not appearance. The performance targets are written
// as "ten thousand objects in a scene of up to ten million triangles", so the budget here is the
// drawn triangle count of the whole scene, summed over instances, not the size of the mesh library.
// The generator never exceeds it: it reserves the cheapest mesh for every instance it has not
// placed yet, and refuses options that cannot fit at all rather than quietly dropping instances.
//
// The material mix matters because it decides how a renderer must batch and sort. Transparent
// instances cannot be merged into an opaque batch, and metal and painted surfaces differ in how
// they shade, so a scene of one material would flatter any implementation.

import {
  instanceRecords,
  metresZUpLocal,
  multiplyMatrix,
  objectRef,
  scaling,
  translation,
  triangleCount,
  type Color,
  type Geometry,
  type InstanceRecord,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
  type Vec3,
} from '@bim-open-toolkit/model';
import { elementAt as at } from './arrays.js';
import { cursor as newCursor, drawFloat, drawInt, type Cursor } from './cursor.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { box, cylinder } from './primitives.js';

// The material classes an instance can be drawn with, in the order the `materialClass` column
// indexes them. The order is part of the contract: a stored column stays readable.
export const materialClasses = ['opaque', 'transparent', 'metal', 'painted'] as const;

// How an instance is drawn, which is what decides the batch and the sort order it belongs to.
export type MaterialClass = (typeof materialClasses)[number];

// The relative share of each material class. The weights need not sum to one; they are normalized.
export type MaterialMix = Readonly<Record<MaterialClass, number>>;

// A mix close to a real building model: mostly opaque, a little glass, some metal and paint.
export const defaultMaterialMix: MaterialMix = { opaque: 0.55, transparent: 0.05, metal: 0.15, painted: 0.25 };

// What to generate. Every field is required, so the scene is a function of this record alone.
export type StressOptions = {
  readonly seed: number;
  readonly instances: number;
  readonly meshes: number;
  readonly triangleBudget: number;
  readonly maxMeshTriangles: number;
  readonly mix: MaterialMix;
};

// The scene the performance targets name: ten thousand instances inside ten million triangles.
export const defaultStressOptions: StressOptions = {
  seed: 1,
  instances: 10000,
  meshes: 24,
  triangleBudget: 10_000_000,
  maxMeshTriangles: 8192,
  mix: defaultMaterialMix,
};

// A generated stress scene. `triangleCount` is what the scene actually draws, at or under budget.
export type StressScene = {
  readonly options: StressOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly materialClass: Uint8Array;
  readonly materialCounts: MaterialMix;
  readonly triangleCount: number;
};

// The smallest triangle count a mesh in this generator can have: a box.
const smallestMesh = 12;

// Rejects options that cannot produce the scene that was asked for.
function checkOptions(options: StressOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.instances) || options.instances < 1) throw new Error(`instances must be a positive integer, got ${options.instances}`);
  if (!Number.isInteger(options.meshes) || options.meshes < 1) throw new Error(`meshes must be a positive integer, got ${options.meshes}`);
  if (!Number.isInteger(options.triangleBudget) || options.triangleBudget < 1) throw new Error(`triangleBudget must be a positive integer, got ${options.triangleBudget}`);
  if (!Number.isInteger(options.maxMeshTriangles) || options.maxMeshTriangles < smallestMesh) throw new Error(`maxMeshTriangles must be an integer of at least ${smallestMesh}, got ${options.maxMeshTriangles}`);
  const weights = materialClasses.map((name) => options.mix[name]);
  if (weights.some((weight) => !(weight >= 0) || !Number.isFinite(weight))) throw new Error('every material weight must be a finite number of at least 0');
  if (!(weights.reduce((total, weight) => total + weight, 0) > 0)) throw new Error('the material mix must give a positive weight to at least one class');
  if (options.instances * smallestMesh > options.triangleBudget) {
    throw new Error(
      `${options.instances} instances need at least ${options.instances * smallestMesh} triangles, more than the budget of ${options.triangleBudget}`,
    );
  }
}

// The colours each material class is drawn in. Fixed palettes rather than a hue computation, so
// no transcendental function enters the generator and the output stays bit-identical everywhere.
const palettes: Readonly<Record<MaterialClass, readonly Color[]>> = {
  opaque: [
    [0.78, 0.76, 0.72],
    [0.62, 0.60, 0.58],
    [0.48, 0.47, 0.45],
  ],
  transparent: [
    [0.62, 0.78, 0.85],
    [0.72, 0.84, 0.80],
  ],
  metal: [
    [0.86, 0.87, 0.89],
    [0.74, 0.68, 0.52],
    [0.66, 0.70, 0.74],
  ],
  painted: [
    [0.78, 0.24, 0.20],
    [0.20, 0.42, 0.72],
    [0.92, 0.72, 0.18],
    [0.24, 0.56, 0.34],
  ],
};

// The opacity range of each class. Only glass is see-through; the rest are solid.
const opacityRange: Readonly<Record<MaterialClass, readonly [number, number]>> = {
  opaque: [1, 1],
  transparent: [0.2, 0.5],
  metal: [1, 1],
  painted: [1, 1],
};

// The mesh library: one box, then cylinders whose triangle counts rise geometrically to the cap.
// They are ordered cheapest first, which is what the budget reservation below relies on.
function buildMeshes(count: number, maxTriangles: number): readonly { readonly name: string; readonly mesh: ShadedMesh }[] {
  const library: { readonly name: string; readonly mesh: ShadedMesh }[] = [{ name: 'box', mesh: box([1, 1, 1]) }];
  if (count === 1) return library;
  // A cylinder of n segments has 4n triangles: two for each side quad and one for each cap fan.
  const smallestSegments = 3;
  const largestSegments = Math.max(smallestSegments + 1, Math.floor(maxTriangles / 4));
  for (let index = 1; index < count; index++) {
    // Geometric spacing, so the library holds both cheap and expensive meshes at any size.
    const share = (index - 1) / Math.max(1, count - 2);
    const segments = Math.round(smallestSegments * (largestSegments / smallestSegments) ** share);
    library.push({ name: `cylinder-${segments}`, mesh: cylinder(0.5, 1, Math.max(smallestSegments, segments)) });
  }
  return library;
}

// Draws a material class from the mix.
function drawMaterial(cursor: Cursor, mix: MaterialMix): MaterialClass {
  const total = materialClasses.reduce((sum, name) => sum + mix[name], 0);
  const roll = drawFloat(cursor) * total;
  let running = 0;
  for (const name of materialClasses) {
    running += mix[name];
    if (roll < running) return name;
  }
  return 'opaque';
}

// Generates a stress scene from its options. The same options always give the same scene.
export function generateStressScene(options: StressOptions): StressScene {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const ref: ModelRef = { id: 'synthetic-stress', revision: `seed-${options.seed}`, source: 'generated' };

  const library = buildMeshes(options.meshes, options.maxMeshTriangles);
  const meshes = library.map((entry) => entry.mesh);
  const triangles = meshes.map(triangleCount);
  const cheapest = Math.min(...triangles);

  // Instances are laid out on a square grid with jitter, so a camera path crosses many of them.
  const side = Math.ceil(Math.sqrt(options.instances));
  const spacing = 4;

  const rows: InstanceRecord[] = [];
  const records: ObjectRecord[] = [];
  const materialClass = new Uint8Array(options.instances);
  const materialCounts: Record<MaterialClass, number> = { opaque: 0, transparent: 0, metal: 0, painted: 0 };
  let remaining = options.triangleBudget;
  let drawn = 0;

  for (let index = 0; index < options.instances; index++) {
    // Reserve the cheapest mesh for every instance still to come, so the budget always holds.
    const reserved = cheapest * (options.instances - index - 1);
    const affordable = remaining - reserved;
    // Spread the budget rather than spending it on the first instances: allow up to three times an
    // even share, but never more than what is affordable and never less than the cheapest mesh.
    const share = affordable / (options.instances - index);
    const limit = Math.max(cheapest, Math.min(affordable, share * 3));
    const candidates = triangles.flatMap((count, meshIndex) => (count <= limit ? [meshIndex] : []));
    const meshIndex = at(candidates, drawInt(cursor, 0, candidates.length));
    remaining -= at(triangles, meshIndex);
    drawn += at(triangles, meshIndex);

    const material = drawMaterial(cursor, options.mix);
    materialClass[index] = materialClasses.indexOf(material);
    materialCounts[material] += 1;
    const palette = palettes[material];
    const color = at(palette, drawInt(cursor, 0, palette.length));
    const [lowOpacity, highOpacity] = opacityRange[material];
    const opacity = lowOpacity + drawFloat(cursor) * (highOpacity - lowOpacity);

    const col = index % side;
    const row = Math.floor(index / side);
    const centre: Vec3 = [
      col * spacing + drawFloat(cursor) * 2 - 1,
      row * spacing + drawFloat(cursor) * 2 - 1,
      drawFloat(cursor) * 12,
    ];
    const size = 0.5 + drawFloat(cursor) * 2.5;
    const transform = multiplyMatrix(translation(centre), scaling([size, size, size]));

    const objectId = `part-${String(index + 1).padStart(6, '0')}`;
    records.push({
      ref: objectRef(ref, objectId),
      name: `Part ${index + 1}`,
      category: 'Component',
      transform,
      appearance: { color, opacity, visible: true },
      representation: meshIndex,
    });
    rows.push({ meshIndex, transform, color, opacity, objectIndex: index });
  }

  const meshGroups: readonly MeshGroup[] = library.map((entry, index) => ({
    name: entry.name,
    mesh: entry.mesh,
    instanceCount: rows.filter((row) => row.meshIndex === index).length,
    triangleCount: at(triangles, index),
  }));

  return {
    options,
    model: { ref, coordinates: metresZUpLocal, objects: records },
    meshGroups,
    geometry: { meshes, instances: instanceRecords(rows) },
    materialClass,
    materialCounts,
    triangleCount: drawn,
  };
}
