// Equipment access envelopes and structural penetrations that may or may not overlap.
//
// A bounding-box overlap is a candidate for coordination, not a clash. This generator produces the
// data an access review reads and nothing more: two sets of boxes in one registered frame, some of
// which overlap on all three axes, some of which overlap on two, and some of which cannot be tested
// at all because nobody registered them. The review has to say which is which; it must not report a
// candidate as a verified intersection, and it must not report an unregistered box as "no overlap".
//
// A box is not a `FactValue` in model revision M1, which has quantity, text, flag and reference
// only. So the state of a box observation is written into the same columns `schedule.ts` produces
// for an observed field - `bboxState`, `bboxMissingReason`, `bboxConflict`, `bboxEvidence` - while
// the box itself is six numeric columns that read NaN when the state is not `known`. The request
// for a bounds-valued fact is in the track checkpoint.

import {
  f64Column,
  stringColumn,
  table,
  type Appearance,
  type CoordinateContext,
  type Geometry,
  type ModelData,
  type ModelRef,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { elementAt } from './arrays.js';
import { cursor as newCursor, drawRange, type Cursor } from './cursor.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { placeScaled } from './placement.js';
import { box } from './primitives.js';
import { add, scene, sceneBuilder } from './scene.js';

// What to generate.
export type ClearanceOptions = {
  readonly seed: number;
  readonly equipment: number;
  readonly penetrations: number;
  readonly gapScale: number;
};

// Six pieces of equipment and eight penetrations, half of which sit inside an access envelope.
export const defaultClearanceOptions: ClearanceOptions = {
  seed: 23,
  equipment: 6,
  penetrations: 8,
  gapScale: 1,
};

// A generated coordination set. `coordinates` is the frame both tables report in: a comparison
// between boxes in different frames is meaningless, so the frame is stated rather than assumed.
export type Clearances = {
  readonly options: ClearanceOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly coordinates: CoordinateContext;
  readonly envelopes: Table;
  readonly penetrations: Table;
  readonly candidateOverlaps: number;
};

// Rejects options that cannot produce a coordination set. Two of each are needed for the cases the
// review has to tell apart.
function checkOptions(options: ClearanceOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.equipment) || options.equipment < 2) throw new Error(`equipment must be an integer of at least 2, got ${options.equipment}`);
  if (!Number.isInteger(options.penetrations) || options.penetrations < 2) throw new Error(`penetrations must be an integer of at least 2, got ${options.penetrations}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// The frame both tables report in. Registered to the project, which is the least a box comparison
// needs: an unregistered frame is a reason to refuse the comparison, not to guess.
export const projectFrame: CoordinateContext = {
  units: 'metres',
  up: 'z',
  registration: { kind: 'project', projectId: 'synthetic-coordination' },
};

// An axis-aligned box in the project frame, given by its centre and its size.
export type Box = { readonly centre: Vec3; readonly size: Vec3 };

// One participant in the review: a box somebody may or may not have registered.
type Participant = {
  readonly objectId: string;
  readonly name: string;
  readonly discipline: string;
  readonly kind: string;
  readonly bbox: Box;
  readonly state: string;
  readonly missingReason: string;
  readonly conflict: string;
  readonly evidence: string;
};

// The disciplines the participants belong to.
const equipmentDiscipline = 'Mechanical';
const penetrationDiscipline = 'Structural';

// The appearance of an access envelope: translucent, because it is a volume to keep clear rather
// than a thing.
const envelopeAppearance: Appearance = { color: [0.35, 0.65, 0.85], opacity: 0.3, visible: true };

// The appearance of a penetration.
const penetrationAppearance: Appearance = { color: [0.85, 0.55, 0.25], opacity: 0.6, visible: true };

// The lowest and highest corner of a box, in the order the columns report them.
const lowOf = (item: Box): Vec3 => [
  item.centre[0] - item.size[0] / 2,
  item.centre[1] - item.size[1] / 2,
  item.centre[2] - item.size[2] / 2,
];
const highOf = (item: Box): Vec3 => [
  item.centre[0] + item.size[0] / 2,
  item.centre[1] + item.size[1] / 2,
  item.centre[2] + item.size[2] / 2,
];

// A box written for a reader, so a disputed pair can be shown without a box-valued fact.
const describeBox = (item: Box): string => {
  const low = lowOf(item);
  const high = highOf(item);
  return `x:[${low[0].toFixed(2)},${high[0].toFixed(2)}] y:[${low[1].toFixed(2)},${high[1].toFixed(2)}] z:[${low[2].toFixed(2)},${high[2].toFixed(2)}]`;
};

// True when two boxes intersect on all three axes. Touching counts as overlapping. Exported for
// this package's own tests; a review adapter states this rule itself rather than borrowing the
// fixture's, which is why it is not part of the package's public API.
export function boxesOverlap(a: Box, b: Box): boolean {
  const lowA = lowOf(a);
  const highA = highOf(a);
  const lowB = lowOf(b);
  const highB = highOf(b);
  for (let axis = 0; axis < 3; axis++) {
    if (elementAt(lowA, axis) > elementAt(highB, axis)) return false;
    if (elementAt(lowB, axis) > elementAt(highA, axis)) return false;
  }
  return true;
}

// The columns describing a set of participants. The six box columns read NaN wherever the state is
// not `known`, so an unregistered box can never be mistaken for a box at the origin.
function participantColumns(items: readonly Participant[]): Table {
  const coordinate = (read: (item: Box) => Vec3, axis: number): readonly number[] =>
    items.map((item) => (item.state === 'known' ? elementAt(read(item.bbox), axis) : Number.NaN));
  return table([
    ['objectId', stringColumn(items.map((item) => item.objectId))],
    ['name', stringColumn(items.map((item) => item.name))],
    ['discipline', stringColumn(items.map((item) => item.discipline))],
    ['minX', f64Column(coordinate(lowOf, 0))],
    ['minY', f64Column(coordinate(lowOf, 1))],
    ['minZ', f64Column(coordinate(lowOf, 2))],
    ['maxX', f64Column(coordinate(highOf, 0))],
    ['maxY', f64Column(coordinate(highOf, 1))],
    ['maxZ', f64Column(coordinate(highOf, 2))],
    ['bboxState', stringColumn(items.map((item) => item.state))],
    ['bboxMissingReason', stringColumn(items.map((item) => item.missingReason))],
    ['bboxConflict', stringColumn(items.map((item) => item.conflict))],
    ['bboxEvidence', stringColumn(items.map((item) => item.evidence))],
  ]);
}

// Generates a coordination set from its options. The same options always give the same boxes.
export function generateClearances(options: ClearanceOptions): Clearances {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const complete = options.gapScale === 0;

  const ref: ModelRef = { id: 'synthetic-clearances', revision: `seed-${options.seed}`, source: 'generated' };
  const meshes: readonly ShadedMesh[] = [box([1, 1, 1])];
  const meshNames: readonly string[] = ['coordination-box'];

  const envelopes: Participant[] = [];
  for (let index = 0; index < options.equipment; index++) {
    const centre: Vec3 = [index * 9, 0, drawRange(cursor, 1.2, 1.8)];
    const size: Vec3 = [drawRange(cursor, 2.4, 3.6), drawRange(cursor, 2, 3), drawRange(cursor, 2, 2.8)];
    // The last envelope was never registered, so nothing can be said about what it overlaps.
    const unregistered = !complete && index === options.equipment - 1;
    envelopes.push({
      objectId: `env-${index + 1}`,
      name: `Access envelope ${index + 1}`,
      discipline: equipmentDiscipline,
      kind: 'envelope',
      bbox: { centre, size },
      state: unregistered ? 'missing' : 'known',
      missingReason: unregistered ? 'not-provided' : '',
      conflict: '',
      evidence: unregistered ? 'coordination-model' : 'coordination-model (MEP-2026-01)',
    });
  }

  const penetrations: Participant[] = [];
  for (let index = 0; index < options.penetrations; index++) {
    const host = elementAt(envelopes, Math.floor(index / 2) % envelopes.length);
    // Every other penetration is placed inside an envelope, so a candidate overlap is structural
    // rather than a matter of which numbers came up.
    const inside = index % 2 === 0;
    const jitter = drawRange(cursor, -0.4, 0.4);
    const centre: Vec3 = inside
      ? [host.bbox.centre[0] + jitter, host.bbox.centre[1], host.bbox.centre[2]]
      : [host.bbox.centre[0] + jitter, host.bbox.centre[1] + 12, host.bbox.centre[2]];
    const size: Vec3 = [drawRange(cursor, 0.4, 0.8), drawRange(cursor, 0.3, 0.5), drawRange(cursor, 0.4, 0.8)];
    // One penetration was surveyed twice and the two boxes do not agree, so it cannot be tested
    // either, for a different reason from the envelope nobody registered.
    // The disputed box is one that would otherwise be a candidate, so a review cannot report it as
    // a finding and cannot report it as clear either.
    const disputed = !complete && index === Math.min(2, options.penetrations - 1);
    const second: Box = { centre: [centre[0] + 0.6, centre[1] + 0.4, centre[2]], size };
    penetrations.push({
      objectId: `pen-${index + 1}`,
      name: `Penetration ${index + 1}`,
      discipline: penetrationDiscipline,
      kind: 'penetration',
      bbox: { centre, size },
      state: disputed ? 'conflicting' : 'known',
      missingReason: '',
      conflict: disputed ? `${describeBox({ centre, size })} vs ${describeBox(second)}` : '',
      evidence: disputed ? 'setting-out-survey (SO-2026-03); coordination-model (MEP-2026-01)' : 'coordination-model (MEP-2026-01)',
    });
  }

  const target = sceneBuilder(ref);
  for (const item of [...envelopes, ...penetrations]) {
    add(target, {
      objectId: item.objectId,
      name: item.name,
      category: item.kind === 'envelope' ? 'Access envelope' : 'Penetration',
      transform: placeScaled(item.bbox.centre, item.bbox.size),
      appearance: item.kind === 'envelope' ? envelopeAppearance : penetrationAppearance,
      meshIndex: 0,
    });
  }
  const built = scene(target, projectFrame, meshes, meshNames);

  let candidates = 0;
  for (const envelope of envelopes) {
    if (envelope.state !== 'known') continue;
    for (const penetration of penetrations) {
      if (penetration.state !== 'known') continue;
      if (boxesOverlap(envelope.bbox, penetration.bbox)) candidates += 1;
    }
  }

  return {
    options,
    model: built.model,
    meshGroups: built.meshGroups,
    geometry: built.geometry,
    coordinates: projectFrame,
    envelopes: participantColumns(envelopes),
    penetrations: participantColumns(penetrations),
    candidateOverlaps: candidates,
  };
}
