// Roof and room-finish surfaces with the measurements somebody supplied for them.
//
// The rule this data exists to defend is that a rendered triangle is not a quantity. So the area
// reported for a face is a supplied measurement drawn independently of the face's geometry, and it
// differs from the geometric area by a few per cent, the way a measurement taken to the finish face
// differs from a model face. A takeoff that quietly computed area from the mesh would produce
// numbers that do not match this table, which is the point.
//
// The gaps are the faces nobody classified, the faces nobody measured, and the faces two surveys
// disagree about. None of them may be read as zero.

import {
  boolColumn,
  conflicting,
  coverageOf,
  fact,
  known,
  metresZUpLocal,
  missing,
  multiplyMatrix,
  objectRef,
  quantity,
  scaling,
  stringColumn,
  table,
  text,
  translation,
  type Appearance,
  type Coverage,
  type Evidence,
  type Fact,
  type Geometry,
  type ModelData,
  type ModelRef,
  type Observation,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { cursor as newCursor, drawChance, drawFloat, drawPick, drawRange, type Cursor } from './cursor.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { alignYTo } from './placement.js';
import { plane } from './primitives.js';
import { add, scene, sceneBuilder } from './scene.js';
import { quantityColumns, textColumns, type NamedColumn } from './schedule.js';

// What to generate.
export type QuantityOptions = {
  readonly seed: number;
  readonly rooms: number;
  readonly facesPerRoom: number;
  readonly roofFaces: number;
  readonly gapScale: number;
};

// A small takeoff: eight rooms of three finish faces each, plus six roof faces.
export const defaultQuantityOptions: QuantityOptions = {
  seed: 3,
  rooms: 8,
  facesPerRoom: 3,
  roofFaces: 6,
  gapScale: 1,
};

// A generated takeoff: the faces, what they are finished in and what anybody measured.
export type Quantities = {
  readonly options: QuantityOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly facts: readonly Fact[];
  readonly surfaces: Table;
  readonly finishCoverage: Coverage;
  readonly areaCoverage: Coverage;
};

// Rejects options that cannot produce a takeoff.
function checkOptions(options: QuantityOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.rooms) || options.rooms < 1) throw new Error(`rooms must be a positive integer, got ${options.rooms}`);
  if (!Number.isInteger(options.facesPerRoom) || options.facesPerRoom < 1) {
    throw new Error(`facesPerRoom must be a positive integer, got ${options.facesPerRoom}`);
  }
  if (!Number.isInteger(options.roofFaces) || options.roofFaces < 0) throw new Error(`roofFaces must be a whole number, got ${options.roofFaces}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// The finishes a room face can be laid in.
const roomFinishes = ['Carpet', 'Tile', 'Vinyl', 'Painted plaster'] as const;

// The finishes a roof face can be covered in.
const roofFinishes = ['Single-ply membrane', 'Standing seam'] as const;

// How an area came to be recorded. Provenance only: it never rescues a missing or disputed number.
const bases = ['supplied-measurement', 'derived-from-drawing'] as const;

// The evidence a measured schedule provides.
const takeoffEvidence: Evidence = { source: 'measured-takeoff', reference: 'QS-2026-02' };

// The evidence a second surveyor provides.
const checkEvidence: Evidence = { source: 'check-survey', reference: 'QS-2026-02B' };

// The evidence a finishes schedule provides.
const finishesEvidence: Evidence = { source: 'finishes-schedule', reference: 'A-FIN-200' };

// One face and everything recorded about it.
type Surface = {
  readonly objectId: string;
  readonly roomId: string;
  readonly roomKnown: boolean;
  readonly scope: string;
  readonly basis: string;
  readonly size: readonly [number, number];
  readonly centre: Vec3;
  readonly finishType: Observation;
  readonly areaM2: Observation;
};

// The appearance of a face. A takeoff colours by finish or by coverage, so the data carries a
// neutral tint rather than a meaning.
const faceAppearance: Appearance = { color: [0.7, 0.7, 0.72], opacity: 1, visible: true };

// What is known about a face's finish. A few were never classified, and a few carry two candidate
// finishes nobody has chosen between. `choices` needs at least two entries so a conflict is always
// between two different finishes.
function drawFinish(target: Cursor, choices: readonly string[], gap: number): Observation {
  const roll = drawFloat(target);
  const first = drawPick(target, choices);
  const second = drawPick(target, choices.filter((choice) => choice !== first));
  if (roll < 0.05 * gap) return conflicting([text(first), text(second)], [finishesEvidence, takeoffEvidence]);
  if (roll < 0.13 * gap) return missing('not-provided', [finishesEvidence]);
  return known(text(first), [finishesEvidence]);
}

// What is known about a face's area. The measurement is supplied, not computed from the mesh: it
// differs from the geometric area by a few per cent, the way a site measurement does.
function drawArea(target: Cursor, geometricArea: number, gap: number): Observation {
  const roll = drawFloat(target);
  const measured = Math.round(geometricArea * drawRange(target, 0.94, 1.03) * 100) / 100;
  const second = Math.round(measured * drawRange(target, 1.05, 1.15) * 100) / 100;
  if (roll < 0.05 * gap) {
    return conflicting([quantity(measured, 'm2'), quantity(second, 'm2')], [takeoffEvidence, checkEvidence]);
  }
  if (roll < 0.12 * gap) return missing('not-measured', [takeoffEvidence]);
  return known(quantity(measured, 'm2'), [takeoffEvidence]);
}

// Generates a takeoff from its options. The same options always give the same faces and numbers.
export function generateQuantities(options: QuantityOptions): Quantities {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const gap = options.gapScale;
  const ref: ModelRef = { id: 'synthetic-quantities', revision: `seed-${options.seed}`, source: 'generated' };
  const meshes: readonly ShadedMesh[] = [plane(1, 1)];
  const meshNames: readonly string[] = ['surface-face'];

  const surfaces: Surface[] = [];
  const columns = Math.ceil(Math.sqrt(options.rooms));

  for (let room = 0; room < options.rooms; room++) {
    const roomId = `room-${room + 1}`;
    const originX = (room % columns) * 9;
    const originY = Math.floor(room / columns) * 9;
    for (let face = 0; face < options.facesPerRoom; face++) {
      const width = drawRange(cursor, 2.5, 6);
      const depth = drawRange(cursor, 2.5, 6);
      const linked = !drawChance(cursor, 0.03 * gap);
      surfaces.push({
        objectId: `finish-${room + 1}-${face + 1}`,
        roomId: linked ? roomId : '',
        roomKnown: linked,
        scope: 'room-finish',
        basis: drawPick(cursor, bases),
        size: [width, depth],
        centre: [originX + face * 7, originY, 0],
        finishType: drawFinish(cursor, roomFinishes, gap),
        areaM2: drawArea(cursor, width * depth, gap),
      });
    }
  }

  for (let face = 0; face < options.roofFaces; face++) {
    const width = drawRange(cursor, 6, 14);
    const depth = drawRange(cursor, 6, 14);
    surfaces.push({
      // A roof face belongs to the building, not to a room. The empty room id is policy, not a gap.
      objectId: `roof-${face + 1}`,
      roomId: '',
      roomKnown: false,
      scope: 'roof',
      basis: drawPick(cursor, bases),
      size: [width, depth],
      centre: [face * 16, -20, 12],
      finishType: drawFinish(cursor, roofFinishes, gap),
      areaM2: drawArea(cursor, width * depth, gap),
    });
  }

  const target = sceneBuilder(ref);
  for (const surface of surfaces) {
    add(target, {
      objectId: surface.objectId,
      name: `${surface.scope} ${surface.objectId}`,
      category: surface.scope === 'roof' ? 'Roof face' : 'Finish face',
      transform: multiplyMatrix(
        multiplyMatrix(translation(surface.centre), alignYTo('z')),
        scaling([surface.size[0], 1, surface.size[1]]),
      ),
      appearance: faceAppearance,
      meshIndex: 0,
    });
  }
  const built = scene(target, metresZUpLocal, meshes, meshNames);

  const surfaceColumns: readonly NamedColumn[] = [
    ['objectId', stringColumn(surfaces.map((surface) => surface.objectId))],
    ['roomId', stringColumn(surfaces.map((surface) => surface.roomId))],
    ['roomIdKnown', boolColumn(surfaces.map((surface) => surface.roomKnown))],
    ['scope', stringColumn(surfaces.map((surface) => surface.scope))],
    ['basis', stringColumn(surfaces.map((surface) => surface.basis))],
    ...textColumns('finishType', surfaces.map((surface) => surface.finishType)),
    ...quantityColumns('areaM2', surfaces.map((surface) => surface.areaM2)),
  ];

  return {
    options,
    model: built.model,
    meshGroups: built.meshGroups,
    geometry: built.geometry,
    facts: surfaces.flatMap((surface) => [
      fact(objectRef(ref, surface.objectId), 'finishType', surface.finishType),
      fact(objectRef(ref, surface.objectId), 'areaM2', surface.areaM2),
    ]),
    surfaces: table(surfaceColumns),
    finishCoverage: coverageOf(surfaces.map((surface) => surface.finishType)),
    areaCoverage: coverageOf(surfaces.map((surface) => surface.areaM2)),
  };
}
