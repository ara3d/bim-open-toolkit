// Two snapshots of one building and the correspondences somebody proposed between them.
//
// A revision comparison is only honest if the correspondence between an object in one revision and
// an object in the next is supplied evidence rather than something the viewer guessed from names or
// geometry. So this generator produces the proposals as data, complete with the cases that cannot
// be resolved: a proposal with two candidates, an object named by two separate proposals, an object
// with no candidate at all in either direction, and a proposal whose confidence nobody recorded.
//
// The second snapshot is derived from the first rather than generated again from a different seed,
// because two unrelated buildings have no interesting correspondence. Snapshot B keeps the model id
// and takes a new revision, which is how `identity.ts` models the same object at two revisions;
// its object ids are nonetheless disjoint from A's, which is the harder case a real comparison has
// to survive.

import {
  boolColumn,
  defaultAppearance,
  f64Column,
  i32Column,
  metresZUpLocal,
  multiplyMatrix,
  noMesh,
  stringColumn,
  table,
  translation,
  type Matrix4,
  type ModelRef,
  type ObjectRecord,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { elementAt, joinIds } from './arrays.js';
import { cursor as newCursor, drawChance, drawInt, drawPick, drawRange, type Cursor } from './cursor.js';
import { defaultBuildingOptions, generateBuilding, type Building, type BuildingOptions } from './building.js';
import { add, scene, sceneBuilder, type Scene } from './scene.js';

// What to generate: the building of snapshot A, and the rates at which snapshot B differs from it.
export type RevisionsOptions = {
  readonly seed: number;
  readonly building: BuildingOptions;
  readonly renameRate: number;
  readonly recategorizeRate: number;
  readonly moveRate: number;
  readonly deleteRate: number;
  readonly ambiguousRate: number;
  readonly additions: number;
};

// A small revision: the default building, changed at rates that leave every case represented.
export const defaultRevisionsOptions: RevisionsOptions = {
  seed: 11,
  building: defaultBuildingOptions,
  renameRate: 0.1,
  recategorizeRate: 0.03,
  moveRate: 0.08,
  deleteRate: 0.05,
  ambiguousRate: 0.04,
  additions: 4,
};

// How many objects the second snapshot changed, by kind. A summary for a reader and a test; it is
// not an input column, because a comparison that read the answer would prove nothing.
export type ChangeCounts = {
  readonly unchanged: number;
  readonly renamed: number;
  readonly recategorized: number;
  readonly moved: number;
  readonly deleted: number;
  readonly added: number;
  readonly ambiguous: number;
  readonly duplicated: number;
};

// Two snapshots and the proposals between them. `objectsA` and `objectsB` describe what each
// revision holds; `correspondences` is what somebody proposed, unresolved cases included.
export type Revisions = {
  readonly options: RevisionsOptions;
  readonly before: Building;
  readonly after: Scene;
  readonly objectsA: Table;
  readonly objectsB: Table;
  readonly correspondences: Table;
  readonly changeCounts: ChangeCounts;
};

// Rejects options that cannot produce a comparison.
function checkOptions(options: RevisionsOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.additions) || options.additions < 0) {
    throw new Error(`additions must be a whole number, got ${options.additions}`);
  }
  const rates: readonly (readonly [string, number])[] = [
    ['renameRate', options.renameRate],
    ['recategorizeRate', options.recategorizeRate],
    ['moveRate', options.moveRate],
    ['deleteRate', options.deleteRate],
    ['ambiguousRate', options.ambiguousRate],
  ];
  for (const [name, value] of rates) {
    if (!(value >= 0) || value > 1) throw new Error(`${name} must be a share from 0 to 1, got ${value}`);
  }
}

// The position an object's transform places it at: the translation column of the matrix.
const positionOf = (transform: Matrix4): Vec3 => [transform[12], transform[13], transform[14]];

// The category an object takes when somebody reclassified it in the second revision.
const recategorized: Readonly<Record<string, string>> = {
  Wall: 'Curtain Wall',
  Door: 'Fire Door',
  Window: 'Curtain Panel',
  Room: 'Circulation Space',
  Slab: 'Structural Slab',
  Storey: 'Building Storey',
};

// One proposal between the two revisions.
type Proposal = {
  readonly id: string;
  readonly aId: string;
  readonly aKnown: boolean;
  readonly bIds: readonly string[];
  readonly basis: string;
  readonly confidence: number;
};

// One object of the second revision, before it becomes a record and an instance row.
type AfterObject = {
  readonly objectId: string;
  readonly name: string | undefined;
  readonly category: string | undefined;
  readonly parentId: string | undefined;
  readonly transform: Matrix4;
  readonly meshIndex: number;
  readonly source: ObjectRecord;
};

// The id an object of the first revision takes in the second. The two id spaces stay disjoint, so
// nothing can match by accident.
const afterId = (objectId: string, suffix: string): string => `${objectId}-${suffix}`;

// Generates two snapshots and the proposals between them. The same options always give the same
// pair, and snapshot A is exactly what `generateBuilding` produces for the same building options.
export function generateRevisions(options: RevisionsOptions): Revisions {
  checkOptions(options);
  const before = generateBuilding(options.building);
  const cursor: Cursor = newCursor(options.seed);
  const ref: ModelRef = { ...before.model.ref, revision: `${before.model.ref.revision}-rev-b` };

  const after: AfterObject[] = [];
  const proposals: Proposal[] = [];
  const counts = { unchanged: 0, renamed: 0, recategorized: 0, moved: 0, deleted: 0, added: 0, ambiguous: 0, duplicated: 0 };
  // Objects of the first revision that the second one dropped. A record precedes its children in
  // `model.objects`, so a child always knows whether its parent survived.
  const dropped = new Set<string>();

  for (const record of before.model.objects) {
    const objectId = record.ref.objectId;
    // Every draw is made for every object, whatever the earlier draws decided, so changing one
    // rate never shifts the sequence for another.
    const deleted = drawChance(cursor, options.deleteRate);
    const renamed = drawChance(cursor, options.renameRate);
    const recategorised = drawChance(cursor, options.recategorizeRate);
    const moved = drawChance(cursor, options.moveRate);
    const ambiguous = drawChance(cursor, options.ambiguousRate);
    const offset = drawRange(cursor, 0.15, 0.9);
    const confidence = drawRange(cursor, 0.55, 1);
    const confidenceRecorded = !drawChance(cursor, 0.06);

    if (deleted) {
      counts.deleted += 1;
      dropped.add(objectId);
      proposals.push({
        id: `corr-${proposals.length + 1}`,
        aId: objectId,
        aKnown: true,
        bIds: [],
        basis: 'same-id',
        confidence: confidenceRecorded ? confidence : Number.NaN,
      });
      continue;
    }

    const category = record.category;
    const newCategory = recategorised && category !== undefined ? recategorized[category] : undefined;
    const transform = moved ? multiplyMatrix(translation([offset, 0, 0]), record.transform) : record.transform;
    const primary: AfterObject = {
      objectId: afterId(objectId, 'b'),
      name: renamed && record.name !== undefined ? `${record.name} (revised)` : record.name,
      category: newCategory ?? category,
      parentId: record.parentId === undefined || dropped.has(record.parentId) ? undefined : afterId(record.parentId, 'b'),
      transform,
      meshIndex: record.representation ?? noMesh,
      source: record,
    };
    after.push(primary);

    const candidates: string[] = [primary.objectId];
    if (ambiguous) {
      // The element was split in two: the proposal names both halves and resolves neither.
      const twin: AfterObject = {
        ...primary,
        objectId: afterId(objectId, 'b2'),
        transform: multiplyMatrix(translation([0, offset, 0]), transform),
      };
      after.push(twin);
      candidates.push(twin.objectId);
      counts.ambiguous += 1;
    }

    if (renamed) counts.renamed += 1;
    if (newCategory !== undefined) counts.recategorized += 1;
    if (moved) counts.moved += 1;
    if (!renamed && newCategory === undefined && !moved && !ambiguous) counts.unchanged += 1;

    proposals.push({
      id: `corr-${proposals.length + 1}`,
      aId: objectId,
      aKnown: true,
      bIds: candidates,
      basis: ambiguous || renamed ? 'geometry-match' : 'same-id',
      confidence: confidenceRecorded ? confidence : Number.NaN,
    });
  }

  // Objects nobody proposed a predecessor for: new in the second revision.
  const templates = before.model.objects.filter((record) => record.representation !== undefined);
  for (let index = 0; index < options.additions; index++) {
    const template = elementAt(templates, drawInt(cursor, 0, Math.max(templates.length, 1)));
    const objectId = `added-${index + 1}`;
    after.push({
      objectId,
      name: `Added ${template.category ?? 'element'} ${index + 1}`,
      category: template.category,
      parentId: undefined,
      transform: multiplyMatrix(translation([0, 0, drawRange(cursor, 0.5, 2)]), template.transform),
      meshIndex: template.representation ?? noMesh,
      source: template,
    });
    counts.added += 1;
    proposals.push({
      id: `corr-${proposals.length + 1}`,
      aId: '',
      aKnown: false,
      bIds: [objectId],
      basis: 'new-object',
      confidence: 1,
    });
  }

  // One object named by two separate proposals, which is the other way a match goes unresolved.
  const matched = proposals.filter((item) => item.aKnown && item.bIds.length === 1);
  const repeated = matched.length === 0 ? undefined : drawPick(cursor, matched);
  if (repeated !== undefined) {
    counts.duplicated += 1;
    proposals.push({
      id: `corr-${proposals.length + 1}`,
      aId: repeated.aId,
      aKnown: true,
      bIds: repeated.bIds,
      basis: 'name-match',
      confidence: drawRange(cursor, 0.4, 0.7),
    });
  }

  const target = sceneBuilder(ref);
  for (const item of after) {
    add(target, {
      objectId: item.objectId,
      name: item.name,
      category: item.category,
      parentId: item.parentId,
      transform: item.transform,
      appearance: item.source.appearance ?? defaultAppearance,
      meshIndex: item.meshIndex,
    });
  }
  const built = scene(target, metresZUpLocal, before.meshGroups.map((group) => group.mesh), before.meshGroups.map((group) => group.name));

  return {
    options,
    before,
    after: built,
    objectsA: objectTable(before.model.objects.map((record) => ({
      objectId: record.ref.objectId,
      name: record.name,
      category: record.category,
      transform: record.transform,
    }))),
    objectsB: objectTable(after.map((item) => ({
      objectId: item.objectId,
      name: item.name,
      category: item.category,
      transform: item.transform,
    }))),
    correspondences: table([
      ['id', stringColumn(proposals.map((item) => item.id))],
      ['aId', stringColumn(proposals.map((item) => item.aId))],
      ['aIdKnown', boolColumn(proposals.map((item) => item.aKnown))],
      ['bIds', stringColumn(proposals.map((item) => joinIds(item.bIds)))],
      ['candidateCount', i32Column(proposals.map((item) => item.bIds.length))],
      ['basis', stringColumn(proposals.map((item) => item.basis))],
      ['confidence', f64Column(proposals.map((item) => item.confidence))],
      ['confidenceKnown', boolColumn(proposals.map((item) => !Number.isNaN(item.confidence)))],
    ]),
    changeCounts: counts,
  };
}

// One snapshot's objects as a table: identity, what it is called, what it is, and where it sits.
// A name or a category nobody recorded is the empty string beside a `<field>Known` column.
function objectTable(
  items: readonly {
    readonly objectId: string;
    readonly name: string | undefined;
    readonly category: string | undefined;
    readonly transform: Matrix4;
  }[],
): Table {
  return table([
    ['objectId', stringColumn(items.map((item) => item.objectId))],
    ['name', stringColumn(items.map((item) => item.name ?? ''))],
    ['nameKnown', boolColumn(items.map((item) => item.name !== undefined))],
    ['category', stringColumn(items.map((item) => item.category ?? ''))],
    ['categoryKnown', boolColumn(items.map((item) => item.category !== undefined))],
    ['x', f64Column(items.map((item) => positionOf(item.transform)[0]))],
    ['y', f64Column(items.map((item) => positionOf(item.transform)[1]))],
    ['z', f64Column(items.map((item) => positionOf(item.transform)[2]))],
  ]);
}
