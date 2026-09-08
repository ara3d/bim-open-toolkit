// Equipment assets, their service history and the points of interest a technician needs.
//
// The distinction this data exists for is "never tracked" against "tracked, nothing yet". Both
// show zero maintenance events, and a handover sheet that reported them the same way would be
// telling a facilities manager that an untracked asset is in good order. So the register of what
// is tracked is its own table, separate from the events themselves, and an asset with no events is
// only an exception when nobody was tracking it.
//
// Which assets fall in which case is structural, so every run exercises all of them.

import {
  boolColumn,
  conflicting,
  coverageOf,
  f64Column,
  fact,
  known,
  metresZUpLocal,
  missing,
  objectRef,
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
import { elementAt } from './arrays.js';
import { cursor as newCursor, drawInt, drawRange, type Cursor } from './cursor.js';
import { addDays, type IsoDate } from './dates.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';
import { box } from './primitives.js';
import { add, scene, sceneBuilder } from './scene.js';
import { textColumns, type NamedColumn } from './schedule.js';

// What to generate.
export type AssetOptions = {
  readonly seed: number;
  readonly assets: number;
  readonly commissioningDate: IsoDate;
  readonly gapScale: number;
};

// A dozen assets commissioned over the year before handover.
export const defaultAssetOptions: AssetOptions = {
  seed: 17,
  assets: 12,
  commissioningDate: '2025-03-01',
  gapScale: 1,
};

// A generated handover pack: the assets, what was done to them, whether anybody was keeping track,
// and the places a technician has to reach.
export type Assets = {
  readonly options: AssetOptions;
  readonly model: ModelData;
  readonly meshGroups: readonly MeshGroup[];
  readonly geometry: Geometry;
  readonly facts: readonly Fact[];
  readonly assets: Table;
  readonly maintenanceEvents: Table;
  readonly serviceHistoryStatus: Table;
  readonly pointsOfInterest: Table;
  readonly installDateCoverage: Coverage;
};

// Rejects options that cannot produce a handover pack. Five assets are needed because the first
// five carry the cases the handover has to tell apart.
function checkOptions(options: AssetOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.assets) || options.assets < 5) throw new Error(`assets must be an integer of at least 5, got ${options.assets}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// What an asset is, and how big its enclosure is in metres.
type AssetType = { readonly category: string; readonly size: Vec3 };

// The asset types, in the order assets are assigned to them.
const assetTypes: readonly AssetType[] = [
  { category: 'Pump', size: [1.1, 0.8, 1.2] },
  { category: 'Air handling unit', size: [3.2, 1.8, 2.1] },
  { category: 'Chiller', size: [2.6, 1.6, 1.9] },
  { category: 'Distribution panel', size: [0.9, 0.4, 1.9] },
];

// The places a technician has to reach on an asset.
const interestKinds: readonly string[] = ['Filter access', 'Isolator', 'Drain point', 'Nameplate'];

// What a service visit was for.
const serviceNotes: readonly string[] = [
  'Routine service, no defects',
  'Filter replaced',
  'Bearing noise investigated',
  'Belt tension adjusted',
  'Commissioning check',
];

// The evidence the commissioning record provides.
const commissioningEvidence: Evidence = { source: 'commissioning-record', reference: 'CX-2025' };

// The evidence the operations and maintenance manual provides.
const manualEvidence: Evidence = { source: 'om-manual', reference: 'OM-2026-01' };

// One asset, before it becomes a record and a row.
type Asset = {
  readonly objectId: string;
  readonly name: string;
  readonly category: string;
  readonly size: Vec3;
  readonly position: Vec3;
  readonly installDate: Observation;
  readonly tracked: boolean;
  readonly events: number;
};

// One recorded service visit. A recorded event always has a date: the row only exists because
// somebody wrote it down.
type ServiceEvent = { readonly id: string; readonly assetId: string; readonly date: IsoDate; readonly note: string };

// One place on an asset a technician has to reach.
type PointOfInterest = {
  readonly id: string;
  readonly assetId: string;
  readonly name: string;
  readonly note: string;
  readonly position: Vec3;
};

// The appearance of an asset enclosure.
const assetAppearance: Appearance = { color: [0.55, 0.6, 0.66], opacity: 1, visible: true };

// The case each of the first five assets carries. Everything after them is tracked with a drawn
// number of visits and a known install date, so the cases a handover must tell apart are present
// whatever the seed and however many assets are asked for.
type AssetCase = { readonly tracked: boolean; readonly events: number; readonly install: string };
const leadingCases: readonly AssetCase[] = [
  { tracked: true, events: 3, install: 'known' },
  { tracked: true, events: 0, install: 'known' },
  { tracked: false, events: 0, install: 'known' },
  { tracked: true, events: 2, install: 'missing' },
  { tracked: true, events: 1, install: 'conflicting' },
];

// What is known about an install date: recorded, never recorded, or disputed between the
// commissioning record and the manual.
function installDateOf(state: string, date: IsoDate): Observation {
  if (state === 'missing') return missing('not-provided', [manualEvidence]);
  if (state === 'conflicting') {
    return conflicting([text(date), text(addDays(date, 21))], [commissioningEvidence, manualEvidence]);
  }
  return known(text(date), [commissioningEvidence]);
}

// Generates a handover pack from its options. The same options always give the same pack.
export function generateAssets(options: AssetOptions): Assets {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const ref: ModelRef = { id: 'synthetic-assets', revision: `seed-${options.seed}`, source: 'generated' };
  const meshes: readonly ShadedMesh[] = assetTypes.map((type) => box(type.size));
  const meshNames: readonly string[] = assetTypes.map((type) => `asset-${type.category.toLowerCase().replace(/ /g, '-')}`);

  const assets: Asset[] = [];
  const events: ServiceEvent[] = [];
  const points: PointOfInterest[] = [];
  const columns = Math.ceil(Math.sqrt(options.assets));

  for (let index = 0; index < options.assets; index++) {
    const type = elementAt(assetTypes, index % assetTypes.length);
    const commissioned = addDays(options.commissioningDate, drawInt(cursor, 0, 120));
    const drawnEvents = drawInt(cursor, 0, 5);
    const drawn: AssetCase = { tracked: true, events: drawnEvents, install: 'known' };
    const state = options.gapScale === 0 ? drawn : leadingCases[index] ?? drawn;
    const position: Vec3 = [(index % columns) * 6, Math.floor(index / columns) * 6, type.size[2] / 2];
    const objectId = `asset-${index + 1}`;
    assets.push({
      objectId,
      name: `${type.category} ${String(index + 1).padStart(2, '0')}`,
      category: type.category,
      size: type.size,
      position,
      installDate: installDateOf(state.install, commissioned),
      tracked: state.tracked,
      events: state.events,
    });

    for (let visit = 0; visit < state.events; visit++) {
      events.push({
        id: `svc-${events.length + 1}`,
        assetId: objectId,
        date: addDays(commissioned, 120 + visit * 180 + drawInt(cursor, 0, 30)),
        note: elementAt(serviceNotes, (index + visit) % serviceNotes.length),
      });
    }

    const interests = drawInt(cursor, 1, 3);
    for (let point = 0; point < interests; point++) {
      const kind = elementAt(interestKinds, (index + point) % interestKinds.length);
      points.push({
        id: `poi-${points.length + 1}`,
        assetId: objectId,
        name: kind,
        note: `${kind} for ${type.category.toLowerCase()} ${String(index + 1)}`,
        position: [
          position[0] + drawRange(cursor, -type.size[0] / 2, type.size[0] / 2),
          position[1] + type.size[1] / 2,
          position[2] + drawRange(cursor, -type.size[2] / 4, type.size[2] / 4),
        ],
      });
    }
  }

  const target = sceneBuilder(ref);
  for (const asset of assets) {
    add(target, {
      objectId: asset.objectId,
      name: asset.name,
      category: asset.category,
      transform: translation(asset.position),
      appearance: assetAppearance,
      meshIndex: assetTypes.findIndex((type) => type.category === asset.category),
    });
  }
  const built = scene(target, metresZUpLocal, meshes, meshNames);

  const assetColumns: readonly NamedColumn[] = [
    ['objectId', stringColumn(assets.map((asset) => asset.objectId))],
    ['name', stringColumn(assets.map((asset) => asset.name))],
    ['category', stringColumn(assets.map((asset) => asset.category))],
    ...textColumns('installDate', assets.map((asset) => asset.installDate)),
  ];

  return {
    options,
    model: built.model,
    meshGroups: built.meshGroups,
    geometry: built.geometry,
    facts: assets.map((asset) => fact(objectRef(ref, asset.objectId), 'installDate', asset.installDate)),
    assets: table(assetColumns),
    maintenanceEvents: table([
      ['id', stringColumn(events.map((event) => event.id))],
      ['assetId', stringColumn(events.map((event) => event.assetId))],
      ['date', stringColumn(events.map((event) => event.date))],
      ['note', stringColumn(events.map((event) => event.note))],
    ]),
    serviceHistoryStatus: table([
      ['assetId', stringColumn(assets.map((asset) => asset.objectId))],
      ['status', stringColumn(assets.map((asset) => (asset.tracked ? 'recorded' : 'not-recorded')))],
      ['tracked', boolColumn(assets.map((asset) => asset.tracked))],
    ]),
    pointsOfInterest: table([
      ['id', stringColumn(points.map((point) => point.id))],
      ['assetId', stringColumn(points.map((point) => point.assetId))],
      ['name', stringColumn(points.map((point) => point.name))],
      ['note', stringColumn(points.map((point) => point.note))],
      ['x', f64Column(points.map((point) => point.position[0]))],
      ['y', f64Column(points.map((point) => point.position[1]))],
      ['z', f64Column(points.map((point) => point.position[2]))],
    ]),
    installDateCoverage: coverageOf(assets.map((asset) => asset.installDate)),
  };
}
