// A seeded building generator: storeys, rooms, walls, slabs, doors and windows, with the facts a
// room and door schedule reads and the gaps such a schedule has to show.
//
// The gaps are the point. A generator that produced a complete, consistent schedule would prove
// nothing, because the workflow this data exists for is exception review. So a documented share of
// doors has no recorded clear width, no fire rating, a fire rating that does not apply, or two
// sources that disagree, and a documented share of rooms has lost its storey link. Every rate is
// listed in the package README and is scaled by `gapScale`, which is 0 for a complete building.
//
// Everything is a function of `BuildingOptions` alone: the same options give byte-identical output
// on any engine, because the only source of variation is the package's own integer generator.
//
// The frame is metres, z up, local, which is the model package's `metresZUpLocal`. Storey
// elevation is the top of its slab.

import {
  boolColumn,
  conflicting,
  coverageOf,
  f64Column,
  fact,
  i32Column,
  identityMatrix,
  instanceRecords,
  known,
  metresZUpLocal,
  missing,
  multiplyMatrix,
  noMesh,
  objectRef,
  quantity,
  scaling,
  stringColumn,
  table,
  text,
  translation,
  triangleCount,
  type Appearance,
  type Coverage,
  type Evidence,
  type Fact,
  type Geometry,
  type InstanceRecord,
  type Matrix4,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
  type ObjectRef,
  type Observation,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import { elementAt as at } from './arrays.js';
import { cursor as newCursor, drawFloat, drawInt, drawPick, drawRange, type Cursor } from './cursor.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { box } from './primitives.js';
import { quantityColumns, textColumns, type NamedColumn } from './schedule.js';

// How much is recorded about the clear width of a door. Nominal width is always attempted.
export type DoorWidthPolicy = 'nominal-only' | 'nominal-and-clear' | 'mixed';

// What to generate. Every field is required, so the output is a function of this record alone.
// `gapScale` multiplies every rate at which a value is missing or disputed: 0 gives a complete
// building, 1 gives the documented rates, and above 1 the gaps grow until nothing is known.
export type BuildingOptions = {
  readonly seed: number;
  readonly storeys: number;
  readonly roomsPerStorey: number;
  readonly doorWidthPolicy: DoorWidthPolicy;
  readonly storeyHeight: number;
  readonly gapScale: number;
};

// A small, plausible building: three storeys of eight rooms with a mixed width policy.
export const defaultBuildingOptions: BuildingOptions = {
  seed: 1,
  storeys: 3,
  roomsPerStorey: 8,
  doorWidthPolicy: 'mixed',
  storeyHeight: 3.6,
  gapScale: 1,
};

// How complete the door schedule is, field by field. The counts sum to the number of doors.
export type DoorCoverage = {
  readonly nominalWidth: Coverage;
  readonly clearWidth: Coverage;
  readonly fireRating: Coverage;
};

// A generated building: the objects, the geometry that draws them, the facts observed about them
// and the two schedules read off those facts.
export type Building = {
  readonly options: BuildingOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly facts: readonly Fact[];
  readonly roomSchedule: Table;
  readonly doorSchedule: Table;
  readonly doorCoverage: DoorCoverage;
};

// Rejects options that cannot produce a building.
function checkOptions(options: BuildingOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.storeys) || options.storeys < 1) throw new Error(`storeys must be a positive integer, got ${options.storeys}`);
  if (!Number.isInteger(options.roomsPerStorey) || options.roomsPerStorey < 1) throw new Error(`roomsPerStorey must be a positive integer, got ${options.roomsPerStorey}`);
  if (!(options.storeyHeight > 0.5) || !Number.isFinite(options.storeyHeight)) throw new Error(`storeyHeight must be more than 0.5 metres, got ${options.storeyHeight}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// The thickness of a slab, and of an interior and an exterior wall, in metres.
const slabThickness = 0.25;
const interiorWallThickness = 0.12;
const exteriorWallThickness = 0.25;

// Door leaf height and thickness, and window sill height, in metres.
const doorHeight = 2.1;
const doorThickness = 0.05;
const sillHeight = 0.9;

// The leaf widths a door comes in, in millimetres. Each becomes its own mesh, so a door instance
// is a translation with no scale, which is how real repeated joinery behaves.
const doorLeafWidths = [762, 838, 926, 1000] as const;

// The window sizes, width then height, in metres.
const windowSizes = [
  [1.2, 1.5],
  [0.9, 1.2],
] as const;

// What a room is used for. The use decides whether a fire rating applies to its door.
const roomUses = ['Office', 'Meeting Room', 'Store', 'Plant Room', 'Lobby', 'WC', 'Laboratory'] as const;

// Uses whose doors open onto a protected route and so carry a fire rating. A door elsewhere, such
// as a WC cubicle door or an open lobby, has no rating to record, which is a fact about the door
// and not a gap in the data.
const unratedUses: readonly string[] = ['Lobby', 'WC'];

// The fire ratings a door type can carry.
const fireRatings = ['EI30', 'EI60', 'EI90'] as const;

// Rotates the horizontal plane a quarter turn about the up axis, for a leaf set into a wall that
// runs along y rather than along x. The model package has no rotation builder, so this is written
// out; it is the matrix, not a derivation.
const quarterTurnAboutUp: Matrix4 = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// The placement of a box mesh built at unit size: scale to the wanted size, then move it.
const placeScaled = (centre: Vec3, size: Vec3): Matrix4 => multiplyMatrix(translation(centre), scaling(size));

// The placement of a mesh already built at its true size, optionally turned to face along y.
const placeTurned = (centre: Vec3, alongY: boolean): Matrix4 =>
  multiplyMatrix(translation(centre), alongY ? quarterTurnAboutUp : identityMatrix);

// The appearance of each kind of element. Windows are translucent; rooms carry no geometry but
// keep a tint so a schedule can colour the room it selected.
const wallAppearance: Appearance = { color: [0.82, 0.8, 0.76], opacity: 1, visible: true };
const slabAppearance: Appearance = { color: [0.62, 0.62, 0.64], opacity: 1, visible: true };
const doorAppearance: Appearance = { color: [0.55, 0.38, 0.22], opacity: 1, visible: true };
const windowAppearance: Appearance = { color: [0.55, 0.72, 0.85], opacity: 0.35, visible: true };
const spaceAppearance: Appearance = { color: [0.35, 0.55, 0.75], opacity: 0.25, visible: true };

// One wall segment of a storey's grid.
type WallSegment = {
  readonly alongY: boolean;
  readonly centre: Vec3;
  readonly length: number;
  readonly exterior: boolean;
};

// The plan grid a storey repeats: the lines the walls sit on and the cells the rooms occupy.
type Grid = {
  readonly cols: number;
  readonly rows: number;
  readonly xLines: readonly number[];
  readonly yLines: readonly number[];
};

// Draws the plan grid once. Every storey repeats it, so walls stack and the building is plausible.
function drawGrid(cursor: Cursor, roomsPerStorey: number): Grid {
  const cols = Math.ceil(Math.sqrt(roomsPerStorey));
  const rows = Math.ceil(roomsPerStorey / cols);
  const lines = (count: number, low: number, high: number): readonly number[] => {
    const result = [0];
    for (let index = 0; index < count; index++) {
      const previous = at(result, index);
      result.push(previous + drawRange(cursor, low, high));
    }
    return result;
  };
  const xLines = lines(cols, 3.6, 7.2);
  const yLines = lines(rows, 3.0, 6.0);
  return { cols, rows, xLines, yLines };
}

// True when the cell holds a room. Cells past `roomsPerStorey` are outside the building.
const isRoomCell = (grid: Grid, roomsPerStorey: number, col: number, row: number): boolean =>
  col >= 0 && col < grid.cols && row >= 0 && row < grid.rows && row * grid.cols + col < roomsPerStorey;

// Every wall segment of one storey, in a fixed order: the ones running along y, then along x.
// A segment exists where a room is on at least one side; it is exterior where only one side is.
function wallsOfStorey(grid: Grid, roomsPerStorey: number, baseZ: number, height: number): readonly WallSegment[] {
  const centreZ = baseZ + height / 2;
  const segments: WallSegment[] = [];
  for (let col = 0; col <= grid.cols; col++) {
    for (let row = 0; row < grid.rows; row++) {
      const before = isRoomCell(grid, roomsPerStorey, col - 1, row);
      const after = isRoomCell(grid, roomsPerStorey, col, row);
      if (!before && !after) continue;
      const low = at(grid.yLines, row);
      const high = at(grid.yLines, row + 1);
      segments.push({
        alongY: true,
        centre: [at(grid.xLines, col), (low + high) / 2, centreZ],
        length: high - low,
        exterior: before !== after,
      });
    }
  }
  for (let row = 0; row <= grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const before = isRoomCell(grid, roomsPerStorey, col, row - 1);
      const after = isRoomCell(grid, roomsPerStorey, col, row);
      if (!before && !after) continue;
      const low = at(grid.xLines, col);
      const high = at(grid.xLines, col + 1);
      segments.push({
        alongY: false,
        centre: [(low + high) / 2, at(grid.yLines, row), centreZ],
        length: high - low,
        exterior: before !== after,
      });
    }
  }
  return segments;
}

// The evidence a door type record provides.
const typeEvidence = (typeId: string): Evidence => ({ source: 'door-type', reference: typeId });

// The evidence a site survey provides.
const surveyEvidence: Evidence = { source: 'site-survey', reference: 'SS-2026-03' };

// The evidence the fire strategy drawing provides.
const strategyEvidence: Evidence = { source: 'fire-strategy-drawing', reference: 'A-FS-101' };

// The evidence an opening measured off the wall provides.
const openingEvidence: Evidence = { source: 'wall-opening', reference: 'model-geometry' };

// What was generated for one door, before it becomes objects, facts and table rows.
type DoorPlan = {
  readonly objectId: string;
  readonly name: string | undefined;
  readonly storeyName: string;
  readonly roomId: string;
  readonly leafWidth: number;
  readonly meshIndex: number;
  readonly centre: Vec3;
  readonly alongY: boolean;
  readonly nominalWidth: Observation;
  readonly clearWidth: Observation;
  readonly fireRating: Observation;
};

// Draws what is known about a door's nominal width. Most are recorded from the door type; a few
// disagree with the opening measured off the wall, and a few were never recorded at all.
function drawNominalWidth(cursor: Cursor, leafWidth: number, typeId: string, gapScale: number): Observation {
  const roll = drawFloat(cursor);
  if (roll < 0.06 * gapScale) {
    return conflicting(
      [quantity(leafWidth, 'mm'), quantity(leafWidth + 50, 'mm')],
      [typeEvidence(typeId), openingEvidence],
    );
  }
  if (roll < 0.1 * gapScale) return missing('not-provided', [typeEvidence(typeId)]);
  return known(quantity(leafWidth, 'mm'), [typeEvidence(typeId)]);
}

// Draws what is known about a door's clear width. Clear width is a site measurement, so it is
// absent wherever nobody measured, and unresolvable wherever the nominal width itself is unknown.
function drawClearWidth(
  cursor: Cursor,
  nominal: Observation,
  leafWidth: number,
  policy: DoorWidthPolicy,
  gapScale: number,
): Observation {
  // The roll is drawn whatever the policy, so the sequence does not shift when the policy changes.
  const roll = drawFloat(cursor);
  // `nominal-only` is a policy rather than a gap: nobody surveys, so `gapScale` does not apply.
  if (policy === 'nominal-only') return missing('not-measured');
  if (nominal.kind !== 'known') return missing('unresolved-source', [surveyEvidence]);
  if (policy === 'mixed' && roll < 0.4 * gapScale) return missing('not-measured');
  // A leaf loses the frame stop and the open leaf's own thickness on the way through.
  return known(quantity(leafWidth - 60, 'mm'), [surveyEvidence]);
}

// Draws what is known about a door's fire rating. A door on an unrated partition has no rating to
// record, which is a different fact from one whose rating was never entered.
function drawFireRating(cursor: Cursor, rated: boolean, typeId: string, gapScale: number): Observation {
  if (!rated) return missing('not-applicable', [typeEvidence(typeId)]);
  const roll = drawFloat(cursor);
  const rating = drawPick(cursor, fireRatings);
  if (roll < 0.08 * gapScale) {
    return conflicting([text(rating), text('EI60')], [typeEvidence(typeId), strategyEvidence]);
  }
  if (roll < 0.2 * gapScale) return missing('not-provided', [typeEvidence(typeId)]);
  return known(text(rating), [typeEvidence(typeId), strategyEvidence]);
}

// Generates a building from its options. The same options always give the same building; different
// seeds give different room sizes, names, door widths and gaps.
export function generateBuilding(options: BuildingOptions): Building {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const gap = options.gapScale;
  const ref: ModelRef = { id: 'synthetic-building', revision: `seed-${options.seed}`, source: 'generated' };
  const idOf = (objectId: string): ObjectRef => objectRef(ref, objectId);

  const meshes: readonly ShadedMesh[] = [
    box([1, 1, 1]),
    box([1, 1, 1]),
    ...doorLeafWidths.map((width) => box([width / 1000, doorThickness, doorHeight])),
    ...windowSizes.map(([width, height]) => box([width, doorThickness, height])),
  ];
  const meshNames: readonly string[] = [
    'wall-panel',
    'floor-slab',
    ...doorLeafWidths.map((width) => `door-${width}`),
    ...windowSizes.map(([width, height]) => `window-${width}x${height}`),
  ];
  const wallMesh = 0;
  const slabMesh = 1;
  const firstDoorMesh = 2;
  const firstWindowMesh = firstDoorMesh + doorLeafWidths.length;

  const grid = drawGrid(cursor, options.roomsPerStorey);
  const wallHeight = options.storeyHeight - slabThickness;
  const extentX = at(grid.xLines, grid.cols);
  const extentY = at(grid.yLines, grid.rows);

  const records: ObjectRecord[] = [];
  const rows: InstanceRecord[] = [];
  const facts: Fact[] = [];
  const doors: DoorPlan[] = [];
  const roomRows: {
    readonly objectId: string;
    readonly name: string;
    readonly use: string;
    readonly storeyName: string;
    readonly area: number;
  }[] = [];

  // Adds one object and the instance row that places it, keeping the two in step.
  const emit = (
    record: Omit<ObjectRecord, 'ref' | 'transform'> & { readonly objectId: string; readonly transform: Matrix4 },
    meshIndex: number,
    appearance: Appearance,
  ): void => {
    const objectIndex = records.length;
    const { objectId, ...rest } = record;
    records.push({
      ...rest,
      ref: idOf(objectId),
      appearance,
      ...(meshIndex === noMesh ? {} : { representation: meshIndex }),
    });
    rows.push({
      meshIndex,
      transform: record.transform,
      color: appearance.color,
      opacity: appearance.opacity,
      objectIndex,
    });
  };

  for (let storey = 0; storey < options.storeys; storey++) {
    const elevation = storey * options.storeyHeight;
    const storeyId = `storey-${storey + 1}`;
    const storeyName = `Level ${storey + 1}`;
    emit({ objectId: storeyId, name: storeyName, category: 'Storey', transform: translation([0, 0, elevation]) }, noMesh, spaceAppearance);

    emit(
      {
        objectId: `slab-${storey + 1}`,
        name: `Floor slab ${storeyName}`,
        category: 'Slab',
        parentId: storeyId,
        transform: placeScaled([extentX / 2, extentY / 2, elevation - slabThickness / 2], [extentX, extentY, slabThickness]),
      },
      slabMesh,
      slabAppearance,
    );

    const segments = wallsOfStorey(grid, options.roomsPerStorey, elevation, wallHeight);
    segments.forEach((segment, index) => {
      const thickness = segment.exterior ? exteriorWallThickness : interiorWallThickness;
      const size: Vec3 = segment.alongY
        ? [thickness, segment.length, wallHeight]
        : [segment.length, thickness, wallHeight];
      emit(
        {
          objectId: `wall-${storey + 1}-${index + 1}`,
          name: `${segment.exterior ? 'External' : 'Internal'} wall ${storey + 1}.${index + 1}`,
          category: 'Wall',
          parentId: storeyId,
          transform: placeScaled(segment.centre, size),
        },
        wallMesh,
        wallAppearance,
      );
    });

    for (let cell = 0; cell < options.roomsPerStorey; cell++) {
      const col = cell % grid.cols;
      const row = Math.floor(cell / grid.cols);
      const lowX = at(grid.xLines, col);
      const highX = at(grid.xLines, col + 1);
      const lowY = at(grid.yLines, row);
      const highY = at(grid.yLines, row + 1);
      const use = drawPick(cursor, roomUses);
      const roomId = `room-${storey + 1}-${cell + 1}`;
      const named = drawFloat(cursor) >= 0.05 * gap;
      const roomName = `${use} ${storey + 1}.${String(cell + 1).padStart(2, '0')}`;
      const linked = drawFloat(cursor) >= 0.04 * gap;
      const area = (highX - lowX - interiorWallThickness) * (highY - lowY - interiorWallThickness);
      emit(
        {
          objectId: roomId,
          name: named ? roomName : undefined,
          category: 'Room',
          parentId: linked ? storeyId : undefined,
          transform: translation([(lowX + highX) / 2, (lowY + highY) / 2, elevation]),
        },
        noMesh,
        spaceAppearance,
      );
      roomRows.push({
        objectId: roomId,
        name: named ? roomName : '',
        use,
        storeyName: linked ? storeyName : '',
        area,
      });

      const rated = !unratedUses.includes(use);
      const doorCount = drawFloat(cursor) < 0.25 ? 2 : 1;
      for (let leaf = 0; leaf < doorCount; leaf++) {
        const widthIndex = drawInt(cursor, 0, doorLeafWidths.length);
        const leafWidth = at([...doorLeafWidths], widthIndex);
        const typeId = `DT-${String(leafWidth)}`;
        const alongY = leaf === 1;
        const centre: Vec3 = alongY
          ? [lowX, (lowY + highY) / 2 - 0.6, elevation + doorHeight / 2]
          : [(lowX + highX) / 2 + 0.4, lowY, elevation + doorHeight / 2];
        const nominalWidth = drawNominalWidth(cursor, leafWidth, typeId, gap);
        const clearWidth = drawClearWidth(cursor, nominalWidth, leafWidth, options.doorWidthPolicy, gap);
        const fireRating = drawFireRating(cursor, rated, typeId, gap);
        const doorId = `door-${storey + 1}-${cell + 1}-${leaf + 1}`;
        const doorNamed = drawFloat(cursor) >= 0.03 * gap;
        const doorName = `Door ${storey + 1}.${String(cell + 1).padStart(2, '0')}${leaf === 1 ? 'b' : 'a'}`;
        doors.push({
          objectId: doorId,
          name: doorNamed ? doorName : undefined,
          storeyName: linked ? storeyName : '',
          roomId,
          leafWidth,
          meshIndex: firstDoorMesh + widthIndex,
          centre,
          alongY,
          nominalWidth,
          clearWidth,
          fireRating,
        });
        emit(
          {
            objectId: doorId,
            name: doorNamed ? doorName : undefined,
            category: 'Door',
            parentId: roomId,
            transform: placeTurned(centre, alongY),
          },
          firstDoorMesh + widthIndex,
          doorAppearance,
        );
        const subject = idOf(doorId);
        facts.push(fact(subject, 'nominalWidth', nominalWidth));
        facts.push(fact(subject, 'clearWidth', clearWidth));
        facts.push(fact(subject, 'fireRating', fireRating));
      }
    }

    let windowIndex = 0;
    segments.forEach((segment) => {
      if (!segment.exterior) return;
      if (drawFloat(cursor) >= 0.65) return;
      const sizeIndex = drawInt(cursor, 0, windowSizes.length);
      const [, height] = at([...windowSizes], sizeIndex);
      windowIndex += 1;
      emit(
        {
          objectId: `window-${storey + 1}-${windowIndex}`,
          name: `Window ${storey + 1}.${windowIndex}`,
          category: 'Window',
          parentId: storeyId,
          transform: placeTurned([segment.centre[0], segment.centre[1], elevation + sillHeight + height / 2], segment.alongY),
        },
        firstWindowMesh + sizeIndex,
        windowAppearance,
      );
    });
  }

  const instances = instanceRecords(rows);
  const meshGroups: readonly MeshGroup[] = meshes.map((mesh, index) => ({
    name: at(meshNames, index),
    mesh,
    instanceCount: rows.filter((row) => row.meshIndex === index).length,
    triangleCount: triangleCount(mesh),
  }));
  const geometry: Geometry = { meshes, instances };
  const model: ModelData = { ref, coordinates: metresZUpLocal, objects: records };

  const roomSchedule = table([
    ['objectId', stringColumn(roomRows.map((room) => room.objectId))],
    ['name', stringColumn(roomRows.map((room) => room.name))],
    ['use', stringColumn(roomRows.map((room) => room.use))],
    ['storey', stringColumn(roomRows.map((room) => room.storeyName))],
    ['storeyKnown', boolColumn(roomRows.map((room) => room.storeyName !== ''))],
    ['areaM2', f64Column(roomRows.map((room) => room.area))],
    ['doorCount', i32Column(roomRows.map((room) => doors.filter((door) => door.roomId === room.objectId).length))],
  ]);

  const doorColumns: readonly NamedColumn[] = [
    ['objectId', stringColumn(doors.map((door) => door.objectId))],
    ['name', stringColumn(doors.map((door) => door.name ?? door.objectId))],
    ['nameKnown', boolColumn(doors.map((door) => door.name !== undefined))],
    ['storey', stringColumn(doors.map((door) => door.storeyName))],
    ['roomId', stringColumn(doors.map((door) => door.roomId))],
    ...quantityColumns('nominalWidth', doors.map((door) => door.nominalWidth)),
    ...quantityColumns('clearWidth', doors.map((door) => door.clearWidth)),
    ...textColumns('fireRating', doors.map((door) => door.fireRating)),
  ];

  return {
    options,
    model,
    meshGroups,
    geometry,
    facts,
    roomSchedule,
    doorSchedule: table(doorColumns),
    doorCoverage: {
      nominalWidth: coverageOf(doors.map((door) => door.nominalWidth)),
      clearWidth: coverageOf(doors.map((door) => door.clearWidth)),
      fireRating: coverageOf(doors.map((door) => door.fireRating)),
    },
  };
}
